// Unit tests for the GEX heatmap's price-scale side (core/heatmapPriceScale.ts):
// where the scale is drawn, the padding that makes room for it, and the check
// a saved preference has to pass before the chart uses it.
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_PRICE_SCALE,
  PRICE_SCALE_EDGE_PAD,
  PRICE_SCALE_SIDES,
  PRICE_LABEL_MIN_GAP_PX,
  isPriceScaleSide,
  niceStep,
  priceScaleLayout,
  priceTicks,
  stepDecimals,
  type Pads,
} from '../core/heatmapPriceScale.ts';

// The heatmap's desktop layout: a price gutter on the left, the color legend
// on the right.
const DESKTOP: Pads = { L: 56, R: 96, T: 36, B: 48 };

test('left is the layout the chart has always had', () => {
  const layout = priceScaleLayout(DESKTOP, 'left');
  assert.deepEqual(layout.pads, DESKTOP);
  assert.equal(layout.left, true);
  assert.equal(layout.right, false);
  assert.equal(layout.rightGutter, 0);
  assert.equal(DEFAULT_PRICE_SCALE, 'left', 'nobody’s chart moves until they choose');
});

test('right moves the gutter in front of the legend and frees the left edge', () => {
  const layout = priceScaleLayout(DESKTOP, 'right');
  assert.equal(layout.left, false);
  assert.equal(layout.right, true);
  assert.equal(layout.rightGutter, DESKTOP.L, 'as wide as the left gutter it replaces');
  assert.equal(layout.pads.R, DESKTOP.R + DESKTOP.L, 'the legend keeps its own room after it');
  assert.equal(layout.pads.L, PRICE_SCALE_EDGE_PAD);
  assert.equal(layout.pads.T, DESKTOP.T);
  assert.equal(layout.pads.B, DESKTOP.B);
});

test('both keeps the left gutter and adds the right one', () => {
  const layout = priceScaleLayout(DESKTOP, 'both');
  assert.equal(layout.left, true);
  assert.equal(layout.right, true);
  assert.equal(layout.pads.L, DESKTOP.L);
  assert.equal(layout.pads.R, DESKTOP.R + DESKTOP.L);
});

test('the narrow layout, which has no legend gutter, gets the same rules', () => {
  const narrow: Pads = { L: 44, R: 8, T: 10, B: 40 };
  assert.equal(priceScaleLayout(narrow, 'right').pads.R, 52);
  assert.equal(priceScaleLayout(narrow, 'right').pads.L, PRICE_SCALE_EDGE_PAD);
  assert.deepEqual(priceScaleLayout(narrow, 'left').pads, narrow);
});

test('a saved side is used only when it is one of the options', () => {
  for (const side of PRICE_SCALE_SIDES) assert.equal(isPriceScaleSide(side), true);
  // chartSettings restores any string for a string default, so these reach
  // the chart unless this check stops them.
  for (const bad of ['', 'Left', 'middle', 'none', null, undefined, 1, true, {}]) {
    assert.equal(isPriceScaleSide(bad), false, `rejects ${JSON.stringify(bad)}`);
  }
});

// ── Price labels ──────────────────────────────────────────────────────────────
// Every label is a round multiple of a 1-2-5 step, and no two sit closer than
// PRICE_LABEL_MIN_GAP_PX. Before, Dots labelled every row, and ES rows two
// points apart printed "$7742.5" over "$7740.5".

const PLOT_H = 584; // the desktop plot height these tests assume
const gapPx = (ticks: { value: number }[], yMin: number, yMax: number) =>
  ticks.length < 2 ? Infinity : ((ticks[1].value - ticks[0].value) / (yMax - yMin)) * PLOT_H;

test('the step is 1, 2 or 5 times a power of ten', () => {
  assert.equal(niceStep(20, 22), 1);
  assert.equal(niceStep(30, 22), 2);
  assert.equal(niceStep(135, 22), 10);
  assert.equal(niceStep(100, 22), 5);
  assert.equal(niceStep(3, 22), 0.2);
  assert.equal(niceStep(0, 22), 1, 'a flat range still gets a step');
});

test('ES across a big move: round labels every 10 points, never crowded', () => {
  const [yMin, yMax] = [7673.6, 7812.4];
  const ticks = priceTicks(yMin, yMax, PLOT_H);
  assert.deepEqual(ticks.map((t) => t.label).slice(0, 3), ['$7680', '$7690', '$7700']);
  assert.equal(ticks[ticks.length - 1].label, '$7810');
  assert.ok(gapPx(ticks, yMin, yMax) >= PRICE_LABEL_MIN_GAP_PX);
  assert.ok(ticks.every((t) => t.value >= yMin && t.value <= yMax));
});

test('SPY Dots, 20 one-point strikes: a label on every strike', () => {
  const ticks = priceTicks(648.5, 668.5, PLOT_H);
  assert.equal(ticks.length, 20);
  assert.deepEqual([ticks[0].label, ticks[19].label], ['$649', '$668']);
});

test('SPY Dots, 40 strikes: every other strike', () => {
  const ticks = priceTicks(638.5, 678.5, PLOT_H);
  assert.ok(ticks.every((t) => t.value % 2 === 0));
  assert.ok(gapPx(ticks, 638.5, 678.5) >= PRICE_LABEL_MIN_GAP_PX);
});

test('SPX five-point strikes land on their own round numbers', () => {
  const ticks = priceTicks(6597.5, 6702.5, PLOT_H);
  assert.ok(ticks.every((t) => t.value % 5 === 0));
});

test('Surface on SPY (±2% of the day’s range): round labels, not counted off the bottom', () => {
  const ticks = priceTicks(641.37, 675.43, PLOT_H);
  assert.ok(ticks.every((t) => t.value % 2 === 0), ticks.map((t) => t.label).join(' '));
  assert.ok(gapPx(ticks, 641.37, 675.43) >= PRICE_LABEL_MIN_GAP_PX);
});

test('a phone-height plot gets fewer labels, still round', () => {
  const ticks = priceTicks(7673.6, 7812.4, 300);
  assert.ok(ticks.every((t) => t.value % 20 === 0), ticks.map((t) => t.label).join(' '));
  assert.ok(((ticks[1].value - ticks[0].value) / (7812.4 - 7673.6)) * 300 >= PRICE_LABEL_MIN_GAP_PX);
});

test('fractional steps print at their own precision, without float noise', () => {
  assert.equal(stepDecimals(10), 0);
  assert.equal(stepDecimals(0.5), 1);
  assert.equal(stepDecimals(0.2), 1);
  const ticks = priceTicks(661.9, 664.1, PLOT_H);
  assert.ok(ticks.length > 1);
  assert.ok(ticks.every((t) => /^\$\d+\.\d$/.test(t.label)), ticks.map((t) => t.label).join(' '));
});

test('no labels for an empty or inverted range', () => {
  assert.deepEqual(priceTicks(10, 10, PLOT_H), []);
  assert.deepEqual(priceTicks(11, 10, PLOT_H), []);
  assert.deepEqual(priceTicks(10, 11, 0), []);
});
