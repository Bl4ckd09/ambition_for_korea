"""End-to-end with fake Claude and judge: checks wiring and that the output matches the frontend schema."""
import json
import pathlib
import re

from conftest import FakeJudge
from counsel_deid import config, pipeline
from counsel_deid.deid import presidio_stage, rewrite, sheet as sheet_mod

ROOT = pathlib.Path(__file__).resolve().parents[1]
FRONTEND_SAMPLE = ROOT.parent / "data" / "examples.jsonl"

SHEET = {"retained": {"sex": "Male", "age_band": "over 90", "state": "withheld", "occupation_category": "Retired",
                      "living_situation": "lives alone"},
         "allowed_inferences": ["widowed", "over 90"], "surrogates": [{"refers_to": "client", "use": "Mr. Walker"}],
         "generalize": [{"risk": "named business", "rewrite_as": "a small restaurant"}], "keep_exact": [], "remove": []}


class FakeClaude:
    def __init__(self):
        self.users = []

    def __call__(self, system, user, schema):
        self.users.append(user)
        if system == sheet_mod.SYSTEM:
            return SHEET
        window = json.loads(user.split("CURRENT WINDOW:\n", 1)[1])["turns"]
        return {"turns": [{"role": t["role"], "text": re.sub(r"<[A-Z_]+>", "someone", t["text"])} for t in window]}


def keys(obj, prefix=""):
    if isinstance(obj, dict):
        out = set()
        for k, v in obj.items():
            out |= {f"{prefix}{k}"} | keys(v, f"{prefix}{k}.")
        return out
    if isinstance(obj, list) and obj and isinstance(obj[0], dict):
        return keys(obj[0], f"{prefix}[].")
    return set()


def test_pipeline_output_matches_frontend_schema(monkeypatch):
    monkeypatch.setattr(presidio_stage, "deidentify", lambda turns: ([[r, t.replace("Halvorsen", "<PERSON>")] for r, t in turns],
                                                                       [{"entity": "PERSON", "original": "Halvorsen"}]))
    sessions = json.loads((ROOT / "data/sessions.json").read_text())
    s3 = next(s for s in sessions if s["id"] == "S3")
    intake = json.loads((ROOT / "data/intake.json").read_text())["S3"]
    persona = json.loads((ROOT / "data/true_personas.json").read_text())["S3"]
    claude = FakeClaude()
    doc = pipeline.run_session(s3, intake, persona, claude, FakeJudge(), config.Settings())

    # The rewrite never sees the original: only the sheet call gets the intake table and raw names.
    rewrite_calls = [u for u in claude.users if "CURRENT WINDOW" in u]
    assert rewrite_calls and all("Halvorsen" not in u and "1932-08-14" not in u for u in rewrite_calls)
    assert len(doc["transcript"]["final"]) == len(s3["turns"])
    assert doc["evaluation"]["summary"]["safe_harbor_passed"]["final"]["total"] == 8

    if FRONTEND_SAMPLE.exists():
        # Compare with the same session: some maps (risk terms, scores) are keyed by what the transcript contains.
        sample = next(d for d in map(json.loads, FRONTEND_SAMPLE.read_text().splitlines()) if d["id"] == "S3")
        assert keys(doc) - keys(sample) == set()
        assert keys(sample) - keys(doc) == set()


def test_without_gold_questions_come_from_the_sheet():
    mosaic, clinical = pipeline.questions({"id": "X", "turns": []}, {**SHEET, "keep_exact": ["PHQ-9 17"]})
    assert mosaic == [{"id": "Q1", "desc": "named business"}]
    assert clinical == [{"id": "C1", "fact": "PHQ-9 17"}]


def test_sheet_leak_check_scrubs_known_identifiers():
    leaked = sheet_mod.leak_check({"note": "ran the Lakeside Diner in Duluth"}, ["Duluth", "Lakeside Diner"])
    assert {"Duluth", "Lakeside Diner"} <= set(leaked)
    assert "Duluth" not in json.dumps(sheet_mod.scrub({"note": "in Duluth"}, ["Duluth"]))
