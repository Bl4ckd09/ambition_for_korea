"""Stage 2: sheet-guided rewrite of the Presidio output, one window of turns at a time.

Each call sees the public sheet, the previous rewritten window (read only, for
continuity) and the current window of Presidio-tagged turns, never the original.
"""
import json

SYSTEM = """You rewrite one window of a psychotherapy transcript as the second-layer de-identifier for US AI training data.
Input: a de-identification SHEET (the plan for this whole session), the PREVIOUS window already rewritten (read only, for continuity), and the CURRENT window after a standard PII tool replaced some spans with tags like <PERSON>, <LOCATION>, <DATE_TIME>.

Rules:
- Follow the sheet exactly: use its surrogates for people, apply each generalize item wherever that kind of detail appears, keep every keep_exact fact verbatim, drop every remove item.
- Remove any remaining HIPAA Safe Harbor identifier the tool missed: names, geography smaller than a state, date elements except the year, ages 90 or older (say "over 90"), phone or ID numbers in digits or words, emails, handles, URLs, named organizations.
- Do not add new specific details. A replacement must never be rarer or more distinctive than what it replaces.
- Keep the clinical content, risk signals, the therapeutic flow, and the speaker's voice. Stay consistent with the previous window.
- Replace every tag with natural words. Never output a tag.
- Return exactly the same number of turns, same roles, same order."""

SCHEMA = {
    "type": "object",
    "properties": {"turns": {"type": "array", "items": {
        "type": "object", "properties": {"role": {"type": "string", "enum": ["T", "C"]}, "text": {"type": "string"}},
        "required": ["role", "text"], "additionalProperties": False}}},
    "required": ["turns"],
    "additionalProperties": False,
}


def rewrite(claude, presidio_turns, sheet, window=8):
    out = []
    for start in range(0, len(presidio_turns), window):
        chunk = presidio_turns[start:start + window]
        prev = out[-window:]
        user = ("SHEET:\n" + json.dumps(sheet, ensure_ascii=False, indent=1) +
                "\n\nPREVIOUS WINDOW (already rewritten, do not return it):\n" +
                ("\n".join(f"{r}: {t}" for r, t in prev) if prev else "(start of session)") +
                "\n\nCURRENT WINDOW:\n" + json.dumps({"turns": [{"role": r, "text": t} for r, t in chunk]},
                                                     ensure_ascii=False, indent=1))
        turns = claude(SYSTEM, user, SCHEMA)["turns"]
        if [t["role"] for t in turns] != [r for r, _ in chunk]:
            raise ValueError(f"window at turn {start}: roles changed {[r for r, _ in chunk]} -> {[t['role'] for t in turns]}")
        out += [[t["role"], t["text"]] for t in turns]
    return out
