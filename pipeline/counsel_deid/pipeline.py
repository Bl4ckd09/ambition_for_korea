"""End-to-end run for one session: de-identify, evaluate every stage, and build the page document.

The document schema is what the frontend reads from data/examples.jsonl. Stage keys:
original, stage1 (Presidio), final (Presidio + sheet-guided Claude rewrite).
Gold labels are optional: without them, mosaic and clinical questions come from the
sheet and the test-label columns stay empty, so the same code runs on real data.
"""
import statistics

from .deid import presidio_stage, rewrite, sheet as sheet_mod
from .evals import judge as judge_mod, lineup, rules, verdict
from .personas import load_pool

STAGES = ("original", "stage1", "final")
LINEUP_STAGES = ("control",) + STAGES
MODES = {
    "random": ("무작위 미끼", "남긴 통계(성별, 나이대, 직업)만으로 특정되는 정도. 비식별을 잘해도 높게 남는 상한선"),
    "matched": ("인적사항 유사 미끼", "남긴 통계가 같은 사람들 사이에서 추가로 새는 정도. 비식별 품질 지표"),
    "implied": ("추론 속성까지 맞춘 미끼", "임상 내용에서 드러나도 되는 속성(사별, 90세 이상 등)까지 같은 미끼"),
}
PIPELINE_TEXT = {
    "stage1": "Microsoft Presidio 기본 설정 (정규식과 spaCy NER, 찾은 값을 <유형> 태그로 치환)",
    "final": "Claude: 원문과 접수 정보로 비식별 시트 1회 생성, 공개 시트만 들고 8턴 구간씩 재작성",
    "evaluation": "룰 검사 + 판단 모델(Jev) 확률 판정(구간 단위와 세션 단위) + 페르소나 대조",
}


def deidentify(session, intake, claude, window=8):
    original = session["turns"]
    stage1, presidio_log = presidio_stage.deidentify(original)
    sheet, scrubbed = sheet_mod.build(claude, original, intake, presidio_log)
    final = rewrite.rewrite(claude, stage1, sheet, window=window)
    return {"original": original, "stage1": stage1, "final": final}, sheet, scrubbed


def questions(session, sheet):
    gold = session.get("gold")
    if gold:
        return gold["quasi"], gold["clinical"]
    mosaic = [{"id": f"Q{i + 1}", "desc": g["risk"]} for i, g in enumerate(sheet.get("generalize", []))]
    clinical = [{"id": f"C{i + 1}", "fact": f} for i, f in enumerate(sheet.get("keep_exact", []))]
    return mosaic, clinical


def evaluate(session, stages, sheet, true_persona, judge, window=8, seeds=(1, 2, 3), pool=None):
    pool = pool or load_pool()
    mosaic, clinical = questions(session, sheet)
    gold_direct = (session.get("gold") or {}).get("direct", [])
    ev = {}
    for st in STAGES:
        turns = stages[st]
        ev[st] = {
            "rules": rules.evaluate(stages["original"], turns),
            "window": judge_mod.window_judge(judge, turns, clinical, window=window),
            "session": judge_mod.session_judge(judge, turns, mosaic),
            "faith": judge_mod.faithfulness(judge, stages["original"], turns) if st != "original" else {},
            "leaks": [g["text"] for g in judge_mod.direct_leaks(turns, gold_direct)],
        }
    lineups = {}
    for mode in MODES:
        runs = []
        for seed in seeds:
            cards = lineup.build(true_persona, pool, mode=mode, seed=seed, allowed_inferences=sheet.get("allowed_inferences"))
            res = {st: lineup.attack(judge, lineup.NO_TRANSCRIPT if st == "control" else judge_mod.render(stages[st]), cards)
                   for st in LINEUP_STAGES}
            runs.append({"cards": cards, "results": res})
        lineups[mode] = runs
    return {"ev": ev, "lineups": lineups, "mosaic": mosaic, "clinical": clinical, "gold_direct": gold_direct}


def _turns(ts):
    return [{"speaker": "치료자" if r == "T" else "내담자", "role": r, "text": t} for r, t in ts]


def document(session, stages, sheet, result):
    ev, lineups, mosaic, clinical, gold_direct = (result[k] for k in ("ev", "lineups", "mosaic", "clinical", "gold_direct"))
    per = lambda fn, sts=STAGES: {s: fn(s) for s in sts}
    mean = lambda xs: round(statistics.mean(xs), 3) if xs else None
    p_true = lambda mode, st: mean([run["results"][st]["p_true"] for run in lineups[mode]])

    sh = []
    for item in verdict.SAFE_HARBOR:
        sh.append({"code": item["code"], "label": item["label"], "result": per(lambda s: verdict.item_verdict(
            item, ev[s]["rules"]["identifier_hits"], ev[s]["window"]["aggregate"],
            {q["id"]: ev[s]["session"].get(q["id"], 0.0) for q in mosaic},
            {g["type"] for g in gold_direct if g["text"] in ev[s]["leaks"]}))})

    first = lineups["matched"][0]
    return {
        "id": session["id"], "title": session.get("title", session["id"]), "topics": session.get("topics", ""),
        "synthetic": True, "note": "모든 인물, 번호, 장소는 테스트용으로 지어낸 값입니다.",
        "pipeline": PIPELINE_TEXT,
        "transcript": per(lambda s: _turns(stages[s])),
        "highlights": {"original_identifiers": [{"text": g["text"], "type": g["type"]} for g in gold_direct],
                       "stage1_left": ev["stage1"]["leaks"], "final_left": ev["final"]["leaks"]},
        "deid_sheet": sheet,
        "evaluation": {
            "summary": {
                "direct_identifiers_left": per(lambda s: {"left": len(ev[s]["leaks"]), "total": len(gold_direct)}),
                "mosaic_exposure": per(lambda s: round(statistics.mean(ev[s]["session"][q["id"]] for q in mosaic), 2) if mosaic else None),
                "clinical_retention": per(lambda s: round(statistics.mean(ev[s]["window"]["aggregate"][c["id"]] for c in clinical), 2) if clinical else None),
                "reidentification_probability": per(lambda s: p_true("matched", s)),
                "chance": 0.1,
                "safe_harbor_passed": per(lambda s: {"passed": sum(x["result"][s]["status"] == "pass" for x in sh), "total": len(sh)}),
            },
            "safe_harbor": sh,
            "mosaic": [{"id": q["id"], "description": q["desc"], "probability": per(lambda s, q=q: round(ev[s]["session"][q["id"]], 2))} for q in mosaic],
            "clinical": [{"id": c["id"], "fact": c["fact"], "probability": per(lambda s, c=c: round(ev[s]["window"]["aggregate"][c["id"]], 2))} for c in clinical],
            "quality": {
                "natural_conversation": per(lambda s: ev[s]["session"]["G_NATURAL"]),
                "clinical_facts_added": per(lambda s: ev[s]["faith"]["F_ADDED"], ("stage1", "final")),
                "risk_changed": per(lambda s: ev[s]["faith"]["F_DISTORT"], ("stage1", "final")),
            },
            "rule_checks": per(lambda s: {
                "risk_terms_kept": ev[s]["rules"]["risk_terms_kept"],
                "scores_and_doses_kept": ev[s]["rules"]["clinical_numbers_kept"],
                "tags_left": sum(1 for h in ev[s]["rules"]["identifier_hits"] if h["rule"] == "R_TAG_LEFT"),
                "turn_structure_kept": ev[s]["rules"]["same_turn_count"] and ev[s]["rules"]["same_speakers"],
            }),
            "lineup": {
                "chance": 0.1, "card_fields": lineup.FIELDS,
                "modes": {m: {"label": label, "meaning": meaning, "p_true": {st: p_true(m, st) for st in LINEUP_STAGES}}
                          for m, (label, meaning) in MODES.items()},
                "cards": [{**c, "probability": {st: round(first["results"][st]["probs"].get(c["label"], 0.0), 3) for st in LINEUP_STAGES}}
                          for c in first["cards"]],
            },
        },
    }


def run_session(session, intake, true_persona, claude, judge, settings, pool=None):
    stages, sheet, _scrubbed = deidentify(session, intake, claude, window=settings.window_turns)
    result = evaluate(session, stages, sheet, true_persona, judge, window=settings.window_turns,
                      seeds=settings.lineup_seeds, pool=pool)
    return document(session, stages, sheet, result)
