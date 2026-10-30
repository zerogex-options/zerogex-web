// Unit tests for the Fuseline Radar's arithmetic.
//
// Every rule here makes a claim about a price or a time on a trader's route:
// where a strike sits relative to the Fuse and targets, how much it changed
// over a window, and which instrument a number is in. Those are the claims
// worth pinning, because a wrong one looks exactly like a right one.
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  EMPTY_PLAN,
  anchorCrossed,
  buildTerrain,
  convertPrice,
  describeBasisSource,
  etOffsetMinutes,
  formatGamma,
  formatSizeDelta,
  formatStrike,
  fitPricesFor,
  nextRelevantStrike,
  planLevels,
  planProblems,
  provisionalThreshold,
  routeReady,
  routeZone,
  sessionBounds,
  sizeContext,
  strikeChange,
  targetPassed,
  type RadarPlan,
} from '../core/fuselineRadar.ts';

const RATIO = 1.00575;
const MIN = 60_000;

// ---- Coordinates ----------------------------------------------------------

test('ES and SPX convert through the ratio and back', () => {
  const es = convertPrice(6716.4, 'SPX', 'ES', RATIO);
  assert.ok(Math.abs(es - 6716.4 * RATIO) < 1e-9);
  assert.ok(Math.abs(convertPrice(es, 'ES', 'SPX', RATIO) - 6716.4) < 1e-9);
  assert.equal(convertPrice(6745, 'ES', 'ES', RATIO), 6745);
});

test('a plan typed in ES is shown in SPX without re-entering it', () => {
  const plan: RadarPlan = { instrument: 'ES', direction: 'up', fuse: 6745, t1: 6768, t2: 6790 };
  const spx = planLevels(plan, 'SPX', RATIO);
  assert.ok(Math.abs(spx.fuse! - 6745 / RATIO) < 1e-9);
  assert.deepEqual(planLevels(plan, 'ES', RATIO), { fuse: 6745, t1: 6768, t2: 6790 });
});

test('a basis that was not measured is flagged', () => {
  assert.equal(describeBasisSource('measured').flag, false);
  assert.equal(describeBasisSource('measured_stale').flag, true);
  assert.equal(describeBasisSource('carry').flag, true);
  assert.equal(describeBasisSource(null).flag, true);
});

test('strike labels follow the display instrument', () => {
  assert.equal(formatStrike(6730, 'SPX', RATIO), '6730');
  assert.equal(formatStrike(6730, 'ES', RATIO), (6730 * RATIO).toFixed(1));
});

// ---- The plan ---------------------------------------------------------------

test('an empty plan asks for the Fuse and Target 1', () => {
  assert.equal(planProblems(EMPTY_PLAN).length, 2);
  assert.equal(routeReady(EMPTY_PLAN), false);
});

test('a target on the wrong side is reported, never reordered', () => {
  const up: RadarPlan = { instrument: 'ES', direction: 'up', fuse: 6745, t1: 6730, t2: null };
  assert.match(planProblems(up)[0], /above the Fuse/);
  assert.equal(routeReady(up), false);

  const down: RadarPlan = { instrument: 'ES', direction: 'down', fuse: 6745, t1: 6760, t2: null };
  assert.match(planProblems(down)[0], /below the Fuse/);
});

test('a bad Target 2 keeps the route but is not drawn', () => {
  const plan: RadarPlan = { instrument: 'ES', direction: 'up', fuse: 6745, t1: 6768, t2: 6750 };
  assert.equal(routeReady(plan), true);
  assert.match(planProblems(plan)[0], /Target 2 must be above Target 1/);
  assert.equal(planLevels(plan, 'ES', RATIO).t2, null);
});

// ---- Where a price sits on the route ----------------------------------------

const UP = { fuse: 6745, t1: 6768, t2: 6790, spot: 6755 };

test('an up route classifies every stretch of the price axis', () => {
  assert.equal(routeZone(6735, UP, 'up'), 'behind');
  assert.equal(routeZone(6749, UP, 'up'), 'retrace');
  assert.equal(routeZone(6756, UP, 'up'), 'spot');
  assert.equal(routeZone(6762, UP, 'up'), 'active');
  assert.equal(routeZone(6769, UP, 'up'), 't1');
  assert.equal(routeZone(6780, UP, 'up'), 'extension');
  assert.equal(routeZone(6800, UP, 'up'), 'beyond');
});

test('a down route is the mirror image', () => {
  const down = { fuse: 6745, t1: 6722, t2: 6700, spot: 6735 };
  assert.equal(routeZone(6755, down, 'down'), 'behind');
  assert.equal(routeZone(6740, down, 'down'), 'retrace');
  assert.equal(routeZone(6728, down, 'down'), 'active');
  assert.equal(routeZone(6710, down, 'down'), 'extension');
  assert.equal(routeZone(6690, down, 'down'), 'beyond');
});

test('with no Target 2, past Target 1 is beyond', () => {
  assert.equal(routeZone(6780, { ...UP, t2: null }, 'up'), 'beyond');
});

test('crossing the Fuse and passing a target depend on direction', () => {
  assert.equal(anchorCrossed(6740, 6745, 'up'), true);
  assert.equal(anchorCrossed(6750, 6745, 'up'), false);
  assert.equal(anchorCrossed(6750, 6745, 'down'), true);
  assert.equal(targetPassed(6770, 6768, 'up'), true);
  assert.equal(targetPassed(6770, 6768, 'down'), false);
});

// ---- What the chart keeps on screen -----------------------------------------

const LV = { fuse: 6745, t1: 6768, t2: 6790 };

test('A to B keeps the Fuse and Target 1 in the fit', () => {
  assert.deepEqual(fitPricesFor('AB', LV, 'up'), [6745, 6768]);
});

test('A to B to C adds Target 2, and falls back to A to B without one', () => {
  assert.deepEqual(fitPricesFor('ABC', LV, 'up'), [6745, 6768, 6790]);
  assert.deepEqual(fitPricesFor('ABC', { ...LV, t2: null }, 'up'), [6745, 6768]);
});

test('Wide reaches the set distance in the trade direction', () => {
  assert.deepEqual(fitPricesFor('WIDE', LV, 'up', 100), [6745, 6845]);
  assert.deepEqual(fitPricesFor('WIDE', { fuse: 6745, t1: 6730, t2: null }, 'down', 100), [6745, 6645]);
});

test('without a route nothing is forced into the fit', () => {
  assert.deepEqual(fitPricesFor('AB', { fuse: null, t1: null, t2: null }, 'up'), []);
});

// ---- Terrain and change -----------------------------------------------------

const T0 = Date.parse('2026-10-26T15:00:00Z');
function buckets(values: Record<number, (number | null)[]>, n: number) {
  return Array.from({ length: n }, (_, i) => ({
    timestamp: new Date(T0 + i * MIN).toISOString(),
    strikes: Object.entries(values)
      .filter(([, v]) => v[i] != null)
      .map(([k, v]) => ({ strike: k, net_gamma: String(v[i]) })),
  }));
}

test('terrain aligns strikes on one clock and keeps a missing strike missing', () => {
  const t = buildTerrain(buckets({ 6730: [1, 2, 3], 6735: [5, null, 7] }, 3));
  assert.equal(t.times.length, 3);
  assert.deepEqual(t.byStrike.get(6730), [1, 2, 3]);
  assert.deepEqual(t.byStrike.get(6735), [5, null, 7]);
});

test('strengthening and weakening are about size, not the signed value', () => {
  const series = Array.from({ length: 21 }, (_, i) => -760e6 + i * 17e6); // -760M to -420M
  const times = series.map((_, i) => T0 + i * MIN);
  const c = strikeChange(series, times, 20, 10e6, 50e6);
  assert.equal(c.state, 'weakening');
  assert.ok(Math.abs(c.sizeDelta! - -340e6) < 1);
});

test('a change inside the threshold is steady', () => {
  const times = [T0, T0 + MIN];
  assert.equal(strikeChange([100e6, 103e6], times, 1, 8e6, 50e6).state, 'steady');
  assert.equal(strikeChange([100e6, 110e6], times, 1, 8e6, 50e6).state, 'strengthening');
});

test('a missing window start makes the change unavailable, not zero', () => {
  const times = [T0, T0 + MIN, T0 + 2 * MIN];
  assert.equal(strikeChange([100e6, 120e6, 150e6], times, 4, 8e6, 50e6).state, 'unavailable');
  assert.equal(strikeChange([null, 120e6, 150e6], times, 2, 8e6, 50e6).state, 'unavailable');
});

test('percentages are withheld near a zero base', () => {
  const times = [T0, T0 + MIN];
  assert.equal(strikeChange([2e6, 30e6], times, 1, 8e6, 50e6).pct, null);
  assert.ok(Math.abs(strikeChange([100e6, 150e6], times, 1, 8e6, 50e6).pct! - 0.5) < 1e-9);
});

test('the provisional threshold grows with the window', () => {
  assert.ok(provisionalThreshold(940e6, 1) < provisionalThreshold(940e6, 4));
  assert.ok(provisionalThreshold(940e6, 4) < provisionalThreshold(940e6, 20));
});

test('size is ranked against every strike on the board', () => {
  const t = buildTerrain(buckets({ 6730: [940], 6750: [690], 6700: [-420] }, 1));
  const ctx = sizeContext(t);
  assert.equal(ctx.maxAbs, 940);
  assert.equal(ctx.rank.get(6730), 1);
  assert.equal(ctx.rank.get(6700), 3);
  assert.ok(Math.abs(ctx.share.get(6730)! - 940 / 2050) < 1e-9);
});

test('the next relevant strike is ahead of spot, on the route, and sizable', () => {
  const strikes = [
    { k: 6710, price: 6750, share: 0.2 }, // behind spot
    { k: 6720, price: 6760, share: 0.05 }, // ahead but small
    { k: 6730, price: 6768.6, share: 0.14 }, // ahead and sizable
    { k: 6750, price: 6790, share: 0.1 },
  ];
  assert.equal(nextRelevantStrike(strikes, UP, 'up'), 6730);
});

// ---- The session clock --------------------------------------------------

test('the ET offset follows daylight saving', () => {
  assert.equal(etOffsetMinutes(Date.parse('2026-07-01T16:00:00Z')), -240);
  assert.equal(etOffsetMinutes(Date.parse('2026-12-01T16:00:00Z')), -300);
});

test('the session runs 09:30 to 16:00 ET in both seasons', () => {
  const summer = sessionBounds(Date.parse('2026-07-01T16:00:00Z'));
  assert.equal(new Date(summer.open).toISOString(), '2026-07-01T13:30:00.000Z');
  const winter = sessionBounds(Date.parse('2026-12-01T16:00:00Z'));
  assert.equal(new Date(winter.close).toISOString(), '2026-12-01T21:00:00.000Z');
});

// ---- Formatting ---------------------------------------------------------------

test('dollar gamma reads in millions and billions with its sign', () => {
  assert.equal(formatGamma(940e6), '+$940M');
  assert.equal(formatGamma(-1.2e9), '-$1.20B');
  assert.equal(formatSizeDelta(66e6), '+66M');
});
