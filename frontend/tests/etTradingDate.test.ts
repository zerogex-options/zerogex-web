// Unit tests for etTradingDateLabel (frontend/core/utils.ts) — the labeller for
// daily ("1day") candles. Guards the bug where a daily candle for the current
// session (e.g. Aug 4) rendered a day early ("Aug 3, 20:00 ET") because its
// UTC-midnight date marker was converted to America/New_York, rolling the
// wall-clock back 4–5h into the previous evening.
import test from 'node:test';
import assert from 'node:assert/strict';

import { etTradingDateLabel } from '../core/utils.ts';

test('daily UTC-midnight bucket labels its own calendar date, not the ET-shifted previous day', () => {
  // The exact case from the report: the Aug 4 session's daily bucket is stamped
  // 2026-08-04T00:00:00Z. Formatted in ET that is "Aug 3, 20:00" — a day early.
  assert.equal(etTradingDateLabel('2026-08-04T00:00:00.000Z'), 'Aug 4');
});

test('holds when the backend truncated the day in ET (04:00Z), not UTC', () => {
  // date_trunc('day', ...) under an ET session clock yields ET midnight = 04:00Z
  // (EDT). Its UTC date is still Aug 4, so the label must be Aug 4.
  assert.equal(etTradingDateLabel('2026-08-04T04:00:00.000Z'), 'Aug 4');
});

test('is DST-proof — an EST (winter) session labels correctly', () => {
  // 05:00Z would be Jan 15 00:00 EST; the UTC-midnight marker is what we get.
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
