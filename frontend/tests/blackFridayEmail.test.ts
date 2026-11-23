import test from 'node:test';
import assert from 'node:assert/strict';

// What the Black Friday announcement states about the sale, and when it may go
// out (core/blackFridayEmail.ts). The email's numbers must be the pricing page's
// numbers, and a real send must never reach people before the sale is on.

import {
  MIN_SALE_EMAIL_LEAD_HOURS,
  REQUIRED_SALE_PLACEHOLDERS,
  buildSaleEmailPlaceholders,
  saleEmailProblems,
  saleLastDayProblem,
} from '../core/blackFridayEmail.ts';
import { formatUsd } from '../core/billingPlans.ts';
import { parseSaleWindow, salePriceUsd } from '../core/blackFridaySale.ts';

const START = '2026-11-19T05:00:00Z'; // 12:00 AM ET, Thursday, November 19
const END = '2026-12-02T04:59:59Z'; // 11:59:59 PM ET, Tuesday, December 1
const WINDOW = parseSaleWindow(START, END);
const HOUR = 3_600_000;

test('the email states the rate, the deadline and the prices the pricing page shows', () => {
  assert.deepEqual(buildSaleEmailPlaceholders(Date.parse(END)), {
    SALE_PERCENT: '50%',
    SALE_DEADLINE: '11:59 PM ET on Tuesday, December 1',
    SALE_DEADLINE_SHORT: 'December 1',
    SALE_BASIC_MONTHLY: '$19.50/month',
    SALE_BASIC_MONTHLY_THEN: 'for your first year, then $39/month',
    SALE_BASIC_ANNUAL: '$99.50',
    SALE_BASIC_ANNUAL_THEN: 'for your first year, then $199/year',
    SALE_PRO_MONTHLY: '$29.50/month',
    SALE_PRO_MONTHLY_THEN: 'for your first year, then $59/month',
    SALE_PRO_ANNUAL: '$149.50',
    SALE_PRO_ANNUAL_THEN: 'for your first year, then $299/year',
  });
  // Straight from the module the page and checkout read.
  const p = buildSaleEmailPlaceholders(Date.parse(END));
  assert.equal(p.SALE_PRO_ANNUAL, formatUsd(salePriceUsd({ tier: 'pro', cadence: 'annual' })));
});

test('a window ending exactly at midnight is still the day before', () => {
  const p = buildSaleEmailPlaceholders(Date.parse('2026-12-02T05:00:00Z'));
  assert.equal(p.SALE_DEADLINE_SHORT, 'December 1');
  assert.match(p.SALE_DEADLINE, /Tuesday, December 1$/);
});

test('every required placeholder is one the builder fills', () => {
  const p = buildSaleEmailPlaceholders(Date.parse(END));
  for (const key of REQUIRED_SALE_PLACEHOLDERS) assert.ok(p[key], key);
});

function problems(nowIso: string, overrides: Partial<Parameters<typeof saleEmailProblems>[0]> = {}) {
  return saleEmailProblems({
    couponConfigured: true,
    window: WINDOW,
    nowMs: Date.parse(nowIso),
    requireOpen: true,
    ...overrides,
  });
}

test('a real send waits until the sale is on', () => {
  const before = problems('2026-11-18T21:00:00Z');
  assert.equal(before.length, 1);
  assert.match(before[0], /hasn't opened yet \(it opens Thursday, November 19 at 12:00 AM ET\)/);
  assert.deepEqual(problems('2026-11-19T05:00:00Z'), []);
  assert.deepEqual(problems('2026-11-23T14:00:00Z'), []);
});

test('a preview may go out before the sale opens', () => {
  assert.deepEqual(problems('2026-11-18T21:00:00Z', { requireOpen: false }), []);
});

test('no send with less than two days left, or after the end', () => {
  const end = Date.parse(END);
  assert.deepEqual(problems(new Date(end - MIN_SALE_EMAIL_LEAD_HOURS * HOUR).toISOString()), []);
  const late = problems(new Date(end - MIN_SALE_EMAIL_LEAD_HOURS * HOUR + 1000).toISOString());
  assert.equal(late.length, 1);
  assert.match(late[0], /ends in 47 hour\(s\)/);
  assert.deepEqual(problems(END), ['the sale has already ended']);
  // A preview of a sale that is over is refused too: there is nothing to check.
  assert.deepEqual(problems(END, { requireOpen: false }), ['the sale has already ended']);
});

test('a sale that is not configured is refused, for a preview as much as a send', () => {
  const noCoupon = problems('2026-11-23T14:00:00Z', { couponConfigured: false, requireOpen: false });
  assert.equal(noCoupon.length, 1);
  assert.match(noCoupon[0], /STRIPE_COUPON_BLACK_FRIDAY is not set/);
  const noWindow = problems('2026-11-23T14:00:00Z', { window: null, requireOpen: false });
  assert.equal(noWindow.length, 1);
  assert.match(noWindow[0], /BLACK_FRIDAY_END_AT is missing/);
});

// --- the last call ------------------------------------------------------------
//
// The last-call email says the sale ends tonight, so a real send is refused on
// any day but the last one in New York, and with less than its six hours left.

const LAST_CALL = { minLeadHours: 6, lastDayOnly: true };

test('the last call goes out on the last day, with six hours to spare', () => {
  // 8:00 AM ET on Tuesday, December 1, and 5:59 PM ET with six hours to go.
  assert.deepEqual(problems('2026-12-01T13:00:00Z', LAST_CALL), []);
  assert.deepEqual(problems('2026-12-01T22:59:59Z', LAST_CALL), []);
  // Midnight ET at the start of the last day already counts.
  assert.deepEqual(problems('2026-12-01T05:00:00Z', LAST_CALL), []);
});

test('the last call is refused on any other day, naming the day it is for', () => {
  const dayBefore = problems('2026-11-30T15:00:00Z', LAST_CALL);
  assert.equal(dayBefore.length, 1);
  assert.match(dayBefore[0], /says the sale ends tonight, so it can only go out on its last day, Tuesday, December 1/);
  // 11:59 PM ET on Monday is still the day before.
  assert.equal(problems('2026-12-01T04:59:00Z', LAST_CALL).length, 1);
  // A week out: the lead time is fine, the day is not.
  assert.equal(problems('2026-11-23T14:00:00Z', LAST_CALL).length, 1);
});

test('too late on the last day is refused by the lead time, and after the end, by the end', () => {
  const late = problems('2026-12-02T00:00:00Z', LAST_CALL); // 7:00 PM ET
  assert.equal(late.length, 1);
  assert.match(late[0], /ends in 4 hour\(s\)\. This email needs at least 6/);
  assert.deepEqual(problems(END, LAST_CALL), ['the sale has already ended']);
});

test('a last-call preview may go out ahead of the day', () => {
  assert.deepEqual(problems('2026-11-30T15:00:00Z', { ...LAST_CALL, requireOpen: false }), []);
});

test('a sale ending exactly at midnight has the day before as its last day', () => {
  const end = Date.parse('2026-12-02T05:00:00Z'); // 12:00 AM ET, Wednesday
  assert.equal(saleLastDayProblem(end, Date.parse('2026-12-01T17:00:00Z')), null);
  assert.match(saleLastDayProblem(end, Date.parse('2026-11-30T17:00:00Z')) ?? '', /Tuesday, December 1/);
});

test('the announcement keeps its two days, whatever the last call allows', () => {
  // No minLeadHours and no lastDayOnly: the defaults the announcement runs on.
  assert.equal(problems('2026-12-01T13:00:00Z').length, 1);
  assert.deepEqual(problems('2026-11-23T14:00:00Z'), []);
});
