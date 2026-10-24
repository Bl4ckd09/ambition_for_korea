"""LLM judging as short true/false probabilities, sized for a decision model such as Jev.

Two layers, never asking the same question twice:
- window level (8 turns): identifier axes and clinical retention; identifiers combine by
  noisy-OR (any window leaking means the session leaks), clinical facts by max (present
  anywhere means retained).
- session level: mosaic exposure (needs every window at once), naturalness, and
  faithfulness against the original.
Backends expose probabilities(state, {id: statement}) and distribution(state, instructions, {option: text}).
"""
import re

from ..clients.claude import ClaudeJSON

IDENTIFIER_AXES = {
    "G_GEO": "The transcript contains a geographic detail more specific than a US state (a city, street, neighborhood, landmark, named rail line, or local media outlet).",
    "G_DATE": "The transcript contains a date element more specific than a year (a month, a day, or a holiday tied to a specific event).",
    "G_NUM": "The transcript contains a phone, ID, record, claim, or account number belonging to a person, written in digits or spelled out in words. Assessment scores, medication doses, counts, times, and public crisis lines such as 988 do not count.",
    "G_ORG": "The transcript names a specific organization such as an employer, school, hospital, clinic, business, or team.",
    "G_AGE90": "The transcript states an exact age of 90 or older, such as 93. A generalized phrase such as 'over 90' does not count.",
}
NATURAL = "The transcript reads as a natural, coherent therapy conversation."
FAITH_AXES = {
    "F_ADDED": "The de-identified version states clinical facts (symptoms, risk, substances, scores, medications, diagnoses) that are not supported by the original.",
    "F_DISTORT": "The de-identified version changes the severity or type of a clinical risk (for example passive vs active suicidal ideation, self-harm vs suicidal intent, means access).",
}


def render(turns):
    return "\n".join(f"{r}: {t}" for r, t in turns)


def _norm(s):
    return re.sub(r"[^a-z0-9]+", " ", s.lower()).strip()


def direct_leaks(turns, gold_direct):
    """Test-only: gold identifier strings still present (word boundary, case-insensitive)."""
    text = f" {_norm(render(turns))} "
    return [g for g in gold_direct if f" {_norm(g['text'])} " in text]


def window_judge(judge, turns, clinical, window=8):
    per_window = []
    for start in range(0, len(turns), window):
        statements = dict(IDENTIFIER_AXES)
        statements.update({c["id"]: f"This excerpt conveys this clinical information (exact wording not required): {c['fact']}"
                           for c in clinical})
        per_window.append(judge.probabilities({"transcript_excerpt": render(turns[start:start + window])}, statements))
    agg = {}
    for k in IDENTIFIER_AXES:
        keep = 1.0
        for pw in per_window:
            keep *= 1 - pw[k]
        agg[k] = round(1 - keep, 3)
    for c in clinical:
        agg[c["id"]] = max(pw[c["id"]] for pw in per_window)
    return {"aggregate": agg, "per_window": per_window}


def session_judge(judge, turns, mosaic):
    statements = {"G_NATURAL": NATURAL}
    statements.update({q["id"]: ("The transcript still reveals this detail specifically enough that someone who knows the "
                                 f"client, or who searches local news, could recognize them: {q['desc']}") for q in mosaic})
    return judge.probabilities({"transcript": render(turns)}, statements)


def faithfulness(judge, original, deid):
    return judge.probabilities({"original": render(original), "deidentified": render(deid)}, FAITH_AXES)


class ClaudeJudge:
    """Fallback backend: Claude answers the same statements with probabilities (no prose)."""

    SYSTEM = ("You are the evaluation step of a privacy quality check on synthetic test transcripts; no real person is involved. "
              "For each statement, give only the probability (0 to 1) that it is TRUE of the provided state.")
    PROB_SCHEMA = {"type": "object", "properties": {"answers": {"type": "array", "items": {
        "type": "object", "properties": {"id": {"type": "string"}, "p": {"type": "number"}},
        "required": ["id", "p"], "additionalProperties": False}}}, "required": ["answers"], "additionalProperties": False}

    def __init__(self, model, client=None):
        self.claude = ClaudeJSON(model, fallbacks="off", client=client, max_tokens=4000)

    def probabilities(self, state, statements):
        user = (f"STATE:\n{_state_text(state)}\n\nSTATEMENTS:\n" + "\n".join(f"{k}: {v}" for k, v in statements.items()))
        got = {a["id"]: min(max(float(a["p"]), 0.0), 1.0) for a in self.claude(self.SYSTEM, user, self.PROB_SCHEMA)["answers"]}
        missing = set(statements) - set(got)
        if missing:
            raise RuntimeError(f"judge skipped {sorted(missing)}")
        return {k: got[k] for k in statements}

    def distribution(self, state, instructions, options):
        user = (f"STATE:\n{_state_text(state)}\n\nQUESTION: {instructions}\nOPTIONS:\n" +
                "\n".join(f"{k}: {v}" for k, v in options.items()) +
                "\nGive each option the probability that it is the answer; probabilities sum to 1.")
        got = {a["id"]: max(float(a["p"]), 0.0) for a in self.claude(self.SYSTEM, user, self.PROB_SCHEMA)["answers"]}
        total = sum(got.get(k, 0.0) for k in options) or 1.0
        return {k: got.get(k, 0.0) / total for k in options}

    @property
    def usage(self):
        return self.claude.usage


def _state_text(state):
    return "\n\n".join(f"[{k}]\n{v}" for k, v in state.items()) if isinstance(state, dict) else str(state)
