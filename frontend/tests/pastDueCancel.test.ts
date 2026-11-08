import test from 'node:test';
import assert from 'node:assert/strict';
import type Stripe from 'stripe';

import { billWasVoided, cancelNowAndVoid, isEndedStatus, isPaymentFailedStatus } from '../core/pastDueCancel.ts';

// A Cancel on a subscription whose payment already failed ends it now and voids
// its open bill (core/pastDueCancel.ts), the fix that was applied by hand with
// `make cancel-subscription VOID_INVOICE=1` on 2026-10-16 and twice on
// 2026-11-08. The order is the load-bearing part: voiding first would flip the
// subscription back to active and send the "payment recovered" email to someone
// who is leaving.

type Call = { op: string; id: string; params?: unknown };

function fakeStripe(
  opts: {
    openInvoices?: string[];
    failCancel?: boolean;
    failList?: boolean;
    failVoid?: string[];
  } = {},
) {
  const calls: Call[] = [];
  const stripe = {
    subscriptions: {
      cancel: async (id: string, params?: unknown) => {
        calls.push({ op: 'cancel', id, params });
        if (opts.failCancel) throw new Error('Stripe 503');
        return { id, status: 'canceled' };
      },
    },
    invoices: {
      list: async (params: { subscription?: string; status?: string }) => {
        calls.push({ op: 'list', id: params.subscription ?? '', params });
        if (opts.failList) throw new Error('rate limited');
        return { data: (opts.openInvoices ?? []).map((id) => ({ id })) };
      },
      voidInvoice: async (id: string) => {
        calls.push({ op: 'void', id });
        if (opts.failVoid?.includes(id)) throw new Error('This invoice can no longer be voided');
        return { id, status: 'void' };
      },
    },
  };
  return { stripe: stripe as unknown as Stripe, calls };
}

test('past_due and unpaid are failed payments; nothing else is', () => {
  assert.equal(isPaymentFailedStatus('past_due'), true);
  assert.equal(isPaymentFailedStatus('unpaid'), true);
  for (const status of ['active', 'trialing', 'canceled', 'incomplete', 'incomplete_expired', 'paused', '', null, undefined]) {
    assert.equal(isPaymentFailedStatus(status), false, String(status));
  }
});

test('canceled and incomplete_expired are already over; nothing else is', () => {
  assert.equal(isEndedStatus('canceled'), true);
  assert.equal(isEndedStatus('incomplete_expired'), true);
  for (const status of ['active', 'trialing', 'past_due', 'unpaid', 'incomplete', 'paused', null, undefined]) {
    assert.equal(isEndedStatus(status), false, String(status));
  }
});

test('cancels first, then voids every invoice still open on it', async () => {
  const { stripe, calls } = fakeStripe({ openInvoices: ['in_1'] });
  const result = await cancelNowAndVoid(stripe, 'sub_A', {
    cancellationDetails: { feedback: 'missing_features', comment: 'No futures data' },
  });

  assert.deepEqual(
    calls.map((c) => `${c.op} ${c.id}`),
    ['cancel sub_A', 'list sub_A', 'void in_1'],
  );
  // Ended now, with no final invoice or proration, and with the member's reason
  // on it so customer.subscription.deleted carries it onto the churn row.
  assert.deepEqual(calls[0].params, {
    invoice_now: false,
    prorate: false,
    cancellation_details: { feedback: 'missing_features', comment: 'No futures data' },
  });
  assert.deepEqual(calls[1].params, { subscription: 'sub_A', status: 'open', limit: 100 });
  assert.deepEqual(result, { status: 'canceled', voided: ['in_1'], voidFailed: [], listError: null });
  assert.equal(billWasVoided(result), true);
});

test('no reason given sends no cancellation_details', async () => {
  const { stripe, calls } = fakeStripe();
  await cancelNowAndVoid(stripe, 'sub_A', { cancellationDetails: { feedback: null, comment: null } });
  assert.deepEqual(calls[0].params, { invoice_now: false, prorate: false });
});

test('a failed cancel throws before anything is voided', async () => {
  const { stripe, calls } = fakeStripe({ openInvoices: ['in_1'], failCancel: true });
  await assert.rejects(cancelNowAndVoid(stripe, 'sub_A'), /Stripe 503/);
  assert.deepEqual(
    calls.map((c) => c.op),
    ['cancel'],
  );
});

test('a void that fails is reported, not thrown, and the others still go', async () => {
  const { stripe } = fakeStripe({ openInvoices: ['in_1', 'in_2'], failVoid: ['in_1'] });
  const result = await cancelNowAndVoid(stripe, 'sub_A');
  assert.equal(result.status, 'canceled');
  assert.deepEqual(result.voided, ['in_2']);
  assert.deepEqual(result.voidFailed, [{ invoiceId: 'in_1', message: 'This invoice can no longer be voided' }]);
  // A bill is still open, so nobody may be told nothing more will be charged.
  assert.equal(billWasVoided(result), false);
});

test('when the open invoices cannot be listed, the cancel still stands and says so', async () => {
  const { stripe } = fakeStripe({ failList: true });
  const result = await cancelNowAndVoid(stripe, 'sub_A');
  assert.equal(result.status, 'canceled');
  assert.equal(result.listError, 'rate limited');
  assert.equal(billWasVoided(result), false);
});

// The operator script's uses: it voids the invoices it showed in its plan, can
// skip the cancel on an already-ended subscription, and can leave invoices be.

test('given invoices are voided as given, without listing', async () => {
  const { stripe, calls } = fakeStripe({ openInvoices: ['in_other'] });
  const result = await cancelNowAndVoid(stripe, 'sub_A', { invoices: [{ id: 'in_shown' }, { id: null }] });
  assert.deepEqual(
    calls.map((c) => `${c.op} ${c.id}`),
    ['cancel sub_A', 'void in_shown'],
  );
  assert.deepEqual(result.voided, ['in_shown']);
});

test('skipCancel only voids; voidOpenInvoices false only cancels', async () => {
  const skip = fakeStripe({ openInvoices: ['in_1'] });
  const voidOnly = await cancelNowAndVoid(skip.stripe, 'sub_A', { skipCancel: true });
  assert.deepEqual(
    skip.calls.map((c) => c.op),
    ['list', 'void'],
  );
  assert.equal(voidOnly.status, null);

  const keep = fakeStripe({ openInvoices: ['in_1'] });
  const cancelOnly = await cancelNowAndVoid(keep.stripe, 'sub_A', { voidOpenInvoices: false });
  assert.deepEqual(
    keep.calls.map((c) => c.op),
    ['cancel'],
  );
  assert.deepEqual(cancelOnly.voided, []);
});

// A failed-payment subscription always has an open bill. Finding none means it
// was paid a moment before the cancel, or marked uncollectible (still payable,
// and missed by the 'open' filter), so "I've canceled that unpaid bill" would
// be false either way.
test('finding no open invoice is not a voided bill', async () => {
  const { stripe } = fakeStripe({ openInvoices: [] });
  const result = await cancelNowAndVoid(stripe, 'sub_A');
  assert.deepEqual(result, { status: 'canceled', voided: [], voidFailed: [], listError: null });
  assert.equal(billWasVoided(result), false);
});
