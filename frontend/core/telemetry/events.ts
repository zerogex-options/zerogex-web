// Canonical analytics event names — the single source of truth shared by the
// client (posthog-client) and server (posthog-server) so a funnel step is
// spelled identically wherever it fires. Keep these stable: renaming an event
// breaks historical funnels in PostHog.
//
// The conversion funnel, in order:
//   signup → first_value → checkout_started → trial_started → subscription_paid
// plus the churn signal: subscription_cancelled.
//
// This module is environment-agnostic (no 'use client', no node imports) so it
// can be imported from both browser components and server route handlers.

export const TelemetryEvent = {
  /** Account created (client, fired on successful /api/auth/register). */
  Signup: 'signup',
  /** First time a user sees core analytics — the "aha" (client, GEX load). */
  FirstValue: 'first_value',
  /** Subscribe clicked → redirecting to Stripe Checkout (client, pricing). */
  CheckoutStarted: 'checkout_started',
  /** Subscription entered a trial (server, Stripe webhook). */
  TrialStarted: 'trial_started',
  /** Subscription became active/paying — incl. trial→paid (server, webhook). */
  SubscriptionPaid: 'subscription_paid',
  /** Subscription ended → tier reset to public; the churn event (server). */
  SubscriptionCancelled: 'subscription_cancelled',
} as const;

export type TelemetryEventName = (typeof TelemetryEvent)[keyof typeof TelemetryEvent];
