// Pure decision logic for the payment-grace cutoff sweep: which members have a
// lapsed grace window but still hold their paid tier, extracted from the sweeper
// so it can be unit-tested without the sweeper's DB and Stripe I/O (mirrors
// core/graceExpiryWarning.ts).
//
// The problem it solves: decidePaymentGrace bounds the window, but it only runs
// inside the webhook's subscription sync, and a sync only happens when Stripe
// sends a subscription event. Stripe's failed-payment retries do not send one —
// each retry is an invoice.payment_failed, and the subscription stays `past_due`
// unchanged. While Stripe ended a failing subscription at about day 3, the
// cancel event's sync dropped the tier on time. Once it started retrying for a
// week or more (from about 2026-09-28), nothing arrived after the window closed,
// so members kept full access for as long as Stripe kept retrying, while the
// grace-expiry warning had told them access ends at day 3.
//
// What the sweeper does with a member this marks `enforce`: it stamps the Stripe
// subscription's metadata, which makes Stripe send customer.subscription.updated,
// and the webhook's own sync drops the tier — the same path, side effects and
// audit trail as any other sync (API keys revoked, billing_payment_grace_ended).
// Nothing here or in the sweeper writes the tier itself.
//
// See scripts/enforce-payment-grace.mts for the cohort query and the Stripe step.

import { decidePaymentGrace } from './paymentGrace.ts';

const DAY_MS = 24 * 60 * 60 * 1000;

// Why a member is left alone on this run. Surfaced by the sweeper's dry run so
// an operator can tell "still inside the window" (healthy) apart from a row in a
// state the sweep deliberately does not touch.
export type GraceEnforcementSkip =
  | 'not-past-due' // only a past_due subscription can be in or past a grace window
  | 'already-public' // nothing left to remove
  | 'protected-tier' // admin is never demoted by a sweep
  | 'no-subscription' // no Stripe subscription to send the update through
  | 'no-window' // past_due with a paid tier but no anchor: not ours to guess at
  | 'still-in-grace'; // the window is open; the member keeps access

export type GraceEnforcementInput = {
  // users.subscription_status as last synced.
  subscriptionStatus: string | null;
  // users.tier as stored.
  tier: string | null;
  // users.stripe_subscription_id.
  subscriptionId: string | null;
  // users.payment_grace_started_at: the window anchor (ISO), or null.
  graceStartedAt: string | null;
  // Window length in days (getPaymentGraceDays(); 0 disables grace entirely).
  graceDays: number;
  // Injected clock (Date.now()) so the decision is deterministic under test.
  nowMs: number;
};

export type GraceEnforcementDecision = {
  // Whether this member's access should end on this run.
  enforce: boolean;
  // Why not, when enforce is false. Null whenever enforce is true.
  skip: GraceEnforcementSkip | null;
  // When the window closes (or closed), or null when the anchor is missing or
  // unreadable. Unlike graceWindowEndIso this stays set after the window has
  // elapsed, because "how long ago did access stop being owed" is the point.
  windowEndIso: string | null;
};

function windowEnd(graceStartedAt: string | null, graceDays: number): string | null {
  if (!graceStartedAt) return null;
  const startedMs = Date.parse(graceStartedAt);
  if (!Number.isFinite(startedMs)) return null;
  return new Date(startedMs + Math.max(0, graceDays) * DAY_MS).toISOString();
}

export function decideGraceEnforcement(input: GraceEnforcementInput): GraceEnforcementDecision {
  const { subscriptionStatus, tier, subscriptionId, graceStartedAt, graceDays, nowMs } = input;
  const windowEndIso = windowEnd(graceStartedAt, graceDays);
  const skip = (reason: GraceEnforcementSkip): GraceEnforcementDecision => ({
    enforce: false,
    skip: reason,
    windowEndIso,
  });

  if (subscriptionStatus !== 'past_due') return skip('not-past-due');
  if (!tier || tier === 'public') return skip('already-public');
  if (tier === 'admin') return skip('protected-tier');
  if (!subscriptionId) return skip('no-subscription');

  // A paid tier on a past_due row with no anchor should not exist: the webhook
  // sets public on the same sync that declines to open a window. Report it, but
  // leave it to a human rather than guessing how it got there.
  if (!graceStartedAt) return skip('no-window');

  // Ask the webhook's own decision, exactly as a follow-up past_due sync would,
  // so the bound (including a malformed anchor, or grace disabled after the
  // window opened) can never differ from the one the webhook enforces.
  const { inGrace } = decidePaymentGrace({
    status: 'past_due',
    previousStatus: 'past_due',
    graceStartedAt,
    graceDays,
    nowMs,
  });
  if (inGrace) return skip('still-in-grace');

  return { enforce: true, skip: null, windowEndIso };
}
