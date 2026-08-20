import test from 'node:test';
import assert from 'node:assert/strict';
import {
  readInvoiceSubscriptionId,
  readInvoicePriceId,
  readInvoicePeriodEndUnix,
  readInvoicePeriodStartUnix,
  readInvoicePaymentMethodId,
} from '../core/stripeInvoice.ts';

// Webhook events are rendered in the API version pinned on the WEBHOOK ENDPOINT,
// which can differ from the version core/stripe.ts pins for our own calls. Basil
// (2025-03-31) moved invoice.subscription and line.price, and reading only one
// shape yields null — indistinguishable from "no subscription on this invoice",
// which is the branch that picks dunning copy and decides orphan recovery.

const PERIOD_START = Date.UTC(2026, 7, 15, 15, 32, 0) / 1000;
const PERIOD_END = Date.UTC(2027, 7, 15, 15, 32, 0) / 1000;

const acaciaInvoice = {
  id: 'in_1',
  subscription: 'sub_1',
  period_start: PERIOD_START,
  period_end: PERIOD_END,
  payment_intent: { id: 'pi_1', payment_method: 'pm_1' },
  lines: {
    data: [
      {
        price: { id: 'price_pro_annual' },
        subscription: 'sub_1',
        period: { start: PERIOD_START, end: PERIOD_END },
      },
    ],
  },
};

const basilInvoice = {
  id: 'in_1',
  parent: { subscription_details: { subscription: 'sub_1' } },
  period_start: PERIOD_START,
  period_end: PERIOD_END,
  payments: { data: [{ payment: { payment_intent: { id: 'pi_1', payment_method: 'pm_1' } } }] },
  lines: {
    data: [
      {
        pricing: { price_details: { price: 'price_pro_annual' } },
        parent: { subscription_item_details: { subscription: 'sub_1' } },
        period: { start: PERIOD_START, end: PERIOD_END },
      },
    ],
  },
};

for (const [label, invoice] of [
  ['acacia', acaciaInvoice],
  ['basil', basilInvoice],
] as const) {
  test(`${label}: subscription id resolves`, () => {
    assert.equal(readInvoiceSubscriptionId(invoice), 'sub_1');
  });
  test(`${label}: price id resolves`, () => {
    assert.equal(readInvoicePriceId(invoice), 'price_pro_annual');
  });
  test(`${label}: service period resolves`, () => {
    assert.equal(readInvoicePeriodStartUnix(invoice), PERIOD_START);
    assert.equal(readInvoicePeriodEndUnix(invoice), PERIOD_END);
  });
  test(`${label}: settling payment method resolves`, () => {
    assert.equal(readInvoicePaymentMethodId(invoice), 'pm_1');
  });
}

test('expanded subscription objects resolve by id', () => {
  assert.equal(readInvoiceSubscriptionId({ subscription: { id: 'sub_2' } }), 'sub_2');
});

test('a one-off invoice has no subscription', () => {
  assert.equal(readInvoiceSubscriptionId({ id: 'in_2', lines: { data: [] } }), null);
});

test('line-level period wins over the invoice-level fallback', () => {
  const invoice = {
    period_start: 1,
    period_end: 2,
    lines: { data: [{ period: { start: PERIOD_START, end: PERIOD_END } }] },
  };
  assert.equal(readInvoicePeriodStartUnix(invoice), PERIOD_START);
  assert.equal(readInvoicePeriodEndUnix(invoice), PERIOD_END);
});

test('invoice-level period is used when lines carry none', () => {
  const invoice = { period_start: PERIOD_START, period_end: PERIOD_END, lines: { data: [{}] } };
  assert.equal(readInvoicePeriodStartUnix(invoice), PERIOD_START);
  assert.equal(readInvoicePeriodEndUnix(invoice), PERIOD_END);
});

test('multi-line invoices take the widest service period', () => {
  const invoice = {
    lines: {
      data: [
        { period: { start: PERIOD_START + 100, end: PERIOD_END - 100 } },
        { period: { start: PERIOD_START, end: PERIOD_END } },
      ],
    },
  };
  assert.equal(readInvoicePeriodStartUnix(invoice), PERIOD_START);
  assert.equal(readInvoicePeriodEndUnix(invoice), PERIOD_END);
});

test('an invoice settled outside a stored payment method yields null', () => {
  assert.equal(readInvoicePaymentMethodId({ id: 'in_3', lines: { data: [] } }), null);
});

test('garbage in, null out (never throws)', () => {
  for (const junk of [null, undefined, 42, 'in_x', {}, { lines: null }, { lines: { data: 7 } }]) {
    assert.equal(readInvoiceSubscriptionId(junk), null);
    assert.equal(readInvoicePriceId(junk), null);
    assert.equal(readInvoicePeriodEndUnix(junk), null);
    assert.equal(readInvoicePeriodStartUnix(junk), null);
    assert.equal(readInvoicePaymentMethodId(junk), null);
  }
});
