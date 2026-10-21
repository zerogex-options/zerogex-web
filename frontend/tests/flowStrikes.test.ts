// Unit tests for the Flow Analysis chart's strike ribbon (frontend/core/flowStrikes.ts).
//
// The contract: a /api/flow/by-strike row becomes a cell whose sides add up
// the way the rest of the page adds them (calls bought + puts sold is the
// bullish side); a strike leads one way only by a real margin; a tail read
// replaces the bars it carries and keeps the rest; the hover finds a strike
// only when the pointer is on its lane; the price window holds a dozen lanes
// on a quiet day; and the ribbon is a handful of grouped paths, sized so one
// block print cannot shrink every other orb to nothing.
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  STRIKE_EVEN_SHARE,
  STRIKE_MIN_LANES,
  buildStrikeRibbon,
  cellNear,
  mergeStrikeRows,
  ribbonPriceDomain,
  strikeCellsByBar,
  strikeLean,
  type FlowStrikeRow,
} from '../core/flowStrikes.ts';
import { paneLayout } from '../core/flowAnalysis.ts';

const T0 = '2026-10-16T13:30:00Z';
const T1 = '2026-10-16T13:35:00Z';
const MS0 = Date.parse(T0);
const MS1 = Date.parse(T1);

function row(timestamp: string, strike: number, cb: number, cs: number, pb: number, ps: number): FlowStrikeRow {
  return { timestamp, strike, call_bought: cb, call_sold: cs, put_bought: pb, put_sold: ps };
}

test('cells add up the sides the way the page does', () => {
  const cells = strikeCellsByBar([row(T0, 665, 40, 10, 5, 25)]).get(MS0);
  assert.ok(cells);
  const [c] = cells;
  assert.equal(c.volume, 80);
  assert.equal(c.bullish, 65); // calls bought + puts sold
  assert.equal(c.bearish, 15); // puts bought + calls sold
  assert.equal(c.net, 50);
});

test('cells are strike-ascending per bar, parse strings, and skip empty or broken rows', () => {
  const byBar = strikeCellsByBar([
    row(T0, 667, 1, 0, 0, 0),
    { timestamp: T0, strike: '665.5', call_bought: '3', call_sold: null, put_bought: 0, put_sold: undefined },
    row(T0, 666, 0, 0, 0, 0), // nothing traded
    { timestamp: 'not a time', strike: 664, call_bought: 9 },
    { timestamp: T0, strike: 'x', call_bought: 9 },
    row(T1, 660, 2, 2, 2, 2),
  ]);
  assert.deepEqual(
    byBar.get(MS0)?.map((c) => [c.strike, c.volume]),
    [
      [665.5, 3],
      [667, 1],
    ],
  );
  assert.equal(byBar.get(MS1)?.length, 1);
  assert.equal(byBar.size, 2);
});

test('a repeated bar and strike is the newer read and replaces', () => {
  const cells = strikeCellsByBar([row(T0, 665, 1, 0, 0, 0), row(T0, 665, 9, 0, 0, 0)]).get(MS0);
  assert.equal(cells?.length, 1);
  assert.equal(cells?.[0].callsBought, 9);
});

test('a strike leads one way only by a real margin', () => {
  assert.equal(strikeLean({ net: 30, volume: 100 }), 'bullish');
  assert.equal(strikeLean({ net: -30, volume: 100 }), 'bearish');
  // Under the even share: two-way.
  assert.equal(strikeLean({ net: 100 * STRIKE_EVEN_SHARE - 1, volume: 100 }), 'even');
  // The 09:30 auction splits exactly even.
  assert.equal(strikeLean({ net: 0, volume: 500 }), 'even');
  assert.equal(strikeLean({ net: 0, volume: 0 }), 'even');
});

test('a tail read replaces the bars it carries and keeps the rest', () => {
  const prev = [row(T0, 665, 1, 1, 1, 1), row(T1, 665, 1, 0, 0, 0), row(T1, 666, 1, 0, 0, 0)];
  const tail = [row(T1, 665, 5, 0, 0, 0)];
  const merged = mergeStrikeRows(prev, tail);
  const byBar = strikeCellsByBar(merged);
  assert.equal(byBar.get(MS0)?.length, 1); // untouched
  assert.deepEqual(
    byBar.get(MS1)?.map((c) => [c.strike, c.callsBought]),
    [[665, 5]],
  );
  assert.deepEqual(mergeStrikeRows(prev, []), prev);
});

test('the hover finds a strike only on its lane', () => {
  const cells = strikeCellsByBar([row(T0, 665, 1, 0, 0, 0), row(T0, 667, 1, 0, 0, 0)]).get(MS0);
  assert.equal(cellNear(cells, 665.4, 1)?.strike, 665);
  assert.equal(cellNear(cells, 666.6, 1)?.strike, 667);
  // Halfway between two lanes with no cell at 666: nothing.
  assert.equal(cellNear(cells, 666, 1), null);
  assert.equal(cellNear(undefined, 665, 1), null);
  assert.equal(cellNear(cells, Number.NaN, 1), null);
});

test('the price window holds a dozen lanes on a quiet day and never shrinks a wide one', () => {
  const quiet = ribbonPriceDomain([664.8, 665.6], [], 1);
  assert.ok(quiet);
  assert.ok(quiet.max - quiet.min >= STRIKE_MIN_LANES * 1 - 1e-9);
  // Centred on the session.
  assert.ok(Math.abs((quiet.max + quiet.min) / 2 - 665.2) < 0.01);

  const wide = ribbonPriceDomain([640, 670], [], 1);
  assert.ok(wide && wide.min <= 640 && wide.max >= 670);
  assert.ok(wide.max - wide.min < 40);

  // A level near the prices still joins the window.
  const withWall = ribbonPriceDomain([660, 670], [674], 1);
  assert.ok(withWall && withWall.max >= 674);

  // No strike step known: the plain window.
  const plain = ribbonPriceDomain([664.8, 665.6], [], null);
  assert.ok(plain && plain.max - plain.min < 2);
});

const GEOM = {
  x: (ms: number) => (ms - MS0) / 60_000 + 10,
  yPrice: (p: number) => (700 - p) * 10,
  slotW: 8,
  dMin: 660,
  dMax: 670,
};

test('the ribbon is a handful of grouped paths, not an element per orb', () => {
  const rows: FlowStrikeRow[] = [];
  for (let bar = 0; bar < 40; bar += 1) {
    const ts = new Date(MS0 + bar * 300_000).toISOString();
    for (let k = 660; k <= 670; k += 1) rows.push(row(ts, k, 50 + bar, 10, 10 + (k % 3) * 30, 5));
  }
  const byBar = strikeCellsByBar(rows);
  const layer = buildStrikeRibbon(byBar, Array.from(byBar.keys()), GEOM);
  assert.ok(layer.count > 300);
  assert.ok(layer.paths.length <= 9, `${layer.paths.length} paths`);
  assert.equal(layer.strikeStep, 1);
  for (const p of layer.paths) assert.ok(['bullish', 'bearish', 'even'].includes(p.lean));
});

test('strikes outside the price window and dust under the floor draw nothing', () => {
  const byBar = strikeCellsByBar([
    row(T0, 665, 1000, 0, 0, 0),
    row(T0, 690, 1000, 0, 0, 0), // off the window
    row(T0, 666, 1, 0, 0, 0), // under the noise floor of a 1,000-lot bar
  ]);
  const layer = buildStrikeRibbon(byBar, [MS0], GEOM);
  assert.equal(layer.count, 1);
  assert.equal(layer.fullVolume, 1000);
});

test('one block print does not shrink every other orb to a sliver', () => {
  const rows: FlowStrikeRow[] = [];
  for (let bar = 0; bar < 60; bar += 1) {
    const ts = new Date(MS0 + bar * 300_000).toISOString();
    rows.push(row(ts, 665, 100, 0, 0, 0));
  }
  rows.push(row(T0, 666, 100_000, 0, 0, 0)); // a block, 1,000x the rest
  const byBar = strikeCellsByBar(rows);
  const layer = buildStrikeRibbon(byBar, Array.from(byBar.keys()), GEOM);
  // Full size sits at the ordinary bars, not at the block.
  assert.equal(layer.fullVolume, 100);
  // So the ordinary orbs all draw, at full strength.
  assert.ok(layer.count >= 60);
  assert.ok(layer.paths.some((p) => p.tier === 'strong'));
});

test('nothing in view: an empty layer', () => {
  const layer = buildStrikeRibbon(new Map(), [], GEOM);
  assert.deepEqual(layer, { paths: [], fullVolume: 0, strikeStep: null, count: 0 });
});

test('the price pane is sized for the ribbon whether or not it is drawn', () => {
  // The layout takes no ribbon flag at all, so switching the ribbon cannot
  // move a pane; the price pane is the tallest, room for a dozen lanes.
  const bands = paneLayout(['price', 'premium', 'contracts', 'pcr'], 0, 600, 12);
  const price = bands.find((b) => b.key === 'price')?.height ?? 0;
  for (const b of bands) if (b.key !== 'price') assert.ok(price > b.height, `price over ${b.key}`);
  // Still fills the height exactly.
  const lastBand = bands[bands.length - 1];
  assert.equal(lastBand.top + lastBand.height, 600);
});
