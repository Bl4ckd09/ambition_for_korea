// Types and pure helpers for the pipeline output in data/examples.jsonl.
// No runtime imports, so `node --test` can load it directly.

export const STAGES = ['original', 'stage1', 'final'] as const;
export type Stage = (typeof STAGES)[number];
type ByStage<T> = Record<Stage, T>;

export const STAGE_LABEL: Record<Stage, string> = { original: 'Original', stage1: 'Stage 1', final: 'Stage 2' };
export const STAGE_STEP: Record<Stage, string> = { original: 'Session', stage1: 'Masking', final: 'Rewrite' };

export type Turn = { speaker: string; role: 'T' | 'C'; text: string };
export type CheckStatus = 'pass' | 'review' | 'fail';
type Lineup = 'control' | Stage;

export type Sample = {
  id: string;
  title: string;
  topics: string;
  synthetic: boolean;
  note: string;
  pipeline: { stage1: string; final: string; evaluation: string };
  transcript: ByStage<Turn[]>;
  highlights: { original_identifiers: { text: string; type: string }[]; stage1_left: string[]; final_left: string[] };
  deid_sheet: {
    retained: Record<string, string>;
    allowed_inferences: string[];
    surrogates: { refers_to: string; use: string }[];
    generalize: { risk: string; rewrite_as: string }[];
    keep_exact: string[];
    remove: string[];
  };
  evaluation: {
    summary: {
      direct_identifiers_left: ByStage<{ left: number; total: number }>;
      mosaic_exposure: ByStage<number>;
      clinical_retention: ByStage<number>;
      reidentification_probability: ByStage<number>;
      chance: number;
      safe_harbor_passed: ByStage<{ passed: number; total: number }>;
    };
    safe_harbor: {
      code: string;
      label: string;
      result: ByStage<{ status: CheckStatus; rule_hits: string[]; llm_probability: number | null; mosaic_probability: number | null; test_label_left: string[] }>;
    }[];
    mosaic: { id: string; description: string; probability: ByStage<number> }[];
    clinical: { id: string; fact: string; probability: ByStage<number> }[];
    quality: {
      natural_conversation: ByStage<number>;
      clinical_facts_added: Record<'stage1' | 'final', number>;
      risk_changed: Record<'stage1' | 'final', number>;
    };
    rule_checks: ByStage<{
      risk_terms_kept: Record<string, boolean>;
      scores_and_doses_kept: Record<string, boolean>;
      tags_left: number;
      turn_structure_kept: boolean;
    }>;
    lineup: {
      chance: number;
      card_fields: string[];
      modes: Record<'random' | 'matched' | 'implied', { label: string; meaning: string; p_true: Record<Lineup, number> }>;
      cards: { label: string; is_client: boolean; fields: Record<string, string | number>; probability: Record<Lineup, number> }[];
    };
  };
};

// The pipeline writes Korean labels; the site is English. Unknown ids fall back to the data.
const EN: Record<string, { title: string; topics: string; note?: string }> = {
  S1: { title: 'Night-shift ER charge nurse', topics: "Panic attacks, passive suicidal ideation, alcohol use, a father's publicly reported death" },
  S2: { title: '16-year-old high school wrestler', topics: 'Non-suicidal self-injury, cyberbullying by teammates, weight cutting, ADHD medication', note: "Stress test only. Real minors' records are excluded under our data policy." },
  S3: { title: '93-year-old veteran', topics: 'Spousal bereavement, firearm access, possible cognitive decline, hearing loss' },
};
export const titleOf = (s: Sample) => EN[s.id]?.title ?? s.title;
export const topicsOf = (s: Sample) => EN[s.id]?.topics ?? s.topics;
export const noteOf = (s: Sample) => EN[s.id]?.note;

export const SAFE_HARBOR_LABEL: Record<string, string> = {
  A: 'Names',
  B: 'Geography smaller than a state',
  C: 'Dates (except year), ages over 89',
  'D-F': 'Phone, fax, email',
  G: 'Social Security numbers',
  'H-K': 'Medical record, health plan, account, license numbers',
  'N-O': 'URLs, IP addresses, social handles',
  R: 'Other unique identifying characteristics',
};

export const LINEUP_MODE: Record<string, string> = {
  random: 'Random decoys',
  matched: 'Matched decoys',
  implied: 'Inferred-attribute decoys',
};

// ---------- transcript highlighting ----------

export type Mark = 'id' | 'tag' | 'leak' | 'sur';
export type Seg = { text: string; mark?: Mark };

const reEsc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const TAG = /^<[A-Z_]+>$/;

// Splits text into plain runs and marked runs. `tags` also marks <TYPE> placeholders.
export function segment(text: string, terms: [string, Mark][], tags = false): Seg[] {
  const alts = terms.map(([t]) => t).filter(Boolean).sort((a, b) => b.length - a.length).map(reEsc);
  if (tags) alts.unshift('<[A-Z_]+>');
  if (!alts.length) return [{ text }];
  const out: Seg[] = [];
  let last = 0;
  for (const m of text.matchAll(new RegExp(alts.join('|'), 'g'))) {
    if (m.index > last) out.push({ text: text.slice(last, m.index) });
    const mark = tags && TAG.test(m[0]) ? 'tag' : terms.find(([t]) => t === m[0])![1];
    out.push({ text: m[0], mark });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last) });
  return out;
}

export function marksFor(s: Sample, stage: Stage): { terms: [string, Mark][]; tags: boolean } {
  const h = s.highlights;
  if (stage === 'original') return { terms: h.original_identifiers.map(i => [i.text, 'id']), tags: false };
  if (stage === 'stage1') return { terms: h.stage1_left.map(t => [t, 'leak']), tags: true };
  return {
    terms: [...h.final_left.map((t): [string, Mark] => [t, 'leak']), ...s.deid_sheet.surrogates.map((x): [string, Mark] => [x.use, 'sur'])],
    tags: false,
  };
}

// ---------- buyer-facing export ----------

// Processed session plus evidence. Never the original, the stage-1 output, identifier highlights,
// mosaic-clue descriptions (they paraphrase the original clues), or the lineup answer key.
export function exportRecord(s: Sample) {
  const e = s.evaluation;
  return {
    sample_id: s.id,
    synthetic: s.synthetic,
    legal_basis: 'synthetic',
    pipeline: { stage_1: 'masking', stage_2: 'rewrite from de-identification sheet', evaluation: 'rules, probability judgments, persona lineup' },
    retained_attributes: s.deid_sheet.retained,
    messages: s.transcript.final.map((t, i) => ({ turn_id: `t${i + 1}`, speaker: t.role === 'T' ? 'therapist' : 'client', text: t.text })),
    clinical_facts: e.clinical.map(c => ({ id: c.id, fact: c.fact, retention_probability: c.probability.final })),
    verification: {
      safe_harbor: e.safe_harbor.map(h => ({ category: h.code, status: h.result.final.status, llm_probability: h.result.final.llm_probability })),
      direct_identifiers_left: e.summary.direct_identifiers_left.final.left,
      mosaic_exposure: e.summary.mosaic_exposure.final,
      lineup_reidentification: { probability: e.summary.reidentification_probability.final, chance: e.summary.chance, decoys: 'demographically matched' },
      rule_checks: e.rule_checks.final,
      quality: {
        natural_conversation: e.quality.natural_conversation.final,
        clinical_facts_added: e.quality.clinical_facts_added.final,
        risk_changed: e.quality.risk_changed.final,
      },
    },
  };
}

export const pct = (v: number) => `${Math.round(v * 100)}%`;

// ---------- stage-to-stage diff (drives the morph animation) ----------

export type Chunk = { same: true; text: string } | { same: false; from: string; to: string };

const tokenize = (s: string) => s.match(/<[A-Z_]+>|[\w'’-]+|\s+|[^\w\s]/g) ?? [];

// Word-level LCS diff. Changes separated only by whitespace, punctuation, or a couple of
// short words are merged, so a rewritten phrase reads as one change instead of confetti.
export function diffChunks(a: string, b: string): Chunk[] {
  if (a === b) return [{ same: true, text: a }];
  const x = tokenize(a), y = tokenize(b);
  const L = Array.from({ length: x.length + 1 }, () => new Uint16Array(y.length + 1));
  for (let i = x.length - 1; i >= 0; i--)
    for (let j = y.length - 1; j >= 0; j--)
      L[i][j] = x[i] === y[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);

  const raw: Chunk[] = [];
  let from = '', to = '';
  const flush = () => { if (from || to) raw.push({ same: false, from, to }); from = to = ''; };
  for (let i = 0, j = 0; i < x.length || j < y.length;) {
    if (i < x.length && j < y.length && x[i] === y[j]) {
      flush();
      const last = raw[raw.length - 1];
      if (last?.same) last.text += x[i]; else raw.push({ same: true, text: x[i] });
      i++; j++;
    } else if (j < y.length && (i === x.length || L[i][j + 1] >= L[i + 1][j])) to += y[j++];
    else from += x[i++];
  }
  flush();

  const small = (t: string) => (t.match(/[\w'’-]+/g) ?? []).every(w => w.length <= 3) && (t.match(/[\w'’-]+/g) ?? []).length <= 2;
  const out: Chunk[] = [];
  for (let k = 0; k < raw.length; k++) {
    const c = raw[k], prev = out[out.length - 1], next = raw[k + 1];
    if (c.same && prev && !prev.same && next && !next.same && small(c.text)) {
      prev.from += c.text + next.from;
      prev.to += c.text + next.to;
      k++;
    } else if (!c.same && prev && !prev.same) {
      prev.from += c.from; prev.to += c.to;
    } else out.push({ ...c });
  }

  // Keep whitespace shared by both sides outside the highlighted change.
  const res: Chunk[] = [];
  const pushSame = (t: string) => {
    if (!t) return;
    const last = res[res.length - 1];
    if (last?.same) last.text += t; else res.push({ same: true, text: t });
  };
  for (const c of out) {
    if (c.same) { pushSame(c.text); continue; }
    let { from, to } = c, lead = '', tail = '';
    while (from && to && from[0] === to[0] && /\s/.test(from[0])) { lead += from[0]; from = from.slice(1); to = to.slice(1); }
    while (from && to && from.at(-1) === to.at(-1) && /\s/.test(from.at(-1)!)) { tail = from.at(-1) + tail; from = from.slice(0, -1); to = to.slice(0, -1); }
    pushSame(lead);
    if (from || to) res.push({ same: false, from, to });
    pushSame(tail);
  }
  return res;
}
