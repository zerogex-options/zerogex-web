// Unit tests for daysToExpiry (core/utils.ts): days to an expiration, counted
// from New York's calendar date. The Strike × DTE heatmap on Dealer Positioning
// sorts expirations into its DTE columns with it, and the Option Contracts page
// shows it next to the contract.
import test from 'node:test';
import assert from 'node:assert/strict';

import { daysToExpiry, etTodayDateKey } from '../core/utils.ts';

test('counts calendar days from the given date', () => {
  assert.equal(daysToExpiry('2026-11-13', '2026-11-13'), 0);
  assert.equal(daysToExpiry('2026-11-16', '2026-11-13'), 3, 'Friday to Monday');
  assert.equal(daysToExpiry('2026-11-20', '2026-11-13'), 7);
  assert.equal(daysToExpiry('2026-11-20T00:00:00', '2026-11-13'), 7, 'a trailing time is ignored');
});

test('a DST change does not move the count', () => {
  assert.equal(daysToExpiry('2026-03-09', '2026-03-06'), 3, 'clocks spring forward on Mar 8');
  assert.equal(daysToExpiry('2026-11-02', '2026-10-30'), 3, 'clocks fall back on Nov 1');
});

test('a passed expiration is negative, so the heatmap drops it instead of calling it 0DTE', () => {
  assert.equal(daysToExpiry('2026-11-12', '2026-11-13'), -1);
});

test('anything that is not a date gives null', () => {
  assert.equal(daysToExpiry('soon', '2026-11-13'), null);
  assert.equal(daysToExpiry('', '2026-11-13'), null);
  assert.equal(daysToExpiry('2026-11-20', ''), null);
});

test('a viewer whose date has rolled past New York’s gets the same columns as one in New York', (t) => {
  // Tuesday Nov 17, 2:00 PM in New York is already 00:30 on Wednesday in India.
  // Counted from the viewer's own midnight, Tuesday's expiration came out at -1
  // (shown as 0) and Wednesday's at 0, so both landed in one 0DTE column.
  const priorTz = process.env.TZ;
  process.env.TZ = 'Asia/Kolkata';
  t.after(() => {
    if (priorTz === undefined) delete process.env.TZ;
    else process.env.TZ = priorTz;
  });
  t.mock.timers.enable({ apis: ['Date'], now: Date.parse('2026-11-17T19:00:00Z') });

  assert.equal(new Date().getDate(), 18, 'the viewer’s own calendar already says Wednesday');
  const todayKey = etTodayDateKey();
  assert.equal(todayKey, '2026-11-17');
  assert.equal(daysToExpiry('2026-11-17', todayKey), 0);
  assert.equal(daysToExpiry('2026-11-18', todayKey), 1);
  assert.equal(daysToExpiry('2026-11-24', todayKey), 7);
});
