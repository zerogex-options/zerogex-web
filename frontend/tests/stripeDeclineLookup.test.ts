import test from 'node:test';
import assert from 'node:assert/strict';
import type Stripe from 'stripe';

import { classifyDecline } from '../core/declineReason.ts';
import { lookupInvoiceDecline } from '../core/stripeDeclineLookup.ts';

// The decline lookup as the webhook calls it: on the raw event payload. Stripe
// renders events in the webhook endpoint's API version, and from basil on an
// invoice there names no charge and no payment intent. Before the lookup
// re-read such an invoice through our own (acacia-pinned) client, every live
// decline came back empty and was stored as "unknown" — 19 out of 19 in the
// week this was found — and every dunning email used its neutral wording.

// A basil-shaped invoice.payment_failed payload: subscription under `parent`,
// no `charge`, no `payment_intent`, no `payments`.
const basilEvent = {
  id: 'in_1',
  object: 'invoice',
  status: 'open',
  attempt_count: 1,
  parent: { subscription_details: { subscription: 'sub_1' } },
};

// The same invoice as our pinned client returns it.
const acaciaInvoice = { id: 'in_1', object: 'invoice', charge: 'ch_1', payment_intent: 'pi_1' };

const failedCharge = {
  id: 'ch_1',
  status: 'failed',
  failure_code: 'card_declined',
  outcome: { reason: 'insufficient_funds', network_decline_code: '51' },
  payment_method_details: {
    type: 'card',
    card: { brand: 'visa', last4: '4242', funding: 'debit', country: 'US' },
  },
};

function fakeStripe(overrides: {
  invoice?: () => unknown;
  charge?: () => unknown;
  intent?: () => unknown;
} = {}) {
  const calls: string[] = [];
  const stripe = {
    invoices: {
      retrieve: async (id: string) => {
        calls.push(`invoices.retrieve ${id}`);
        return overrides.invoice ? overrides.invoice() : acaciaInvoice;
      },
    },
    charges: {
      retrieve: async (id: string) => {
        calls.push(`charges.retrieve ${id}`);
        return overrides.charge ? overrides.charge() : failedCharge;
      },
      list: async () => ({ data: [] }),
    },
    paymentIntents: {
      retrieve: async (id: string) => {
        calls.push(`paymentIntents.retrieve ${id}`);
        return overrides.intent ? overrides.intent() : { id, latest_charge: null };
      },
    },
  };
  return { stripe: stripe as unknown as Stripe, calls };
}

test('a webhook payload with no charge is re-read, and the reason is found', async () => {
  const { stripe, calls } = fakeStripe();
  const lookup = await lookupInvoiceDecline(stripe, basilEvent);
  assert.equal(lookup.decline?.declineCode, 'insufficient_funds');
  assert.equal(classifyDecline(lookup.decline), 'insufficient_funds');
  assert.equal(lookup.chargeId, 'ch_1');
  assert.equal(lookup.card?.last4, '4242');
  assert.deepEqual(calls, ['invoices.retrieve in_1', 'charges.retrieve ch_1']);
});

test('an invoice that already names its charge is not fetched again', async () => {
  // The backfill and the resend script pass invoices from our own client; they
  // must not pay for a second read.
  const { stripe, calls } = fakeStripe();
  const lookup = await lookupInvoiceDecline(stripe, acaciaInvoice);
  assert.equal(lookup.decline?.declineCode, 'insufficient_funds');
  assert.deepEqual(calls, ['charges.retrieve ch_1']);
});

test('an attempt that never produced a charge is read off the intent after the re-read', async () => {
  // An abandoned 3-D Secure step-up: the re-read invoice names only an intent.
  const { stripe, calls } = fakeStripe({
    invoice: () => ({ id: 'in_1', charge: null, payment_intent: 'pi_1' }),
    intent: () => ({
      id: 'pi_1',
      latest_charge: null,
      last_payment_error: { code: 'authentication_required', decline_code: 'authentication_required' },
    }),
  });
  const lookup = await lookupInvoiceDecline(stripe, basilEvent);
  assert.equal(classifyDecline(lookup.decline), 'authentication_required');
  assert.deepEqual(calls, ['invoices.retrieve in_1', 'paymentIntents.retrieve pi_1']);
});

test('a Stripe failure on the re-read is swallowed, never thrown into the webhook', async () => {
  // A throw here would 500 the webhook, Stripe would retry the event, and the
  // member would get the dunning email twice.
  const { stripe } = fakeStripe({
    invoice: () => {
      throw new Error('Stripe is down');
    },
  });
  const lookup = await lookupInvoiceDecline(stripe, basilEvent);
  assert.equal(lookup.decline, null);
  assert.equal(lookup.chargeId, null);
});

test('something that is not an invoice is not looked up', async () => {
  const { stripe, calls } = fakeStripe();
  for (const payload of [null, {}, { id: 'ch_1' }]) {
    const lookup = await lookupInvoiceDecline(stripe, payload);
    assert.equal(lookup.decline, null);
  }
  assert.deepEqual(calls, []);
});

// What the lookup now hands on to core/paymentFailureDiagnostics.ts: the intent
// it resolved, and — instead of silence — why it gave up.

test('the payment intent the lookup resolved is handed on', async () => {
  const { stripe } = fakeStripe();
  const lookup = await lookupInvoiceDecline(stripe, basilEvent);
  assert.equal(lookup.paymentIntentId, 'pi_1');
  assert.equal(lookup.error, null);
});

test('a Stripe failure part-way keeps the ids already resolved, and says why', async () => {
  const { stripe } = fakeStripe({
    charge: () => {
      throw new Error('Stripe is down');
    },
  });
  const lookup = await lookupInvoiceDecline(stripe, basilEvent);
  // Still nothing to classify — the email reads exactly what it did before.
  assert.equal(lookup.decline, null);
  assert.equal(lookup.chargeId, 'ch_1');
  assert.equal(lookup.paymentIntentId, 'pi_1');
  assert.equal(lookup.error, 'Stripe is down');
});

test("an intent found only on the charge is reported but does not change the decline", async () => {
  // The invoice names a charge with no decline data and no intent of its own.
  // Before, that ended with no reason; reading the charge's intent for the
  // REASON would change which dunning copy the member gets. It is reported only.
  const { stripe, calls } = fakeStripe({
    invoice: () => ({ id: 'in_1', charge: 'ch_ok', payment_intent: null }),
    charge: () => ({ id: 'ch_ok', status: 'succeeded', payment_intent: 'pi_from_charge' }),
    intent: () => ({ id: 'pi_from_charge', last_payment_error: { code: 'card_declined', decline_code: 'insufficient_funds' } }),
  });
  const lookup = await lookupInvoiceDecline(stripe, basilEvent);
  assert.equal(lookup.decline, null);
  assert.equal(lookup.paymentIntentId, 'pi_from_charge');
  assert.deepEqual(calls, ['invoices.retrieve in_1', 'charges.retrieve ch_ok']);
});
