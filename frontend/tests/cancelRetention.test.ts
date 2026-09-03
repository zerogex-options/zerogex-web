import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canOfferRetentionDiscount,
  discountAuditType,
  type RetentionOfferInput,
} from '../core/cancelRetention.ts';

// The in-app cancellation flow's two load-bearing decisions:
//   1. WHETHER the 25%-off save can still be offered (one-shot, live-sub only).
//   2. WHICH audit event a save writes — which directly governs whether the
//      growth-rate dashboard nets the save out. Getting (2) wrong silently
//      inflates or deflates the headline net-growth number, so lock the matrix.

function offer(over: Partial<RetentionOfferInput> = {}): RetentionOfferInput {
  return {
    subscriptionId: 'sub_123',
    subscriptionStatus: 'active',
    retentionOfferClaimedAt: null,
    ...over,
  };
}

test('offer eligibility: active and trialing subs with an unclaimed offer qualify', () => {
  assert.equal(canOfferRetentionDiscount(offer({ subscriptionStatus: 'active' })), true);
  assert.equal(canOfferRetentionDiscount(offer({ subscriptionStatus: 'trialing' })), true);
});

test('offer eligibility: an already-claimed one-shot offer is never re-offered', () => {
  assert.equal(
    canOfferRetentionDiscount(offer({ retentionOfferClaimedAt: '2026-01-01T00:00:00.000Z' })),
    false,
  );
});

test('offer eligibility: no subscription on file → no offer', () => {
  assert.equal(canOfferRetentionDiscount(offer({ subscriptionId: null })), false);
});

test('offer eligibility: non-live statuses are not offerable', () => {
  for (const status of ['past_due', 'canceled', 'unpaid', 'incomplete', 'paused', null]) {
    assert.equal(
      canOfferRetentionDiscount(offer({ subscriptionStatus: status })),
      false,
      `status ${status} should not be offerable`,
    );
  }
});

test('discount audit: already-canceling → win-back type that offsets a counted cancellation', () => {
  const d = discountAuditType(true);
  assert.equal(d.type, 'billing_winback_discount_honored');
  assert.equal(d.offsetsCountedCancellation, true);
});

test('discount audit: intercepted pre-cancel → distinct type with NO offset (no phantom net)', () => {
  const d = discountAuditType(false);
  assert.equal(d.type, 'billing_retention_offer_accepted');
  assert.equal(d.offsetsCountedCancellation, false);
});
