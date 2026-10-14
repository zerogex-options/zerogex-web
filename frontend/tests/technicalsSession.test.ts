// Unit tests for the Technicals page's session read (frontend/core/technicalsSession.ts).
//
// The contract: the opening-range zone matches the backend's orb_status rule
// (near = the outer fifth of the range); the breakout log reads breaks on
// closes and extremes on wicks; and the event list numbers its chart markers
// left to right while listing newest first.
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildSessionEvents,
  deriveOrbLog,
  fmtLevel,
  orbBarPosition,
  orbZone,
  priceDomain,
  spreadTags,
  type Candle,
} from '../core/technicalsSession.ts';
import type { TechnicalsBar } from '../hooks/useTechnicals';

// Rod's ES opening range on Tue Oct 13, 2026.
const HIGH = 7861.0;
const LOW = 7845.25;

test('zones follow the backend: near is the outer fifth of the range', () => {
  assert.equal(orbZone(7862, HIGH, LOW), 'above');
  assert.equal(orbZone(7860, HIGH, LOW), 'nearHigh');
  assert.equal(orbZone(7857.85, HIGH, LOW), 'nearHigh', 'exactly a fifth below the high');
  assert.equal(orbZone(7853.25, HIGH, LOW), 'inside');
  assert.equal(orbZone(7848.4, HIGH, LOW), 'nearLow');
  assert.equal(orbZone(7845, HIGH, LOW), 'below');
  assert.equal(orbZone(null, HIGH, LOW), null);
  assert.equal(orbZone(7850, null, LOW), null);
});

test('the position bar keeps the range inside a margin each side', () => {
  assert.equal(orbBarPosition(LOW, HIGH, LOW), 0.1);
  assert.equal(orbBarPosition(HIGH, HIGH, LOW), 0.9);
  assert.ok(Math.abs(orbBarPosition(7853.125, HIGH, LOW)! - 0.5) < 1e-9);
  assert.equal(orbBarPosition(9000, HIGH, LOW), 1, 'far above pins to the end');
  assert.equal(orbBarPosition(7850, HIGH, HIGH), null, 'no range, no bar');
});

const T0 = Date.parse('2026-10-13T14:00:00Z'); // 10:00 ET
const at = (i: number) => T0 + i * 5 * 60_000;
const c = (i: number, open: number, high: number, low: number, close: number): Candle => ({ ms: at(i), open, high, low, close });

test('a breakdown that fails: break, furthest point, back inside', () => {
  const log = deriveOrbLog(
    [
      c(0, 7847, 7848, 7846, 7846.5),
      c(3, 7846, 7846.5, 7842, 7842.25), // closes below the low
      c(4, 7842, 7843, 7836, 7837),
      c(5, 7837, 7838, 7832, 7833), // furthest: 7832
      c(9, 7840, 7846, 7839, 7845.5), // closes back inside
    ],
    HIGH,
    LOW,
    T0,
  );
  assert.deepEqual(
    log.map((e) => e.kind),
    ['breakdown', 'furthest', 'backInside'],
  );
  assert.equal(log[0].price, 7842.25);
  assert.equal(log[1].price, 7832);
  assert.ok(Math.abs(log[1].multiple! - (LOW - 7832) / (HIGH - LOW)) < 1e-9);
  assert.equal(log[2].side, 'below');
  assert.equal(log[2].minutes, 30);
});

test('a wick through the edge is a test, logged once per touch', () => {
  const log = deriveOrbLog(
    [
      c(0, 7859, 7861.5, 7858, 7859.25), // wick above, close inside
      c(1, 7859, 7861.25, 7858, 7860), // still touching: not a new row
      c(2, 7858, 7859, 7855, 7856),
      c(3, 7858, 7861.75, 7857, 7858), // a new touch
    ],
    HIGH,
    LOW,
    T0,
  );
  assert.deepEqual(log.map((e) => e.kind), ['testHigh', 'testHigh']);
  assert.equal(log[0].price, 7861.5);
});

test('a break still running ends the log with the furthest point so far', () => {
  const log = deriveOrbLog([c(0, 7860, 7863, 7859, 7862), c(1, 7862, 7868, 7861.5, 7867)], HIGH, LOW, T0);
  assert.deepEqual(log.map((e) => e.kind), ['breakout', 'furthest']);
  assert.equal(log[1].ongoing, true);
  assert.equal(log[1].price, 7868);
});

test('bars inside the opening window are ignored', () => {
  assert.deepEqual(deriveOrbLog([{ ms: T0 - 60_000, open: 1, high: 9999, low: 0, close: 9999 }], HIGH, LOW, T0), []);
  assert.deepEqual(deriveOrbLog([c(0, 1, 2, 0, 1)], HIGH, HIGH, T0), [], 'no range, no log');
});

function bar(i: number, close: number, opts: { signal?: string; chg?: number; volumeClass?: string; buying?: number; sigma?: number } = {}): TechnicalsBar {
  return {
    time_et: '',
    timestamp: new Date(at(i)).toISOString(),
    close,
    volume: 1000,
    vwap_deviation: { vwap: null, vwap_deviation_pct: null, vwap_position: null },
    opening_range: { orb_high: HIGH, orb_low: LOW, orb_range: HIGH - LOW, distance_above_orb_high: null, distance_below_orb_low: null, orb_pct: null, orb_status: null },
    volume_spike: {
      current_volume: 1000,
      up_volume: null,
      down_volume: null,
      avg_volume: null,
      volume_sigma: opts.sigma ?? null,
      volume_ratio: null,
      buying_pressure_pct: opts.buying ?? null,
      volume_class: opts.volumeClass ?? '⚪ Normal',
    },
    momentum_divergence: { chg_5m: opts.chg ?? null, opt_flow: null, divergence_signal: opts.signal ?? null },
  };
}

test('the event list: newest first, markers numbered oldest first, no confirmations', () => {
  const bars = [
    bar(3, 7842.25, { signal: '🔴 Bearish Confirmation', chg: -3 }),
    bar(5, 7833.25, { signal: '🚨 Bullish Divergence (Price Down, Calls Buying)', chg: -0.25, volumeClass: '🚨 Extreme Spike', buying: 72, sigma: 3.1 }),
    bar(20, 7860.5, { signal: '🚨 Bearish Divergence (Price Up, Puts Buying)', chg: 1.5 }),
    bar(30, 7852.25, { signal: '⚠️ Weak Rally (Selling Volume)', chg: 1.25 }),
    bar(31, 7852, { signal: '⚪ Neutral', chg: -0.25 }),
  ];
  const log = deriveOrbLog([c(3, 7846, 7846.5, 7842, 7842.25), c(9, 7840, 7846, 7839, 7845.5)], HIGH, LOW, T0);
  const events = buildSessionEvents(bars, log);

  assert.ok(!events.some((e) => /confirmation|neutral/i.test(e.title)), 'confirmations and neutral bars are left out');
  for (let i = 1; i < events.length; i += 1) assert.ok(events[i - 1].ms >= events[i].ms, 'newest first');

  const divergence = events.find((e) => e.title === 'Bullish divergence')!;
  assert.equal(divergence.detail, 'price down, calls buying');
  assert.equal(divergence.tone, 'warning');
  assert.equal(divergence.markerSide, 'below');

  const spike = events.find((e) => e.title === 'Volume spike')!;
  assert.equal(spike.detail, '3.1σ · 72% buying');
  assert.equal(spike.tone, 'bullish');
  assert.equal(spike.marker, null);

  const weak = events.find((e) => e.title === 'Weak rally')!;
  assert.equal(weak.detail, 'selling volume');
  assert.equal(weak.marker, null);

  // Markers in time order: breakdown (10:15), divergence (10:25),
  // back inside (10:45), divergence (11:40).
  const marked = events.filter((e) => e.marker != null).sort((a, b) => a.marker! - b.marker!);
  assert.deepEqual(
    marked.map((e) => e.title),
    ['Broke below the opening range', 'Bullish divergence', 'Back inside the opening range', 'Bearish divergence'],
  );
  assert.equal(marked[0].chg5m, -3, 'a range event picks up its bar’s five-minute change');
});

test('prices print like the Gamma Terminal: grouped, two decimals, no $', () => {
  assert.equal(fmtLevel(7853.25), '7,853.25');
  assert.equal(fmtLevel(null), '—');
});

test('price tags never overlap and stay on the axis', () => {
  const ys = spreadTags([100, 104, 106, 300, 395], 16, 10, 400);
  const sorted = [...ys].sort((a, b) => a - b);
  for (let i = 1; i < sorted.length; i += 1) assert.ok(sorted[i] - sorted[i - 1] >= 16 - 1e-9, `gap at ${i}`);
  assert.equal(ys[0], 100, 'the first tag keeps its own y');
  assert.equal(ys[3], 300, 'a tag with room keeps its own y');
  assert.ok(ys[4] <= 400, 'the bottom tag stays on the axis');
});

test('the price window takes in nearby levels and leaves far ones off-scale', () => {
  const d = priceDomain([7832, 7861.5], [7843.4, 7868.5, 7838.25, 7990])!;
  assert.ok(d.max > 7868.5, 'a wall just above the session is drawn');
  assert.ok(d.max < 7990, 'a level far above is left off-scale');
  assert.ok(d.min < 7832);
  assert.equal(priceDomain([], [7850]), null);
});
