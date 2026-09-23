// Unit tests for the GEX heatmap's price-scale side (core/heatmapPriceScale.ts):
// where the scale is drawn, the padding that makes room for it, and the check
// a saved preference has to pass before the chart uses it.
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_PRICE_SCALE,
  PRICE_SCALE_EDGE_PAD,
  PRICE_SCALE_SIDES,
  isPriceScaleSide,
  priceScaleLayout,
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
