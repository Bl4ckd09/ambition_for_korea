import pytest

from conftest import FakeJudge
from counsel_deid.evals import lineup

TRUE = {"sex": "Male", "age": 93, "marital_status": "widowed", "education_level": "high_school",
        "occupation": "not_in_workforce", "city": "Duluth", "state": "MN"}


def pool():
    rows = []
    for i in range(40):
        rows.append({**TRUE, "uuid": f"w{i}", "age": 85 + i % 10, "marital_status": "widowed" if i % 2 else "married_present",
                     "city": f"Town{i}"})
        rows.append({**TRUE, "uuid": f"f{i}", "sex": "Female", "age": 30 + i, "occupation": "cashier", "city": f"City{i}"})
    return rows


def test_matched_decoys_share_retained_stats():
    cards = lineup.build(TRUE, pool(), mode="matched", seed=1)
    assert len(cards) == 10 and sum(c["is_client"] for c in cards) == 1
    for c in cards:
        assert c["fields"]["sex"] == "Male" and c["fields"]["age"] >= 85 and c["fields"]["occupation"] == "not_in_workforce"


def test_implied_mode_adds_attributes_from_the_sheet():
    cards = lineup.build(TRUE, pool(), mode="implied", seed=1, allowed_inferences=["widowed", "over 90"])
    for c in cards:
        assert c["fields"]["marital_status"] == "widowed" and c["fields"]["age"] >= 90


def test_too_few_decoys_is_an_error_not_a_silent_fallback():
    with pytest.raises(ValueError):
        lineup.build({**TRUE, "occupation": "astronaut"}, pool(), mode="matched")


def test_attack_reports_probability_of_the_true_card():
    cards = lineup.build(TRUE, pool(), mode="random", seed=2)
    true_label = next(c["label"] for c in cards if c["is_client"])
    assert lineup.attack(FakeJudge(favorite=true_label), "transcript", cards)["p_true"] == pytest.approx(0.91 / 1.0, abs=1e-3)
    assert lineup.attack(FakeJudge(), lineup.NO_TRANSCRIPT, cards)["p_true"] == pytest.approx(0.1)
