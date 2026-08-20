// Unit tests for the "hold their bill steady while moving them up a tier"
// arithmetic. The failure these guard against is silent: a mis-sized coupon
// still applies cleanly, so the subscription switches and the member simply
// gets charged more than they were told.
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  couponHoldsRate,
  couponResultCents,
  holdSteadyDiscountCents,
} from '../core/holdRate.ts';

test('discount is the gap between the new list price and what they pay now', () => {
  // The real case: Basic lists $39, member pays $19 on an old coupon, Pro
  // lists $79 — so $60 off holds them at $19.
  assert.equal(holdSteadyDiscountCents(7900, 1900), 6000);
});

test('no discount needed when the target already matches their rate', () => {
  assert.equal(holdSteadyDiscountCents(1900, 1900), 0);
});

test('a target listing below their current rate reports negative, not zero', () => {
  // Callers must refuse this: holding the rate steady would mean charging MORE
  // than the tier costs. Clamping to zero here would hide that.
  assert.equal(holdSteadyDiscountCents(1500, 1900), -400);
});

test('amount_off coupons resolve exactly', () => {
  assert.equal(couponResultCents({ amount_off: 6000 }, 7900), 1900);
  assert.equal(couponResultCents({ amount_off: 0 }, 7900), 7900);
});

test('amount_off larger than the price floors at zero, never negative', () => {
  assert.equal(couponResultCents({ amount_off: 9900 }, 7900), 0);
});

test('percent_off rounds half-up to the cent, like Stripe', () => {
  assert.equal(couponResultCents({ percent_off: 50 }, 7900), 3950);
  assert.equal(couponResultCents({ percent_off: 100 }, 7900), 0);
  // 7900 * (1 - 0.3333) = 5266.93 -> 5267
  assert.equal(couponResultCents({ percent_off: 33.33 }, 7900), 5267);
});

test('amount_off takes precedence over percent_off, matching Stripe', () => {
  assert.equal(couponResultCents({ amount_off: 6000, percent_off: 10 }, 7900), 1900);
});

test('a coupon with neither field is indeterminate, not free', () => {
  assert.equal(couponResultCents({}, 7900), null);
  assert.equal(couponResultCents({ amount_off: null, percent_off: null }, 7900), null);
});

test('couponHoldsRate accepts only an exact landing', () => {
  assert.equal(couponHoldsRate({ amount_off: 6000 }, 7900, 1900), true);
  // One cent out is still a rejection — this is the overcharge guard.
  assert.equal(couponHoldsRate({ amount_off: 5999 }, 7900, 1900), false);
  assert.equal(couponHoldsRate({}, 7900, 1900), false);
});

test('a percentage that misses the target rate is rejected', () => {
  // 76% off $79 is $18.96 — four cents under the $19 being held. Close enough
  // to look right in a dashboard, wrong enough to be a different bill.
  assert.equal(couponResultCents({ percent_off: 76 }, 7900), 1896);
  assert.equal(couponHoldsRate({ percent_off: 76 }, 7900, 1900), false);
});

test('a percentage that rounds onto the target rate is accepted', () => {
  // 75.95% off $79 is $18.9995, which rounds to exactly $19 — a legitimate
  // hold. The check is where the money lands, not how the coupon is expressed.
  assert.equal(couponResultCents({ percent_off: 75.95 }, 7900), 1900);
  assert.equal(couponHoldsRate({ percent_off: 75.95 }, 7900, 1900), true);
});
