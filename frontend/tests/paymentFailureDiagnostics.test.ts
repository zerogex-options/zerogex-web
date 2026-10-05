import test from 'node:test';
import assert from 'node:assert/strict';
import type Stripe from 'stripe';

import {
  collectPaymentFailureDiagnostics,
  describeDiagnosticProblems,
  readChargeMethod,
  readChargeOutcome,
  readPaymentIntentError,
} from '../core/paymentFailureDiagnostics.ts';

// WHERE a failed invoice payment died — issuer, Radar, or never sent — read off
// the PaymentIntent and its latest charge. These run against a fake Stripe
// client so each case can be stated exactly as Stripe renders it, including the
// ones that fail half-way.

type Fake = {
  intents?: Record<string, unknown | (() => unknown)>;
  charges?: Record<string, unknown | (() => unknown)>;
  invoicePayments?: (invoiceId: string) => unknown;
};

function fakeStripe(fake: Fake) {
  const calls: string[] = [];
  const resolve = (value: unknown) => (typeof value === 'function' ? (value as () => unknown)() : value);
  const stripe: Record<string, unknown> = {
    paymentIntents: {
      retrieve: async (id: string, params?: { expand?: string[] }) => {
        calls.push(`paymentIntents.retrieve ${id}${params?.expand ? ` expand=${params.expand.join(',')}` : ''}`);
        if (!fake.intents || !(id in fake.intents)) throw new Error(`No such payment_intent: '${id}'`);
        return resolve(fake.intents[id]);
      },
    },
    charges: {
      retrieve: async (id: string) => {
        calls.push(`charges.retrieve ${id}`);
        if (!fake.charges || !(id in fake.charges)) throw new Error(`No such charge: '${id}'`);
        return resolve(fake.charges[id]);
      },
    },
  };
  if (fake.invoicePayments) {
    const list = fake.invoicePayments;
    stripe.invoicePayments = {
      list: async (params: { invoice: string }) => {
        calls.push(`invoicePayments.list ${params.invoice}`);
        return list(params.invoice);
      },
    };
  }
  return { stripe: stripe as unknown as Stripe, calls };
}

// The invoice as the decline lookup leaves it: acacia-shaped, naming its intent.
const invoice = { id: 'in_1', object: 'invoice', payment_intent: 'pi_1', attempt_count: 1 };

function card(overrides: Record<string, unknown> = {}) {
  return {
    brand: 'visa',
    network: 'visa',
    last4: '4242',
    country: 'US',
    funding: 'debit',
    exp_month: 12,
    exp_year: 2030,
    fingerprint: 'fp_should_not_be_read',
    checks: { cvc_check: 'pass', address_postal_code_check: 'pass', address_line1_check: null },
    three_d_secure: null,
    ...overrides,
  };
}

test('issuer decline: declined_by_network, with the advice codes off the intent', async () => {
  const { stripe, calls } = fakeStripe({
    intents: {
      pi_1: {
        id: 'pi_1',
        status: 'requires_payment_method',
        client_secret: 'pi_1_secret_DO_NOT_STORE',
        last_payment_error: {
          type: 'card_error',
          code: 'card_declined',
          decline_code: 'insufficient_funds',
          advice_code: 'try_again_later',
          network_advice_code: '01',
          network_decline_code: '51',
          message: 'Your card has insufficient funds.',
          // The full PaymentMethod, billing details and all, rides on the error.
          payment_method: {
            id: 'pm_1',
            billing_details: { email: 'member@example.com', name: 'A Member' },
            card: card(),
          },
        },
        latest_charge: {
          id: 'ch_1',
          status: 'failed',
          payment_intent: 'pi_1',
          failure_code: 'card_declined',
          outcome: {
            network_status: 'declined_by_network',
            type: 'issuer_declined',
            reason: 'insufficient_funds',
            risk_level: 'normal',
            risk_score: 23,
            seller_message: 'The bank returned the decline code `insufficient_funds`.',
            advice_code: 'try_again_later',
            network_advice_code: '01',
            network_decline_code: '51',
          },
          payment_method_details: { type: 'card', card: card() },
        },
      },
    },
  });

  const diag = await collectPaymentFailureDiagnostics(stripe, invoice);

  assert.deepEqual(calls, ['paymentIntents.retrieve pi_1 expand=latest_charge']);
  assert.equal(diag.paymentIntentId, 'pi_1');
  assert.equal(diag.paymentIntentStatus, 'requires_payment_method');
  assert.equal(diag.chargeId, 'ch_1');
  assert.deepEqual(diag.intentError, {
    type: 'card_error',
    code: 'card_declined',
    declineCode: 'insufficient_funds',
    adviceCode: 'try_again_later',
    networkAdviceCode: '01',
    networkDeclineCode: '51',
    message: 'Your card has insufficient funds.',
  });
  assert.equal(diag.outcome?.networkStatus, 'declined_by_network');
  assert.equal(diag.outcome?.type, 'issuer_declined');
  assert.equal(diag.outcome?.reason, 'insufficient_funds');
  assert.equal(diag.outcome?.riskLevel, 'normal');
  assert.equal(diag.outcome?.riskScore, 23);
  assert.deepEqual(diag.method, {
    type: 'card',
    brand: 'visa',
    network: 'visa',
    last4: '4242',
    country: 'US',
    funding: 'debit',
    postalCheck: 'pass',
    cvcCheck: 'pass',
    threeDSecureResult: null,
    threeDSecureResultReason: null,
  });
  assert.deepEqual(diag.errors, []);

  // Nothing sensitive is carried forward: no client secret, no billing details,
  // no expiry, no fingerprint.
  const kept = JSON.stringify(diag);
  for (const secret of ['secret', 'member@example.com', 'A Member', 'fp_should_not_be_read', '2030']) {
    assert.equal(kept.includes(secret), false, `diagnostics leaked ${secret}`);
  }
});

test('Radar block: not_sent_to_network, outcome blocked, with the rule and the score', async () => {
  const { stripe } = fakeStripe({
    intents: {
      pi_1: {
        id: 'pi_1',
        status: 'requires_payment_method',
        last_payment_error: {
          type: 'card_error',
          code: 'card_declined',
          decline_code: 'fraudulent',
          message: 'Your card was declined.',
        },
        latest_charge: {
          id: 'ch_radar',
          status: 'failed',
          outcome: {
            network_status: 'not_sent_to_network',
            type: 'blocked',
            reason: 'highest_risk_level',
            risk_level: 'highest',
            risk_score: 91,
            // Expanded on some reads, a bare id on others.
            rule: { id: 'rule_block_highest', action: 'block', predicate: ':risk_level: = highest' },
            seller_message: 'Stripe blocked this payment as too risky.',
            network_decline_code: null,
          },
          payment_method_details: {
            type: 'card',
            card: card({ checks: { cvc_check: 'fail', address_postal_code_check: 'unavailable' } }),
          },
        },
      },
    },
  });

  const diag = await collectPaymentFailureDiagnostics(stripe, invoice);

  assert.equal(diag.outcome?.networkStatus, 'not_sent_to_network');
  assert.equal(diag.outcome?.type, 'blocked');
  assert.equal(diag.outcome?.reason, 'highest_risk_level');
  assert.equal(diag.outcome?.riskLevel, 'highest');
  assert.equal(diag.outcome?.riskScore, 91);
  assert.equal(diag.outcome?.rule, 'rule_block_highest');
  assert.equal(diag.outcome?.networkDeclineCode, null);
  // The intent still calls it a card_declined: only the charge says no bank saw it.
  assert.equal(diag.intentError?.code, 'card_declined');
  assert.equal(diag.method?.cvcCheck, 'fail');
  assert.equal(diag.method?.postalCheck, 'unavailable');
  assert.deepEqual(diag.errors, []);
});

test('generic "The payment failed." still carries the network codes that explain it', async () => {
  // The case this was built for: the stored reason reads only
  // payment_intent_generic_payment_failed, and the charge says the issuer
  // declined it with network code 05 (do not honor). Paid through Link, so
  // there is no card object at all.
  const { stripe } = fakeStripe({
    intents: {
      pi_1: {
        id: 'pi_1',
        status: 'requires_payment_method',
        last_payment_error: {
          type: 'card_error',
          code: 'payment_intent_generic_payment_failed',
          network_decline_code: '05',
          network_advice_code: '03',
          message: 'The payment failed.',
        },
        latest_charge: {
          id: 'ch_link',
          status: 'failed',
          outcome: {
            network_status: 'declined_by_network',
            type: 'issuer_declined',
            reason: 'generic_decline',
            risk_level: 'normal',
            network_decline_code: '05',
            network_advice_code: '03',
          },
          payment_method_details: { type: 'link', link: { country: 'US' } },
        },
      },
    },
  });

  const diag = await collectPaymentFailureDiagnostics(stripe, invoice);

  assert.equal(diag.intentError?.code, 'payment_intent_generic_payment_failed');
  assert.equal(diag.intentError?.message, 'The payment failed.');
  assert.equal(diag.intentError?.networkDeclineCode, '05');
  assert.equal(diag.intentError?.networkAdviceCode, '03');
  assert.equal(diag.outcome?.networkStatus, 'declined_by_network');
  assert.equal(diag.outcome?.type, 'issuer_declined');
  // No risk score without Radar for Fraud Teams: absent, not zero.
  assert.equal(diag.outcome?.riskScore, null);
  assert.equal(diag.method?.type, 'link');
  assert.equal(diag.method?.brand, null);
  assert.equal(diag.method?.last4, null);
});

test('no PaymentIntent anywhere: says so, calls nothing, never throws', async () => {
  // A basil-shaped event invoice with no `payments` list, on an SDK that has no
  // Invoice Payments API (stripe-node 17, which this project pins).
  const { stripe, calls } = fakeStripe({});
  const diag = await collectPaymentFailureDiagnostics(stripe, {
    id: 'in_none',
    parent: { subscription_details: { subscription: 'sub_1' } },
  });

  assert.deepEqual(calls, []);
  assert.equal(diag.paymentIntentId, null);
  assert.equal(diag.chargeId, null);
  assert.equal(diag.outcome, null);
  assert.deepEqual(diag.errors, ['no PaymentIntent found for invoice in_none']);
});

test('the PaymentIntent is resolved version-tolerantly, cheapest source first', async () => {
  const intents = {
    pi_basil: { id: 'pi_basil', status: 'requires_payment_method', latest_charge: null },
    pi_from_charge: { id: 'pi_from_charge', status: 'requires_payment_method', latest_charge: null },
    pi_new: { id: 'pi_new', status: 'requires_payment_method', latest_charge: null },
  };

  // basil `payments` list on the invoice in hand: no extra read to find it.
  {
    const { stripe, calls } = fakeStripe({ intents });
    const diag = await collectPaymentFailureDiagnostics(stripe, {
      id: 'in_1',
      payments: { data: [{ payment: { type: 'payment_intent', payment_intent: 'pi_basil' } }] },
    });
    assert.equal(diag.paymentIntentId, 'pi_basil');
    assert.deepEqual(calls, ['paymentIntents.retrieve pi_basil expand=latest_charge']);
  }

  // Only a charge known: its own payment_intent names the intent.
  {
    const { stripe, calls } = fakeStripe({
      intents,
      charges: { ch_only: { id: 'ch_only', payment_intent: 'pi_from_charge', outcome: { network_status: 'declined_by_network' } } },
    });
    const diag = await collectPaymentFailureDiagnostics(stripe, { id: 'in_1' }, { chargeId: 'ch_only' });
    assert.equal(diag.paymentIntentId, 'pi_from_charge');
    // The intent has no latest charge, so the charge already read is described.
    assert.equal(diag.chargeId, 'ch_only');
    assert.equal(diag.outcome?.networkStatus, 'declined_by_network');
    assert.deepEqual(calls, [
      'charges.retrieve ch_only',
      'paymentIntents.retrieve pi_from_charge expand=latest_charge',
    ]);
  }

  // A newer SDK with the Invoice Payments API: used as the last resort, newest
  // payment first.
  {
    const { stripe, calls } = fakeStripe({
      intents,
      invoicePayments: () => ({
        data: [
          { created: 100, payment: { type: 'payment_intent', payment_intent: 'pi_old' } },
          { created: 200, payment: { type: 'payment_intent', payment_intent: { id: 'pi_new' } } },
        ],
      }),
    });
    const diag = await collectPaymentFailureDiagnostics(stripe, { id: 'in_1' });
    assert.equal(diag.paymentIntentId, 'pi_new');
    assert.deepEqual(calls, ['invoicePayments.list in_1', 'paymentIntents.retrieve pi_new expand=latest_charge']);
  }
});

test('a Stripe failure keeps everything else that was read, and is written down', async () => {
  // The intent read fails; the charge the decline lookup found is read directly
  // so its outcome is not lost with it.
  const { stripe, calls } = fakeStripe({
    intents: {
      pi_1: () => {
        throw new Error('Stripe is down');
      },
    },
    charges: {
      ch_known: {
        id: 'ch_known',
        outcome: { network_status: 'declined_by_network', type: 'issuer_declined', reason: 'do_not_honor' },
        payment_method_details: { type: 'card', card: card({ brand: 'mastercard', network: 'mastercard' }) },
      },
    },
  });

  const diag = await collectPaymentFailureDiagnostics(stripe, invoice, { paymentIntentId: 'pi_1', chargeId: 'ch_known' });

  assert.deepEqual(calls, ['paymentIntents.retrieve pi_1 expand=latest_charge', 'charges.retrieve ch_known']);
  assert.equal(diag.paymentIntentId, 'pi_1');
  assert.equal(diag.paymentIntentStatus, null);
  assert.equal(diag.intentError, null);
  assert.equal(diag.chargeId, 'ch_known');
  assert.equal(diag.outcome?.reason, 'do_not_honor');
  assert.equal(diag.method?.network, 'mastercard');
  assert.deepEqual(diag.errors, ['paymentIntents.retrieve pi_1: Stripe is down']);

  // Everything failing still returns, with the ids it knew and every error.
  const { stripe: down } = fakeStripe({
    intents: { pi_1: () => { throw new Error('timeout'); } },
    charges: { ch_known: () => { throw new Error('timeout'); } },
  });
  const nothing = await collectPaymentFailureDiagnostics(down, invoice, { chargeId: 'ch_known' });
  assert.equal(nothing.paymentIntentId, 'pi_1');
  assert.equal(nothing.chargeId, 'ch_known');
  assert.equal(nothing.outcome, null);
  assert.deepEqual(nothing.errors, [
    'paymentIntents.retrieve pi_1: timeout',
    'charges.retrieve ch_known: timeout',
  ]);

  // One line for the row and the audit log, the decline lookup's own failure first.
  assert.equal(
    describeDiagnosticProblems({ lookupError: 'Stripe is down', diagnostics: nothing }),
    'decline lookup: Stripe is down; paymentIntents.retrieve pi_1: timeout; charges.retrieve ch_known: timeout',
  );
  assert.equal(describeDiagnosticProblems({ lookupError: null, diagnostics: diag }), 'paymentIntents.retrieve pi_1: Stripe is down');
  assert.equal(describeDiagnosticProblems({ lookupError: null, diagnostics: { ...diag, errors: [] } }), null);
});

test('repeated Smart Retry attempts: one intent, a new charge each time', async () => {
  // A subscription invoice re-confirms the SAME PaymentIntent on every retry,
  // and each try leaves its own charge as latest_charge. Each attempt's row
  // must describe its own charge — a card that was short on Monday and blocked
  // on Thursday failed two different ways.
  let attempt = 1;
  const charges: Record<number, unknown> = {
    1: {
      id: 'ch_try1',
      outcome: { network_status: 'declined_by_network', type: 'issuer_declined', reason: 'insufficient_funds', network_decline_code: '51' },
    },
    2: {
      id: 'ch_try2',
      outcome: { network_status: 'not_sent_to_network', type: 'blocked', reason: 'rule', rule: 'rule_cvc' },
    },
  };
  const { stripe } = fakeStripe({
    intents: {
      pi_1: () => ({ id: 'pi_1', status: 'requires_payment_method', latest_charge: charges[attempt] }),
    },
  });

  const first = await collectPaymentFailureDiagnostics(stripe, { ...invoice, attempt_count: 1 });
  attempt = 2;
  const second = await collectPaymentFailureDiagnostics(stripe, { ...invoice, attempt_count: 2 });

  assert.equal(first.paymentIntentId, second.paymentIntentId);
  assert.equal(first.chargeId, 'ch_try1');
  assert.equal(first.outcome?.networkStatus, 'declined_by_network');
  assert.equal(second.chargeId, 'ch_try2');
  assert.equal(second.outcome?.networkStatus, 'not_sent_to_network');
  assert.equal(second.outcome?.rule, 'rule_cvc');
});

test('an unexpanded latest_charge is read rather than describing an older charge', async () => {
  const { stripe, calls } = fakeStripe({
    intents: { pi_1: { id: 'pi_1', status: 'requires_payment_method', latest_charge: 'ch_latest' } },
    charges: {
      ch_old: { id: 'ch_old', payment_intent: 'pi_1', outcome: { network_status: 'declined_by_network' } },
      ch_latest: { id: 'ch_latest', outcome: { network_status: 'not_sent_to_network', type: 'blocked' } },
    },
  });
  const diag = await collectPaymentFailureDiagnostics(stripe, { id: 'in_1' }, { chargeId: 'ch_old' });
  assert.equal(diag.chargeId, 'ch_latest');
  assert.equal(diag.outcome?.networkStatus, 'not_sent_to_network');
  assert.deepEqual(calls, [
    'charges.retrieve ch_old',
    'paymentIntents.retrieve pi_1 expand=latest_charge',
    'charges.retrieve ch_latest',
  ]);
});

test('3-D Secure: the result and its reason are read off the card', () => {
  const method = readChargeMethod({
    payment_method_details: {
      type: 'card',
      card: card({ three_d_secure: { result: 'failed', result_reason: 'rejected', version: '2.2.0' } }),
    },
  });
  assert.equal(method?.threeDSecureResult, 'failed');
  assert.equal(method?.threeDSecureResultReason, 'rejected');
});

test('the readers return null for objects that are not there', () => {
  for (const value of [null, undefined, {}, 'pi_1', 42]) {
    assert.equal(readPaymentIntentError(value), null);
    assert.equal(readChargeOutcome(value), null);
    assert.equal(readChargeMethod(value), null);
  }
});
