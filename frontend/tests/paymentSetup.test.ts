import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  classifyPaymentSetup,
  isPaymentSetupReady,
  paymentSetupGateApplies,
  type SetupReadiness,
} from '../core/paymentSetup.ts';

// The payment-setup classifier is the trial-access gate: a `trialing` sub is
// granted the paid tier ONLY when its pending SetupIntent is proven succeeded.
// Lock the mapping down — a bare (unexpanded) id must never read as ready, and a
// pending/failed SetupIntent must never read as ready.

// Build the minimal shape the classifier reads. Cast through the param type so
// the test documents intent without constructing a full Stripe.Subscription.
type SubArg = Parameters<typeof classifyPaymentSetup>[0];
function sub(pending_setup_intent: unknown): SubArg {
  return { pending_setup_intent } as SubArg;
}

test('no pending setup (null) is ready — a non-trial or already-cleared setup', () => {
  assert.equal(classifyPaymentSetup(sub(null)), 'ready' satisfies SetupReadiness);
  assert.equal(isPaymentSetupReady(sub(null)), true);
});

test('no pending setup (undefined) is ready', () => {
  assert.equal(classifyPaymentSetup(sub(undefined)), 'ready');
  assert.equal(isPaymentSetupReady(sub(undefined)), true);
});

test('an expanded succeeded SetupIntent is ready', () => {
  const s = sub({ id: 'seti_1', status: 'succeeded' });
  assert.equal(classifyPaymentSetup(s), 'ready');
  assert.equal(isPaymentSetupReady(s), true);
});

test('a pending SetupIntent (requires_action / requires_payment_method / canceled / processing) is NOT ready', () => {
  for (const status of [
    'requires_action',
    'requires_payment_method',
    'requires_confirmation',
    'processing',
    'canceled',
  ]) {
    const s = sub({ id: 'seti_1', status });
    assert.equal(classifyPaymentSetup(s), 'pending', `status=${status}`);
    assert.equal(isPaymentSetupReady(s), false, `status=${status}`);
  }
});

test('a bare id string is unresolved and NOT ready (caller must resolve it)', () => {
  const s = sub('seti_unexpanded');
  assert.equal(classifyPaymentSetup(s), 'unresolved-id');
  // isPaymentSetupReady errs toward withholding on an unknown.
  assert.equal(isPaymentSetupReady(s), false);
});

// ── Which subscriptions the gate decides at all ─────────────────────────────

test('a trial that started with a card is gated', () => {
  assert.equal(paymentSetupGateApplies({ status: 'trialing', startedWithoutCard: false }), true);
});

test('a trial that started without a card is never gated, card added or not', () => {
  // It already grants access with no card at all. On 2026-11-21 gating it took
  // a member from Basic to Public the moment they added a card.
  assert.equal(paymentSetupGateApplies({ status: 'trialing', startedWithoutCard: true }), false);
});

test('nothing but a trial is gated', () => {
  for (const status of [
    'active',
    'past_due',
    'unpaid',
    'canceled',
    'incomplete',
    'incomplete_expired',
    'paused',
  ] as const) {
    for (const startedWithoutCard of [false, true]) {
      assert.equal(
        paymentSetupGateApplies({ status, startedWithoutCard }),
        false,
        `status=${status} startedWithoutCard=${startedWithoutCard}`,
      );
    }
  }
});

test('the webhook decides trial access through paymentSetupGateApplies', () => {
  // syncSubscriptionToUser can't run here (DB + Stripe), so pin the call site:
  // gating on `status === 'trialing'` alone is the bug this replaced.
  const src = readFileSync(new URL('../app/api/webhooks/stripe/route.ts', import.meta.url), 'utf8');
  assert.match(
    src,
    /paymentSetupGateApplies\(\{ status: subscription\.status, startedWithoutCard: startedNoCard \}\)/,
  );
  assert.doesNotMatch(src, /if \(subscription\.status === 'trialing'\) \{\s*const readiness = classifyPaymentSetup/);
});
