import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CASES } from './cases.ts';
import { build, segments, verify } from './pipeline.ts';

test('every planned span and context anchor appears in its case', () => {
  for (const c of CASES) {
    for (const key of [...c.spans.map(s => s.match), ...c.anchors]) {
      assert.ok(c.turns.some(([, t]) => t.includes(key)), `${c.id}: missing "${key}"`);
    }
  }
});

test('segments reassemble to the original text', () => {
  for (const c of CASES) {
    for (const [, t] of c.turns) {
      const joined = segments(t, c).map(s => (s.kind === 'span' ? s.span.match : s.text)).join('');
      assert.equal(joined, t);
    }
  }
});

test('status follows code policy', () => {
  assert.equal(verify(CASES[0]).status, 'demo_checks_passed');
  assert.equal(verify(CASES[1]).status, 'needs_review');
});

test('a residual identifier blocks release', () => {
  const noPhoneRule = { ...CASES[0], spans: CASES[0].spans.filter(s => s.match !== '(559) 555-0142') };
  assert.equal(verify(noPhoneRule).status, 'blocked');
});

test('exported JSON never contains an original identifier', () => {
  for (const c of CASES) {
    const json = JSON.stringify(build(c));
    for (const s of c.spans) assert.ok(!json.includes(s.match), `${c.id}: leaked "${s.match}"`);
  }
});
