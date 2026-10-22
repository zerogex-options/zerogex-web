// Unit tests for the Strike Panel's strike axis labels.
//
// The rules:
//   • labels never overlap, however far the reader zooms out;
//   • zoomed in, every strike is labeled;
//   • zoomed out, the axis labels every 2nd / 5th / 10th ... strike, on round
//     multiples of that step;
//   • the strike being read is always labeled, and its neighbors give way.
import test from 'node:test';
import assert from 'node:assert/strict';

import { formatStrike, strikeAxisLabels } from '../core/strikeAxis.ts';

// A price axis with `pxPer` units per point, higher prices higher up (lower y).
const axis = (pxPer: number, top = 700) => (price: number) => (top - price) * pxPer;
const range = (from: number, to: number, step: number) => {
  const out: number[] = [];
  for (let p = from; p <= to + 1e-9; p += step) out.push(Math.round(p * 100) / 100);
  return out;
};

const assertNoOverlap = (ys: number[], minGap: number) => {
  const sorted = [...ys].sort((a, b) => a - b);
  for (let i = 1; i < sorted.length; i++) assert.ok(sorted[i] - sorted[i - 1] >= minGap - 1e-9, `labels ${sorted[i - 1]} and ${sorted[i]} overlap`);
};

test('zoomed in, every strike is labeled', () => {
  const strikes = range(680, 700, 1);
  const r = strikeAxisLabels({ strikes, yFor: axis(20), minGap: 12, yMin: 0, yMax: 1000 });
  assert.equal(r.every, 1);
  assert.equal(r.labels.length, strikes.length);
});

test('zoomed out, labels step by 2 / 5 / 10 on round strikes and never overlap', () => {
  const strikes = range(600, 700, 1);
  for (const [pxPer, every] of [[8, 2], [4, 5], [2, 10], [1, 20], [0.4, 50]] as const) {
    const r = strikeAxisLabels({ strikes, yFor: axis(pxPer), minGap: 12, yMin: -1e6, yMax: 1e6 });
    assert.equal(r.every, every, `at ${pxPer} units per point`);
    assert.ok(r.labels.length > 0);
    for (const l of r.labels) assert.equal(l.price % every, 0, `${l.price} is not on a multiple of ${every}`);
    assertNoOverlap(r.labels.map((l) => l.y), 12);
  }
});

test('SPX-style 5-point strikes step on round multiples of the step', () => {
  const strikes = range(5800, 6200, 5);
  const r = strikeAxisLabels({ strikes, yFor: axis(0.5, 6300), minGap: 12, yMin: -1e6, yMax: 1e6 });
  // 5 points = 2.5 units, so a 12-unit gap needs every 5th strike: 25 points.
  assert.equal(r.every, 5);
  for (const l of r.labels) assert.equal(l.price % 25, 0);
});

test('irregular grids (wider strikes far out) still never overlap', () => {
  const strikes = [...range(500, 590, 5), ...range(591, 609, 1), ...range(610, 700, 5), 612.5, 607.5];
  const r = strikeAxisLabels({ strikes, yFor: axis(3), minGap: 12, yMin: -1e6, yMax: 1e6 });
  assertNoOverlap(r.labels.map((l) => l.y), 12);
});

test('strikes off the round multiples fall back to every Nth strike', () => {
  const strikes = range(600.5, 700.5, 1);
  const r = strikeAxisLabels({ strikes, yFor: axis(4), minGap: 12, yMin: -1e6, yMax: 1e6 });
  assert.equal(r.every, 5);
  assert.ok(r.labels.length >= 15);
  assertNoOverlap(r.labels.map((l) => l.y), 12);
});

test('the focused strike is always labeled and its neighbors give way', () => {
  const strikes = range(600, 700, 1);
  const r = strikeAxisLabels({ strikes, yFor: axis(4), minGap: 12, yMin: -1e6, yMax: 1e6, focus: 651 });
  const focused = r.labels.filter((l) => l.focus);
  assert.equal(focused.length, 1);
  assert.equal(focused[0].price, 651);
  assert.ok(!r.labels.some((l) => l.price === 650), '650 sits 4 units from 651 and must give way');
  assertNoOverlap(r.labels.map((l) => l.y), 12);
});

test('only strikes inside the visible band are labeled', () => {
  const strikes = range(600, 700, 1);
  const yFor = axis(20);
  const r = strikeAxisLabels({ strikes, yFor, minGap: 12, yMin: yFor(660), yMax: yFor(640) });
  assert.ok(r.labels.every((l) => l.price >= 640 && l.price <= 660));
  assert.equal(r.strikes.length, 21);
});

test('no strikes, no labels', () => {
  const r = strikeAxisLabels({ strikes: [], yFor: axis(1), minGap: 12, yMin: 0, yMax: 100 });
  assert.deepEqual(r.labels, []);
});

test('formatStrike prints strikes compactly', () => {
  assert.equal(formatStrike(6025), '6025');
  assert.equal(formatStrike(687.5), '687.5');
  assert.equal(formatStrike(102.25), '102.25');
});
