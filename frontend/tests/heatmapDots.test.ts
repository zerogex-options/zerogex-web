// Unit tests for the GEX heatmap's Dots view (core/heatmapDots.ts): which
// strikes become rows, how many intervals fit, how big a dot is, and the
// checks a saved preference has to pass before the chart uses it.
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_DOT_STRIKES,
  DEFAULT_HEATMAP_VIEW,
  MIN_DOT_COLUMN_PX,
  dotRadius,
  dotRowBounds,
  dotWindowStart,
  isDotStrikeCount,
  isHeatmapView,
  nearestRow,
  pickDotRows,
  rowStep,
} from '../core/heatmapDots.ts';

const range = (lo: number, hi: number, step = 1) => {
  const out: number[] = [];
  for (let s = lo; s <= hi; s += step) out.push(s);
  return out;
};

test('nobody’s chart changes until they pick Dots', () => {
  assert.equal(DEFAULT_HEATMAP_VIEW, 'surface');
  assert.equal(DEFAULT_DOT_STRIKES, 20);
});

test('a saved view or strike count is only used if it is one of the options', () => {
  assert.ok(isHeatmapView('surface'));
  assert.ok(isHeatmapView('dots'));
  for (const bad of ['Dots', 'bubbles', '', 1, null, undefined]) assert.ok(!isHeatmapView(bad), String(bad));
  for (const ok of [10, 20, 40]) assert.ok(isDotStrikeCount(ok));
  for (const bad of [0, 15, 41, '20', null, NaN]) assert.ok(!isDotStrikeCount(bad), String(bad));
});

test('rows: the requested number of strikes, centered on the price range', () => {
  const rows = pickDotRows(range(600, 720), 659.2, 662.8, 20);
  assert.equal(rows.length, 20);
  assert.deepEqual(rows, range(651, 670));
  assert.ok(rows[0] <= 659.2 && rows[rows.length - 1] >= 662.8);
});

test('rows widen past the count so a big move stays on the chart', () => {
  const rows = pickDotRows(range(600, 720), 640.4, 671.6, 10);
  assert.ok(rows.length > 10);
  assert.ok(rows[0] <= 640.4, `lowest row ${rows[0]}`);
  assert.ok(rows[rows.length - 1] >= 671.6, `highest row ${rows[rows.length - 1]}`);
});

test('rows follow the chain’s own spacing (SPX 5-point strikes)', () => {
  const rows = pickDotRows(range(6400, 6900, 5), 6648, 6662, 10);
  assert.equal(rows.length, 10);
  assert.ok(rows.every((s) => s % 5 === 0));
  assert.ok(rows.includes(6650) && rows.includes(6660));
});

test('rows stop at the edge of the chain, and come back sorted', () => {
  assert.deepEqual(pickDotRows([5, 3, 4, 1, 2], 1.2, 1.4, 3), [1, 2, 3]);
  assert.deepEqual(pickDotRows([1, 2, 3], 2, 2, 20), [1, 2, 3]);
  assert.deepEqual(pickDotRows([], 2, 2, 20), []);
});

test('with no price, rows sit in the middle of the chain', () => {
  assert.deepEqual(pickDotRows(range(1, 9), null, null, 3), [4, 5, 6]);
});

test('the y-range runs half a strike past each end row', () => {
  assert.deepEqual(dotRowBounds([650, 651, 652]), { yMin: 649.5, yMax: 652.5 });
  assert.deepEqual(dotRowBounds([6650, 6655, 6660]), { yMin: 6647.5, yMax: 6662.5 });
  assert.equal(rowStep([650, 651, 652, 660]), 1, 'one odd gap doesn’t set the step');
  assert.equal(rowStep([650]), 1);
});

test('the hover snaps to the nearest row', () => {
  assert.equal(nearestRow([650, 655, 660], 653.1), 655);
  assert.equal(nearestRow([650, 655, 660], 640), 650);
});

test('only as many recent intervals as fit at a readable dot size', () => {
  assert.equal(dotWindowStart(90, 1100), 0, 'a desktop plot fits the whole session');
  assert.equal(dotWindowStart(180, 1100), 180 - Math.floor(1100 / MIN_DOT_COLUMN_PX));
  assert.equal(dotWindowStart(90, 330), 90 - Math.floor(330 / MIN_DOT_COLUMN_PX), 'a phone keeps the latest');
  assert.equal(dotWindowStart(90, 2), 89, 'always at least one interval');
});

test('dot area tracks |GEX|, capped, with a floor for any nonzero value', () => {
  const r = (v: number) => dotRadius(v, 100, 10);
  assert.equal(r(100), 10);
  assert.equal(r(-100), 10, 'sign does not change size');
  assert.equal(r(400), 10, 'clipped');
  assert.ok(Math.abs(r(25) ** 2 / r(100) ** 2 - 0.25) < 1e-9, 'a quarter of the GEX, a quarter of the area');
  assert.equal(r(0.0001), 1.1, 'a quiet strike is still a speck');
  assert.equal(r(0), 0);
  assert.equal(r(NaN), 0, 'no reported value, no dot');
  assert.equal(dotRadius(50, 0, 10), 0);
  assert.equal(dotRadius(1, 100, 0.5), 0.5, 'never bigger than the cell allows');
});
