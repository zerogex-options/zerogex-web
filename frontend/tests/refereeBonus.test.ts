// Unit tests for the refer-a-friend bonus (core/refereeBonus). These encode the
// promise the program makes to a referred friend:
//   1. a NEW customer who arrives through a member's link gets the bonus —
//      first month free monthly, 10% off the first year annual;
//   2. the bonus is ADDITIVE: it is never traded away for whatever other promo
//      the site is running (the public promo, the founding rate), it stacks on
//      top of it;
//   3. the 100%-off monthly coupon can never land on an annual purchase.
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  resolveRefereeBonusCoupon,
  splitRefereeBonus,
  type RefereeBonusInput,
} from '../core/refereeBonus.ts';

const MONTHLY_BONUS = 'coupon_referee_monthly'; // 100% off, duration:once
const ANNUAL_BONUS = 'coupon_referee_annual'; // 10% off, duration:once

// A referred, first-time, monthly buyer with the program switched on — the
// happy path every test below varies one field of.
function input(over: Partial<RefereeBonusInput> = {}): RefereeBonusInput {
  return {
    cadence: 'monthly',
    referredByCode: 'K7QMR2XB',
    programEnabled: true,
    hasPriorPaid: false,
    couponForCadence: MONTHLY_BONUS,
    monthlyCoupon: MONTHLY_BONUS,
    ...over,
  };
}

test('a referred first-time customer earns the bonus for the cadence they buy', () => {
  assert.equal(resolveRefereeBonusCoupon(input()), MONTHLY_BONUS);
  assert.equal(
    resolveRefereeBonusCoupon(input({ cadence: 'annual', couponForCadence: ANNUAL_BONUS })),
    ANNUAL_BONUS,
  );
});

test('an organic signup earns nothing', () => {
  assert.equal(resolveRefereeBonusCoupon(input({ referredByCode: null })), null);
});

test('the master switch turns the bonus off entirely', () => {
  assert.equal(resolveRefereeBonusCoupon(input({ programEnabled: false })), null);
});

test('a returning customer earns nothing — the bonus is a new-customer incentive', () => {
  // Also the reason the webhook always has its pre-first-invoice window: only
  // first-time customers get a trial, and only they can earn the bonus.
  assert.equal(resolveRefereeBonusCoupon(input({ hasPriorPaid: true })), null);
});

test('an unconfigured cadence simply gets no bonus rather than a wrong one', () => {
  assert.equal(
    resolveRefereeBonusCoupon(input({ cadence: 'annual', couponForCadence: null })),
    null,
  );
});

test('the 100%-off monthly coupon is never applied to an annual purchase', () => {
  // Env misconfiguration: the annual var was pointed at the monthly coupon.
  // Dropping the bonus is correct — applying it would make the first YEAR free.
  assert.equal(
    resolveRefereeBonusCoupon(input({ cadence: 'annual', couponForCadence: MONTHLY_BONUS })),
    null,
  );
  // The same coupon on the cadence it belongs to is untouched by that guard.
  assert.equal(resolveRefereeBonusCoupon(input({ cadence: 'monthly' })), MONTHLY_BONUS);
});

test('bonus + public promo: the promo rides checkout, the bonus is stacked', () => {
  // Stripe Checkout carries one discount, so the customer sees the advertised
  // promo rate on Stripe's page and the webhook adds the bonus to the
  // subscription during the trial — both land on the first invoice.
  assert.deepEqual(splitRefereeBonus('coupon_promo_pro_monthly', MONTHLY_BONUS), {
    couponId: 'coupon_promo_pro_monthly',
    stackCouponId: MONTHLY_BONUS,
  });
});

test('bonus + founding rate: the founding rate rides checkout, the bonus is stacked', () => {
  assert.deepEqual(splitRefereeBonus('coupon_founding_pro_intro', MONTHLY_BONUS), {
    couponId: 'coupon_founding_pro_intro',
    stackCouponId: MONTHLY_BONUS,
  });
});

test('bonus alone rides checkout by itself', () => {
  assert.deepEqual(splitRefereeBonus(null, ANNUAL_BONUS), {
    couponId: ANNUAL_BONUS,
    stackCouponId: null,
  });
});

test('another offer with no bonus is unchanged, and neither means no discount', () => {
  assert.deepEqual(splitRefereeBonus('coupon_promo_pro_annual', null), {
    couponId: 'coupon_promo_pro_annual',
    stackCouponId: null,
  });
  assert.deepEqual(splitRefereeBonus(null, null), { couponId: null, stackCouponId: null });
});

test('invariant: an earned bonus is never traded away for another offer', () => {
  // The regression this guards: making the bonus an EITHER/OR with the promo or
  // the founding rate. Whatever else applies, an earned bonus must survive
  // exactly once across the two slots.
  for (const primary of [null, 'coupon_promo_pro_monthly', 'coupon_founding_pro_intro']) {
    const split = splitRefereeBonus(primary, MONTHLY_BONUS);
    const slots = [split.couponId, split.stackCouponId].filter(Boolean);
    assert.equal(
      slots.filter((c) => c === MONTHLY_BONUS).length,
      1,
      `primary=${primary}: the bonus must appear exactly once`,
    );
    if (primary) {
      assert.ok(slots.includes(primary), `primary=${primary}: the other offer must survive too`);
      assert.equal(split.couponId, primary, 'the advertised rate is what checkout shows');
    }
  }
});
