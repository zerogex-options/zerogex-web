import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { barClock, formatBarDuration } from '../core/barClock.ts';

const MIN = 60_000;

// ── Intraday buckets ─────────────────────────────────────────────────────────

test('intraday: reports elapsed, remaining and progress inside the bucket', () => {
  const start = Date.parse('2026-08-04T14:35:00Z');
  const clock = barClock('2026-08-04T14:35:00Z', '5min', start + 2 * MIN + 30_000);
  assert.ok(clock);
  assert.equal(clock.totalMs, 5 * MIN);
  assert.equal(clock.elapsedMs, 2 * MIN + 30_000);
  assert.equal(clock.remainingMs, 2 * MIN + 30_000);
  assert.equal(clock.progress, 0.5);
  assert.equal(clock.complete, false);
});

test('intraday: a just-opened bucket reads zero elapsed and a full window', () => {
  const start = Date.parse('2026-08-04T14:35:00Z');
  const clock = barClock('2026-08-04T14:35:00Z', '15min', start);
  assert.ok(clock);
  assert.equal(clock.elapsedMs, 0);
  assert.equal(clock.remainingMs, 15 * MIN);
  assert.equal(clock.progress, 0);
  assert.equal(clock.complete, false);
});

test('intraday: the window closes exactly at start + interval', () => {
  const start = Date.parse('2026-08-04T14:35:00Z');
  const clock = barClock('2026-08-04T14:35:00Z', '5min', start + 5 * MIN);
  assert.ok(clock);
  assert.equal(clock.remainingMs, 0);
  assert.equal(clock.progress, 1);
  assert.equal(clock.complete, true);
});

test('intraday: a bucket the feed has not rolled yet stays clamped, not negative', () => {
  const start = Date.parse('2026-08-04T14:35:00Z');
  const clock = barClock('2026-08-04T14:35:00Z', '1min', start + 9 * MIN);
  assert.ok(clock);
  assert.equal(clock.elapsedMs, 1 * MIN);
  assert.equal(clock.remainingMs, 0);
  assert.equal(clock.progress, 1);
  assert.equal(clock.complete, true);
});

test('intraday: every supported interval sizes its own window', () => {
  const ts = '2026-08-04T14:00:00Z';
  const now = Date.parse(ts);
  assert.equal(barClock(ts, '1min', now)?.totalMs, 1 * MIN);
  assert.equal(barClock(ts, '5min', now)?.totalMs, 5 * MIN);
  assert.equal(barClock(ts, '15min', now)?.totalMs, 15 * MIN);
  assert.equal(barClock(ts, '1hr', now)?.totalMs, 60 * MIN);
});

// ── Daily buckets ────────────────────────────────────────────────────────────
//
// The daily marker is UTC midnight, so naive +24h arithmetic would put the
// close at 20:00 ET. These pin the real cash session on both sides of DST.

test('daily: the window is the cash session on the marker date, in EDT', () => {
  const clock = barClock('2026-08-04T00:00:00Z', '1day', Date.parse('2026-08-04T13:30:00Z'));
  assert.ok(clock);
  // 09:30–16:00 ET = 13:30–20:00 UTC while EDT is in effect.
  assert.equal(clock.totalMs, 390 * MIN);
  assert.equal(clock.elapsedMs, 0);
  assert.equal(clock.remainingMs, 390 * MIN);
  assert.equal(clock.complete, false);
});

test('daily: the window shifts an hour later in UTC under EST', () => {
  const clock = barClock('2026-01-14T00:00:00Z', '1day', Date.parse('2026-01-14T14:30:00Z'));
  assert.ok(clock);
  // 09:30–16:00 ET = 14:30–21:00 UTC while EST is in effect.
  assert.equal(clock.totalMs, 390 * MIN);
  assert.equal(clock.elapsedMs, 0);
  assert.equal(clock.remainingMs, 390 * MIN);
});

test('daily: mid-session reports the real remaining time to the bell', () => {
  const clock = barClock('2026-08-04T00:00:00Z', '1day', Date.parse('2026-08-04T18:00:00Z'));
  assert.ok(clock);
  assert.equal(clock.elapsedMs, 270 * MIN); // 09:30 → 14:00 ET
  assert.equal(clock.remainingMs, 120 * MIN); // 14:00 → 16:00 ET
  assert.equal(clock.complete, false);
});

test('daily: pre-market is clamped to zero elapsed, not a negative countdown', () => {
  const clock = barClock('2026-08-04T00:00:00Z', '1day', Date.parse('2026-08-04T11:00:00Z'));
  assert.ok(clock);
  assert.equal(clock.elapsedMs, 0);
  assert.equal(clock.remainingMs, 390 * MIN);
  assert.equal(clock.progress, 0);
  assert.equal(clock.complete, false);
});

test('daily: the candle is complete at the bell and stays complete after hours', () => {
  const atBell = barClock('2026-08-04T00:00:00Z', '1day', Date.parse('2026-08-04T20:00:00Z'));
  assert.ok(atBell);
  assert.equal(atBell.remainingMs, 0);
  assert.equal(atBell.complete, true);

  const afterHours = barClock('2026-08-04T00:00:00Z', '1day', Date.parse('2026-08-04T23:45:00Z'));
  assert.ok(afterHours);
  assert.equal(afterHours.remainingMs, 0);
  assert.equal(afterHours.progress, 1);
  assert.equal(afterHours.complete, true);
});

test('daily: the DST changeover days still resolve their own offset', () => {
  // 2026-03-08 is the spring-forward day; the session runs entirely in EDT.
  const spring = barClock('2026-03-09T00:00:00Z', '1day', Date.parse('2026-03-09T13:30:00Z'));
  assert.ok(spring);
  assert.equal(spring.elapsedMs, 0);
  assert.equal(spring.totalMs, 390 * MIN);

  // The Friday before is still EST, so its open is 14:30 UTC.
  const beforeSpring = barClock('2026-03-06T00:00:00Z', '1day', Date.parse('2026-03-06T14:30:00Z'));
  assert.ok(beforeSpring);
  assert.equal(beforeSpring.elapsedMs, 0);
  assert.equal(beforeSpring.totalMs, 390 * MIN);
});

// ── Guards ───────────────────────────────────────────────────────────────────

test('an unparseable or missing timestamp yields no clock at all', () => {
  assert.equal(barClock('not-a-date', '5min', Date.now()), null);
  assert.equal(barClock('', '5min', Date.now()), null);
  assert.equal(barClock(null, '5min', Date.now()), null);
  assert.equal(barClock(undefined, '5min', Date.now()), null);
});

// ── Formatting ───────────────────────────────────────────────────────────────

test('durations render as M:SS below an hour and H:MM:SS above it', () => {
  assert.equal(formatBarDuration(0), '0:00');
  assert.equal(formatBarDuration(9_000), '0:09');
  assert.equal(formatBarDuration(4 * MIN + 7_000), '4:07');
  assert.equal(formatBarDuration(59 * MIN + 59_000), '59:59');
  assert.equal(formatBarDuration(60 * MIN), '1:00:00');
  assert.equal(formatBarDuration(390 * MIN), '6:30:00');
});

test('a countdown ceils so it only reads 0:00 once the candle has closed', () => {
  assert.equal(formatBarDuration(1, 'ceil'), '0:01');
  assert.equal(formatBarDuration(999, 'ceil'), '0:01');
  assert.equal(formatBarDuration(1_000, 'ceil'), '0:01');
  assert.equal(formatBarDuration(0, 'ceil'), '0:00');
});

test('elapsed floors so a fresh candle reads 0:00 rather than 0:01', () => {
  assert.equal(formatBarDuration(1), '0:00');
  assert.equal(formatBarDuration(999), '0:00');
  assert.equal(formatBarDuration(1_000), '0:01');
});

test('negative and non-finite inputs degrade to 0:00 instead of NaN', () => {
  assert.equal(formatBarDuration(-5_000), '0:00');
  assert.equal(formatBarDuration(Number.NaN), '0:00');
  assert.equal(formatBarDuration(Number.POSITIVE_INFINITY), '0:00');
});
