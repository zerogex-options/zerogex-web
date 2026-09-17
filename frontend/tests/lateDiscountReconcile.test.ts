import test from 'node:test';
import assert from 'node:assert/strict';
import { decideLateDiscountFix, readInvoiceCouponIds } from '../core/stripeInvoice.ts';

// A plan switch scheduled at period end reconciles the SUBSCRIPTION's coupons
// on the customer.subscription.updated Stripe emits at the boundary — by which
// point Stripe has already drawn that boundary's invoice. These cover the
// ordering rules that decide whether the drawn invoice can still be corrected.

const PROMO_BASIC = 'promo_basic_monthly';
const PROMO_PRO = 'promo_pro_monthly';
const REFEREE = 'referee_monthly';
const HAND_APPLIED = 'goodwill_credit';
const MANAGED = [PROMO_BASIC, PROMO_PRO, REFEREE];

test('readInvoiceCouponIds reads the basil discounts[] shape', () => {
  const invoice = { discounts: [{ id: 'di_1', coupon: { id: PROMO_BASIC } }] };
  assert.deepEqual(readInvoiceCouponIds(invoice), [PROMO_BASIC]);
});

test('readInvoiceCouponIds reads the pre-basil singular discount shape', () => {
  const invoice = { discount: { id: 'di_1', coupon: { id: PROMO_PRO } } };
  assert.deepEqual(readInvoiceCouponIds(invoice), [PROMO_PRO]);
});

test('readInvoiceCouponIds distinguishes "no discounts" from "not expanded"', () => {
  // No discounts at all is a real, actionable answer.
  assert.deepEqual(readInvoiceCouponIds({ discounts: [] }), []);
  // An unexpanded discount names the DISCOUNT, not its coupon. Reporting [] here
  // would read as "no coupons" and invite the caller to rewrite the invoice.
  assert.equal(readInvoiceCouponIds({ discounts: ['di_1'] }), null);
  assert.equal(readInvoiceCouponIds({ discounts: [{ id: 'di_1' }] }), null);
});

test('readInvoiceCouponIds dedupes and keeps first-seen order', () => {
  const invoice = {
    discounts: [
      { id: 'di_1', coupon: { id: PROMO_BASIC } },
      { id: 'di_2', coupon: { id: REFEREE } },
      { id: 'di_3', coupon: { id: PROMO_BASIC } },
    ],
  };
  assert.deepEqual(readInvoiceCouponIds(invoice), [PROMO_BASIC, REFEREE]);
});

test('an unexpanded discount set never triggers a rewrite', () => {
  const decision = decideLateDiscountFix({
    invoiceStatus: 'draft',
    invoiceCouponIds: null,
    intendedCouponIds: [PROMO_BASIC],
    managedCouponIds: MANAGED,
  });
  assert.equal(decision.action, 'none');
});

test('draft invoice missing the incoming promo is patched — the overcharge case', () => {
  // The Zoltan case: Pro trial downgraded to Basic at period end, invoice drawn
  // with no coupon, the Basic promo reconciled onto the subscription seconds later.
  const decision = decideLateDiscountFix({
    invoiceStatus: 'draft',
    invoiceCouponIds: [],
    intendedCouponIds: [PROMO_BASIC],
    managedCouponIds: MANAGED,
  });
  assert.equal(decision.action, 'patch_draft');
  assert.deepEqual(decision.missing, [PROMO_BASIC]);
  assert.deepEqual(decision.stale, []);
});

test('draft invoice carrying the outgoing promo is patched — the undercharge case', () => {
  const decision = decideLateDiscountFix({
    invoiceStatus: 'draft',
    invoiceCouponIds: [PROMO_PRO],
    intendedCouponIds: [PROMO_BASIC],
    managedCouponIds: MANAGED,
  });
  assert.equal(decision.action, 'patch_draft');
  assert.deepEqual(decision.missing, [PROMO_BASIC]);
  assert.deepEqual(decision.stale, [PROMO_PRO]);
});

test('a finalized invoice is reported too_late, never rewritten', () => {
  for (const status of ['open', 'paid', 'uncollectible', 'void']) {
    const decision = decideLateDiscountFix({
      invoiceStatus: status,
      invoiceCouponIds: [],
      intendedCouponIds: [PROMO_BASIC],
      managedCouponIds: MANAGED,
    });
    assert.equal(decision.action, 'too_late', `status ${status}`);
    assert.deepEqual(decision.missing, [PROMO_BASIC]);
  }
});

test('an invoice already matching the reconciled set is left alone', () => {
  const decision = decideLateDiscountFix({
    invoiceStatus: 'draft',
    invoiceCouponIds: [PROMO_BASIC],
    intendedCouponIds: [PROMO_BASIC],
    managedCouponIds: MANAGED,
  });
  assert.equal(decision.action, 'none');
});

test('coupons we do not manage are never counted stale', () => {
  // Founding lifetime, win-back and hand-applied credits validly outlive a
  // cadence switch — stripping them would silently revoke a granted discount.
  const decision = decideLateDiscountFix({
    invoiceStatus: 'draft',
    invoiceCouponIds: [PROMO_BASIC, HAND_APPLIED],
    intendedCouponIds: [PROMO_BASIC],
    managedCouponIds: MANAGED,
  });
  assert.equal(decision.action, 'none');
  assert.deepEqual(decision.stale, []);
});

test('intending no coupon still strips a managed one the invoice carries', () => {
  // Switching into a plan whose public promo window has closed: the outgoing
  // promo must come off the invoice even though nothing replaces it.
  const decision = decideLateDiscountFix({
    invoiceStatus: 'draft',
    invoiceCouponIds: [PROMO_PRO],
    intendedCouponIds: [],
    managedCouponIds: MANAGED,
  });
  assert.equal(decision.action, 'patch_draft');
  assert.deepEqual(decision.stale, [PROMO_PRO]);
  assert.deepEqual(decision.missing, []);
});
