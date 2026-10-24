"""Grow or refresh the decoy pool from NVIDIA Nemotron-Personas-USA (CC BY 4.0) via the HF datasets-server API.

Merges into data/nemotron_pool.jsonl.gz (dedup by uuid) and backs off on HTTP 429, so it can be
re-run until rare strata (e.g. men over 90) have enough rows. Usage:
  python scripts/fetch_nemotron_pool.py [pages] [seed]
"""
import gzip
import json
import pathlib
import random
import sys
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor

FIELDS = ["uuid", "sex", "age", "marital_status", "education_level", "occupation", "city", "state"]
URL = ("https://datasets-server.huggingface.co/rows?dataset=nvidia/Nemotron-Personas-USA"
       "&config=default&split=train&offset={}&length=100")
OUT = pathlib.Path(__file__).resolve().parents[1] / "data" / "nemotron_pool.jsonl.gz"


def page(offset, tries=6):
    for attempt in range(tries):
        try:
            rows = json.load(urllib.request.urlopen(URL.format(offset), timeout=60))["rows"]
            return [{k: r["row"].get(k) for k in FIELDS} for r in rows]
        except urllib.error.HTTPError as e:
            if e.code != 429:
                print("fail", offset, e, file=sys.stderr)
                return []
            time.sleep(5 * 2 ** attempt)
        except Exception as e:  # network hiccup: skip this page, keep the rest
            print("fail", offset, e, file=sys.stderr)
            return []
    return []


def main(pages=60, seed=11, workers=2):
    existing = []
    if OUT.exists():
        with gzip.open(OUT, "rt", encoding="utf-8") as f:
            existing = [json.loads(line) for line in f if line.strip()]
    seen = {r["uuid"] for r in existing}
    offsets = random.Random(seed).sample(range(0, 900000, 100), pages)
    with ThreadPoolExecutor(workers) as ex:
        new = {r["uuid"]: r for chunk in ex.map(page, offsets) for r in chunk if r["uuid"] not in seen}
    rows = existing + list(new.values())
    with gzip.open(OUT, "wt", encoding="utf-8") as f:
        f.writelines(json.dumps(r, ensure_ascii=False) + "\n" for r in rows)
    print(f"{len(existing)} + {len(new)} = {len(rows)} rows -> {OUT}")


if __name__ == "__main__":
    main(pages=int(sys.argv[1]) if len(sys.argv) > 1 else 60, seed=int(sys.argv[2]) if len(sys.argv) > 2 else 11)
