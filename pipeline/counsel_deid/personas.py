"""NVIDIA Nemotron-Personas-USA decoy pool (CC BY 4.0, https://huggingface.co/datasets/nvidia/Nemotron-Personas-USA).

The repo ships a pre-fetched categorical sample (data/nemotron_pool.jsonl.gz) so runs are
reproducible offline; scripts/fetch_nemotron_pool.py grows or refreshes it.
"""
import gzip
import json
import pathlib
from functools import lru_cache

DEFAULT_POOL = pathlib.Path(__file__).resolve().parents[1] / "data" / "nemotron_pool.jsonl.gz"
FIELDS = ["uuid", "sex", "age", "marital_status", "education_level", "occupation", "city", "state"]


@lru_cache(maxsize=4)
def load_pool(path=DEFAULT_POOL):
    path = pathlib.Path(path)
    if not path.exists():
        raise FileNotFoundError(f"{path} is missing; run scripts/fetch_nemotron_pool.py to download the decoy pool")
    with gzip.open(path, "rt", encoding="utf-8") as f:
        return tuple(json.loads(line) for line in f if line.strip())
