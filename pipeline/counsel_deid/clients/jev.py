"""TypeSafe Jev decision model (System One API), per https://docs.typesafe.ai/api.

POST {base}/systemone with {"model", "state", "questions"}; each question is
{"type": "noul" | "choice" | "score", "instructions", "criteria"?}. Answers come back
keyed by question name: noul -> {"noul": P(yes)}, choice -> {"choice", "confidence",
"probabilities": {name: p}}. Jev never writes text, so it judges but cannot explain.
"""
import json
import urllib.error
import urllib.request

MAX_QUESTIONS = 50          # documented per-request limit
MAX_INPUT_CHARS = 100_000   # ~32k token input budget at a conservative ~3 chars/token


class JevError(RuntimeError):
    pass


def noul(instructions, true=None, false=None):
    q = {"type": "noul", "instructions": instructions}
    if true or false:
        q["criteria"] = {"true": true or "Yes", "false": false or "No"}
    return q


def choice(instructions, options):
    """options: {name: description}; 1 to 255 entries."""
    if not 1 <= len(options) <= 255:
        raise ValueError("choice questions take 1 to 255 options")
    return {"type": "choice", "instructions": instructions, "criteria": dict(options)}


class Jev:
    def __init__(self, api_key, base_url="https://api.typesafe.ai/v1", model="jev-1.13.0", timeout=60, opener=None):
        if not api_key:
            raise JevError("TYPESAFE_API_KEY is not set; set it or use DEID_JUDGE_BACKEND=claude")
        self.api_key, self.base_url, self.model, self.timeout = api_key, base_url.rstrip("/"), model, timeout
        self.opener = opener or urllib.request.urlopen
        self.usage = {"input_tokens": 0, "output_tokens": 0}

    def ask(self, state, questions):
        """Ask up to 50 questions about one state; split larger sets across calls."""
        answers = {}
        names = list(questions)
        for start in range(0, len(names), MAX_QUESTIONS):
            batch = {n: questions[n] for n in names[start:start + MAX_QUESTIONS]}
            answers.update(self._post(state, batch))
        return answers

    def _post(self, state, questions):
        body = {"model": self.model, "state": state, "questions": questions}
        payload = json.dumps(body, ensure_ascii=False)
        if len(payload) > MAX_INPUT_CHARS:
            raise JevError(f"request is {len(payload)} chars, past the ~32k token input limit; judge smaller windows")
        req = urllib.request.Request(
            f"{self.base_url}/systemone", data=payload.encode("utf-8"), method="POST",
            headers={"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"})
        try:
            with self.opener(req, timeout=self.timeout) as resp:
                data = json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            raise JevError(f"Jev HTTP {e.code}: {e.read().decode('utf-8', 'replace')[:500]}") from e
        for key in self.usage:
            self.usage[key] += (data.get("usage") or {}).get(key, 0) or 0
        missing = set(questions) - set(data.get("answers", {}))
        if missing:
            raise JevError(f"Jev returned no answer for {sorted(missing)}")
        return data["answers"]

    def probabilities(self, state, statements):
        """{id: statement} -> {id: P(statement is true)} via noul questions."""
        answers = self.ask(state, {k: noul(v) for k, v in statements.items()})
        return {k: float(answers[k]["noul"]) for k in statements}

    def distribution(self, state, instructions, options):
        """One choice question -> {option: probability}."""
        answers = self.ask(state, {"pick": choice(instructions, options)})
        return {k: float(v) for k, v in answers["pick"]["probabilities"].items()}
