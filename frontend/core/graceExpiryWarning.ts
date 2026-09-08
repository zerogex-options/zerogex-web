// Pure decision logic for the grace-expiry warning: the second dunning touch,
// sent ~24h before a payment-recovery grace window closes, extracted from the
// sweeper so it can be unit-tested without the sweeper's DB and Stripe I/O
// (mirrors core/paymentGrace.ts and core/trialDunning.ts).
//
// The problem it solves: the dunning flow was a SINGLE email. The Stripe webhook
// sends one payment-failed / trial-conversion-failed nudge gated on
// `invoice.attempt_count === 1` (app/api/webhooks/stripe/route.ts) — Smart
// Retries emit further invoice.payment_failed events with attempt_count 2, 3, …
// and every one of those sends nothing. Nothing fires when the grace window
// itself runs out either: decidePaymentGrace simply stops returning `inGrace`
// and the next subscription sync drops the member to `public`, silently. So a
// member whose card is still failing gets one email on day 0, then loses access
// on day 3 having heard nothing since. This closes that gap with one warning
// while the deadline can still be acted on.
//
// Why a time-based sweeper rather than a webhook branch: no Stripe event fires
// at "24h before the window closes". The past_due syncs that DO arrive are on
// Stripe's retry schedule, which is unrelated to graceDays. Same reasoning as
// the cancellation-alert sweeper (see docs/automated-emails-audit.md §3.5).
//
// See scripts/send-grace-expiry-warnings.mts for the cohort query and the send
// loop, and core/mailer.ts buildGraceExpiryWarningEmail for the copy.

import { graceWindowEndIso } from './paymentGrace.ts';

const HOUR_MS = 60 * 60 * 1000;

// Fire when the window has this many hours or fewer left on it. 24h is the
// point where the deadline is still actionable — a member can update a card
// tonight and have it retried tomorrow — without being so early that the
// warning arrives before the member has had a chance to notice the first email.
export const DEFAULT_LEAD_HOURS = 24;

// Never warn until the window has been open at least this long, so the warning
// cannot land on top of the first dunning email. This matters when the window
// is short: with BILLING_PAYMENT_GRACE_DAYS=1 the whole window is 24h, so a
// bare "≤ leadHours remaining" test would be true the instant it opens and the
// member would get two emails minutes apart. With the guard the warning lands
// at the 12h mark instead. At the default graceDays=3 the guard never binds
// (≤24h remaining implies ≥48h open).
export const DEFAULT_MIN_OPEN_HOURS = 12;

// Why a given member is not being warned on this run. Surfaced by the sweeper's
// --dry-run so an operator can tell "nobody is due yet" (healthy) apart from
// "everyone is already warned" or "the window elapsed before we ever ran".
export type GraceExpiryWarningSkip =
  | 'no-window' // no anchor, grace disabled, or a malformed anchor
  | 'window-elapsed' // the window already ran out — too late to warn honestly
  | 'already-warned' // this exact window has been warned about
  | 'too-soon-after-opening' // open < minOpenHours; would stack on the first email
  | 'not-yet-due'; // still more than leadHours left to run

export type GraceExpiryWarningInput = {
  // Persisted window anchor from the users row (ISO), or null when none is open.
  graceStartedAt: string | null;
  // Window length in days (getPaymentGraceDays(); 0 disables grace entirely).
  graceDays: number;
  // Persisted users.payment_grace_warning_sent_for: the grace anchor this member
  // was already warned about, or null if never. This is the once-per-window
  // latch, and it is keyed to the WINDOW rather than being a boolean that has to
  // be reset — a re-opened window gets a fresh anchor from decidePaymentGrace
  // (`new Date(nowMs).toISOString()`), which no longer equals the stored value,
  // so the latch invalidates itself. Same discipline as the cancellation alert's
  // `alert_for=<audit id>` idempotency. The consequence worth having: nothing in
  // the Stripe webhook has to clear it, so there is no path on which a stale
  // latch silently suppresses the warning for a member's next window.
  warnedFor: string | null;
  // Injected clock (Date.now()) so the decision is deterministic under test.
  nowMs: number;
  // Hours-remaining threshold at or below which the warning fires.
  leadHours?: number;
  // Minimum hours the window must have been open before any warning goes out.
  minOpenHours?: number;
};

export type GraceExpiryWarningDecision = {
  // Whether to send the warning to this member on this run.
  send: boolean;
  // The instant the window closes, or null when none is open. Non-null whenever
  // `send` is true — the email's entire job is naming this date, so the copy is
  // never built without it.
  graceUntilIso: string | null;
  // Whole hours left on the window at nowMs (floored, never negative), or null
  // when no window is open. Reported by --dry-run so an operator can see how
  // close each member is to the deadline.
  hoursRemaining: number | null;
  // Why not, when `send` is false. Null when `send` is true.
  skip: GraceExpiryWarningSkip | null;
};

export function decideGraceExpiryWarning(
  input: GraceExpiryWarningInput,
): GraceExpiryWarningDecision {
  const {
    graceStartedAt,
    graceDays,
    warnedFor,
    nowMs,
    leadHours = DEFAULT_LEAD_HOURS,
    minOpenHours = DEFAULT_MIN_OPEN_HOURS,
  } = input;

  // graceWindowEndIso already encodes every "there is no live window" case —
  // null anchor, graceDays <= 0, an unparseable anchor, and a window that has
  // already elapsed — and it is the same helper the first dunning email uses to
  // quote its deadline. Reusing it is what keeps the two emails from ever
  // disagreeing about when a member's access actually ends.
  const graceUntilIso = graceWindowEndIso(graceStartedAt, graceDays, nowMs);
  if (!graceUntilIso) {
    // Distinguish "no window at all" from "there was one and we missed it": the
    // second means a sweep did not run often enough, which is an operational
    // problem worth seeing rather than a quiet no-op.
    const startedMs = graceStartedAt ? Date.parse(graceStartedAt) : NaN;
    const elapsed =
      Number.isFinite(startedMs) && graceDays > 0 && nowMs >= startedMs + graceDays * 24 * HOUR_MS;
    return {
      send: false,
      graceUntilIso: null,
      hoursRemaining: null,
      skip: elapsed ? 'window-elapsed' : 'no-window',
    };
  }

  // Safe: a non-null graceUntilIso means the anchor parsed.
  const startedMs = Date.parse(graceStartedAt as string);
  const untilMs = Date.parse(graceUntilIso);
  const hoursRemaining = Math.max(0, Math.floor((untilMs - nowMs) / HOUR_MS));

  // The latch is compared against the anchor, not merely tested for presence, so
  // a member who recovers and fails again is warned about the new window too.
  if (warnedFor !== null && warnedFor === graceStartedAt) {
    return { send: false, graceUntilIso, hoursRemaining, skip: 'already-warned' };
  }

  const openHours = (nowMs - startedMs) / HOUR_MS;
  if (openHours < minOpenHours) {
    return { send: false, graceUntilIso, hoursRemaining, skip: 'too-soon-after-opening' };
  }

  // Note the asymmetry with the trial reminder's centered +/- window: because
  // the latch makes a repeat send impossible, this only needs a one-sided test.
  // A sweep that lands late still catches the member (any remaining time under
  // the lead qualifies) instead of stepping over a bracket and missing them
  // entirely — which for a 3-day window is the failure that actually matters.
  if ((untilMs - nowMs) / HOUR_MS > leadHours) {
    return { send: false, graceUntilIso, hoursRemaining, skip: 'not-yet-due' };
  }

  return { send: true, graceUntilIso, hoursRemaining, skip: null };
}
