import test from 'node:test';
import assert from 'node:assert/strict';
import {
  decideOrphanPayment,
  buildRecoverySubscriptionParams,
  RECOVERED_FROM_INVOICE_KEY,
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
