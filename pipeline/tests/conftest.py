import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))


class FakeJudge:
    """Deterministic judge: every statement gets `p`; distributions favor `favorite` if given."""

    def __init__(self, p=0.1, favorite=None, overrides=None):
        self.p, self.favorite, self.overrides = p, favorite, overrides or {}
        self.calls = []

    def probabilities(self, state, statements):
        self.calls.append(("probabilities", state, statements))
        return {k: self.overrides.get(k, self.p) for k in statements}

    def distribution(self, state, instructions, options):
        self.calls.append(("distribution", state, options))
        if self.favorite in options:
            return {k: (0.91 if k == self.favorite else 0.01) for k in options}
        return {k: 1 / len(options) for k in options}
