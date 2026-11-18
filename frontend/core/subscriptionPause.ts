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
// key. Locked down in tests/subscriptionPause.test.ts.

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
// next month.
export function computeResumesAtUnix(nowMs: number, months: number): number {
  const d = new Date(nowMs);
  d.setMonth(d.getMonth() + months);
  return Math.floor(d.getTime() / 1000);
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
