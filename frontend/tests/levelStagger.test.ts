// Unit tests for the reference-level label de-collision used by the Daily
// Replay scrubber and its shareable snapshot. Every expectation is hand-derived
// from the three-pass algorithm: start each label `anchor` px above its line,
// push overlaps down to keep `gap`, pull the stack up if it overran `maxY`,
// then clamp the top to `minY` — always preserving input order.
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  classifyLevelVisibility,
  staggerLabelYs,
} from '../app/replay/[symbol]/[date]/levelStagger.ts';

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

// ── classifyLevelVisibility ────────────────────────────────────────────────
// The plot drops a level silently in three different situations, and all three
// look identical on screen: nothing. These pin the distinction the status row
// depends on. The band and the 1px slack deliberately mirror the marker filter
// in ReplayScrubber, so 'on' means exactly "this level got a marker".

const BAND = { top: 24, bottom: 500 };
// A straight linear map from price to y over the band: 700 → bottom, 800 → top.
const yFor = (price: number) => BAND.bottom - ((price - 700) / 100) * (BAND.bottom - BAND.top);

test('a level inside the visible band is on the chart', () => {
  assert.equal(classifyLevelVisibility(750, yFor, BAND), 'on');
  assert.equal(classifyLevelVisibility(700, yFor, BAND), 'on');
  assert.equal(classifyLevelVisibility(800, yFor, BAND), 'on');
});

test('a missing level reads as none, never as a position', () => {
  // The Pin is null whenever the server suppresses it below the score floor —
  // 25 of the 391 minutes in QQQ's 2026-08-24 session, including the close.
  assert.equal(classifyLevelVisibility(null, yFor, BAND), 'none');
  assert.equal(classifyLevelVisibility(undefined, yFor, BAND), 'none');
  assert.equal(classifyLevelVisibility(Number.NaN, yFor, BAND), 'none');
  assert.equal(classifyLevelVisibility(Number.POSITIVE_INFINITY, yFor, BAND), 'none');
});

test('a level off the top or bottom of the band is reported with its direction', () => {
  assert.equal(classifyLevelVisibility(900, yFor, BAND), 'above');
  assert.equal(classifyLevelVisibility(600, yFor, BAND), 'below');
});

test('zero is a position, not an absence', () => {
  // Distinct from `none`: a level legitimately at 0 must not be swallowed by a
  // falsy check. It is off the band here, so it reports its direction.
  assert.equal(classifyLevelVisibility(0, yFor, BAND), 'below');
});

test('the 1px slack matches the marker filter, so on means drawn', () => {
  // Exactly 1px past each edge still counts as on — the same inclusive slack
  // the plot's own filter uses. Past that, it is clipped and says so.
  const atTopEdge = (y: number) => y;
  assert.equal(classifyLevelVisibility(BAND.top - 1, atTopEdge, BAND), 'on');
  assert.equal(classifyLevelVisibility(BAND.top - 2, atTopEdge, BAND), 'above');
  assert.equal(classifyLevelVisibility(BAND.bottom + 1, atTopEdge, BAND), 'on');
  assert.equal(classifyLevelVisibility(BAND.bottom + 2, atTopEdge, BAND), 'below');
});
