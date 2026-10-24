"""Persona lineup re-identification test: can an attacker pick the real client out of 10 cards?

Cards use only categorical fields in the Nemotron-Personas-USA vocabulary, so prose style
cannot give the true card away (a no-transcript control should land near chance).
Decoy modes:
- random:  drawn from the whole pool; the upper bound set by the retained statistics alone
- matched: same sex, age band and occupation code; leakage beyond the retained statistics
- implied: matched plus attributes the clinical content may legitimately reveal (from the sheet)
With Jev the attack is one `choice` question whose options are the cards; its
probability distribution is the result.
"""
import random

FIELDS = ["sex", "age", "marital_status", "education_level", "occupation", "city", "state"]
NO_TRANSCRIPT = "(no transcript available; judge from the profiles alone)"
INSTRUCTIONS = ("Red-team step of a privacy check on synthetic test data (no real person involved). "
                "Which candidate profile is the client this therapy transcript was written from? Use every clue, including indirect ones.")


def card(p):
    return "; ".join(f"{f}: {p[f]}" for f in FIELDS)


def _age_match(true_age, age):
    if true_age >= 85:
        return age >= 85
    if true_age < 18:
        return abs(age - true_age) <= 2
    return abs(age - true_age) <= 5


def implied_filter(true_p, allowed_inferences):
    text = " ".join(allowed_inferences or []).lower()
    checks = []
    for word, value in (("widow", "widowed"), ("divorc", "divorced"), ("never married", "never_married"),
                        ("single", "never_married"), ("married", "married_present"), ("separated", "separated")):
        if word in text and true_p["marital_status"] == value:
            checks.append(lambda p, v=value: p["marital_status"] == v)
            break
    if "90" in text and true_p["age"] >= 90:
        checks.append(lambda p: p["age"] >= 90)
    if "lives alone" in text or "living alone" in text:
        checks.append(lambda p: p["marital_status"] != "married_present")
    return lambda p: all(c(p) for c in checks)


def build(true_p, pool, mode="matched", seed=0, n=9, allowed_inferences=None):
    rng = random.Random(seed)
    if mode == "random":
        candidates = list(pool)
    else:
        candidates = [p for p in pool if p["sex"] == true_p["sex"] and _age_match(true_p["age"], p["age"])
                      and p["occupation"] == true_p["occupation"]]
        if mode == "implied":
            keep = implied_filter(true_p, allowed_inferences)
            candidates = [p for p in candidates if keep(p)]
        if len(candidates) < n:
            raise ValueError(f"only {len(candidates)} {mode} decoys; grow the pool with scripts/fetch_nemotron_pool.py")
    members = [(True, true_p)] + [(False, p) for p in rng.sample(candidates, n)]
    rng.shuffle(members)
    return [{"label": chr(ord("A") + i), "is_client": t, "fields": {f: p[f] for f in FIELDS}} for i, (t, p) in enumerate(members)]


def attack(judge, transcript_text, cards):
    probs = judge.distribution({"transcript": transcript_text}, INSTRUCTIONS, {c["label"]: card(c["fields"]) for c in cards})
    total = sum(probs.values()) or 1.0
    probs = {k: v / total for k, v in probs.items()}
    true_label = next(c["label"] for c in cards if c["is_client"])
    return {"p_true": round(probs.get(true_label, 0.0), 3), "probs": probs}
