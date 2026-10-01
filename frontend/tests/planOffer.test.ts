import test from 'node:test';
import assert from 'node:assert/strict';
import { countPaidPeriods, isPlanOfferDue, PLAN_OFFER_WINDOW_DAYS, type PlanOfferInput } from '../core/planOffer.ts';

// The first-month plan offer goes to a monthly member a few days before their
// first renewal, once per subscription, never to someone who opted out of
// marketing email or is already leaving.

const NOW = Date.parse('2026-10-01T15:00:00Z');
const DAY = 86_400_000;

function input(over: Partial<PlanOfferInput> = {}): PlanOfferInput {
  return {
    cadence: 'monthly',
    status: 'active',
    cancelAtPeriodEnd: false,
    paused: false,
    marketingUnsubscribed: false,
    subscriptionId: 'sub_A',
    periodEndIso: new Date(NOW + 5 * DAY).toISOString(),
    paidPeriods: 1,
    sentForSubscriptionId: null,
    nowMs: NOW,
    ...over,
  };
}

test('due for a monthly member in their first paid month, days before the renewal', () => {
  assert.equal(isPlanOfferDue(input()), true);
});

test('the window: not too early, and not on the last day', () => {
  const at = (days: number) => isPlanOfferDue(input({ periodEndIso: new Date(NOW + days * DAY).toISOString() }));
  assert.equal(at(PLAN_OFFER_WINDOW_DAYS.latest + 0.01), false);
  assert.equal(at(PLAN_OFFER_WINDOW_DAYS.latest), true);
  assert.equal(at(2), true);
  assert.equal(at(PLAN_OFFER_WINDOW_DAYS.earliest), false);
  assert.equal(at(-1), false);
  assert.equal(isPlanOfferDue(input({ periodEndIso: null })), false);
  assert.equal(isPlanOfferDue(input({ periodEndIso: 'not a date' })), false);
});

test('only the first paid month: not a trial, not a later renewal', () => {
  assert.equal(isPlanOfferDue(input({ paidPeriods: 0 })), false);
  assert.equal(isPlanOfferDue(input({ paidPeriods: 2 })), false);
  assert.equal(isPlanOfferDue(input({ status: 'trialing' })), false);
});

test('never to someone leaving, paused, past due, opted out, or not on monthly', () => {
  assert.equal(isPlanOfferDue(input({ cancelAtPeriodEnd: true })), false);
  assert.equal(isPlanOfferDue(input({ paused: true })), false);
  assert.equal(isPlanOfferDue(input({ status: 'past_due' })), false);
  assert.equal(isPlanOfferDue(input({ marketingUnsubscribed: true })), false);
  assert.equal(isPlanOfferDue(input({ cadence: 'quarterly' })), false);
  assert.equal(isPlanOfferDue(input({ cadence: 'annual' })), false);
  assert.equal(isPlanOfferDue(input({ cadence: null })), false);
});

test('once per subscription: a new subscription is eligible again', () => {
  assert.equal(isPlanOfferDue(input({ sentForSubscriptionId: 'sub_A' })), false);
  assert.equal(isPlanOfferDue(input({ sentForSubscriptionId: 'sub_OLD' })), true);
  assert.equal(isPlanOfferDue(input({ subscriptionId: null })), false);
});

test('countPaidPeriods counts each period-opening payment once', () => {
  const rows = [
    // The $0 invoice that opened the trial: not a payment.
    { type: 'stripe_invoice_paid', message: 'Invoice in_0 paid for sub sub_A amount=0 billing_reason=subscription_create period_end=x price=p' },
    // The first charge, reported twice (account stamp and invoice row).
    { type: 'stripe_first_payment', message: 'First payment cleared on sub sub_A (invoice in_1, 5900 usd)' },
    { type: 'stripe_invoice_paid', message: 'Invoice in_1 paid for sub sub_A amount=5900 billing_reason=subscription_cycle period_end=x price=p' },
    // A mid-period tier change opens no period of its own.
    { type: 'stripe_invoice_paid', message: 'Invoice in_u paid for sub sub_A amount=1200 billing_reason=subscription_update period_end=x price=p' },
    // Another subscription, and one whose id merely starts the same way.
    { type: 'stripe_invoice_paid', message: 'Invoice in_9 paid for sub sub_B amount=5900 billing_reason=subscription_cycle period_end=x price=p' },
    { type: 'stripe_invoice_paid', message: 'Invoice in_8 paid for sub sub_AB amount=5900 billing_reason=subscription_cycle period_end=x price=p' },
    // Not payment evidence at all.
    { type: 'stripe_payment_failed', message: 'Payment failed for sub sub_A invoice in_7' },
  ];
  assert.equal(countPaidPeriods(rows, 'sub_A'), 1);
  const renewed = [
    ...rows,
    { type: 'stripe_invoice_paid', message: 'Invoice in_2 paid for sub sub_A amount=5900 billing_reason=subscription_cycle period_end=x price=p' },
  ];
  assert.equal(countPaidPeriods(renewed, 'sub_A'), 2);
  assert.equal(countPaidPeriods([], 'sub_A'), 0);
});

test('a plan paid up front at checkout counts its first payment', () => {
  const rows = [
    { type: 'stripe_invoice_paid', message: 'Invoice in_c paid for sub sub_P amount=4900 billing_reason=subscription_create period_end=x price=p' },
  ];
  assert.equal(countPaidPeriods(rows, 'sub_P'), 1);
});

test('the email names the plans, the renewal date, the switch link and the opt-out', async () => {
  const { buildPlanOfferEmail } = await import('../core/mailer.ts');
  const { subject, text, html } = buildPlanOfferEmail({
    tierLabel: 'Pro',
    renewalIso: '2026-10-06T16:14:00Z',
    offers: [
      { label: 'annual', price: '$299 a year', perMonth: '$24.92' },
      { label: 'quarterly', price: '$115 every 3 months', perMonth: '$38.33' },
    ],
    switchUrl: 'https://zerogex.io/pricing?cadence=annual&from=plan_offer',
    unsubUrl: 'https://zerogex.io/unsubscribe?u=user_1&t=tok',
  });
  assert.match(subject, /Pro/);
  assert.match(subject, /annual/);
  for (const body of [text, html]) {
    assert.match(body, /Pro annual: \$299 a year, about \$24\.92 a month/);
    assert.match(body, /Pro quarterly: \$115 every 3 months, about \$38\.33 a month/);
    assert.match(body, /October 6, 2026/);
    // Staying on monthly is stated as the no-action default.
    assert.match(body, /there(?:'|&#39;)s nothing to do/);
  }
  assert.match(text, /pricing\?cadence=annual&from=plan_offer/);
  assert.match(html, /href="https:\/\/zerogex\.io\/pricing\?cadence=annual&amp;from=plan_offer"/);
  assert.match(text, /Unsubscribe: https:\/\/zerogex\.io\/unsubscribe/);
  assert.match(html, /href="https:\/\/zerogex\.io\/unsubscribe\?u=user_1&amp;t=tok"/);
});
