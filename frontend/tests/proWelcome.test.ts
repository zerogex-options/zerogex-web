import test from 'node:test';
import assert from 'node:assert/strict';
import { isProWelcomeEligible } from '../core/proWelcome.ts';
import type { ProWelcomeUser } from '../core/proWelcome.ts';

// The one-time "Welcome to Pro" modal greets a freshly-subscribed Pro member on
// their first landing back from Stripe. The gate is the contract for who sees
// it, so lock the matrix down.

const base: ProWelcomeUser = {
  tier: 'pro',
  hasActiveSubscription: true,
  proWelcomeSeenAt: null,
};

test('isProWelcomeEligible: a new Pro subscriber who has not seen it qualifies', () => {
  assert.equal(isProWelcomeEligible(base), true);
});

test('isProWelcomeEligible: only the pro tier qualifies', () => {
  assert.equal(isProWelcomeEligible({ ...base, tier: 'public' }), false);
  assert.equal(isProWelcomeEligible({ ...base, tier: 'basic' }), false);
  // Admin is granted, never subscribed — and the "your trial" framing doesn't
  // apply — so it must not fire even with the (unexpected) active flag set.
  assert.equal(isProWelcomeEligible({ ...base, tier: 'admin' }), false);
});

test('isProWelcomeEligible: requires a live Stripe subscription', () => {
  // Grandfathered Pro (tier=pro, no Stripe sub) is excluded — matches
  // "when they first subscribe for a trial".
  assert.equal(isProWelcomeEligible({ ...base, hasActiveSubscription: false }), false);
  assert.equal(isProWelcomeEligible({ tier: 'pro', proWelcomeSeenAt: null }), false);
});

test('isProWelcomeEligible: a set seen-stamp suppresses it (one-time)', () => {
  assert.equal(
    isProWelcomeEligible({ ...base, proWelcomeSeenAt: '2026-07-20T00:00:00.000Z' }),
    false,
  );
});

test('isProWelcomeEligible: null/undefined user is safe', () => {
  assert.equal(isProWelcomeEligible(null), false);
  assert.equal(isProWelcomeEligible(undefined), false);
});
