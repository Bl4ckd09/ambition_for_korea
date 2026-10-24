"""Stage 1: standard open-source baseline (Microsoft Presidio, default configuration).

Default analyzer = regex/checksum recognizers + spaCy NER (PERSON, LOCATION, DATE_TIME,
NRP). Default operator = replace with <ENTITY_TYPE>. Kept untuned on purpose so it is a
fair baseline; stage 2 handles what it misses.
"""
from functools import lru_cache


@lru_cache(maxsize=1)
def _engines():
    from presidio_analyzer import AnalyzerEngine
    from presidio_anonymizer import AnonymizerEngine
    return AnalyzerEngine(), AnonymizerEngine()


def deidentify(turns):
    """turns: [[role, text], ...] -> (tagged turns, detections with original spans for the sheet leak check)."""
    analyzer, anonymizer = _engines()
    out, log = [], []
    for i, (role, text) in enumerate(turns):
        results = analyzer.analyze(text=text, language="en")
        out.append([role, anonymizer.anonymize(text=text, analyzer_results=results).text])
        log += [{"turn": i, "entity": r.entity_type, "score": round(r.score, 2), "original": text[r.start:r.end]}
                for r in results]
    return out, log
