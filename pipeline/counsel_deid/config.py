"""Runtime configuration from environment variables (see .env.example). No secrets live in code."""
import os
from dataclasses import dataclass, field


def _env(name, default=None):
    value = os.environ.get(name)
    return value if value not in (None, "") else default


@dataclass(frozen=True)
class Settings:
    # Claude (Anthropic API) rewrites; the SDK reads ANTHROPIC_API_KEY itself.
    rewrite_model: str = field(default_factory=lambda: _env("DEID_REWRITE_MODEL", "claude-sonnet-5-5"))
    # Server-side refusal fallback ("default" routes by refusal category); "off" disables it.
    claude_fallbacks: str = field(default_factory=lambda: _env("DEID_CLAUDE_FALLBACKS", "default"))
    # Judge backend: "jev" (TypeSafe decision model) or "claude" (Claude Haiku answering the same yes/no questions).
    judge_backend: str = field(default_factory=lambda: _env("DEID_JUDGE_BACKEND", "jev"))
    judge_claude_model: str = field(default_factory=lambda: _env("DEID_JUDGE_CLAUDE_MODEL", "claude-haiku-5-5"))
    # TypeSafe Jev. Point JEV_BASE_URL at a gateway that serves the same /systemone body to route elsewhere.
    jev_api_key: str = field(default_factory=lambda: _env("TYPESAFE_API_KEY"))
    jev_base_url: str = field(default_factory=lambda: _env("JEV_BASE_URL", "https://api.typesafe.ai/v1"))
    jev_model: str = field(default_factory=lambda: _env("JEV_MODEL", "jev-1.13.0"))
    # Pipeline shape.
    window_turns: int = field(default_factory=lambda: int(_env("DEID_WINDOW_TURNS", "8")))
    lineup_seeds: tuple = field(default_factory=lambda: tuple(int(s) for s in _env("DEID_LINEUP_SEEDS", "1,2,3").split(",")))
    workers: int = field(default_factory=lambda: int(_env("DEID_WORKERS", "4")))


def load_dotenv(path):
    """Minimal KEY=VALUE loader for pipeline/.env; never overrides variables already set."""
    try:
        lines = open(path, encoding="utf-8").read().splitlines()
    except FileNotFoundError:
        return
    for line in lines:
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            key, value = line.split("=", 1)
            os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


def load(dotenv=None):
    if dotenv:
        load_dotenv(dotenv)
    return Settings()
