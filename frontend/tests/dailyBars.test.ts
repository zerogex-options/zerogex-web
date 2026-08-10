// Unit tests for the daily ("1day") candle handling in the price charts
// (GammaTerminalChart / UnderlyingCandlesChart / PairCandleChart), which share
// two pieces of core/utils logic:
//
//   etTradingDateLabel        — labels a daily bucket by its ET trading date
//   shouldOmitClosedMarketTimes — gates the intraday market-hours filter
//
// Both guard the same root hazard: a daily bucket is stamped at UTC midnight,
// and a US cash session sits wholly inside one UTC day, so that midnight's UTC
// date IS the ET trading date — but rendered in ET it rolls back 4–5h into the
// previous evening. That mislabels every daily candle a day early AND, when the
// previous ET day is a weekend, makes the intraday market-hours filter drop the
// bar entirely (every Monday's stamp lands on Sunday 20:00 ET).
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  etTradingDateLabel,
  shouldOmitClosedMarketTimes,
  omitClosedMarketTimes,
} from '../core/utils.ts';

// ── Labelling: a daily marker must show its own calendar date ────────────────
test('daily UTC-midnight bucket labels its own calendar date, not the ET-shifted previous day', () => {
  // The exact case from the report: the Aug 4 session's daily bucket is stamped
  // 2026-08-04T00:00:00Z. Formatted in ET that is "Aug 3, 20:00" — a day early.
  assert.equal(etTradingDateLabel('2026-08-04T00:00:00.000Z'), 'Aug 4');
});

test('holds when the backend truncated the day in ET (04:00Z), not UTC', () => {
  assert.equal(etTradingDateLabel('2026-08-04T04:00:00.000Z'), 'Aug 4');
});

test('is DST-proof — an EST (winter) session labels correctly', () => {
  assert.equal(etTradingDateLabel('2026-01-15T00:00:00.000Z'), 'Jan 15');
});

test('handles a month boundary without rolling back', () => {
  assert.equal(etTradingDateLabel('2026-08-01T00:00:00.000Z'), 'Aug 1');
});

test('accepts a Date instance as well as an ISO string', () => {
  assert.equal(etTradingDateLabel(new Date('2026-08-04T00:00:00.000Z')), 'Aug 4');
});

test('returns an empty string for an unparseable timestamp', () => {
  assert.equal(etTradingDateLabel('not-a-date'), '');
});

// ── Filtering: daily bars must bypass the intraday market-hours filter ────────
test('shouldOmitClosedMarketTimes gates by bucket size — intraday yes, daily no', () => {
  for (const intraday of [1, 5, 15, 60]) {
    assert.equal(shouldOmitClosedMarketTimes(intraday), true, `${intraday}m should be filtered`);
  }
  assert.equal(shouldOmitClosedMarketTimes(1440), false, 'daily must not be filtered');
});

test('regression: the raw filter drops the Monday daily bar, so daily must skip it', () => {
  // One UTC-midnight daily bar per trading day, late Jul → early Aug 2026.
  const dailyBars = [
    '2026-07-31T00:00:00.000Z', // Fri
    '2026-08-03T00:00:00.000Z', // Mon  <-- the bar that went missing
    '2026-08-04T00:00:00.000Z', // Tue  (today, live)
  ].map((t) => ({ timestamp: t }));

  // The hazard: applying the intraday filter to daily bars eats Monday, because
  // 2026-08-03T00:00Z reads as Sunday 20:00 ET.
  const wronglyFiltered = omitClosedMarketTimes(dailyBars, (b) => b.timestamp);
  assert.deepEqual(
    wronglyFiltered.map((b) => etTradingDateLabel(b.timestamp)),
    ['Jul 31', 'Aug 4'],
    'sanity check: the raw filter really does drop the Monday bar',
  );

  // The fix: daily bars are not filtered, so every session survives.
  const filtered = shouldOmitClosedMarketTimes(1440)
    ? omitClosedMarketTimes(dailyBars, (b) => b.timestamp)
    : dailyBars;
  assert.deepEqual(
    filtered.map((b) => etTradingDateLabel(b.timestamp)),
    ['Jul 31', 'Aug 3', 'Aug 4'],
    'daily path must keep the Monday (Aug 3) bar',
  );
});

test('intraday bars still get the market-hours filter (overnight rows removed)', () => {
  const intradayBars = [
    { timestamp: '2026-08-04T14:00:00.000Z' }, // 10:00 ET — RTH, keep
    { timestamp: '2026-08-04T02:00:00.000Z' }, // 22:00 ET prev day — closed, drop
  ];
  const filtered = shouldOmitClosedMarketTimes(5)
    ? omitClosedMarketTimes(intradayBars, (b) => b.timestamp)
    : intradayBars;
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].timestamp, '2026-08-04T14:00:00.000Z');
});
