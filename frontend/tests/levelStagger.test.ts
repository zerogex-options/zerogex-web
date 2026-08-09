// Unit tests for the reference-level label de-collision used by the Daily
// Replay scrubber and its shareable snapshot. Every expectation is hand-derived
// from the three-pass algorithm: start each label `anchor` px above its line,
// push overlaps down to keep `gap`, pull the stack up if it overran `maxY`,
// then clamp the top to `minY` — always preserving input order.
import test from 'node:test';
import assert from 'node:assert/strict';

import { staggerLabelYs } from '../app/replay/[symbol]/[date]/levelStagger.ts';

const OPTS = { gap: 13, minY: 10, maxY: 500 };

test('well-separated levels: labels sit anchor px above each line', () => {
  assert.deepEqual(staggerLabelYs([100, 200, 300], OPTS), [96, 196, 296]);
});

test('empty and single inputs', () => {
  assert.deepEqual(staggerLabelYs([], OPTS), []);
  assert.deepEqual(staggerLabelYs([250], OPTS), [246]);
});

test('two close levels are pushed apart to exactly the gap', () => {
  const ys = staggerLabelYs([100, 105], OPTS);
  assert.deepEqual(ys, [96, 109]);
  assert.equal(ys[1] - ys[0], 13);
});

test('a tight cluster spreads downward at the gap', () => {
  assert.deepEqual(staggerLabelYs([100, 104, 108], OPTS), [96, 109, 122]);
});

test('a cluster overrunning the bottom is pulled back up within maxY', () => {
  const ys = staggerLabelYs([480, 490, 500], OPTS);
  assert.deepEqual(ys, [474, 487, 500]);
  assert.ok(ys[ys.length - 1] <= OPTS.maxY);
  assert.equal(ys[1] - ys[0], 13);
  assert.equal(ys[2] - ys[1], 13);
});

test('labels near the top are clamped to minY and re-spread', () => {
  const ys = staggerLabelYs([5, 8], OPTS);
  assert.deepEqual(ys, [10, 23]);
  assert.ok(ys[0] >= OPTS.minY);
});

test('custom anchor offsets the starting position', () => {
  assert.deepEqual(staggerLabelYs([100, 200], { ...OPTS, anchor: 0 }), [100, 200]);
});

test('never overlaps: every adjacent pair keeps at least the gap', () => {
  const ys = staggerLabelYs([120, 122, 124, 126, 128], OPTS);
  for (let i = 1; i < ys.length; i += 1) {
    assert.ok(ys[i] - ys[i - 1] >= 13 - 1e-9, `pair ${i} too close: ${ys[i - 1]} → ${ys[i]}`);
  }
});
