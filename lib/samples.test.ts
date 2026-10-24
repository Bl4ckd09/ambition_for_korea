import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadSamples } from './load-samples.ts';
import { exportRecord, marksFor, segment, STAGES } from './samples.ts';

const samples = loadSamples();

test('every sample has aligned transcripts across stages', () => {
  assert.ok(samples.length > 0);
  for (const s of samples) {
    const n = s.transcript.original.length;
    for (const stage of STAGES) assert.equal(s.transcript[stage].length, n, `${s.id} ${stage}`);
  }
});

test('segments reassemble to the original text', () => {
  for (const s of samples) {
    for (const stage of STAGES) {
      const { terms, tags } = marksFor(s, stage);
      for (const t of s.transcript[stage]) assert.equal(segment(t.text, terms, tags).map(x => x.text).join(''), t.text);
    }
  }
});

test('original identifiers are all marked in the original transcript', () => {
  for (const s of samples) {
    const { terms } = marksFor(s, 'original');
    const marked = s.transcript.original.flatMap(t => segment(t.text, terms).filter(x => x.mark).map(x => x.text));
    for (const { text } of s.highlights.original_identifiers) {
      assert.ok(marked.some(m => m.includes(text)), `${s.id}: "${text}" not marked`);
    }
  }
});

// Collects every key and string value in the export, so numbers like 0.93 can't false-match "93".
const strings = (v: unknown): string[] =>
  typeof v === 'string' ? [v]
    : Array.isArray(v) ? v.flatMap(strings)
    : v && typeof v === 'object' ? Object.entries(v).flatMap(([k, x]) => [k, ...strings(x)])
    : [];

test('export never contains an original identifier or the lineup answer key', () => {
  for (const s of samples) {
    const out = strings(exportRecord(s)).map(x => x.toLowerCase());
    const client = s.evaluation.lineup.cards.find(c => c.is_client)!;
    const secrets = [...s.highlights.original_identifiers.map(i => i.text), String(client.fields.city)];
    for (const secret of secrets) {
      assert.ok(!out.some(x => x.includes(secret.toLowerCase())), `${s.id}: export leaks "${secret}"`);
    }
  }
});
