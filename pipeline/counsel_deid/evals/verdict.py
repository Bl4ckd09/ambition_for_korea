"""HIPAA Safe Harbor item verdicts from rules + LLM judge (+ gold labels when testing).

45 CFR 164.514(b)(2)(i). Photo, biometric, vehicle and device items are omitted because
they cannot occur in a text transcript. Decision: a gold identifier left, or rule and
judge both flagging, fails the item; exactly one of them flagging sends it to human review.
"""
SAFE_HARBOR = [
    {"code": "A", "label": "이름", "gold": ["NAME"], "rules": [], "axes": []},
    {"code": "B", "label": "주보다 작은 지역 단위", "gold": ["ADDRESS", "CITY"], "rules": ["R_CITY", "R_STREET", "R_ZIP"], "axes": ["G_GEO"]},
    {"code": "C", "label": "연도 외 날짜 요소, 89세 초과 나이", "gold": ["DATE", "AGE_90PLUS"],
     "rules": ["R_DATE_NUMERIC", "R_DATE_MONTH_DAY", "R_DATE_DAY_MONTH", "R_AGE_90PLUS"], "axes": ["G_DATE", "G_AGE90"]},
    {"code": "D-F", "label": "전화, 팩스, 이메일", "gold": ["PHONE", "PHONE_SPOKEN", "EMAIL"],
     "rules": ["R_PHONE", "R_SPOKEN_DIGITS", "R_EMAIL"], "axes": ["G_NUM"]},
    {"code": "G", "label": "사회보장번호", "gold": ["SSN"], "rules": ["R_SSN"], "axes": ["G_NUM"]},
    {"code": "H-K", "label": "의료기록, 보험, 계좌, 자격 번호", "gold": ["MRN", "VA_CLAIM"], "rules": ["R_LONG_NUMBER"], "axes": ["G_NUM"]},
    {"code": "N-O", "label": "URL, IP, SNS 핸들", "gold": ["HANDLE"], "rules": ["R_URL", "R_IP", "R_HANDLE"], "axes": []},
    {"code": "R", "label": "그 밖의 고유 식별 특성", "gold": ["EMPLOYER", "SCHOOL"], "rules": ["R_ORG"], "axes": ["G_ORG"], "mosaic": True},
]
THRESHOLD = 0.5


def item_verdict(item, rule_hits, window_agg, mosaic_probs, gold_left_types=()):
    hits = sorted({h["match"] for h in rule_hits if h["rule"] in item["rules"]})
    llm = max((window_agg.get(a, 0.0) for a in item["axes"]), default=None)
    mosaic = max(mosaic_probs.values(), default=0.0) if item.get("mosaic") else None
    gold_left = sorted(t for t in item["gold"] if t in set(gold_left_types))
    rule_flag = bool(hits)
    llm_flag = (llm is not None and llm >= THRESHOLD) or (mosaic is not None and mosaic >= THRESHOLD)
    status = "fail" if gold_left or (rule_flag and llm_flag) else ("review" if rule_flag or llm_flag else "pass")
    return {"status": status, "rule_hits": hits, "llm_probability": None if llm is None else round(llm, 2),
            "mosaic_probability": None if mosaic is None else round(mosaic, 2), "test_label_left": gold_left}
