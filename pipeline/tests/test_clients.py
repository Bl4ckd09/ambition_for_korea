import io
import json
from types import SimpleNamespace

import pytest

from counsel_deid.clients import claude as claude_mod
from counsel_deid.clients.jev import Jev, JevError


class FakeResp(io.BytesIO):
    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False


def jev_with(handler):
    sent = []

    def opener(req, timeout):
        body = json.loads(req.data)
        sent.append((req, body))
        return FakeResp(json.dumps(handler(body)).encode())
    return Jev("key", opener=opener), sent


def test_jev_noul_request_shape_and_parsing():
    jev, sent = jev_with(lambda b: {"answers": {k: {"type": "noul", "noul": 0.2} for k in b["questions"]},
                                    "usage": {"input_tokens": 10, "output_tokens": 1}})
    assert jev.probabilities({"transcript": "T: hi"}, {"G_NUM": "has a number"}) == {"G_NUM": 0.2}
    req, body = sent[0]
    assert req.full_url == "https://api.typesafe.ai/v1/systemone"
    assert req.headers["Authorization"] == "Bearer key"
    assert body["questions"]["G_NUM"] == {"type": "noul", "instructions": "has a number"}
    assert jev.usage == {"input_tokens": 10, "output_tokens": 1}


def test_jev_choice_uses_criteria_and_returns_probabilities():
    jev, sent = jev_with(lambda b: {"answers": {"pick": {"type": "choice", "choice": "A", "confidence": 0.7,
                                                         "probabilities": {"A": 0.7, "B": 0.3}}}})
    assert jev.distribution({"transcript": "x"}, "which?", {"A": "card a", "B": "card b"}) == {"A": 0.7, "B": 0.3}
    assert sent[0][1]["questions"]["pick"]["criteria"] == {"A": "card a", "B": "card b"}


def test_jev_splits_more_than_50_questions_and_rejects_missing_answers():
    jev, sent = jev_with(lambda b: {"answers": {k: {"type": "noul", "noul": 0.5} for k in b["questions"]}})
    assert len(jev.probabilities("s", {f"q{i}": "?" for i in range(120)})) == 120
    assert [len(b["questions"]) for _, b in sent] == [50, 50, 20]
    jev2, _ = jev_with(lambda b: {"answers": {}})
    with pytest.raises(JevError):
        jev2.probabilities("s", {"q": "?"})


def test_jev_requires_a_key():
    with pytest.raises(JevError):
        Jev("")


def fake_anthropic(stop_reason="end_turn", text='{"ok": true}'):
    resp = SimpleNamespace(stop_reason=stop_reason, stop_details=SimpleNamespace(category="cyber", explanation="no"),
                           content=[SimpleNamespace(type="text", text=text)],
                           usage=SimpleNamespace(input_tokens=5, output_tokens=2, cache_read_input_tokens=0))
    calls = {}

    def create(**kw):
        calls.update(kw)
        return resp
    client = SimpleNamespace(messages=SimpleNamespace(create=create), beta=SimpleNamespace(messages=SimpleNamespace(create=create)))
    return client, calls


def test_claude_json_sends_schema_cache_and_fallback():
    client, calls = fake_anthropic()
    out = claude_mod.ClaudeJSON("claude-sonnet-5-5", client=client)("sys", "user", {"type": "object"})
    assert out == {"ok": True}
    assert calls["betas"] == [claude_mod.FALLBACK_BETA] and calls["fallbacks"] == "default"
    assert calls["output_config"]["format"]["type"] == "json_schema"
    assert calls["system"][0]["cache_control"] == {"type": "ephemeral"}


def test_claude_json_raises_on_refusal_instead_of_returning_data():
    client, _ = fake_anthropic(stop_reason="refusal")
    with pytest.raises(claude_mod.ClaudeRefusal):
        claude_mod.ClaudeJSON("claude-sonnet-5-5", fallbacks="off", client=client)("s", "u", {})
