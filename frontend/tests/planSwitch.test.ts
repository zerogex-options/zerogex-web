import test from 'node:test';
import assert from 'node:assert/strict';
import {
  decidePlanSwitch,
  isDowngrade,
  pickSwitchPromoCoupon,
  reconcileSwitchDiscounts,
  type PlanSwitchInput,
} from '../core/planSwitch.ts';

// decidePlanSwitch is the gate between an in-app plan change and the Stripe
// billing portal. Since only Basic monthly trials (core/billingPlans.ts), a
// trialing member moving onto any other plan starts paying — in-app, after
// confirming the amount — while paid members and downgrades keep going to the
// portal exactly as before. Lock the matrix down.

function input(over: Partial<PlanSwitchInput> = {}): PlanSwitchInput {
  return {
    currentTier: 'basic',
    currentCadence: 'monthly',
    targetTier: 'pro',
    targetCadence: 'monthly',
    targetHasTrial: false,
    status: 'trialing',
    ...over,
  };
}

test('trialing Basic → Pro (a guarantee plan) starts paying in-app', () => {
  assert.deepEqual(decidePlanSwitch(input()), { kind: 'in_app_start_paid' });
});

test('trialing Basic monthly → any quarterly or annual plan also starts paying in-app', () => {
  for (const targetCadence of ['quarterly', 'annual'] as const) {
    for (const targetTier of ['basic', 'pro'] as const) {
      assert.deepEqual(
        decidePlanSwitch(input({ targetTier, targetCadence })),
        { kind: 'in_app_start_paid' },
        `${targetTier}/${targetCadence}`,
      );
    }
  }
});

test('a trial-plan target keeps the trial for the original shape: tier up, same cadence', () => {
  // Only reachable when BILLING_TRIAL_PLANS puts Pro back on a trial.
  assert.deepEqual(decidePlanSwitch(input({ targetHasTrial: true })), { kind: 'in_app_upgrade' });
  // ...and anything else toward a trial plan still goes through the portal.
  assert.deepEqual(
    decidePlanSwitch(input({ targetHasTrial: true, targetCadence: 'annual' })),
    { kind: 'portal' },
  );
});

test('an ACTIVE (paid) member switching goes to the portal for proration', () => {
  assert.deepEqual(decidePlanSwitch(input({ status: 'active' })), { kind: 'portal' });
  assert.deepEqual(decidePlanSwitch(input({ status: 'active', targetCadence: 'quarterly' })), { kind: 'portal' });
});

test('a past_due member goes to the portal, never in-app', () => {
  assert.deepEqual(decidePlanSwitch(input({ status: 'past_due' })), { kind: 'portal' });
});

test('downgrades always route to the portal, even during a trial', () => {
  // Lower tier.
  assert.deepEqual(
    decidePlanSwitch(input({ currentTier: 'pro', targetTier: 'basic' })),
    { kind: 'portal' },
  );
  // Same tier, shorter period.
  assert.deepEqual(
    decidePlanSwitch(input({ currentTier: 'pro', targetTier: 'pro', currentCadence: 'annual', targetCadence: 'quarterly' })),
    { kind: 'portal' },
  );
  // Lower tier on a longer period is still a tier downgrade.
  assert.deepEqual(
    decidePlanSwitch(input({ currentTier: 'pro', targetTier: 'basic', targetCadence: 'annual' })),
    { kind: 'portal' },
  );
});

test('a grandfathered Pro trial moving to a longer Pro period starts paying', () => {
  assert.deepEqual(
    decidePlanSwitch(input({ currentTier: 'pro', targetTier: 'pro', targetCadence: 'annual' })),
    { kind: 'in_app_start_paid' },
  );
});

test('same plan on both sides is a no-op', () => {
  assert.deepEqual(decidePlanSwitch(input({ targetTier: 'basic' })), { kind: 'noop' });
});

test('an unresolvable current price never switches in-app — falls back to the portal', () => {
  assert.deepEqual(decidePlanSwitch(input({ currentTier: null, currentCadence: null })), { kind: 'portal' });
});

test('downgrade ordering: tier first, then billing period', () => {
  const base = { currentTier: 'basic', currentCadence: 'monthly', targetTier: 'basic', targetCadence: 'monthly' } as const;
  assert.equal(isDowngrade({ ...base, targetCadence: 'quarterly' }), false);
  assert.equal(isDowngrade({ ...base, currentCadence: 'annual', targetCadence: 'quarterly' }), true);
  assert.equal(isDowngrade({ ...base, currentTier: 'pro', targetCadence: 'annual' }), true);
  assert.equal(isDowngrade({ ...base, targetTier: 'pro' }), false);
});

// --- Discounts across a switch --------------------------------------------

const PROMO_MONTHLY = 'promo_10_off_12mo';
const OLD_ANNUAL_PROMO = 'promo_annual_old';
const FOUNDING_INTRO = 'founding_intro_monthly';
const WINBACK = 'winback_25';
const MANAGED = [PROMO_MONTHLY, OLD_ANNUAL_PROMO, FOUNDING_INTRO];

test('a monthly promo is stripped on a move to a plan with no promo, even with no replacement', () => {
  const plan = reconcileSwitchDiscounts({
    currentCouponIds: [PROMO_MONTHLY],
    managedCouponIds: MANAGED,
    correctCouponIds: [null],
  });
  assert.deepEqual(plan, { keep: [], stale: [PROMO_MONTHLY], missing: [], changed: true });
});

test('coupons we do not manage are kept, in order, across the switch', () => {
  const plan = reconcileSwitchDiscounts({
    currentCouponIds: [WINBACK, PROMO_MONTHLY],
    managedCouponIds: MANAGED,
    correctCouponIds: [PROMO_MONTHLY],
  });
  assert.deepEqual(plan, { keep: [WINBACK, PROMO_MONTHLY], stale: [], missing: [], changed: false });
});

test('the correct coupon is added when missing, and a stale one swapped out', () => {
  const plan = reconcileSwitchDiscounts({
    currentCouponIds: [OLD_ANNUAL_PROMO, WINBACK],
    managedCouponIds: MANAGED,
    correctCouponIds: [PROMO_MONTHLY, null],
  });
  assert.deepEqual(plan, {
    keep: [WINBACK, PROMO_MONTHLY],
    stale: [OLD_ANNUAL_PROMO],
    missing: [PROMO_MONTHLY],
    changed: true,
  });
});

test('nothing to do reports unchanged, so no update is sent', () => {
  const plan = reconcileSwitchDiscounts({ currentCouponIds: [], managedCouponIds: MANAGED, correctCouponIds: [null] });
  assert.equal(plan.changed, false);
  assert.deepEqual(plan.keep, []);
});

// The promo promises the member's first 12 months, so it follows them across a
// move to the other monthly plan, even after the signup window has closed.
test('a held monthly promo stays on a Basic → Pro monthly switch after the window closes', () => {
  assert.equal(
    pickSwitchPromoCoupon({
      currentCouponIds: ['c_other', 'c_promo_monthly'],
      advertisedPromoCouponIds: ['c_promo_monthly'],
      targetAdvertisesPromo: true,
      activePromoCouponId: null,
    }),
    'c_promo_monthly',
  );
});

test('a held promo is never swapped for another promo coupon (the 12-month clock must not restart)', () => {
  assert.equal(
    pickSwitchPromoCoupon({
      currentCouponIds: ['c_promo_basic'],
      advertisedPromoCouponIds: ['c_promo_basic', 'c_promo_pro'],
      targetAdvertisesPromo: true,
      activePromoCouponId: 'c_promo_pro',
    }),
    'c_promo_basic',
  );
});

test('a move to a plan without the promo drops it; otherwise the live promo (or none) applies', () => {
  // Monthly → annual: not advertised there, and nothing live for annual.
  assert.equal(
    pickSwitchPromoCoupon({
      currentCouponIds: ['c_promo_monthly'],
      advertisedPromoCouponIds: ['c_promo_monthly'],
      targetAdvertisesPromo: false,
      activePromoCouponId: null,
    }),
    null,
  );
  // No promo held: whatever checkout would attach today.
  assert.equal(
    pickSwitchPromoCoupon({
      currentCouponIds: [],
      advertisedPromoCouponIds: ['c_promo_monthly'],
      targetAdvertisesPromo: true,
      activePromoCouponId: 'c_promo_monthly',
    }),
    'c_promo_monthly',
  );
  assert.equal(
    pickSwitchPromoCoupon({
      currentCouponIds: ['c_winback'],
      advertisedPromoCouponIds: ['c_promo_monthly'],
      targetAdvertisesPromo: true,
      activePromoCouponId: null,
    }),
    null,
  );
});
