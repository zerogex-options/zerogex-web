import test from 'node:test';
import assert from 'node:assert/strict';

// The plan catalogue and the trial-vs-guarantee policy (core/billingPlans.ts).
// These are the numbers and rules the pricing page shows, checkout enforces and
// the refund flow honors, so they are pinned here rather than trusted to stay
// in step by eye.

import {
  BILLABLE_TIERS,
  BILLING_CADENCES,
  DEFAULT_TRIAL_PLANS,
  LIST_PRICE_USD,
  MONEY_BACK_GUARANTEE_DAYS,
  MONTHLY_PROMO,
  formatUsd,
  isBillingCadence,
  isPromoAdvertised,
  maxSavingsPct,
  parseTrialPlans,
  perMonthEquivalentUsd,
  planDisplay,
  planHasFreeTrial,
  planHasMoneyBackGuarantee,
  promoPriceUsd,
  savingsVsMonthlyPct,
} from '../core/billingPlans.ts';

test('the price ladder is the one agreed', () => {
  assert.deepEqual(LIST_PRICE_USD, {
    basic: { monthly: 39, quarterly: 75, annual: 199 },
    pro: { monthly: 59, quarterly: 115, annual: 299 },
  });
});

test('per-month equivalents put every cadence on one axis', () => {
  assert.equal(perMonthEquivalentUsd({ tier: 'basic', cadence: 'monthly' }), 39);
  assert.equal(perMonthEquivalentUsd({ tier: 'basic', cadence: 'quarterly' }), 25);
  assert.equal(perMonthEquivalentUsd({ tier: 'basic', cadence: 'annual' }), 16.58);
  assert.equal(perMonthEquivalentUsd({ tier: 'pro', cadence: 'monthly' }), 59);
  assert.equal(perMonthEquivalentUsd({ tier: 'pro', cadence: 'quarterly' }), 38.33);
  assert.equal(perMonthEquivalentUsd({ tier: 'pro', cadence: 'annual' }), 24.92);
});

test('each longer commitment is strictly cheaper per month, for both tiers', () => {
  for (const tier of BILLABLE_TIERS) {
    const m = perMonthEquivalentUsd({ tier, cadence: 'monthly' });
    const q = perMonthEquivalentUsd({ tier, cadence: 'quarterly' });
    const a = perMonthEquivalentUsd({ tier, cadence: 'annual' });
    assert.ok(m > q && q > a, `${tier}: ${m} > ${q} > ${a}`);
  }
});

test('savings are stated against the monthly list price', () => {
  assert.equal(savingsVsMonthlyPct({ tier: 'basic', cadence: 'monthly' }), null);
  assert.equal(savingsVsMonthlyPct({ tier: 'basic', cadence: 'quarterly' }), 36);
  assert.equal(savingsVsMonthlyPct({ tier: 'pro', cadence: 'quarterly' }), 35);
  // The annual figures the page has always shown.
  assert.equal(savingsVsMonthlyPct({ tier: 'basic', cadence: 'annual' }), 57);
  assert.equal(savingsVsMonthlyPct({ tier: 'pro', cadence: 'annual' }), 58);
  assert.equal(maxSavingsPct('quarterly'), 36);
  assert.equal(maxSavingsPct('annual'), 58);
  assert.equal(maxSavingsPct('monthly'), null);
});

test('the promo is $10 off the monthly plans for 12 months, and nowhere else', () => {
  assert.equal(MONTHLY_PROMO.amountOffUsd, 10);
  assert.equal(MONTHLY_PROMO.months, 12);
  assert.equal(promoPriceUsd({ tier: 'basic', cadence: 'monthly' }), 29);
  assert.equal(promoPriceUsd({ tier: 'pro', cadence: 'monthly' }), 49);
  for (const tier of BILLABLE_TIERS) {
    for (const cadence of ['quarterly', 'annual'] as const) {
      assert.equal(promoPriceUsd({ tier, cadence }), null);
      // Not advertised means checkout will not attach it either (core/stripe.ts
      // getActivePromoCouponId gates on this), so a stale annual coupon in env
      // can never discount a checkout the page quotes at list.
      assert.equal(isPromoAdvertised({ tier, cadence }), false);
    }
    assert.equal(isPromoAdvertised({ tier, cadence: 'monthly' }), true);
  }
  const display = planDisplay({ tier: 'pro', cadence: 'monthly' });
  assert.equal(display.promoPrice, 49);
  assert.equal(display.promoPeriods, 12);
  assert.equal(planDisplay({ tier: 'pro', cadence: 'annual' }).promoPrice, null);
});

test('by default only Basic monthly has a free trial', () => {
  const plans = parseTrialPlans(undefined);
  assert.deepEqual([...plans], [...DEFAULT_TRIAL_PLANS]);
  assert.equal(planHasFreeTrial({ tier: 'basic', cadence: 'monthly' }, plans), true);
  for (const tier of BILLABLE_TIERS) {
    for (const cadence of BILLING_CADENCES) {
      if (tier === 'basic' && cadence === 'monthly') continue;
      assert.equal(planHasFreeTrial({ tier, cadence }, plans), false, `${tier}/${cadence}`);
    }
  }
});

test('every plan carries exactly one protection: a trial or the guarantee', () => {
  for (const raw of [undefined, '', 'none', 'pro:monthly', 'basic:monthly,pro:annual']) {
    const plans = parseTrialPlans(raw);
    for (const tier of BILLABLE_TIERS) {
      for (const cadence of BILLING_CADENCES) {
        const sku = { tier, cadence };
        assert.notEqual(
          planHasFreeTrial(sku, plans),
          planHasMoneyBackGuarantee(sku, plans),
          `${tier}/${cadence} under ${JSON.stringify(raw)}`,
        );
      }
    }
  }
});

test('BILLING_TRIAL_PLANS can restore trials without a deploy', () => {
  const plans = parseTrialPlans('basic:monthly, pro:monthly ,BASIC:ANNUAL,pro:annual');
  assert.deepEqual([...plans].sort(), ['basic:annual', 'basic:monthly', 'pro:annual', 'pro:monthly']);
  assert.equal(parseTrialPlans('none').size, 0);
});

test('a garbled BILLING_TRIAL_PLANS never silently removes the advertised trial', () => {
  // Typos are ignored; if nothing recognizable is left the default applies.
  assert.deepEqual([...parseTrialPlans('basic-monthly')], ['basic:monthly']);
  assert.deepEqual([...parseTrialPlans('gold:monthly,pro:weekly')], ['basic:monthly']);
  // A partly-valid list keeps only the valid entries.
  assert.deepEqual([...parseTrialPlans('pro:monthly,oops')], ['pro:monthly']);
});

test('the guarantee window is 7 days', () => {
  assert.equal(MONEY_BACK_GUARANTEE_DAYS, 7);
});

test('cadence guard accepts quarterly and nothing unknown', () => {
  assert.equal(isBillingCadence('quarterly'), true);
  assert.equal(isBillingCadence('weekly'), false);
  assert.equal(isBillingCadence(undefined), false);
});

test('money formatting drops .00 but keeps real cents', () => {
  assert.equal(formatUsd(25), '$25');
  assert.equal(formatUsd(16.58), '$16.58');
  assert.equal(formatUsd(38.3), '$38.30');
});
