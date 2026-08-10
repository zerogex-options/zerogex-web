import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyPaymentSetup,
  isPaymentSetupReady,
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
