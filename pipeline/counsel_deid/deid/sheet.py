"""De-identification sheet: a per-session plan built once from the original and the intake table.

This is the only model call that sees the original text. Only the public sheet goes to
the rewrite calls, and it is checked mechanically for identifiers before use.
"""
import json
import re

from ..evals import rules

SYSTEM = """You prepare a de-identification plan for one psychotherapy session that will become US AI training data under HIPAA Safe Harbor plus mosaic-risk control.
You receive the ORIGINAL transcript and the client's INTAKE table. Decide, from the true facts, what the de-identified version should keep and how it should generalize.
Every value you write must be safe to show a stranger: never include a real name, city, street, school, employer, exact date, ID number, handle, or exact age 90 or older.
Do not add facts that are not in the transcript; the intake table is only for computing generalized values such as an age band.
- retained: what the rewrite keeps. age_band is a decade band such as 30-39, or "over 90". state is the US state only if it does not combine with other details to single the client out, else "withheld".
- allowed_inferences: attributes a reader may legitimately infer from the retained clinical content, e.g. "widowed", "lives alone", "minor".
- surrogates: for each person mentioned, a generic surrogate first name or a role phrase.
- generalize: each identifying kind of detail, described generically, and the generic phrasing that keeps its clinical meaning.
- keep_exact: clinical facts that must stay verbatim (assessment scores, medication names and doses, substance amounts, frequencies).
- remove: kinds of detail to drop entirely, described generically."""

_STR = {"type": "string"}
_LIST = {"type": "array", "items": _STR}
SCHEMA = {
    "type": "object",
    "properties": {
        "retained": {
            "type": "object",
            "properties": {k: _STR for k in ("sex", "age_band", "state", "occupation_category", "living_situation")},
            "required": ["sex", "age_band", "state", "occupation_category", "living_situation"],
            "additionalProperties": False,
        },
        "allowed_inferences": _LIST,
        "surrogates": {"type": "array", "items": {"type": "object", "properties": {"refers_to": _STR, "use": _STR},
                                                   "required": ["refers_to", "use"], "additionalProperties": False}},
        "generalize": {"type": "array", "items": {"type": "object", "properties": {"risk": _STR, "rewrite_as": _STR},
                                                   "required": ["risk", "rewrite_as"], "additionalProperties": False}},
        "keep_exact": _LIST,
        "remove": _LIST,
    },
    "required": ["retained", "allowed_inferences", "surrogates", "generalize", "keep_exact", "remove"],
    "additionalProperties": False,
}

_MONTH = re.compile(r"\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\b")


def known_identifiers(intake, presidio_log):
    """Identifier strings already known: intake values plus Presidio spans.

    Presidio over-tags everyday time words ("today", "four hours") as DATE_TIME; those are
    clinical content, so only DATE_TIME spans with a digit or month name count.
    """
    vals = [e["original"] for e in presidio_log
            if e["entity"] != "DATE_TIME" or re.search(r"\d", e["original"]) or _MONTH.search(e["original"])]
    vals += [str(intake[k]) for k in ("city", "zip", "employer", "school", "date_of_birth", "session_date") if intake.get(k)]
    return vals


def leak_check(sheet, known):
    text = json.dumps(sheet, ensure_ascii=False)
    found = [k for k in known if len(k) >= 3 and re.search(rf"(?<![A-Za-z0-9]){re.escape(k)}(?![A-Za-z0-9])", text, re.I)]
    hits, _ = rules.identifier_hits([["X", text]])
    found += [h["match"] for h in hits if h["rule"] != "R_TAG_LEFT"]
    return sorted(set(found))


def scrub(sheet, leaked):
    text = json.dumps(sheet, ensure_ascii=False)
    for k in leaked:
        text = re.sub(re.escape(k), "[withheld]", text, flags=re.I)
    return json.loads(text)


def build(claude, original_turns, intake, presidio_log):
    user = ("INTAKE:\n" + json.dumps(intake, ensure_ascii=False, indent=1) +
            "\n\nORIGINAL TRANSCRIPT:\n" + "\n".join(f"{r}: {t}" for r, t in original_turns))
    sheet = claude(SYSTEM, user, SCHEMA)
    leaked = leak_check(sheet, known_identifiers(intake, presidio_log))
    return (scrub(sheet, leaked) if leaked else sheet), leaked
