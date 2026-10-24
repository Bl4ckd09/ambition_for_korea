"""Claude via the official Anthropic SDK, returning schema-constrained JSON.

Structured outputs (output_config.format) guarantee the text block is valid JSON for
the given schema. The server-side refusal fallback (beta) is on by default; a final
refusal raises ClaudeRefusal so callers never read a declined response as data.
"""
import json

import anthropic

FALLBACK_BETA = "server-side-fallback-2026-07-01"


class ClaudeRefusal(RuntimeError):
    def __init__(self, category, explanation):
        super().__init__(f"Claude declined the request (category={category}): {explanation}")
        self.category = category


class ClaudeJSON:
    def __init__(self, model, fallbacks="default", client=None, max_tokens=16000):
        self.model = model
        self.fallbacks = fallbacks
        self.client = client or anthropic.Anthropic()
        self.max_tokens = max_tokens
        self.usage = {"input_tokens": 0, "output_tokens": 0, "cache_read_input_tokens": 0}

    def __call__(self, system, user, schema, effort=None):
        kwargs = {
            "model": self.model,
            "max_tokens": self.max_tokens,
            # The system prompt is identical across windows and sessions, so cache it.
            "system": [{"type": "text", "text": system, "cache_control": {"type": "ephemeral"}}],
            "messages": [{"role": "user", "content": user}],
            "output_config": {"format": {"type": "json_schema", "schema": schema}},
        }
        if effort:
            kwargs["output_config"]["effort"] = effort
        if self.fallbacks and self.fallbacks != "off":
            response = self.client.beta.messages.create(betas=[FALLBACK_BETA], fallbacks=self.fallbacks, **kwargs)
        else:
            response = self.client.messages.create(**kwargs)
        self._count(response.usage)
        if response.stop_reason == "refusal":
            details = getattr(response, "stop_details", None)
            raise ClaudeRefusal(getattr(details, "category", None), getattr(details, "explanation", None))
        if response.stop_reason == "max_tokens":
            raise RuntimeError(f"Claude hit max_tokens={self.max_tokens}; raise it or shrink the window")
        text = next(b.text for b in response.content if b.type == "text")
        return json.loads(text)

    def _count(self, usage):
        for key in self.usage:
            self.usage[key] += getattr(usage, key, 0) or 0
