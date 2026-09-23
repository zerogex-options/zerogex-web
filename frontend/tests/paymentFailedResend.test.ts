import test from 'node:test';
import assert from 'node:assert/strict';

import {
  decideResend,
  parsePaymentFailedAudit,
  parseResendAudit,
  resendAuditMessage,
  toDeclineCategory,
} from '../core/paymentFailedResend.ts';

// Who gets a second copy of the payment-failed email. The resend exists because
// the first copy may have gone to spam; it must still only reach members whose
// money is outstanding and whose subscription Stripe is still trying to save.

test('reads both shapes of the audit row the webhook writes', () => {
  assert.deepEqual(parsePaymentFailedAudit('Sent payment-failed email for invoice in_1AbC'), {
    invoiceId: 'in_1AbC',
    trialConversion: false,
  });
  assert.deepEqual(parsePaymentFailedAudit('Sent trial-conversion payment-failed email for invoice in_9Zz'), {
    invoiceId: 'in_9Zz',
    trialConversion: true,
  });
  // The error row for a failed send is not a sent email.
  assert.equal(parsePaymentFailedAudit('Payment-failed email send failed for invoice in_1AbC: boom'), null);
  assert.equal(parsePaymentFailedAudit(''), null);
});

test('the resend latch round-trips its invoice id', () => {
  const message = resendAuditMessage({ invoiceId: 'in_1AbC', trialConversion: true });
  assert.equal(parseResendAudit(message), 'in_1AbC');
});

test('an unpaid invoice on a subscription still in dunning is resent', () => {
  for (const subscriptionStatus of ['past_due', 'unpaid', 'incomplete']) {
    assert.deepEqual(decideResend({ invoiceStatus: 'open', amountDue: 5900, subscriptionStatus }), { send: true });
  }
});

test('a member who has since paid hears nothing more', () => {
  assert.deepEqual(decideResend({ invoiceStatus: 'paid', amountDue: 0, subscriptionStatus: 'active' }), {
    send: false,
    skip: 'paid',
  });
  assert.deepEqual(decideResend({ invoiceStatus: 'open', amountDue: 0, subscriptionStatus: 'past_due' }), {
    send: false,
    skip: 'paid',
  });
});

test('an invoice that can no longer be paid is not emailed about', () => {
  for (const invoiceStatus of ['void', 'uncollectible', 'draft', null]) {
    assert.deepEqual(decideResend({ invoiceStatus, amountDue: 5900, subscriptionStatus: 'past_due' }), {
      send: false,
      skip: 'closed',
    });
  }
});

test('a canceled subscription is left to the open-invoice recovery email', () => {
  // The dunning copy says Stripe will try again; after cancellation it will not.
  for (const subscriptionStatus of ['canceled', 'active', 'trialing', null]) {
    assert.deepEqual(decideResend({ invoiceStatus: 'open', amountDue: 5900, subscriptionStatus }), {
      send: false,
      skip: 'not_in_dunning',
    });
  }
});

test('only categories the copy knows are passed through', () => {
  assert.equal(toDeclineCategory('insufficient_funds'), 'insufficient_funds');
  assert.equal(toDeclineCategory('card_problem'), 'card_problem');
  assert.equal(toDeclineCategory('something_new'), null);
  assert.equal(toDeclineCategory(null), null);
});
