import pytest

from conftest import FakeJudge
from counsel_deid.evals import judge, verdict

TURNS = [["T" if i % 2 == 0 else "C", f"turn {i}"] for i in range(20)]
CLINICAL = [{"id": "C1", "fact": "panic attacks"}]


def test_window_judge_combines_identifiers_by_noisy_or_and_clinical_by_max():
    class PerWindow(FakeJudge):
        def probabilities(self, state, statements):
            n = len(self.calls)
            self.calls.append(state)
            return {k: (0.3 if k == "G_NUM" else 0.9 if (k == "C1" and n == 1) else 0.05) for k in statements}

    res = judge.window_judge(PerWindow(), TURNS, CLINICAL, window=8)
    assert len(res["per_window"]) == 3                       # 20 turns -> 8, 8, 4
    assert res["aggregate"]["G_NUM"] == pytest.approx(1 - 0.7 ** 3, abs=1e-3)
    assert res["aggregate"]["C1"] == 0.9


def test_session_judge_asks_mosaic_and_naturalness_only():
    fj = FakeJudge()
    out = judge.session_judge(fj, TURNS, [{"id": "Q1", "desc": "unique role"}])
    assert set(out) == {"G_NATURAL", "Q1"}
    assert not set(judge.IDENTIFIER_AXES) & set(fj.calls[0][2])


@pytest.mark.parametrize("rule_hit,llm,gold,expected", [
    (False, 0.1, (), "pass"),
    (True, 0.1, (), "review"),
    (False, 0.8, (), "review"),
    (True, 0.8, (), "fail"),
    (False, 0.1, ("SSN",), "fail"),
])
def test_item_verdict(rule_hit, llm, gold, expected):
    item = next(i for i in verdict.SAFE_HARBOR if i["code"] == "G")
    hits = [{"rule": "R_SSN", "match": "512-44-8193"}] if rule_hit else []
    assert verdict.item_verdict(item, hits, {"G_NUM": llm}, {}, gold)["status"] == expected
