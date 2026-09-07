import test from 'node:test';
import assert from 'node:assert/strict';
import type Stripe from 'stripe';
import {
  previewNextInvoice,
  isNoUpcomingInvoiceError,
} from '../core/stripeInvoicePreview.ts';

type Call = Record<string, unknown>;

// A stripe double exposing only the invoice methods we care about, recording the
// params each was called with.
function fakeStripe(opts: { createPreview?: boolean; retrieveUpcoming?: boolean }) {
  const calls: { createPreview: Call[]; retrieveUpcoming: Call[] } = {
    createPreview: [],
    retrieveUpcoming: [],
  };
  const invoices: Record<string, unknown> = {};
  if (opts.createPreview) {
    invoices.createPreview = async (params: Call) => {
      calls.createPreview.push(params);
      return { amount_due: 2900, currency: 'usd' } as Stripe.Invoice;
    };
  }
  if (opts.retrieveUpcoming) {
    invoices.retrieveUpcoming = async (params: Call) => {
      calls.retrieveUpcoming.push(params);
      return { amount_due: 5900, currency: 'usd' } as Stripe.Invoice;
    };
  }
  return { stripe: { invoices } as unknown as Stripe, calls };
}

test('prefers createPreview when the SDK has it', async () => {
  // Both endpoints available is the real-world case: retrieveUpcoming still
  // exists on the SDK but refuses billing_mode=flexible subscriptions, so the
  // newer one has to win.
  const { stripe, calls } = fakeStripe({ createPreview: true, retrieveUpcoming: true });
  const invoice = await previewNextInvoice(stripe, { subscription: 'sub_1', customer: 'cus_1' });
  assert.equal(invoice.amount_due, 2900);
  assert.equal(calls.retrieveUpcoming.length, 0);
  assert.deepEqual(calls.createPreview[0], { subscription: 'sub_1', customer: 'cus_1' });
});

test('createPreview omits subscription_details when nothing modifies the sub', async () => {
  // An empty subscription_details is not the same request as none at all; the
  // plain "what will they be charged next" read must stay plain.
  const { stripe, calls } = fakeStripe({ createPreview: true });
  await previewNextInvoice(stripe, { subscription: 'sub_1' });
  assert.deepEqual(calls.createPreview[0], { subscription: 'sub_1' });
});

test('createPreview nests item + proration changes under subscription_details', async () => {
  const { stripe, calls } = fakeStripe({ createPreview: true });
  await previewNextInvoice(stripe, {
    subscription: 'sub_1',
    customer: 'cus_1',
    items: [{ id: 'si_1', price: 'price_pro' }],
    prorationBehavior: 'always_invoice',
    discounts: [{ coupon: 'founding25' }],
  });
  assert.deepEqual(calls.createPreview[0], {
    subscription: 'sub_1',
    customer: 'cus_1',
    subscription_details: {
      items: [{ id: 'si_1', price: 'price_pro' }],
      proration_behavior: 'always_invoice',
    },
    discounts: [{ coupon: 'founding25' }],
  });
});

test('falls back to retrieveUpcoming, translating to the legacy param shape', async () => {
  const { stripe, calls } = fakeStripe({ retrieveUpcoming: true });
  const invoice = await previewNextInvoice(stripe, {
    subscription: 'sub_1',
    customer: 'cus_1',
    items: [{ id: 'si_1', price: 'price_pro' }],
    prorationBehavior: 'none',
    discounts: [{ coupon: 'founding25' }],
  });
  assert.equal(invoice.amount_due, 5900);
  assert.deepEqual(calls.retrieveUpcoming[0], {
    subscription: 'sub_1',
    customer: 'cus_1',
    subscription_items: [{ id: 'si_1', price: 'price_pro' }],
    subscription_proration_behavior: 'none',
    coupon: 'founding25',
  });
});

test('legacy fallback drops multiple discounts rather than sending a wrong one', async () => {
  // The old endpoint takes a single `coupon`. Quoting a member a price computed
  // from one of two stacked discounts would be worse than quoting the undiscounted
  // preview, so send neither.
  const { stripe, calls } = fakeStripe({ retrieveUpcoming: true });
  await previewNextInvoice(stripe, {
    subscription: 'sub_1',
    discounts: [{ coupon: 'a' }, { coupon: 'b' }],
  });
  assert.deepEqual(calls.retrieveUpcoming[0], { subscription: 'sub_1' });
});

test('throws a nameable error when the SDK has neither endpoint', async () => {
  const { stripe } = fakeStripe({});
  await assert.rejects(() => previewNextInvoice(stripe, { subscription: 'sub_1' }), /createPreview/);
});

test('isNoUpcomingInvoiceError recognizes both the code and the message', () => {
  assert.equal(isNoUpcomingInvoiceError({ code: 'invoice_upcoming_none' }), true);
  assert.equal(isNoUpcomingInvoiceError({ message: 'No upcoming invoices for customer' }), true);
  assert.equal(isNoUpcomingInvoiceError({ message: 'no upcoming invoice found' }), true);
  assert.equal(isNoUpcomingInvoiceError({ code: 'resource_missing' }), false);
  assert.equal(isNoUpcomingInvoiceError(new Error('card declined')), false);
  assert.equal(isNoUpcomingInvoiceError(null), false);
  assert.equal(isNoUpcomingInvoiceError(undefined), false);
});
