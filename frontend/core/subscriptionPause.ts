// Pure logic for the PAUSE-instead-of-cancel retention lever. A paused
// subscription keeps its Stripe subscription alive (so it auto-resumes on its own)
// but is billed nothing and — per the webhook's entitlement gate — grants no
// access, so it is NOT churn: the member takes a bounded break and comes back
// instead of canceling outright.
//
// Kept PURE (no Stripe, no database; its one import, core/auth.ts, has no
// imports of its own) so it's unit-tested without Stripe. The webhook derives
// entitlement from derivePauseState(subscription.pause_collection); the
// cancel-flow route uses clampPauseMonths + computeResumesAtUnix to set a bounded
// pause_collection, and it and the billing status route only offer a pause where
// isPausableCadence allows one. scripts/pause-subscription.mts sets the same
// pause for a member who asks by email, and previews it with billsDuringPause.
// pauseRevokesApiKeys decides who is told that the pause costs them their API
// key. scripts/resume-subscription.mts ends a pause early for a member, and
// previews what that does with previewResume. A cancel or a save ends a pause
// too (scheduleCancelParams, endPauseParam), so a plan is never paused and
// canceling at once. Locked down in tests/subscriptionPause.test.ts.

import { isApiKeyEligibleTier, type TierId } from './auth.ts';

export const PAUSE_MONTH_OPTIONS = [1, 2, 3] as const;
const MIN_PAUSE_MONTHS = 1;
const MAX_PAUSE_MONTHS = 3;

// The shape we read off subscription.pause_collection (declared locally so this
// module doesn't depend on the Stripe types). Both fields optional/nullable
// exactly as Stripe delivers them.
export type PauseCollectionInput =
  | {
      behavior?: string | null;
      resumesAt?: number | null;
    }
  | null
  | undefined;

export type PauseState = {
  // Whether billing is paused (any pause_collection behavior present).
  paused: boolean;
  // ISO of the scheduled auto-resume, or null (an indefinite pause, or not paused).
  resumesAtIso: string | null;
};

// Whether a plan billed at this cadence may be paused: monthly only. Stripe keeps
// the billing cycle running through a pause, and with behavior 'void' it voids
// every invoice generated in the window; nothing is collected for that period
// afterwards. Monthly evens out (N months without access, N monthly invoices
// voided). Quarterly and annual do not: a renewal inside the window voids the
// whole 3- or 12-month invoice while access comes back after 1–3 months (an
// annual member pausing one month across renewal gets ~11 months free), and a
// renewal outside it costs the member months they already paid for. A missing
// cadence (a price that maps to no SKU) is not pausable either.
export function isPausableCadence(cadence: string | null | undefined): boolean {
  return cadence === 'monthly';
}

// The tier a member holds while paused. The webhook grants nothing during a
// pause (syncSubscriptionToUser in app/api/webhooks/stripe/route.ts).
const PAUSED_TIER: TierId = 'public';

// Whether pausing a plan on `planTier` switches off the member's API key for
// good. The pause drops the member to PAUSED_TIER, and the webhook revokes every
// key on a drop out of API-key eligibility (revokeApiKeysIfTierDropped in
// core/apiKeyAdmin.ts, the same test as below). The key service can revoke a
// key but not suspend one, so the old key never works again: once the plan
// resumes, the member generates a new one at /account#api-access. The cancel
// flow says so before the member picks a pause length, the Account page's
// paused banner says it again, and scripts/pause-subscription.mts prints it in
// its preview.
//
// Pass the tier of the subscription's price (priceIdToSku), not users.tier: the
// pause itself sets users.tier to PAUSED_TIER, so only the plan still says Pro
// while the member is paused.
export function pauseRevokesApiKeys(planTier: TierId | null | undefined): boolean {
  if (!planTier) return false;
  return isApiKeyEligibleTier(planTier) && !isApiKeyEligibleTier(PAUSED_TIER);
}

export function derivePauseState(input: PauseCollectionInput): PauseState {
  if (!input || !input.behavior) return { paused: false, resumesAtIso: null };
  const resumesAtIso =
    typeof input.resumesAt === 'number' && Number.isFinite(input.resumesAt)
      ? new Date(input.resumesAt * 1000).toISOString()
      : null;
  return { paused: true, resumesAtIso };
}

// Clamp a requested pause length to the allowed [1, 3] months. A retention pause
// is a short break, not an indefinite freeze — a paused sub pays nothing and has
// no access, so it must stay bounded. A malformed request defaults to 1 month.
export function clampPauseMonths(requested: unknown): number {
  const n =
    typeof requested === 'number'
      ? requested
      : typeof requested === 'string'
        ? Number(requested)
        : Number.NaN;
  if (!Number.isFinite(n)) return MIN_PAUSE_MONTHS;
  return Math.max(MIN_PAUSE_MONTHS, Math.min(MAX_PAUSE_MONTHS, Math.floor(n)));
}

// The Unix-seconds instant a pause of `months` starting at nowMs should resume.
// Calendar-month arithmetic (not 30×days) so "1 month" lands on the same day
// next month, in UTC, and on the target month's LAST day when that day doesn't
// exist. setMonth overflowed instead: a one-month pause on Jan 31 resumed on
// Mar 3 (Nov 30 + 3 months on Mar 2), so a member billed on the 1st had two
// renewals voided for a one-month pause and nearly four free weeks.
export function computeResumesAtUnix(nowMs: number, months: number): number {
  const d = new Date(nowMs);
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth() + months;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const day = Math.min(d.getUTCDate(), lastDay);
  return Math.floor(
    Date.UTC(year, month, day, d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds()) / 1000,
  );
}

// A monthly bill `months` after the billing-cycle anchor, the way Stripe dates
// them: same UTC day and time each month, on the month's last day when the
// anchor's day doesn't exist (an anchor on the 31st bills Nov 30, then Dec 31).
// Always counted from the anchor itself, never chained, so a short month
// doesn't drag every later bill earlier.
export function monthlyBillUnix(anchorUnix: number, months: number): number {
  const a = new Date(anchorUnix * 1000);
  const year = a.getUTCFullYear();
  const month = a.getUTCMonth() + months;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const day = Math.min(a.getUTCDate(), lastDay);
  return Math.floor(
    Date.UTC(year, month, day, a.getUTCHours(), a.getUTCMinutes(), a.getUTCSeconds()) / 1000,
  );
}

export type PauseBills = {
  // Bills that come due while paused. With behavior 'void' each one is voided:
  // the member is never charged for those periods.
  skippedUnix: number[];
  // The first bill after the pause ends: the member's next real charge.
  nextChargeUnix: number | null;
};

// A century of months: an anchor this old is bad data, not a member.
const MAX_BILLS_SCANNED = 1200;

// What a pause from nowUnix to resumesAtUnix does to a monthly plan's bills.
// Stripe keeps billing on schedule through a pause, so every bill dated inside
// the window is skipped and the first one after it is charged as usual. This is
// what makes a monthly pause fair: N months paused skips exactly N bills, and a
// period paid just before the pause is not lost, it covers the stretch from the
// resume to the next charge. Preview only; Stripe does the actual voiding.
export function billsDuringPause(anchorUnix: number, nowUnix: number, resumesAtUnix: number): PauseBills {
  if (
    !Number.isFinite(anchorUnix) ||
    !Number.isFinite(nowUnix) ||
    !Number.isFinite(resumesAtUnix) ||
    resumesAtUnix <= nowUnix
  ) {
    return { skippedUnix: [], nextChargeUnix: null };
  }
  const skippedUnix: number[] = [];
  for (let k = 0; k < MAX_BILLS_SCANNED; k++) {
    const bill = monthlyBillUnix(anchorUnix, k);
    if (bill <= nowUnix) continue;
    if (bill < resumesAtUnix) {
      skippedUnix.push(bill);
      continue;
    }
    return { skippedUnix, nextChargeUnix: bill };
  }
  return { skippedUnix, nextChargeUnix: null };
}

// What ending a pause right now does, for the operator's preview in
// scripts/resume-subscription.mts. Resuming clears pause_collection and nothing
// else, exactly as the Account page's Resume now does (action 'resume' in
// app/api/billing/cancel-flow/route.ts), so a cancel the member scheduled stays
// scheduled.
//
//   accessUntilUnix  Access comes back as soon as the webhook hears. With a
//                    cancel scheduled it lasts until the period ends, and then
//                    the plan ends. Null otherwise: it carries on.
//   nextChargeUnix   The next bill Stripe collects: the end of the current
//                    period. Null when a scheduled cancel means nothing more
//                    is billed.
//   periodUnpaid     This period's bill was voided, which is what a pause does
//                    to every bill dated inside it. Resuming then hands over
//                    the rest of the period with no payment behind it. Resume
//                    now in the app does the same; the preview says so, so it
//                    is a choice and not a surprise.
export type ResumePreview = {
  accessUntilUnix: number | null;
  nextChargeUnix: number | null;
  periodUnpaid: boolean;
};

export function previewResume(input: {
  cancelAtPeriodEnd: boolean;
  periodEndUnix: number | null;
  // Status of the subscription's latest invoice (the bill for this period), or
  // null when there is none.
  latestInvoiceStatus: string | null;
}): ResumePreview {
  const periodEnd =
    typeof input.periodEndUnix === 'number' && Number.isFinite(input.periodEndUnix) ? input.periodEndUnix : null;
  return {
    accessUntilUnix: input.cancelAtPeriodEnd ? periodEnd : null,
    nextChargeUnix: input.cancelAtPeriodEnd ? null : periodEnd,
    periodUnpaid: input.latestInvoiceStatus === 'void',
  };
}

// Stripe's subscription.pause_collection as it arrives: null unless the plan is
// paused. Only `behavior` decides, as in derivePauseState.
export type StripePauseCollection = { behavior?: string | null; resumes_at?: number | null } | null | undefined;

// The update that ends a pause now. An empty string clears pause_collection in
// the Stripe API, which is exactly what the Account page's Resume now sends.
// Empty when the plan isn't paused, so it can be spread into any update.
//
// A save keeps the member's access on ("Keep my access & claim 25% off"), so a
// save ends a pause too: the one-click save (app/save/route.ts) and the cancel
// modal's discounts (app/api/billing/cancel-flow/route.ts) spread this into
// their update. Otherwise a member who was paused would be told their access
// continues while it stayed off until the pause ran out.
export function endPauseParam(pauseCollection: StripePauseCollection): { pause_collection?: '' } {
  return pauseCollection?.behavior ? { pause_collection: '' } : {};
}

// Canceling a paused plan ends the pause, then cancels at period end.
//
// Paused, a member has no access. Canceled at period end, everything they are
// told says they keep access until then: the cancel email ("you keep full
// access until ..."), the Account page, the 25% save link and the founder's
// alert. A plan left paused AND canceling made all of that false, and the 25%
// link or "Keep my plan" would quietly put the member back on the pause and on
// the charge after it (docs/outreach/2026-11-20-mat-paused-then-canceled.md).
//
// Ending the pause makes it a plain cancel: access is back until the period
// ends, then the plan ends with nothing more charged. That is exactly Resume
// now followed by Cancel, which a member could always do, so it gives away
// nothing new. If the pause already voided this period's bill, the rest of the
// period comes free, as it does with Resume now.
//
// The in-app cancel (app/api/billing/cancel-flow/route.ts) and
// make set-cancellation ON=1 both build their update here. feedback must
// already be one of Stripe's values (validateCancelFeedback).
export type ScheduleCancelParams = {
  cancel_at_period_end: true;
  pause_collection?: '';
  cancellation_details?: { feedback?: string; comment?: string };
};

export function scheduleCancelParams(input: {
  pauseCollection: StripePauseCollection;
  feedback?: string | null;
  comment?: string | null;
}): ScheduleCancelParams {
  const params: ScheduleCancelParams = { cancel_at_period_end: true, ...endPauseParam(input.pauseCollection) };
  if (input.feedback || input.comment) {
    params.cancellation_details = {
      ...(input.feedback ? { feedback: input.feedback } : {}),
      ...(input.comment ? { comment: input.comment } : {}),
    };
  }
  return params;
}
