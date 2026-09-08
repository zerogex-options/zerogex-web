// Unit tests for founding-rate restoration (core/foundingRestore). These encode
// the promise the founding programme makes to the members who took it:
//   1. a founder who redeemed and then LAPSED keeps their rate — resubscribing
//      re-applies it instead of quietly selling them standard pricing;
//   2. the July-1 lock-in deadline governs ACQUISITION only, so restoration must
//      keep working long after the offer closed;
//   3. being INVITED to the founding cohort (founding_eligible) is not the same
//      as having redeemed it — a seeded user who never subscribed gets nothing,
//      which is what stops this from becoming a late-acquisition back door.
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  shouldRestoreFoundingRate,
  type FoundingRestoreInput,
} from '../core/foundingRestore.ts';

// A founder who redeemed in June 2026 and whose subscription has since been
// deleted after its dunning retries ran out — the happy path every test below
// varies one field of.
function input(over: Partial<FoundingRestoreInput> = {}): FoundingRestoreInput {
  return {
    foundingMemberStartedAt: '2026-06-03T03:42:38.316Z',
    hasActiveSubscription: false,
    ...over,
  };
}

test('restores the rate for a redeemed founder whose subscription lapsed', () => {
  assert.equal(shouldRestoreFoundingRate(input()), true);
});

test('restoration outlives the founding lock-in deadline', () => {
  // The whole point: acquisition closed 2026-07-01, and this member redeemed
  // before it. Nothing here consults the deadline, so the entitlement survives
  // indefinitely — a card stolen years later must not cost them the rate.
  assert.equal(
    shouldRestoreFoundingRate(input({ foundingMemberStartedAt: '2026-01-15T00:00:00.000Z' })),
    true,
  );
});

test('never restores for an account that never redeemed', () => {
  // founding_eligible=1 with founding_member_started_at NULL is the seeded
  // launch-cohort invitee who let the offer expire. Restoring here would hand
  // out the founding rate after the deadline — the exact late acquisition the
  // cutoff refuses.
  assert.equal(shouldRestoreFoundingRate(input({ foundingMemberStartedAt: null })), false);
});

test('never restores while a subscription is still on file', () => {
  // A live subscription already carries the founding coupon on the Stripe
  // subscription object; plan changes go through the portal, where the webhook's
  // discount reconciliation preserves it. Checkout 409s this case before
  // resolving a discount at all, so this is the defensive second gate.
  assert.equal(shouldRestoreFoundingRate(input({ hasActiveSubscription: true })), false);
});

test('treats a blank or whitespace-only stamp as never redeemed', () => {
  // Presence is the signal, so a malformed backfill must not mint founders.
  assert.equal(shouldRestoreFoundingRate(input({ foundingMemberStartedAt: '' })), false);
  assert.equal(shouldRestoreFoundingRate(input({ foundingMemberStartedAt: '   ' })), false);
});
