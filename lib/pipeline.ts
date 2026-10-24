// Pure pipeline logic: apply a transformation plan, re-scan, decide status, build the export.
// No runtime imports, so `node --test` can load it directly.

export type Speaker = 'counselor' | 'client';

export type Span = {
  id: string;
  match: string;
  to: string;
  type: string;
  method: string;
  by: 'Model proposal' | 'Format rule';
  why: string;
  review?: string;
};

export type Verdict = 'preserved' | 'lost' | 'contradicted' | 'unclear';

export type Case = {
  id: string;
  label: string;
  summary: string;
  turns: [Speaker, string][];
  spans: Span[];
  anchors: string[];
  context: [item: string, verdict: Verdict, note: string][];
  dims: [dimension: string, context: string][];
};

export type Status = 'demo_checks_passed' | 'needs_review' | 'blocked';

export type Segment =
  | { kind: 'text'; text: string }
  | { kind: 'span'; span: Span }
  | { kind: 'ctx'; text: string };

const reEsc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const alt = (keys: string[]) =>
  new RegExp([...keys].sort((a, b) => b.length - a.length).map(reEsc).join('|'), 'g');

export const applyPlan = (text: string, c: Case) =>
  text.replace(alt(c.spans.map(s => s.match)), m => c.spans.find(s => s.match === m)!.to);

export const turnIds = (c: Case, s: Span) =>
  c.turns.flatMap(([, t], i) => (t.includes(s.match) ? [`t${i + 1}`] : []));

// Splits a turn into plain text, planned spans, and context anchors for rendering.
export function segments(text: string, c: Case): Segment[] {
  const out: Segment[] = [];
  let last = 0;
  for (const m of text.matchAll(alt([...c.spans.map(s => s.match), ...c.anchors]))) {
    if (m.index > last) out.push({ kind: 'text', text: text.slice(last, m.index) });
    const span = c.spans.find(s => s.match === m[0]);
    out.push(span ? { kind: 'span', span } : { kind: 'ctx', text: m[0] });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ kind: 'text', text: text.slice(last) });
  return out;
}

const RULES: [string, RegExp][] = [
  ['phone', /\(?\b\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}\b/g],
  ['email', /[\w.+-]+@[\w-]+\.[a-z]{2,}/gi],
  ['url', /https?:\/\/\S+/gi],
  ['ssn', /\b\d{3}-\d{2}-\d{4}\b/g],
];

export const ruleScan = (texts: string[]) =>
  RULES.flatMap(([name, re]) => texts.flatMap(t => [...t.matchAll(re)].map(() => name)));

export function verify(c: Case) {
  const out = c.turns.map(([, t]) => applyPlan(t, c));
  const residual = ruleScan(out);
  const leaks = c.spans.filter(s => out.some(t => t.includes(s.match)));
  const flags = c.spans.filter(s => s.review);
  // ponytail: code policy, not a model's opinion. Any leak blocks; any open flag routes to review.
  const status: Status = residual.length || leaks.length ? 'blocked' : flags.length ? 'needs_review' : 'demo_checks_passed';
  return { out, residual, leaks, flags, status, inOriginal: ruleScan(c.turns.map(([, t]) => t)) };
}

// The buyer-facing record. Processed text only: no original strings, no mapping table.
export function build(c: Case) {
  const v = verify(c);
  return {
    sample_id: `synthetic-${c.id}`,
    synthetic: true,
    processing_mode: 'preconfigured_demo',
    legal_basis: 'synthetic',
    status: v.status,
    messages: c.turns.map(([speaker], i) => ({ turn_id: `t${i + 1}`, speaker, text: v.out[i] })),
    transformations: c.spans.map(s => ({
      id: s.id, entity_type: s.type, method: s.method, replacement: s.to,
      turn_ids: turnIds(c, s), detected_by: s.by, reason: s.why,
    })),
    context_review: c.context.map(([item, verdict, note]) => ({ item, verdict, method: 'human_authored', note })),
    review_flags: v.flags.map(s => ({ transformation_id: s.id, reason: s.review })),
    checks: [
      { check: 'format_rules', mode: 'live', findings: v.residual.length },
      { check: 'original_identifier_strings', mode: 'live', findings: v.leaks.length },
      { check: 'transformation_plan', mode: 'preconfigured' },
      { check: 'context_preservation', mode: 'human_authored' },
      { check: 'candidate_linkage', mode: 'not_run' },
    ],
    evaluation_dimensions: c.dims.map(([dimension, context]) => ({ dimension, context })),
    versions: { policy: 'demo-0.1', report: 'demo-0.1' },
  };
}
