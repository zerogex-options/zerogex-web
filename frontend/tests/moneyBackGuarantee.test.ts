import test from 'node:test';
import assert from 'node:assert/strict';

// The 7-day money-back guarantee's decisions (core/moneyBackGuarantee.ts):
// which subscriptions it covers, the window, the one-refund limit, and exactly
// which payments a refund gives back.

import {
  canonicalEmail,
  decideMoneyBack,
  isCoveredStart,
  type GuaranteeInvoice,
  type GuaranteeSubscription,
  type MoneyBackInput,
} from '../core/moneyBackGuarantee.ts';

const DAY = 86_400;
const NOW = Date.UTC(2026, 9, 10, 15, 0, 0); // 2026-10-10 15:00Z
const nowUnix = Math.floor(NOW / 1000);

const PRO_MONTHLY = 'price_pro_monthly';
const BASIC_MONTHLY = 'price_basic_monthly';
const PRO_QUARTERLY = 'price_pro_quarterly';
const covered = (priceId: string | null) => priceId === PRO_MONTHLY || priceId === PRO_QUARTERLY;

function invoice(over: Partial<GuaranteeInvoice> = {}): GuaranteeInvoice {
  return {
    id: 'in_1',
    status: 'paid',
    billingReason: 'subscription_create',
    amountPaid: 4900,
    amountRefunded: 0,
    paidAtUnix: nowUnix - 2 * DAY,
    createdUnix: nowUnix - 2 * DAY,
    priceId: PRO_MONTHLY,
    chargeId: 'ch_1',
    paymentIntentId: 'pi_1',
    currency: 'usd',
    ...over,
  };
}

function sub(over: Partial<GuaranteeSubscription> = {}): GuaranteeSubscription {
  return { id: 'sub_1', status: 'active', trialEndUnix: null, stampedMoneyBack: true, ...over };
}

function input(over: Partial<MoneyBackInput> = {}): MoneyBackInput {
  return {
    nowMs: NOW,
    windowDays: 7,
    subscription: sub(),
    invoices: [invoice()],
    priceCovered: covered,
    priorRefundElsewhere: false,
    resuming: false,
    ...over,
  };
}

test('a paid-up-front purchase inside the window is refunded in full', () => {
  const decision = decideMoneyBack(input());
  assert.equal(decision.eligible, true);
  if (!decision.eligible) return;
  assert.equal(decision.totalAmount, 4900);
  assert.equal(decision.currency, 'usd');
  assert.deepEqual(decision.refunds.map((r) => r.invoiceId), ['in_1']);
  assert.equal(decision.deadlineMs, (nowUnix - 2 * DAY + 7 * DAY) * 1000);
});

test('the window is 7 days from the first payment, to the second', () => {
  const paidAt = nowUnix - 7 * DAY;
  // Exactly at the deadline: still honored.
  assert.equal(decideMoneyBack(input({ invoices: [invoice({ paidAtUnix: paidAt })] })).eligible, true);
  // One second later: closed, and the deadline is reported for the UI.
  const late = decideMoneyBack(input({ invoices: [invoice({ paidAtUnix: paidAt - 1 })] }));
  assert.equal(late.eligible, false);
  if (!late.eligible) {
    assert.equal(late.reason, 'window_elapsed');
    assert.equal(late.deadlineMs, (paidAt - 1 + 7 * DAY) * 1000);
  }
});

test('one refund per customer', () => {
  const decision = decideMoneyBack(input({ priorRefundElsewhere: true }));
  assert.deepEqual(
    decision.eligible ? null : decision.reason,
    'prior_refund',
  );
});

test('a trial that simply ran out is not covered — it was the free trial', () => {
  const trialEnd = nowUnix - 2 * DAY;
  const decision = decideMoneyBack(
    input({
      subscription: sub({ stampedMoneyBack: false, trialEndUnix: trialEnd }),
      invoices: [
        invoice({ id: 'in_0', billingReason: 'subscription_create', amountPaid: 0, priceId: BASIC_MONTHLY, paidAtUnix: trialEnd - 7 * DAY }),
        invoice({ billingReason: 'subscription_cycle', priceId: BASIC_MONTHLY, createdUnix: trialEnd, paidAtUnix: trialEnd + 3600 }),
      ],
    }),
  );
  assert.equal(decision.eligible ? null : decision.reason, 'not_covered');
});

test('the in-app upgrade out of a trial is covered however Stripe labels its invoice', () => {
  const trialEnd = nowUnix - 1 * DAY; // trial ended early, by our update
  for (const billingReason of ['subscription_update', 'subscription_cycle']) {
    const decision = decideMoneyBack(
      input({
        subscription: sub({ stampedMoneyBack: true, trialEndUnix: trialEnd }),
        invoices: [
          invoice({ id: 'in_0', amountPaid: 0, priceId: BASIC_MONTHLY, paidAtUnix: trialEnd - 3 * DAY }),
          invoice({ billingReason, createdUnix: trialEnd, paidAtUnix: trialEnd }),
        ],
      }),
    );
    assert.equal(decision.eligible, true, billingReason);
  }
});

test('an unstamped portal switch onto a guarantee plan is covered by its price', () => {
  const start = invoice({ billingReason: 'subscription_update', priceId: PRO_QUARTERLY, amountPaid: 11500 });
  assert.equal(isCoveredStart(sub({ stampedMoneyBack: false }), start, covered), true);
  // ...but the same switch onto a plan without the guarantee is not.
  assert.equal(
    isCoveredStart(sub({ stampedMoneyBack: false }), { ...start, priceId: BASIC_MONTHLY }, covered),
    false,
  );
});

test('an unstamped purchase is not covered, even on a plan that now carries the guarantee', () => {
  // Checkout stamps every purchase it sells under the guarantee, so an
  // unstamped create invoice was sold without it: say a resubscriber who paid
  // for Pro up front the week before the guarantee launched. Deploying must not
  // hand them a refund button for a purchase made on other terms.
  const purchase = invoice({ billingReason: 'subscription_create', priceId: PRO_MONTHLY });
  assert.equal(isCoveredStart(sub({ stampedMoneyBack: false }), purchase, covered), false);
  assert.equal(isCoveredStart(sub({ stampedMoneyBack: true }), purchase, covered), true);
  const decision = decideMoneyBack(input({ subscription: sub({ stampedMoneyBack: false }), invoices: [purchase] }));
  assert.equal(decision.eligible, false);
  assert.equal(!decision.eligible && decision.reason, 'not_covered');
});

test('a subscription whose first payment is an ordinary renewal is not covered', () => {
  // First month free (a referral bonus): the first money is month two's renewal.
  const decision = decideMoneyBack(
    input({
      invoices: [
        invoice({ id: 'in_0', amountPaid: 0, paidAtUnix: nowUnix - 32 * DAY }),
        invoice({ billingReason: 'subscription_cycle', paidAtUnix: nowUnix - 1 * DAY, createdUnix: nowUnix - 1 * DAY }),
      ],
    }),
  );
  assert.equal(decision.eligible ? null : decision.reason, 'not_covered');
});

test('a proration from an upgrade inside the window is refunded too', () => {
  const decision = decideMoneyBack(
    input({
      invoices: [
        invoice(),
        invoice({ id: 'in_2', billingReason: 'subscription_update', amountPaid: 6600, paidAtUnix: nowUnix - DAY, chargeId: 'ch_2' }),
      ],
    }),
  );
  assert.equal(decision.eligible, true);
  if (decision.eligible) {
    assert.equal(decision.totalAmount, 4900 + 6600);
    assert.deepEqual(decision.refunds.map((r) => r.invoiceId), ['in_1', 'in_2']);
  }
});

test('only what is still unrefunded is given back, and a fully refunded payment is not refunded again', () => {
  const partial = decideMoneyBack(input({ invoices: [invoice({ amountRefunded: 900 })] }));
  assert.equal(partial.eligible && partial.totalAmount, 4000);
  const done = decideMoneyBack(input({ invoices: [invoice({ amountRefunded: 4900 })] }));
  assert.equal(done.eligible ? null : done.reason, 'already_refunded');
});

test('an unreadable refund state refuses rather than guesses', () => {
  const decision = decideMoneyBack(input({ invoices: [invoice({ amountRefunded: null })] }));
  assert.equal(decision.eligible ? null : decision.reason, 'refund_state_unknown');
});

test('a payment with nothing the refunds API can reverse goes to a human', () => {
  const decision = decideMoneyBack(input({ invoices: [invoice({ chargeId: null, paymentIntentId: null })] }));
  assert.equal(decision.eligible ? null : decision.reason, 'needs_manual_refund');
});

test('nothing paid yet, or no subscription, or an ended one', () => {
  const unpaid = decideMoneyBack(input({ invoices: [invoice({ amountPaid: 0 })] }));
  assert.equal(unpaid.eligible ? null : unpaid.reason, 'no_payment');
  const noSub = decideMoneyBack(input({ subscription: null }));
  assert.equal(noSub.eligible ? null : noSub.reason, 'no_subscription');
  const ended = decideMoneyBack(input({ subscription: sub({ status: 'canceled' }) }));
  assert.equal(ended.eligible ? null : ended.reason, 'subscription_ended');
});

test('a resumed request finishes even past the window, but only for what was paid when asked', () => {
  const requestedAt = NOW - 1 * DAY * 1000; // a day after the first payment
  const decision = decideMoneyBack(
    input({
      nowMs: NOW + 30 * DAY * 1000,
      resuming: true,
      priorRefundElsewhere: true, // its own ledger row; the resume already passed the limit
      subscription: sub({ status: 'canceled' }),
      refundCutoffMs: requestedAt,
      invoices: [
        invoice(),
        // A renewal paid AFTER the request stalled must never be swept up.
        invoice({ id: 'in_renewal', billingReason: 'subscription_cycle', paidAtUnix: nowUnix + 25 * DAY, chargeId: 'ch_9' }),
      ],
    }),
  );
  assert.equal(decision.eligible, true);
  if (decision.eligible) assert.deepEqual(decision.refunds.map((r) => r.invoiceId), ['in_1']);
});

test('a resumed request whose money is already back only has the cancel left', () => {
  const decision = decideMoneyBack(input({ resuming: true, invoices: [invoice({ amountRefunded: 4900 })] }));
  assert.equal(decision.eligible, true);
  if (decision.eligible) assert.equal(decision.refunds.length, 0);
});

test('canonical email: case, +tags, and Gmail dots are one customer', () => {
  assert.equal(canonicalEmail('  J.Doe+zgx@GMAIL.com '), 'jdoe@gmail.com');
  assert.equal(canonicalEmail('jdoe@googlemail.com'), 'jdoe@gmail.com');
  assert.equal(canonicalEmail('Trader+2@Example.com'), 'trader@example.com');
  // Dots are only ignored where the mailbox provider ignores them.
  assert.equal(canonicalEmail('j.doe@example.com'), 'j.doe@example.com');
  assert.notEqual(canonicalEmail('j.doe@example.com'), canonicalEmail('jdoe@example.com'));
});
