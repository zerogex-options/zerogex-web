import test from 'node:test';
import assert from 'node:assert/strict';
import { planSwitchDiscounts } from '../core/switchDiscounts.ts';

// planSwitchDiscounts decides the coupons a subscription carries after a plan
// switch, for the webhook, the in-app trial upgrade and the manual fix script
// alike. Every coupon it considers is read from env on each call, so setting
// them here, before any test runs, is enough (as in campaigns.test.ts).
//
// The business card's campaign rate (50% off, code TARGET) is exclusive at
// checkout: the public promo never rides on top of it. These lock in that a
// switch keeps it exclusive too.

const PROMO = 'promo_10_off_12m';
const CARD_MONTHLY = 'card_50_off_12m';
const CARD_ANNUAL = 'card_50_off_once';

// The public promo is live: its window is open and both monthly plans carry it.
process.env.PROMO_END_AT = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
process.env.STRIPE_COUPON_PROMO_BASIC_MONTHLY = PROMO;
process.env.STRIPE_COUPON_PROMO_PRO_MONTHLY = PROMO;
process.env.STRIPE_CAMPAIGN_TARGET_MONTHLY = CARD_MONTHLY;
process.env.STRIPE_CAMPAIGN_TARGET_ANNUAL = CARD_ANNUAL;

function switchTo(tier: 'basic' | 'pro', cadence: 'monthly' | 'quarterly' | 'annual', currentCouponIds: string[]) {
  return planSwitchDiscounts({
    currentCouponIds,
    newSku: { tier, cadence },
    foundingMemberStartedAt: null,
    foundingLifetimeAppliedAt: null,
  });
}

test('a card member moving Basic → Pro monthly keeps the card rate and gets no promo on top', () => {
  const plan = switchTo('pro', 'monthly', [CARD_MONTHLY]);
  assert.ok(plan);
  assert.deepEqual(plan.keep, [CARD_MONTHLY]);
  assert.equal(plan.changed, false);
});

test('a card member moving Pro → Basic monthly gets no promo on top either', () => {
  const plan = switchTo('basic', 'monthly', [CARD_MONTHLY]);
  assert.ok(plan);
  assert.deepEqual(plan.keep, [CARD_MONTHLY]);
  assert.equal(plan.changed, false);
});

test('a card member already carrying the promo as well has it removed on their next switch', () => {
  const plan = switchTo('pro', 'monthly', [CARD_MONTHLY, PROMO]);
  assert.ok(plan);
  assert.deepEqual(plan.keep, [CARD_MONTHLY]);
  assert.deepEqual(plan.stale, [PROMO]);
  assert.equal(plan.changed, true);
});

test('the annual card coupon rules out the promo in the same way', () => {
  const plan = switchTo('basic', 'monthly', [CARD_ANNUAL]);
  assert.ok(plan);
  assert.deepEqual(plan.keep, [CARD_ANNUAL]);
  assert.equal(plan.changed, false);
});

test('a card member moving to a period with no card coupon keeps the one they have', () => {
  const plan = switchTo('basic', 'quarterly', [CARD_MONTHLY]);
  assert.ok(plan);
  assert.deepEqual(plan.keep, [CARD_MONTHLY]);
  assert.equal(plan.changed, false);
});

test('a member without the card rate still gets the live promo on the same switch', () => {
  const plan = switchTo('pro', 'monthly', []);
  assert.ok(plan);
  assert.deepEqual(plan.keep, [PROMO]);
  assert.deepEqual(plan.missing, [PROMO]);
  assert.equal(plan.changed, true);
});
