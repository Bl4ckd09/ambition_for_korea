// Types and pure helpers for the pipeline output in data/examples.jsonl.
// No runtime imports, so `node --test` can load it directly.

export const STAGES = ['original', 'stage1', 'final'] as const;
export type Stage = (typeof STAGES)[number];
type ByStage<T> = Record<Stage, T>;

export const STAGE_LABEL: Record<Stage, string> = {
  original: 'Original',
  stage1: 'Baseline (Presidio)',
  final: 'Into the Unknown',
};

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

export const LINEUP_MODE: Record<string, { label: string; meaning: string }> = {
  random: {
    label: 'Random decoys',
    meaning: 'How identifiable the retained demographics (sex, age band, occupation) are on their own. It stays high even with good de-identification, so treat it as the ceiling.',
  },
  matched: {
    label: 'Demographically matched decoys',
    meaning: 'Extra leakage among people who share the retained demographics. This is the de-identification quality metric.',
  },
  implied: {
    label: 'Decoys matched on inferable attributes',
    meaning: 'Decoys also share attributes the clinical content is allowed to reveal, such as bereavement or being over 90.',
  },
};

// ---------- transcript highlighting ----------

export type Mark = 'id' | 'tag' | 'leak' | 'sur';
export type Seg = { text: string; mark?: Mark };

const reEsc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const TAG = /^<[A-Z_]+>$/;

// Splits text into plain runs and marked runs. `tags` also marks Presidio-style <TYPE> placeholders.
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

// Processed session plus evidence. Never the original, the baseline output, identifier highlights,
// mosaic-clue descriptions (they paraphrase the original clues), or the lineup answer key.
export function exportRecord(s: Sample) {
  const e = s.evaluation;
  return {
    sample_id: s.id,
    synthetic: s.synthetic,
    legal_basis: 'synthetic',
    pipeline: {
      rewrite: 'Claude Sonnet: de-identification sheet once, then rewrite in 8-turn windows from the public sheet',
      evaluation: 'Rule checks + Claude Haiku probability judgments (per window and per session) + persona lineup',
    },
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
