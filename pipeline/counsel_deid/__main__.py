"""CLI: python -m counsel_deid run [--only S1] [--out ../data/examples.jsonl]"""
import argparse
import json
import pathlib
import sys
from concurrent.futures import ThreadPoolExecutor

from . import config
from .clients.claude import ClaudeJSON
from .clients.jev import Jev, JevError
from .evals.judge import ClaudeJudge
from .personas import DEFAULT_POOL, load_pool
from .pipeline import run_session

DATA = pathlib.Path(__file__).resolve().parents[1] / "data"


def make_judge(settings):
    if settings.judge_backend == "jev":
        try:
            return Jev(settings.jev_api_key, base_url=settings.jev_base_url, model=settings.jev_model)
        except JevError as e:
            raise SystemExit(str(e))
    if settings.judge_backend == "claude":
        return ClaudeJudge(settings.judge_claude_model)
    raise SystemExit(f"unknown DEID_JUDGE_BACKEND={settings.judge_backend!r} (use jev or claude)")


def main(argv=None):
    ap = argparse.ArgumentParser(prog="counsel_deid")
    sub = ap.add_subparsers(dest="cmd", required=True)
    run = sub.add_parser("run", help="de-identify and evaluate sessions, write one JSON document per line")
    run.add_argument("--sessions", default=DATA / "sessions.json")
    run.add_argument("--intake", default=DATA / "intake.json")
    run.add_argument("--personas", default=DATA / "true_personas.json")
    run.add_argument("--pool", default=DEFAULT_POOL)
    run.add_argument("--only", nargs="*", help="session ids to run (default: all)")
    run.add_argument("--out", default=pathlib.Path(__file__).resolve().parents[2] / "data" / "examples.jsonl")
    args = ap.parse_args(argv)

    settings = config.load(dotenv=pathlib.Path(__file__).resolve().parents[1] / ".env")
    sessions = json.loads(pathlib.Path(args.sessions).read_text())
    intake = json.loads(pathlib.Path(args.intake).read_text())
    personas = json.loads(pathlib.Path(args.personas).read_text())
    if args.only:
        sessions = [s for s in sessions if s["id"] in set(args.only)]
    pool = load_pool(args.pool)
    claude = ClaudeJSON(settings.rewrite_model, fallbacks=settings.claude_fallbacks)
    judge = make_judge(settings)

    with ThreadPoolExecutor(settings.workers) as ex:
        docs = list(ex.map(lambda s: run_session(s, intake[s["id"]], personas[s["id"]], claude, judge, settings, pool=pool), sessions))

    out = pathlib.Path(args.out)
    out.write_text("".join(json.dumps(d, ensure_ascii=False) + "\n" for d in docs))
    print(f"wrote {len(docs)} documents to {out}", file=sys.stderr)
    print(f"claude usage: {claude.usage}; judge usage: {getattr(judge, 'usage', {})}", file=sys.stderr)


if __name__ == "__main__":
    main()
