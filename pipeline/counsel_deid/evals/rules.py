"""Rule-based evaluation that needs no gold labels, so it also runs on real data.

Hard gate: any hit on an identifier rule fails the transcript regardless of the
LLM judge. Clinical rules compare the output against the original to catch lost
doses, scores and risk terms. City names come from the Nemotron decoy pool, so the
gazetteer is independent of the test sessions.
"""
import re

from ..personas import load_pool


MONTHS = ("January|February|March|April|May|June|July|August|September|October|November|December|"
          "Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sept?|Oct|Nov|Dec")
DIGIT_WORDS = "zero|oh|one|two|three|four|five|six|seven|eight|nine"
STREET = r"(?:Street|St|Avenue|Ave|Road|Rd|Lane|Ln|Drive|Boulevard|Blvd|Highway|Hwy)"
ORG = (r"(?:Medical Center|Hospital|Clinic|High School|Middle School|Elementary|University|College|"
       r"Diner|Restaurant|Cafe|Church|Inc|LLC|Corp)")

# Each rule: (id, HIPAA Safe Harbor item it supports, regex)
ID_RULES = [
    ("R_SSN", "G", re.compile(r"\b\d{3}-\d{2}-\d{4}\b")),
    ("R_PHONE", "D", re.compile(r"(?:\+1[\s.-]?)?\(?\b\d{3}\)?[\s.-]?\d{3}[\s.-]\d{4}\b")),
    ("R_SPOKEN_DIGITS", "D", re.compile(rf"\b(?:(?:{DIGIT_WORDS})[\s,.-]+){{6,}}(?:{DIGIT_WORDS})\b", re.I)),
    ("R_EMAIL", "F", re.compile(r"[\w.+-]+@[\w-]+\.[a-z]{2,}", re.I)),
    ("R_URL", "N", re.compile(r"https?://\S+|www\.\S+", re.I)),
    ("R_IP", "O", re.compile(r"\b\d{1,3}(?:\.\d{1,3}){3}\b")),
    ("R_HANDLE", "R", re.compile(r"(?<![\w.])@[A-Za-z0-9_.]{2,}")),
    ("R_ZIP", "B", re.compile(r"\b\d{5}(?:-\d{4})?\b")),
    ("R_LONG_NUMBER", "H-K", re.compile(r"\b\d(?:[\s-]?\d){5,}\b")),
    ("R_DATE_NUMERIC", "C", re.compile(r"\b\d{1,2}/\d{1,2}/\d{2,4}\b")),
    ("R_DATE_MONTH_DAY", "C", re.compile(rf"\b(?:{MONTHS})\.?\s+\d{{1,2}}(?:st|nd|rd|th)?\b")),
    ("R_DATE_DAY_MONTH", "C", re.compile(rf"\b\d{{1,2}}(?:st|nd|rd|th)?\s+of\s+(?:{MONTHS})\b")),
    ("R_STREET", "B", re.compile(rf"\b(?:\d{{1,6}}\s+)?(?:[A-Z][a-z]+\s){{1,3}}{STREET}\b")),
    ("R_ORG", "R", re.compile(rf"\b(?:St\.\s)?(?:[A-Z][\w']+\s){{1,4}}{ORG}\b")),
    ("R_TAG_LEFT", "-", re.compile(r"<[A-Z_]{3,}>")),
]
# Soft: months alone are a Safe Harbor date element but often appear in harmless speech.
SOFT_RULES = [("R_MONTH_ONLY", "C", re.compile(rf"\b(?:{MONTHS[:MONTHS.index('|Jan')]})\b"))]

AGE_RE = re.compile(r"\b(?:I'm|I am|aged?|turned|is|was)\s+(\d{2,3})\b|\b(\d{2,3})[- ]years?[- ]old\b")

RISK_TERMS = {
    "suicidal ideation": r"suicid|kill (?:my|him|her)self|not (?:wanting|want) to be alive|wouldn't wake up|rather be with",
    "self-harm": r"\bcutting\b|self[- ]harm|hurt (?:my|your)self",
    "firearm": r"\bguns?\b|pistol|rifle|firearm",
    "medication access": r"\bmeds\b|medication|pills",
    "alcohol": r"\bwine\b|\bbottle\b|drink",
    "eating": r"\bmeal\b|barely eat|appetite|eating",
    "crisis line": r"\b988\b|crisis line",
}
# (pattern capturing the clinical number, label) - the number is matched alone so the
# "9" in "PHQ-9" or "7" in "GAD-7" is never mistaken for part of the score.
CLINICAL_NUMBER_PATTERNS = [
    (re.compile(r"\b(\d+)\s?(?:mg|milligrams)\b", re.I), "dose"),
    (re.compile(r"PHQ-9\b[^.\d]{0,30}?\b(\d{1,2})\b", re.I), "PHQ-9"),
    (re.compile(r"GAD-7\b[^.\d]{0,30}?\b(\d{1,2})\b", re.I), "GAD-7"),
]


def _load_cities():
    names = {r["city"] for r in load_pool() if r.get("city")}
    # Single short words collide with common nouns and surnames; keep multi-word or 6+ letter names.
    return sorted({c for c in names if " " in c or len(c) >= 6}, key=len, reverse=True)


_CITY_RE = None


def city_re():
    global _CITY_RE
    if _CITY_RE is None:
        _CITY_RE = re.compile(r"\b(?:" + "|".join(re.escape(c) for c in _load_cities()) + r")\b")
    return _CITY_RE


def text_of(turns):
    return "\n".join(t for _, t in turns)


def identifier_hits(turns):
    text = text_of(turns)
    hits = []
    for rid, item, rx in ID_RULES:
        hits += [{"rule": rid, "item": item, "match": m.group(0)} for m in rx.finditer(text)]
    for m in city_re().finditer(text):
        hits.append({"rule": "R_CITY", "item": "B", "match": m.group(0)})
    for m in AGE_RE.finditer(text):
        age = int(m.group(1) or m.group(2))
        if age >= 90:
            hits.append({"rule": "R_AGE_90PLUS", "item": "C", "match": m.group(0)})
    soft = [{"rule": rid, "item": item, "match": m.group(0)}
            for rid, item, rx in SOFT_RULES for m in rx.finditer(text)]
    return hits, soft


def clinical_checks(original_turns, turns):
    orig, out = text_of(original_turns), text_of(turns)
    risk = {}
    for name, pat in RISK_TERMS.items():
        if re.search(pat, orig, re.I):
            risk[name] = bool(re.search(pat, out, re.I))
    kept_nums = {}
    for rx, label in CLINICAL_NUMBER_PATTERNS:
        out_vals = {m.group(1) for m in rx.finditer(out)}
        for m in rx.finditer(orig):
            kept_nums[f"{label} {m.group(1)}"] = m.group(1) in out_vals
    return {"risk_terms_kept": risk, "clinical_numbers_kept": kept_nums}


def structure_checks(original_turns, turns):
    return {"same_turn_count": len(original_turns) == len(turns),
            "same_speakers": [s for s, _ in original_turns] == [s for s, _ in turns],
            "length_ratio": round(len(text_of(turns)) / max(1, len(text_of(original_turns))), 2)}


def evaluate(original_turns, turns):
    hits, soft = identifier_hits(turns)
    return {"identifier_hits": hits, "soft_hits": soft, **clinical_checks(original_turns, turns),
            **structure_checks(original_turns, turns)}
