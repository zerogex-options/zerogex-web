// Pure decision logic for the bounded payment-recovery grace window, extracted
// from the Stripe webhook so it can be unit-tested without the webhook's DB and
// Stripe-API side effects (mirrors core/proWelcome.ts).
//
// The problem it solves: when an established paying subscription's RENEWAL charge
// fails, Stripe moves it to `past_due`. Revoking access on that first failure is
// the biggest self-inflicted involuntary-churn driver — Stripe's Smart Retries
// would recover many of those cards over the following days. This grants a short,
// bounded window during which the member keeps their paid tier while the retries
// run, without ever becoming "weeks of free premium".
//
// See app/api/webhooks/stripe/route.ts for how the result is persisted
// (users.payment_grace_started_at) and applied (tier retention), and
// getPaymentGraceDays() in core/stripe.ts for the window length.

export type PaymentGraceInput = {
  // Current Stripe subscription status on this webhook sync.
  status: string;
  // Last-synced status, read pre-UPDATE. `active` here identifies an established
  // paying subscription — the only cohort a renewal-failure grace protects.
  previousStatus: string | null;
  // Persisted window anchor from the users row (ISO), or null when none is open.
  graceStartedAt: string | null;
  // Window length in days (getPaymentGraceDays(); 0 disables grace entirely).
  graceDays: number;
  // Injected clock (Date.now()) so the decision is deterministic under test.
  nowMs: number;
};

export type PaymentGraceDecision = {
  // Value to persist back to users.payment_grace_started_at.
  graceStartedAt: string | null;
  // Whether the member keeps their paid tier on this sync despite `past_due`.
  inGrace: boolean;
};

const DAY_MS = 24 * 60 * 60 * 1000;

export function decidePaymentGrace(input: PaymentGraceInput): PaymentGraceDecision {
  const { status, previousStatus, graceStartedAt, graceDays, nowMs } = input;

  // Any non-past_due status closes the window: recovery to `active`, a switch
  // back to `trialing`, cancel, etc. The tier grant is then driven by the normal
  // ACTIVE_STATUSES check in the webhook, not by grace.
  if (status !== 'past_due') {
    return { graceStartedAt: null, inGrace: false };
  }

  // Already inside an open window: enforce the bound off the persisted anchor.
  // A malformed anchor (unparseable) is treated as expired rather than trusted.
  // A non-positive graceDays (grace disabled after being enabled) also expires
  // it immediately here, since nowMs - startedMs >= 0.
  if (graceStartedAt) {
    const startedMs = Date.parse(graceStartedAt);
    const inGrace = Number.isFinite(startedMs) && nowMs - startedMs < graceDays * DAY_MS;
    return { graceStartedAt, inGrace };
  }

  // First `past_due` sync. Open a window ONLY for an established (previously
  // `active`) subscription. A trial-conversion failure (previousStatus
  // `trialing`, never `active`) opens no window, so an unvalidated trial card is
  // downgraded immediately — preserving the hard trial-end behavior.
  if (graceDays > 0 && previousStatus === 'active') {
    return { graceStartedAt: new Date(nowMs).toISOString(), inGrace: true };
  }

  return { graceStartedAt: null, inGrace: false };
}
