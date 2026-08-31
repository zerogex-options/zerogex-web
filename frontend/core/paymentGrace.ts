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

// Which failure opened the window. Persisted (users.payment_grace_reason) so the
// cohort survives across the many past_due syncs that follow the one that opened
// it, and so admin monitoring can show trial-conversion failures separately from
// established-renewal failures:
//   renewal — an established paying subscription's renewal charge was declined.
//   trial   — a free trial lapsed and the FIRST conversion charge was declined,
//             so the member has never completed a payment yet.
export type PaymentGraceReason = 'renewal' | 'trial';

export type PaymentGraceInput = {
  // Current Stripe subscription status on this webhook sync.
  status: string;
  // Last-synced status, read pre-UPDATE. `active` here identifies an established
  // paying subscription — the only cohort a renewal-failure grace protects.
  previousStatus: string | null;
  // Persisted window anchor from the users row (ISO), or null when none is open.
  graceStartedAt: string | null;
  // Persisted reason from the users row, or null when none is open (and null on
  // rows whose window was opened before this column existed — carried through
  // verbatim rather than guessed, so nothing is mis-attributed retroactively).
  graceReason?: PaymentGraceReason | null;
  // Window length in days (getPaymentGraceDays(); 0 disables grace entirely).
  graceDays: number;
  // Injected clock (Date.now()) so the decision is deterministic under test.
  nowMs: number;
  // When true, a trial-conversion failure ALSO opens a grace window, using the
  // same bounded graceDays (see trialConversion below for how one is identified,
  // which is NOT simply previousStatus). Defaults to false, which
  // preserves the original renewal-only behavior. The Stripe webhook passes
  // getTrialGraceEnabled(). A trial already requires a card at checkout, so its
  // first-charge decline is the same recoverable case a renewal decline is — this
  // gives Stripe's Smart Retries the same short window before access drops.
  trialGrace?: boolean;
  // Whether the member actually held a paid tier on the PREVIOUS sync. Guards the
  // trial-conversion branch only: a trial whose payment setup never succeeded is
  // withheld access at checkout (tier stays `public`), so previousTierGranted is
  // false for it — and its first-charge failure must NOT open a grace window,
  // which would hand premium to exactly the unvalidated-card cohort grace exists
  // to exclude. A normally-activated trial (setup succeeded → tier granted) has
  // previousTierGranted true and keeps the recovery window. Defaults true so the
  // renewal branch and every existing caller are unchanged.
  previousTierGranted?: boolean;
  // Whether this past_due is the FIRST charge at the end of a free trial, decided
  // ORDER-INDEPENDENTLY by the caller from the subscription's trial_end
  // (isWithinTrialConversionWindow in core/trialDunning). This is what makes the
  // Trial Grace cohort measurable at all.
  //
  // previousStatus cannot identify a first-charge failure on its own: at trial
  // end Stripe moves the subscription to `active` when the cycle invoice is
  // created, and only to `past_due` once that invoice finalizes (~an hour later)
  // and the charge is declined. The trial-end `active` sync overwrites the
  // last-synced `trialing` first, so by the time the failure arrives
  // previousStatus reads `active` and the failure is attributed to the RENEWAL
  // cohort — which is why admin monitoring's Trial Grace bucket read zero while
  // trial-conversion failures were plainly happening.
  //
  // Stripe pins trial_end to when the trial actually ended and keeps it for the
  // life of the subscription, so "the trial ended moments ago" identifies the
  // conversion charge no matter which syncs landed in which order. Same signal
  // core/trialDunning already uses to pick the dunning copy. Defaults false, so
  // callers that don't supply it keep the previousStatus-only behavior.
  trialConversion?: boolean;
};

export type PaymentGraceDecision = {
  // Value to persist back to users.payment_grace_started_at.
  graceStartedAt: string | null;
  // Value to persist back to users.payment_grace_reason. Always null whenever
  // graceStartedAt is null, so the two columns can never disagree.
  graceReason: PaymentGraceReason | null;
  // Whether the member keeps their paid tier on this sync despite `past_due`.
  inGrace: boolean;
};

const DAY_MS = 24 * 60 * 60 * 1000;

export function decidePaymentGrace(input: PaymentGraceInput): PaymentGraceDecision {
  const {
    status,
    previousStatus,
    graceStartedAt,
    graceReason = null,
    graceDays,
    nowMs,
    trialGrace = false,
    previousTierGranted = true,
    trialConversion = false,
  } = input;

  // Any non-past_due status closes the window: recovery to `active`, a switch
  // back to `trialing`, cancel, etc. The tier grant is then driven by the normal
  // ACTIVE_STATUSES check in the webhook, not by grace.
  if (status !== 'past_due') {
    return { graceStartedAt: null, graceReason: null, inGrace: false };
  }

  // Already inside an open window: enforce the bound off the persisted anchor.
  // A malformed anchor (unparseable) is treated as expired rather than trusted.
  // A non-positive graceDays (grace disabled after being enabled) also expires
  // it immediately here, since nowMs - startedMs >= 0.
  if (graceStartedAt) {
    const startedMs = Date.parse(graceStartedAt);
    const inGrace = Number.isFinite(startedMs) && nowMs - startedMs < graceDays * DAY_MS;
    // The reason belongs to the window, not to this sync: carry the persisted
    // one through unchanged (previousStatus is `past_due` on these follow-up
    // syncs and so can no longer identify the cohort).
    return { graceStartedAt, graceReason, inGrace };
  }

  // First `past_due` sync. Open a window for an established (previously `active`)
  // subscription, and — when trialGrace is enabled — for a trial-conversion
  // failure (previously `trialing`) too. Both use the same bounded graceDays, so
  // the "already inside a window" branch above enforces the bound identically on
  // subsequent past_due syncs regardless of which case opened it. With trialGrace
  // off, a trialing→past_due opens no window (the original hard trial-end).
  //
  // The caller's trial_end signal is consulted FIRST because it is authoritative
  // and order-independent, where previousStatus is whatever Stripe's sync
  // ordering happened to leave behind (see trialConversion above).
  // previousStatus === 'trialing' remains the fallback for a sub that skipped
  // the trial-end `active` sync, or whose trial_end the caller couldn't read.
  //
  // Once a past_due IS identified as a trial conversion, the trial rules decide
  // it outright — it must never fall through to the renewal branch. Otherwise a
  // withheld-card trial (previousTierGranted false) would be handed a window by
  // the renewal path purely because Stripe's trial-end `active` sync ran first,
  // defeating the guard, and BILLING_TRIAL_GRACE_ENABLED=0 would be silently
  // ineffective for exactly the failures it is meant to govern.
  const isTrialConversion = trialConversion || previousStatus === 'trialing';
  const openedBy: PaymentGraceReason | null = isTrialConversion
    ? trialGrace && previousTierGranted
      ? 'trial'
      : null
    : previousStatus === 'active'
      ? 'renewal'
      : null;
  if (graceDays > 0 && openedBy) {
    return { graceStartedAt: new Date(nowMs).toISOString(), graceReason: openedBy, inGrace: true };
  }

  return { graceStartedAt: null, graceReason: null, inGrace: false };
}

// The instant an open grace window runs through, or null when none is currently
// open (no anchor, grace disabled, a malformed anchor, or the window already
// elapsed at `nowMs`). Used by the payment-failed dunning email to tell a member
// their access is retained THROUGH this date instead of implying an immediate
// downgrade — a positive-only signal, safe to trust because the anchor is set by
// the webhook only for an established renewal failure.
export function graceWindowEndIso(
  graceStartedAt: string | null,
  graceDays: number,
  nowMs: number,
): string | null {
  if (!graceStartedAt || graceDays <= 0) return null;
  const startedMs = Date.parse(graceStartedAt);
  if (!Number.isFinite(startedMs)) return null;
  const untilMs = startedMs + graceDays * DAY_MS;
  return untilMs > nowMs ? new Date(untilMs).toISOString() : null;
}
