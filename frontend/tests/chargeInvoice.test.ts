import test from 'node:test';
import assert from 'node:assert/strict';
import type Stripe from 'stripe';

import {
  lookupChargeInvoice,
  readRefundAuditRow,
  refundAuditMessage,
  type ChargeInvoiceLookup,
} from '../core/chargeInvoice.ts';

// The charge.refunded webhook as Stripe actually delivers it. Events are
// rendered in the webhook endpoint's API version, and from basil on a Charge has
// no `invoice` field at all. The handler read only that field, so a full refund
// of a $39 trial-conversion payment was logged "(no invoice — one-off charge)"
// and the partner-commission reversal for its invoice never ran.

// A basil-shaped charge.refunded payload: no `invoice` key.
const basilEvent = {
  id: 'ch_1',
  object: 'charge',
  amount: 3900,
  amount_refunded: 3900,
  currency: 'usd',
  customer: 'cus_1',
  payment_intent: 'pi_1',
};

// The same charge as our acacia-pinned client returns it.
const acaciaCharge = { ...basilEvent, invoice: 'in_1' };

function fakeStripe(charge: () => unknown = () => acaciaCharge) {
  const calls: string[] = [];
  const stripe = {
    charges: {
      retrieve: async (id: string) => {
        calls.push(`charges.retrieve ${id}`);
        return charge();
      },
    },
  };
  return { stripe: stripe as unknown as Stripe, calls };
}

test('a basil payload is re-read through our client, and the invoice is found', async () => {
  const { stripe, calls } = fakeStripe();
  assert.deepEqual(await lookupChargeInvoice(stripe, basilEvent), { kind: 'invoice', invoiceId: 'in_1' });
  assert.deepEqual(calls, ['charges.retrieve ch_1']);
});

test('a payload that names its invoice is not fetched again', async () => {
  const { stripe, calls } = fakeStripe();
  assert.deepEqual(await lookupChargeInvoice(stripe, acaciaCharge), { kind: 'invoice', invoiceId: 'in_1' });
  assert.deepEqual(calls, []);
});

test('an acacia payload for a one-off charge is taken at its word', async () => {
  const { stripe, calls } = fakeStripe();
  assert.deepEqual(await lookupChargeInvoice(stripe, { ...basilEvent, invoice: null }), { kind: 'none' });
  assert.deepEqual(calls, []);
});

test('a basil payload for a real one-off charge comes back as one', async () => {
  const { stripe } = fakeStripe(() => ({ ...basilEvent, invoice: null }));
  assert.deepEqual(await lookupChargeInvoice(stripe, basilEvent), { kind: 'none' });
});

test('a failed re-read is unknown, with the reason, and does not throw', async () => {
  const { stripe } = fakeStripe(() => {
    throw new Error('Request timed out');
  });
  const lookup = await lookupChargeInvoice(stripe, basilEvent);
  assert.equal(lookup.kind, 'unknown');
  assert.match(lookup.kind === 'unknown' ? lookup.reason : '', /charge lookup failed: Request timed out/);
});

test('a re-read that also lacks the field is unknown, not a one-off', async () => {
  // Every refund would look like this if core/stripe.ts were pinned past acacia.
  const { stripe } = fakeStripe(() => basilEvent);
  assert.equal((await lookupChargeInvoice(stripe, basilEvent)).kind, 'unknown');
});

test('a payload with no charge id is unknown, without calling Stripe', async () => {
  const { stripe, calls } = fakeStripe();
  assert.equal((await lookupChargeInvoice(stripe, { object: 'charge' })).kind, 'unknown');
  assert.deepEqual(calls, []);
});

// ---------------------------------------------------------------------------
// The refund_issued row: what it says, and what the repair script reads back.
// ---------------------------------------------------------------------------

test('the refund row names the invoice the lookup found', () => {
  assert.equal(
    refundAuditMessage(basilEvent, { kind: 'invoice', invoiceId: 'in_1' }),
    'Full refund on charge ch_1: 3900 of 3900 usd charged, invoice in_1',
  );
});

test('a partial refund states the running total, and a real one-off says so', () => {
  assert.equal(
    refundAuditMessage({ ...basilEvent, amount_refunded: 1000 }, { kind: 'none' }),
    'Partial refund on charge ch_1: 1000 of 3900 usd charged (no invoice — one-off charge)',
  );
});

test('an unresolved invoice never reads as a one-off charge', () => {
  const message = refundAuditMessage(basilEvent, {
    kind: 'unknown',
    reason: 'charge lookup failed: Request timed out',
  });
  assert.equal(
    message,
    'Full refund on charge ch_1: 3900 of 3900 usd charged (invoice could not be resolved: charge lookup failed: Request timed out)',
  );
  assert.doesNotMatch(message, /one-off/);
});

test('rows that name their invoice are read back with it', () => {
  const message = refundAuditMessage(basilEvent, { kind: 'invoice', invoiceId: 'in_1' });
  assert.deepEqual(readRefundAuditRow(message), { chargeId: 'ch_1', invoiceId: 'in_1', needsLookup: false });
});

test('one-off and unresolved rows are flagged for a Stripe lookup', () => {
  const lookups: ChargeInvoiceLookup[] = [
    { kind: 'none' },
    { kind: 'unknown', reason: 'charge lookup failed: Request timed out' },
  ];
  for (const lookup of lookups) {
    assert.deepEqual(readRefundAuditRow(refundAuditMessage(basilEvent, lookup)), {
      chargeId: 'ch_1',
      invoiceId: null,
      needsLookup: true,
    });
  }
});

test('a row the old handler wrote is flagged', () => {
  // The old handler's wording, as it sits in the audit log.
  assert.deepEqual(
    readRefundAuditRow('Full refund on charge ch_3abc: 3900 of 3900 usd charged (no invoice — one-off charge)'),
    { chargeId: 'ch_3abc', invoiceId: null, needsLookup: true },
  );
});

test('backfilled rows are trusted: the backfill read each charge through the API', () => {
  assert.deepEqual(
    readRefundAuditRow(
      'Full refund on charge ch_2: 3900 of 3900 usd charged (no invoice — one-off charge) [backfilled re_2]',
    ),
    { chargeId: 'ch_2', invoiceId: null, needsLookup: false },
  );
  assert.deepEqual(
    readRefundAuditRow('Partial refund on charge ch_3: 100 of 3900 usd charged, invoice in_3 [backfilled re_3]'),
    { chargeId: 'ch_3', invoiceId: 'in_3', needsLookup: false },
  );
});

test('a message that is not a refund row reads as null', () => {
  assert.equal(readRefundAuditRow('Invoice in_1 paid for sub sub_1 amount=3900'), null);
});
