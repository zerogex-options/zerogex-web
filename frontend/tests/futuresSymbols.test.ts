// Unit tests for ES / NQ as first-class picker symbols.
//
// ES and NQ carry no options chain of their own in ZeroGEX: the API answers
// them by carrying the SPX / NDX option-derived levels onto the futures price
// axis. The frontend therefore treats them as ordinary symbols — but three
// things must hold, and each has bitten a symbol rollout before:
//
//   * they validate and persist like any other underlying, or the picker
//     silently snaps back to SPY on reload;
//   * NQ reads against VXN (not VIX), which is the pairing that was
//     copy-pasted across a dozen surfaces before it was centralised;
//   * their chart series is filtered by the CME session, not by equity hours,
//     which would trim away most of a legitimate overnight series.
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  SYMBOLS,
  FUTURES_BACKING_INDEX,
  isFuturesSymbol,
  volatilityIndexFor,
  resolveSymbol,
} from '../core/symbols.ts';
import { isUnderlyingSymbol } from '../core/symbolPersistence.ts';
import {
  isFuturesTicker,
  isWithinFuturesSessionHours,
  isWithinTradingHoursForSymbol,
} from '../core/utils.ts';

test('ES and NQ are picker symbols backed by SPX and NDX', () => {
  assert.ok(SYMBOLS.includes('ES'));
  assert.ok(SYMBOLS.includes('NQ'));
  assert.equal(FUTURES_BACKING_INDEX.ES, 'SPX');
  assert.equal(FUTURES_BACKING_INDEX.NQ, 'NDX');
});

test('ES and NQ validate as underlyings so they survive a reload', () => {
  assert.equal(isUnderlyingSymbol('ES'), true);
  assert.equal(isUnderlyingSymbol('NQ'), true);
  assert.equal(resolveSymbol('ES'), 'ES');
  assert.equal(resolveSymbol('nq'), 'NQ');
  // An unknown ticker still falls back rather than leaking through.
  assert.equal(resolveSymbol('RTY'), 'SPY');
});

test('isFuturesSymbol separates the futures from their backing indices', () => {
  assert.equal(isFuturesSymbol('ES'), true);
  assert.equal(isFuturesSymbol('nq'), true);
  assert.equal(isFuturesSymbol('SPX'), false);
  assert.equal(isFuturesSymbol('SPY'), false);
  assert.equal(isFuturesSymbol(null), false);
});

test('Nasdaq-100 exposure reads against VXN, S&P against VIX', () => {
  assert.equal(volatilityIndexFor('NQ'), 'VXN');
  assert.equal(volatilityIndexFor('NDX'), 'VXN');
  assert.equal(volatilityIndexFor('QQQ'), 'VXN');
  assert.equal(volatilityIndexFor('ES'), 'VIX');
  assert.equal(volatilityIndexFor('SPX'), 'VIX');
  assert.equal(volatilityIndexFor('SPY'), 'VIX');
  assert.equal(volatilityIndexFor(null), 'VIX');
});

// 2026-08-19 is a Wednesday; 08-21 Friday; 08-22 Saturday; 08-23 Sunday.
// Times below are ET, expressed as the matching UTC instant (EDT = UTC-4).
const et = (iso: string) => new Date(iso);

test('futures session spans the overnight window, unlike equity hours', () => {
  // 03:00 ET Wednesday — dead for equities, live for the future.
  const overnight = et('2026-08-19T07:00:00Z');
  assert.equal(isWithinFuturesSessionHours(overnight), true);
  assert.equal(isWithinTradingHoursForSymbol(overnight, 'ES'), true);
  assert.equal(isWithinTradingHoursForSymbol(overnight, 'SPX'), false);
});

test('futures session excludes the daily maintenance break', () => {
  // 17:30 ET Wednesday — CME is down between 17:00 and 18:00.
  assert.equal(isWithinFuturesSessionHours(et('2026-08-19T21:30:00Z')), false);
  // 18:30 ET Wednesday — reopened.
  assert.equal(isWithinFuturesSessionHours(et('2026-08-19T22:30:00Z')), true);
});

test('futures session excludes the weekend gap and reopens Sunday evening', () => {
  // Friday 18:00 ET — closed since 17:00.
  assert.equal(isWithinFuturesSessionHours(et('2026-08-21T22:00:00Z')), false);
  // Saturday noon ET — closed all day.
  assert.equal(isWithinFuturesSessionHours(et('2026-08-22T16:00:00Z')), false);
  // Sunday 15:00 ET — still closed, reopen is 18:00.
  assert.equal(isWithinFuturesSessionHours(et('2026-08-23T19:00:00Z')), false);
  // Sunday 19:00 ET — open.
  assert.equal(isWithinFuturesSessionHours(et('2026-08-23T23:00:00Z')), true);
});

test('isFuturesTicker tolerates the continuous-contract @ prefix', () => {
  assert.equal(isFuturesTicker('@ES'), true);
  assert.equal(isFuturesTicker('ES'), true);
  assert.equal(isFuturesTicker('SPY'), false);
});

test('an invalid timestamp is not treated as an open session', () => {
  assert.equal(isWithinFuturesSessionHours('not-a-date'), false);
});
