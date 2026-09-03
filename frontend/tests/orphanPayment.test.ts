import test from 'node:test';
import assert from 'node:assert/strict';
import {
  RECOVERED_FROM_INVOICE_KEY,
  buildRecoverySubscriptionParams,
  classifyElapsedPaidPeriod,
  decideDiscountCarryOver,
  decideOrphanPayment,
  readSubscriptionDiscounts,
  type OrphanPaymentInput,
} from '../core/orphanPayment.ts';

// The production case this locks down: a trial's conversion charge failed,
// Stripe exhausted its retries and canceled the subscription, the member was
// dropped to 'public' — and then they paid the still-open invoice from Stripe's
// dunning email. $229 collected, no subscription left to grant anything, and
// (before this module) no code path that noticed.

const NOW = Date.UTC(2026, 7, 20, 16, 0, 0) / 1000; // 2026-08-20, the day they paid
const PERIOD_END = Date.UTC(2027, 7, 15, 15, 32, 0) / 1000; // annual period they bought

function input(over: Partial<OrphanPaymentInput> = {}): OrphanPaymentInput {
  return {
    amountPaid: 22900,
    invoiceStatus: 'paid',
    billingReason: 'subscription_cycle',
    subscriptionId: 'sub_live',
    subscriptionStatus: 'canceled',
    localTier: 'public',
    localSubscriptionId: null,
    priceId: 'price_pro_annual',
    priceMapsToPaidTier: true,
    coveredPeriodEndUnix: PERIOD_END,
    nowUnix: NOW,
    ...over,
  };
}

test('paid invoice on a canceled sub, member on public → recoverable', () => {
  const decision = decideOrphanPayment(input());
  assert.equal(decision.kind, 'detected');
  assert.equal(decision.kind === 'detected' && decision.recoverable, true);
  if (decision.kind === 'detected' && decision.recoverable) {
    assert.equal(decision.priceId, 'price_pro_annual');
    // Billing resumes when the paid period runs out — never sooner, or we would
    // charge twice for the same period.
    assert.equal(decision.billingCycleAnchorUnix, PERIOD_END);
  }
});

test('the subscription is still alive → the ordinary sync owns it', () => {
  for (const status of ['active', 'trialing', 'past_due', 'unpaid', 'incomplete', 'paused']) {
    const decision = decideOrphanPayment(input({ subscriptionStatus: status }));
    assert.equal(decision.kind, 'none', `status ${status} should not be orphaned`);
    assert.equal(decision.kind === 'none' && decision.reason, 'subscription_live');
  }
});

test('member already entitled → nothing orphaned', () => {
  assert.equal(decideOrphanPayment(input({ localTier: 'pro' })).kind, 'none');
  assert.equal(decideOrphanPayment(input({ localSubscriptionId: 'sub_other' })).kind, 'none');
});

test('$0 and unpaid invoices buy nothing', () => {
  assert.equal(decideOrphanPayment(input({ amountPaid: 0 })).kind, 'none');
  assert.equal(decideOrphanPayment(input({ invoiceStatus: 'open' })).kind, 'none');
  assert.equal(decideOrphanPayment(input({ invoiceStatus: 'void' })).kind, 'none');
});

test('an orphaned payment we cannot safely act on is still DETECTED, never silent', () => {
  const cases: Array<[Partial<OrphanPaymentInput>, string]> = [
    [{ subscriptionId: null }, 'no_subscription_parent'],
    [{ billingReason: 'manual' }, 'billing_reason_manual'],
    [{ priceId: null }, 'price_unresolved'],
    [{ priceMapsToPaidTier: false }, 'price_not_in_catalogue'],
    [{ coveredPeriodEndUnix: null }, 'period_unresolved'],
    [{ coveredPeriodEndUnix: NOW - 1 }, 'period_already_elapsed'],
  ];
  for (const [over, reason] of cases) {
    const decision = decideOrphanPayment(input(over));
    assert.equal(decision.kind, 'detected', reason);
    assert.equal(decision.kind === 'detected' && decision.recoverable, false, reason);
    assert.equal(decision.kind === 'detected' && decision.reason, reason);
  }
});

test('a subscription that vanished entirely (status null) is treated as canceled', () => {
  const decision = decideOrphanPayment(input({ subscriptionStatus: null }));
  assert.equal(decision.kind === 'detected' && decision.recoverable, true);
});

test('an unknown billing_reason still recovers rather than dropping the payment', () => {
  const decision = decideOrphanPayment(input({ billingReason: null }));
  assert.equal(decision.kind === 'detected' && decision.recoverable, true);
});

test('recovery params never charge twice and carry the idempotency stamp', () => {
  const params = buildRecoverySubscriptionParams({
    customerId: 'cus_x',
    priceId: 'price_pro_annual',
    billingCycleAnchorUnix: PERIOD_END,
    invoiceId: 'in_x',
    periodStartUnix: NOW - 5 * 24 * 3600,
    defaultPaymentMethodId: 'pm_x',
  });
  assert.deepEqual(params.items, [{ price: 'price_pro_annual' }]);
  assert.equal(params.billing_cycle_anchor, PERIOD_END);
  // Without proration_behavior 'none' Stripe invoices the gap immediately —
  // i.e. bills the member a second time for the period they just paid.
  assert.equal(params.proration_behavior, 'none');
  assert.equal(params.backdate_start_date, NOW - 5 * 24 * 3600);
  assert.equal(params.default_payment_method, 'pm_x');
  assert.deepEqual(params.metadata, { [RECOVERED_FROM_INVOICE_KEY]: 'in_x' });
});

test('recovery params omit optional wiring when it is unknown', () => {
  const params = buildRecoverySubscriptionParams({
    customerId: 'cus_x',
    priceId: 'price_pro_annual',
    billingCycleAnchorUnix: PERIOD_END,
    invoiceId: 'in_x',
    periodStartUnix: null,
    defaultPaymentMethodId: null,
  });
  assert.equal('backdate_start_date' in params, false);
  assert.equal('default_payment_method' in params, false);
});

// --- Discount carry-over ---------------------------------------------------
// The re-created subscription is a NEW Stripe object with no discounts of its
// own. Getting this wrong is a silent price change either way: dropping a
// forever coupon overcharges every future renewal, re-applying a spent one
// discounts a period the member never bought.

test('a forever coupon follows the member onto the new subscription', () => {
  const result = decideDiscountCarryOver([
    { couponId: 'founding_lifetime_25', duration: 'forever', durationInMonths: null },
  ]);
  assert.deepEqual(result.carry, ['founding_lifetime_25']);
  assert.deepEqual(result.flagged, []);
});

test('a spent or partly-spent coupon is flagged, never re-applied', () => {
  const result = decideDiscountCarryOver([
    { couponId: 'promo_first_year', duration: 'once', durationInMonths: null },
    { couponId: 'intro_12mo', duration: 'repeating', durationInMonths: 12 },
  ]);
  assert.deepEqual(result.carry, []);
  assert.deepEqual(result.flagged, [
    // A fully-spent intro price is the designed outcome — the pricing page says
    // "$229 first year, then $299" — so it is reported but not raised for review.
    { couponId: 'promo_first_year', duration: 'once', needsReview: false },
    // A repeating coupon may be partly unspent, which is a judgment call.
    { couponId: 'intro_12mo', duration: 'repeating', needsReview: true },
  ]);
});

test('an unreadable duration is flagged rather than trusted', () => {
  const result = decideDiscountCarryOver([
    { couponId: 'mystery', duration: null, durationInMonths: null },
  ]);
  assert.deepEqual(result.carry, []);
  assert.deepEqual(result.flagged, [
    { couponId: 'mystery', duration: 'unknown', needsReview: true },
  ]);
});

test('mixed discounts split correctly and never duplicate', () => {
  const result = decideDiscountCarryOver([
    { couponId: 'forever_winback', duration: 'forever', durationInMonths: null },
    { couponId: 'forever_winback', duration: 'forever', durationInMonths: null },
    { couponId: 'promo_first_year', duration: 'once', durationInMonths: null },
  ]);
  assert.deepEqual(result.carry, ['forever_winback']);
  assert.equal(result.flagged.length, 1);
});

test("the standard first-year promo raises no review — it expired as advertised", () => {
  const result = decideDiscountCarryOver([
    { couponId: 'promo_pro_annual', duration: 'once', durationInMonths: null },
  ]);
  assert.deepEqual(result.carry, []);
  assert.equal(result.flagged.length, 1);
  assert.equal(result.flagged[0].needsReview, false);
});

test('no discounts on the canceled sub → nothing to carry', () => {
  assert.deepEqual(decideDiscountCarryOver([]), { carry: [], flagged: [] });
});

test('subscription discounts are read across shapes and expansion levels', () => {
  // Expanded coupon objects — the shape the retrieve() with expand gives us.
  assert.deepEqual(
    readSubscriptionDiscounts({
      discounts: [{ coupon: { id: 'c_1', duration: 'forever', duration_in_months: null } }],
    }),
    [{ couponId: 'c_1', duration: 'forever', durationInMonths: null }],
  );
  // Bare coupon id — carries no duration, so the policy refuses it.
  assert.deepEqual(readSubscriptionDiscounts({ discounts: [{ coupon: 'c_2' }] }), [
    { couponId: 'c_2', duration: null, durationInMonths: null },
  ]);
  // Legacy single `discount`.
  assert.deepEqual(
    readSubscriptionDiscounts({
      discount: { coupon: { id: 'c_3', duration: 'repeating', duration_in_months: 6 } },
    }),
    [{ couponId: 'c_3', duration: 'repeating', durationInMonths: 6 }],
  );
  // Garbage never throws.
  for (const junk of [null, undefined, 7, 'sub_x', {}, { discounts: 'nope' }]) {
    assert.deepEqual(readSubscriptionDiscounts(junk), []);
  }
});

test('a bare discount id is unusable and is not carried', () => {
  const discounts = readSubscriptionDiscounts({ discounts: ['di_1'] });
  assert.deepEqual(decideDiscountCarryOver(discounts), { carry: [], flagged: [] });
});

test('carried coupons land in the create params, absent when there are none', () => {
  const base = {
    customerId: 'cus_x',
    priceId: 'price_pro_annual',
    billingCycleAnchorUnix: PERIOD_END,
    invoiceId: 'in_x',
  };
  const withCoupons = buildRecoverySubscriptionParams({ ...base, carryCouponIds: ['c_1'] });
  assert.deepEqual(withCoupons.discounts, [{ coupon: 'c_1' }]);
  assert.equal('discounts' in buildRecoverySubscriptionParams({ ...base, carryCouponIds: [] }), false);
  assert.equal('discounts' in buildRecoverySubscriptionParams(base), false);
});

// --- classifyElapsedPaidPeriod ---------------------------------------------
// A paid period that has run out is either ordinary churn or a member who was
// cut off from something they had already bought. Everything here is about
// keeping those two apart.

const ONE_DAY = 24 * 60 * 60;
const ELAPSED_START = 1_760_000_000;
const ELAPSED_END = ELAPSED_START + 30 * ONE_DAY;

const PAID_SUB = 'sub_paid_for_this_period';

function classifyFixture(over: Partial<Parameters<typeof classifyElapsedPaidPeriod>[0]> = {}) {
  return classifyElapsedPaidPeriod({
    periodStartUnix: ELAPSED_START,
    periodEndUnix: ELAPSED_END,
    invoiceSubscriptionId: PAID_SUB,
    cancellationReason: null,
    deletions: [],
    cancelRequestUnixes: [],
    ...over,
  });
}

// Shorthand: a deletion of the subscription this invoice actually paid for.
function del(atUnix: number, subscriptionId: string = PAID_SUB) {
  return { atUnix, subscriptionId };
}

test('access that ran to the period end is ordinary churn', () => {
  const verdict = classifyFixture({ deletions: [del(ELAPSED_END)] });
  assert.equal(verdict.kind, 'consumed');
  assert.equal(verdict.reason, 'access_ran_to_period_end');
});

test('no deletion at all is ordinary churn', () => {
  assert.equal(classifyFixture().kind, 'consumed');
});

test('a deletion inside the paid window is lost paid time', () => {
  const lostAt = ELAPSED_START + 10 * ONE_DAY;
  const verdict = classifyFixture({ deletions: [del(lostAt)] });
  assert.equal(verdict.kind, 'lost');
  if (verdict.kind !== 'lost') return;
  assert.equal(verdict.lostAtUnix, lostAt);
  assert.equal(verdict.lostSeconds, 20 * ONE_DAY);
});

test('a member who asked to cancel gave the rest of the period up themselves', () => {
  const lostAt = ELAPSED_START + 10 * ONE_DAY;
  const verdict = classifyFixture({
    deletions: [del(lostAt)],
    cancelRequestUnixes: [lostAt - 60],
  });
  assert.equal(verdict.kind, 'consumed');
  assert.equal(verdict.reason, 'member_cancelled_early');
});

test('a cancellation from a previous period does not excuse this deletion', () => {
  // A request long before the deletion belongs to some earlier cancel/resubscribe
  // cycle — reading it as consent here would hide a real loss.
  const lostAt = ELAPSED_START + 20 * ONE_DAY;
  const verdict = classifyFixture({
    deletions: [del(lostAt)],
    cancelRequestUnixes: [ELAPSED_START - 90 * ONE_DAY],
  });
  assert.equal(verdict.kind, 'lost');
});

test('a cancellation AFTER the deletion does not excuse it either', () => {
  const lostAt = ELAPSED_START + 10 * ONE_DAY;
  const verdict = classifyFixture({
    deletions: [del(lostAt)],
    cancelRequestUnixes: [lostAt + ONE_DAY],
  });
  assert.equal(verdict.kind, 'lost');
});

test('the earliest involuntary deletion sets the loss', () => {
  const first = ELAPSED_START + 5 * ONE_DAY;
  const verdict = classifyFixture({ deletions: [del(ELAPSED_START + 12 * ONE_DAY), del(first)] });
  assert.equal(verdict.kind, 'lost');
  if (verdict.kind !== 'lost') return;
  assert.equal(verdict.lostAtUnix, first);
});

test('a deletion at the exact period start is not a loss', () => {
  // Boundary: the window is exclusive at both edges, so a deletion stamped at
  // the very start belongs to the prior cycle, not this paid one.
  assert.equal(classifyFixture({ deletions: [del(ELAPSED_START)] }).kind, 'consumed');
});

test('unresolved period bounds never claim a loss', () => {
  const verdict = classifyFixture({
    periodStartUnix: null,
    deletions: [del(ELAPSED_START + ONE_DAY)],
  });
  assert.equal(verdict.kind, 'consumed');
  assert.equal(verdict.reason, 'period_bounds_unresolved');
});

test('a plan switch is not a loss — it deletes a different subscription', () => {
  // The old subscription is torn down at the instant the new one starts, which
  // lands inside the period the new one just billed for. Only the subscription
  // id tells the two apart.
  const verdict = classifyFixture({
    deletions: [del(ELAPSED_START + 5, 'sub_the_old_plan')],
  });
  assert.equal(verdict.kind, 'consumed');
  assert.equal(verdict.reason, 'access_ran_to_period_end');
});

test('a loss is still caught when a switch happened in the same window', () => {
  const lostAt = ELAPSED_START + 9 * ONE_DAY;
  const verdict = classifyFixture({
    deletions: [del(ELAPSED_START + 5, 'sub_the_old_plan'), del(lostAt)],
  });
  assert.equal(verdict.kind, 'lost');
  if (verdict.kind !== 'lost') return;
  assert.equal(verdict.lostAtUnix, lostAt);
});

test('an unnamed subscription in the deletion record claims nothing', () => {
  const verdict = classifyFixture({
    deletions: [del(ELAPSED_START + 9 * ONE_DAY, null)],
  });
  assert.equal(verdict.kind, 'consumed');
});

test('an invoice with no subscription claims nothing', () => {
  const verdict = classifyFixture({
    invoiceSubscriptionId: null,
    deletions: [del(ELAPSED_START + 9 * ONE_DAY)],
  });
  assert.equal(verdict.kind, 'consumed');
  assert.equal(verdict.reason, 'subscription_unresolved');
});

test("Stripe's own cancellation_requested outranks a missing audit row", () => {
  // A portal cancellation writes no audit row of ours, so without this the
  // member's own decision reads as access being taken away from them.
  const verdict = classifyFixture({
    cancellationReason: 'cancellation_requested',
    deletions: [del(ELAPSED_START + 3 * ONE_DAY)],
    cancelRequestUnixes: [],
  });
  assert.equal(verdict.kind, 'consumed');
  assert.equal(verdict.reason, 'member_requested_cancellation');
});

test('a payment_failed cancellation inside a paid period is still a loss', () => {
  const lostAt = ELAPSED_START + 3 * ONE_DAY;
  const verdict = classifyFixture({
    cancellationReason: 'payment_failed',
    deletions: [del(lostAt)],
  });
  assert.equal(verdict.kind, 'lost');
  if (verdict.kind !== 'lost') return;
  assert.equal(verdict.lostAtUnix, lostAt);
});
