// Unit tests for the Flow Analysis chart's strike ribbon (frontend/core/flowStrikes.ts).
//
// The contract: a /api/flow/by-strike row becomes a cell whose net is calls
// bought minus calls sold plus puts sold minus puts bought, the way the rest
// of the page adds the sides; any net leans its way and only sides that cancel
// exactly draw nothing; a tail read replaces the bars it carries and keeps the
// rest; the hover finds a strike only when the pointer is on its lane; the
// price window holds a dozen lanes on a quiet day; and the ribbon is a handful
// of grouped paths of round dots in three sizes, on Auto against the day's
// flow (so one block print cannot shrink every other dot to nothing, and a
// zoom never resizes them) or at the reader's own contract counts (so a
// closed minute keeps its dot), with a filter for the small ones.
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  AUTO_SIZING,
  STRIKE_MIN_LANES,
  autoSizeContracts,
  buildStrikeRibbon,
  cellNear,
  cleanSizing,
  mergeStrikeRows,
  parseSizing,
  ribbonPriceDomain,
  strikeCellShown,
  strikeCellsByBar,
  strikeDotRadius,
  strikeFullNet,
  strikeLean,
  strikeTier,
  sizingKey,
  type FlowStrikeRow,
  type StrikeSizing,
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

test("a dot is calls bought minus sold plus puts sold minus bought, as a subscriber's rule has it", () => {
  // 100 calls bought vs 50 calls sold: a green dot of 50.
  const [calls] = strikeCellsByBar([row(T0, 665, 100, 50, 0, 0)]).get(MS0) ?? [];
  assert.ok(calls);
  assert.equal(calls.net, 50);
  assert.equal(strikeLean(calls), 'bullish');
  // 100 puts bought vs 200 puts sold: a green dot of 100.
  const [puts] = strikeCellsByBar([row(T0, 665, 0, 0, 100, 200)]).get(MS0) ?? [];
  assert.ok(puts);
  assert.equal(puts.net, 100);
  assert.equal(strikeLean(puts), 'bullish');
  // Puts bought, calls sold: red.
  const [red] = strikeCellsByBar([row(T0, 665, 0, 30, 70, 0)]).get(MS0) ?? [];
  assert.ok(red);
  assert.equal(red.net, -100);
  assert.equal(strikeLean(red), 'bearish');
  // Both at one strike in one bar add up into one dot.
  const [both] = strikeCellsByBar([row(T0, 665, 100, 50, 100, 200)]).get(MS0) ?? [];
  assert.equal(both?.net, 150);
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

test('any net leans its way; only sides that cancel exactly are even', () => {
  assert.equal(strikeLean({ net: 1 }), 'bullish');
  assert.equal(strikeLean({ net: -1 }), 'bearish');
  // The 09:30 auction, which has no side to go on, splits exactly even.
  assert.equal(strikeLean({ net: 0 }), 'even');
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
  assert.ok(layer.count > 200);
  assert.ok(layer.paths.length <= 6, `${layer.paths.length} paths`);
  assert.equal(layer.strikeStep, 1);
  // No two-way group: those strikes draw nothing.
  for (const p of layer.paths) assert.ok(['bullish', 'bearish'].includes(p.lean));
  // Weak tiers first, so the big dots draw over the small ones.
  const order = { weak: 0, mid: 1, strong: 2 } as const;
  for (let i = 1; i < layer.paths.length; i += 1) assert.ok(order[layer.paths[i - 1].tier] <= order[layer.paths[i].tier]);
});

test('a small net is dust on Auto but a dot at contract sizes; an even strike is never one', () => {
  const byBar = strikeCellsByBar([
    row(T0, 665, 500, 0, 0, 0), // net 500
    row(T0, 666, 52, 48, 0, 0), // net 4: under Auto's floor of a 500-lot bar
    row(T0, 667, 50, 50, 0, 0), // net 0
  ]);
  const auto = buildStrikeRibbon(byBar, [MS0], GEOM);
  assert.equal(auto.count, 1);
  const own: StrikeSizing = { kind: 'contracts', small: 1, medium: 100, large: 400 };
  const contracts = buildStrikeRibbon(byBar, [MS0], GEOM, 'all', { sizing: own });
  assert.equal(contracts.count, 2);
  const small = byBar.get(MS0)?.find((c) => c.strike === 666);
  assert.ok(small);
  assert.equal(strikeCellShown(small, auto), false);
  assert.equal(strikeCellShown(small, contracts), true);
});

test('dots are round and sized by net flow, not by what traded', () => {
  // Same volume, very different net: the lopsided strike is the big dot.
  const byBar = strikeCellsByBar([row(T0, 665, 900, 100, 0, 0), row(T0, 667, 600, 400, 0, 0)]);
  const layer = buildStrikeRibbon(byBar, [MS0], GEOM);
  const radii = [...layer.paths.map((p) => p.d).join(' ').matchAll(/A ([\d.]+) ([\d.]+)/g)].map((m) => [Number(m[1]), Number(m[2])]);
  for (const [rx, ry] of radii) assert.equal(rx, ry, 'a circle');
  assert.equal(layer.fullNet, 800);
  // Each circle is two arcs; the lopsided strike's is the bigger one.
  const sizes = radii.map(([r]) => r);
  assert.ok(Math.max(...sizes) > Math.min(...sizes) * 1.5, `${sizes}`);
  // And the hover ring's radius is the drawn one.
  const lopsided = byBar.get(MS0)?.find((c) => c.strike === 665);
  assert.ok(lopsided);
  assert.equal(strikeDotRadius(lopsided, layer).toFixed(1), Math.max(...sizes).toFixed(1));
});

test('dots come in three sizes, not a smooth run', () => {
  const rows: FlowStrikeRow[] = [];
  for (let bar = 0; bar < 30; bar += 1) {
    const ts = new Date(MS0 + bar * 300_000).toISOString();
    for (let k = 660; k <= 670; k += 1) rows.push(row(ts, k, 20 + ((bar * 7 + k * 13) % 400), 5, 0, 0));
  }
  const byBar = strikeCellsByBar(rows);
  const layer = buildStrikeRibbon(byBar, Array.from(byBar.keys()), GEOM);
  const radii = new Set([...layer.paths.map((p) => p.d).join(' ').matchAll(/A ([\d.]+) /g)].map((m) => m[1]));
  assert.ok(radii.size <= 3, `${[...radii]}`);
  assert.ok(radii.size >= 2);
});

test('a full size set over the session holds the dots still under a zoom', () => {
  const rows: FlowStrikeRow[] = [];
  for (let bar = 0; bar < 60; bar += 1) {
    const ts = new Date(MS0 + bar * 300_000).toISOString();
    // A quiet first half, a busy second half.
    rows.push(row(ts, 665, bar < 30 ? 100 : 1000, 0, 0, 0));
  }
  const byBar = strikeCellsByBar(rows);
  const all = Array.from(byBar.keys());
  const full = strikeFullNet(byBar, all, GEOM.dMin, GEOM.dMax);
  assert.equal(full, 1000);
  // Zoomed into the quiet half: left alone it would make those dots large.
  const quiet = all.slice(0, 20);
  const own = buildStrikeRibbon(byBar, quiet, GEOM);
  const held = buildStrikeRibbon(byBar, quiet, GEOM, 'all', { fullNet: full });
  assert.ok(own.paths.every((p) => p.tier === 'strong'));
  assert.ok(held.paths.every((p) => p.tier === 'weak'));
  assert.equal(held.fullNet, 1000);
});

test('the size filter hides the smaller dots without resizing the rest', () => {
  const rows: FlowStrikeRow[] = [];
  // Nets of 1,000 (full), 300 (medium) and 80 (small) at three strikes.
  rows.push(row(T0, 665, 1000, 0, 0, 0), row(T0, 666, 300, 0, 0, 0), row(T0, 667, 80, 0, 0, 0));
  const byBar = strikeCellsByBar(rows);
  const all = buildStrikeRibbon(byBar, [MS0], GEOM, 'all');
  const medium = buildStrikeRibbon(byBar, [MS0], GEOM, 'medium');
  const large = buildStrikeRibbon(byBar, [MS0], GEOM, 'large');
  assert.deepEqual([all.count, medium.count, large.count], [3, 2, 1]);
  // Full size is the same at every setting.
  assert.equal(all.fullNet, large.fullNet);
  const big = (l: typeof all) => l.paths.find((p) => p.tier === 'strong')?.d;
  assert.equal(big(all), big(large));
  // And the filter works the same on contract sizes.
  const own: StrikeSizing = { kind: 'contracts', small: 50, medium: 200, large: 900 };
  const counts = (['all', 'medium', 'large'] as const).map((f) => buildStrikeRibbon(byBar, [MS0], GEOM, f, { sizing: own }).count);
  assert.deepEqual(counts, [3, 2, 1]);
});

test('at contract sizes a dot is its net alone, so a closed minute keeps it as the day goes on', () => {
  const own: StrikeSizing = { kind: 'contracts', small: 100, medium: 500, large: 2000 };
  assert.equal(strikeTier({ net: 99 }, { sizing: own, fullNet: 0 }), null);
  assert.equal(strikeTier({ net: -100 }, { sizing: own, fullNet: 0 }), 'weak');
  assert.equal(strikeTier({ net: 500 }, { sizing: own, fullNet: 0 }), 'mid');
  assert.equal(strikeTier({ net: -2500 }, { sizing: own, fullNet: 0 }), 'strong');
  // The 10:00 bar's dot, before and after a far bigger 11:00 bar arrives.
  const early = strikeCellsByBar([row(T0, 665, 600, 0, 0, 0)]);
  const later = strikeCellsByBar([row(T0, 665, 600, 0, 0, 0), row(T1, 665, 50_000, 0, 0, 0)]);
  const dot = (byBar: ReturnType<typeof strikeCellsByBar>, sizing: StrikeSizing) =>
    buildStrikeRibbon(byBar, [MS0], GEOM, 'all', { sizing, fullNet: sizing.kind === 'auto' ? undefined : 0 }).paths.map((p) => p.tier);
  assert.deepEqual(dot(early, own), dot(later, own));
  // On Auto the same minute steps down once the bigger bar sets full size.
  const autoEarly = buildStrikeRibbon(early, [MS0], GEOM).paths.map((p) => p.tier);
  const autoLater = buildStrikeRibbon(later, [MS0], GEOM, 'all', { fullNet: strikeFullNet(later, [MS0, MS1], GEOM.dMin, GEOM.dMax) }).paths.map((p) => p.tier);
  assert.notDeepEqual(autoEarly, autoLater);
});

test('dot sizes as typed are cleaned up and stored', () => {
  // Out of order: sorted. Fractions: whole contracts.
  assert.deepEqual(cleanSizing(1000, 50, 250.4), { kind: 'contracts', small: 50, medium: 250, large: 1000 });
  // Blank, zero or nonsense: Auto.
  assert.deepEqual(cleanSizing(Number.NaN, 50, 250), AUTO_SIZING);
  assert.deepEqual(cleanSizing(0, 50, 250), AUTO_SIZING);
  // Stored and read back.
  const own = cleanSizing(50, 250, 1000);
  assert.equal(sizingKey(own), '50,250,1000');
  assert.deepEqual(parseSizing(sizingKey(own)), own);
  assert.deepEqual(parseSizing('auto'), AUTO_SIZING);
  assert.deepEqual(parseSizing('garbage'), AUTO_SIZING);
  assert.deepEqual(parseSizing(null), AUTO_SIZING);
});

test("the sizes editor starts from Auto's own cutoffs, in numbers someone would type", () => {
  assert.deepEqual(autoSizeContracts(1234), { small: 62, medium: 190, large: 620 });
  assert.deepEqual(autoSizeContracts(40), { small: 2, medium: 6, large: 20 });
  assert.equal(autoSizeContracts(0), null);
});

test('strikes outside the price window and dust under the floor draw nothing', () => {
  const byBar = strikeCellsByBar([
    row(T0, 665, 1000, 0, 0, 0),
    row(T0, 690, 1000, 0, 0, 0), // off the window
    row(T0, 666, 1, 0, 0, 0), // under the noise floor of a 1,000-lot bar
  ]);
  const layer = buildStrikeRibbon(byBar, [MS0], GEOM);
  assert.equal(layer.count, 1);
  assert.equal(layer.fullNet, 1000);
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
  assert.equal(layer.fullNet, 100);
  // So the ordinary orbs all draw, at full strength.
  assert.ok(layer.count >= 60);
  assert.ok(layer.paths.some((p) => p.tier === 'strong'));
});

test('nothing in view: an empty layer', () => {
  const layer = buildStrikeRibbon(new Map(), [], GEOM);
  assert.deepEqual(layer, { paths: [], sizing: AUTO_SIZING, fullNet: 0, dotR: 0, strikeStep: null, count: 0 });
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
