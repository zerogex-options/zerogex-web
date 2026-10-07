// The scan strip renders four booleans and decides nothing.
//
// The rules live in src/analytics/scan_lights.py so the base-rate report can
// grade the implementation the panel runs. What is worth pinning HERE is the
// contract between the two: which lights exist, that identity is carried by
// the label rather than the colour, and that a payload without lights renders
// nothing rather than a row of failures.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const SOURCE = readFileSync(new URL('../components/ScanLightStrip.tsx', import.meta.url), 'utf8');

test('the strip names exactly Barrie four lights, in his order', () => {
  // "Do not add further lights" is in the spec. A fifth would need this edited,
  // which is the point: it should be a decision, not a drive-by.
  const keys = [...SOURCE.matchAll(/key: '(\w+)'/g)].map((m) => m[1]);

  assert.deepEqual(keys, ['agree', 'heads_up', 'fragile', 'stand_down']);

  const labels = [...SOURCE.matchAll(/label: '([^']+)'/g)].map((m) => m[1]);
  assert.deepEqual(labels, ['Agree', 'Heads-up', 'Fragile', 'Stand down']);
});

test('every light is labeled, so colour never carries identity alone', () => {
  // The lit green sits near the Stable bid teal by necessity, which is only
  // safe because each pill says what it is.
  const labels = [...SOURCE.matchAll(/label: '([^']+)'/g)].map((m) => m[1]);

  assert.equal(labels.length, 4);
  for (const label of labels) assert.ok(label.trim().length > 0);
});

test('the lit colour is never the directional green', () => {
  // Barrie ruled out red and directional colours. A bullish green beside a
  // light called Fragile would say something the strip must never say.
  assert.ok(SOURCE.includes('--color-scan-lit'));
  assert.ok(!SOURCE.includes('--color-bull'));
  assert.ok(!SOURCE.includes('--color-bear'));
  assert.ok(!/--color-(positive|negative)/.test(SOURCE));
});

test('no rule logic lives in the component', () => {
  // It renders payload.lights. Any comparison against a classifier vocabulary
  // here would be a second implementation of rules the report grades.
  for (const token of ['PINNING', 'ACCELERATIVE', 'SUPPORTIVE', 'CAPPING', 'PERSISTENT', 'MIXED']) {
    assert.ok(!SOURCE.includes(token), `${token} suggests rule logic in the component`);
  }
});

test('a payload with no lights renders nothing at all', () => {
  // Four dim pills would read as "every rule failed", which is a different
  // statement from "this API does not serve them yet".
  assert.ok(/if \(!lights\) return null;/.test(SOURCE));
});

test('the unlit state is distinguishable without colour', () => {
  // A hollow ring when off, a filled dot when on, plus the aria label.
  assert.ok(SOURCE.includes('boxShadow'));
  assert.ok(/aria-label=\{`\$\{label\}: \$\{on \? 'yes' : 'no'\}`\}/.test(SOURCE));
});
