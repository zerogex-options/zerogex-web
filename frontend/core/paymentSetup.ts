// Pure classification of whether a subscription's payment method is prepared for
// the eventual off-session charge. Extracted from the Stripe webhook so the
// gate can be unit-tested without the webhook's DB and Stripe-API side effects
// (mirrors core/paymentGrace.ts). Uses `import type` only, so it pulls no Stripe
// runtime and stays test-runnable under `node --experimental-strip-types`.
//
// WHY THIS EXISTS: a $0-due trial subscription is created in status `trialing`
// with a `pending_setup_intent` — the SetupIntent that authorizes the card for
// the future (post-trial) merchant-initiated charge. That SetupIntent can end in
// `requires_action` (customer abandoned 3DS), `requires_payment_method` (the card
// failed at setup), `processing`, or `canceled`. In all of those the subscription
// is STILL `trialing`, so granting access purely on `trialing` lets a customer in
// on an unusable payment method. This classifies the readiness so the webhook can
// withhold the tier until the setup is proven `succeeded`.
//
// See app/api/webhooks/stripe/route.ts for how the result gates grantsTier, and
// how an `unresolved-id` is resolved against Stripe before deciding.

import type Stripe from 'stripe';

// The three states pending_setup_intent can present on a webhook payload:
//   • ready         — no pending setup at all (not a trial, or Stripe already
//                     cleared a succeeded SetupIntent to null), OR the expanded
//                     SetupIntent object is `succeeded`. Safe to grant.
//   • pending       — an expanded SetupIntent object that is NOT succeeded
//                     (requires_action / requires_payment_method / processing /
//                     canceled). Withhold.
//   • unresolved-id — a bare id string, because the field wasn't expanded on this
//                     event. Indeterminate from the object alone: the caller MUST
//                     resolve it (setupIntents.retrieve) before trusting it, and
//                     must treat a failed lookup as NOT ready.
export type SetupReadiness = 'ready' | 'pending' | 'unresolved-id';

export function classifyPaymentSetup(
  subscription: Pick<Stripe.Subscription, 'pending_setup_intent'>,
): SetupReadiness {
  const psi = subscription.pending_setup_intent;
  if (!psi) return 'ready';
  if (typeof psi === 'string') return 'unresolved-id';
  return psi.status === 'succeeded' ? 'ready' : 'pending';
}

// Convenience boolean for the common "grant only when proven ready" gate. An
// unexpanded id resolves to NOT ready (the caller should resolve it explicitly
// via classifyPaymentSetup + a Stripe lookup for correctness); this errs toward
// withholding so access is never granted on an unknown.
export function isPaymentSetupReady(
  subscription: Pick<Stripe.Subscription, 'pending_setup_intent'>,
): boolean {
  return classifyPaymentSetup(subscription) === 'ready';
}
