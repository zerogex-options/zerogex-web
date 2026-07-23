// ZeroGEX Ambassador Program — configuration + pure helpers.
//
// This is a LEAF module: it imports nothing from the rest of core/ so it can be
// pulled into both core/referrals.ts (attribution-window gate) and
// core/ambassadors.ts (runtime) without an import cycle. Everything here is
// either an env-driven config getter or a pure, side-effect-free function, which
// also makes it trivially unit-testable without touching the DB or Stripe.
//
// The Ambassador Program is the THIRD partner category, sitting between the
// Refer-a-Friend program (regular subscribers, account credits) and the Content
// Creator Affiliate program (large-audience creators, cash commissions). It
// reuses the existing affiliate plumbing (users.partner_tier, the referrals
// ledger, and the partner_commissions ledger) rather than introducing a parallel
// attribution/payout system — see core/ambassadors.ts.

// Partner categories. `referral` is the implicit default for any user with a
// referral_code but no partner_tier; `ambassador` and `creator` are the two
// commission-bearing partner tiers stored in users.partner_tier.
export type PartnerType = 'referral' | 'ambassador' | 'creator';

// Program lifecycle status for an ambassador (users.partner_status).
export type PartnerStatus = 'invited' | 'active' | 'paused' | 'inactive' | 'rejected';
export const PARTNER_STATUSES: readonly PartnerStatus[] = [
  'invited',
  'active',
  'paused',
  'inactive',
  'rejected',
];

// How an ambassador elects to be rewarded (users.partner_reward_preference).
export type RewardPreference = 'cash' | 'account_credit';
export const REWARD_PREFERENCES: readonly RewardPreference[] = ['cash', 'account_credit'];

// Commission ledger status vocabulary. The existing creator program writes
// 'accrued' -> 'paid'/'reversed'; the ambassador program uses the richer set
// below on partner_commissions rows tagged partner_type='ambassador', so the
// two never collide (creator reversal only touches 'accrued', ambassador logic
// only touches ambassador-tagged rows).
export type CommissionStatus =
  | 'pending' // accrued, inside the holding period (cash or credit)
  | 'approved' // cleared admin review, awaiting hold release
  | 'payable' // cash, hold elapsed, awaiting operator payout
  | 'paid' // cash, operator marked paid
  | 'credited' // account credit applied to the ambassador's Stripe balance
  | 'reversed' // refund/dispute reversal (full) or compensating negative row
  | 'disputed' // chargeback opened; money pulled
  | 'cancelled'; // voided by an admin with a reason
export const COMMISSION_STATUSES: readonly CommissionStatus[] = [
  'pending',
  'approved',
  'payable',
  'paid',
  'credited',
  'reversed',
  'disputed',
  'cancelled',
];

// Human-facing program identity. Not secret; safe to render in the UI.
export const AMBASSADOR_PROGRAM_NAME = 'ZeroGEX Ambassador';
export const FOUNDING_AMBASSADOR_DESIGNATION = 'Founding Ambassador';

function readInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw == null || raw === '') return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

// Master switch. The whole program is inert (no invites honored, no attribution
// recorded, no commissions accrued, no dashboard shown) unless the operator opts
// in — mirroring isReferralProgramEnabled() / isCreatorPartnerProgramEnabled().
export function isAmbassadorProgramEnabled(): boolean {
  return process.env.AMBASSADOR_PROGRAM_ENABLED === '1';
}

// Rollout control: pause NEW attribution/accrual while preserving every existing
// ambassador record. When set, existing commissions still release, get paid, and
// reverse normally, but a fresh signup under an ambassador code is not attributed
// and no new commissions accrue. Off by default (attribution follows the master
// switch).
export function isAmbassadorAttributionEnabled(): boolean {
  return isAmbassadorProgramEnabled() && process.env.AMBASSADOR_ATTRIBUTION_DISABLED !== '1';
}

// The version string of the Ambassador Program Terms currently in force. Stored
// on the user row at acceptance (users.partner_terms_version) so we can prove
// which revision an ambassador agreed to and prompt re-acceptance after a
// prospective update.
export function getAmbassadorTermsVersion(): string {
  const v = process.env.AMBASSADOR_TERMS_VERSION;
  return v && v.length > 0 ? v : 'v1';
}

// Optional, operator-configured contact/feedback destinations surfaced to
// ambassadors in the dashboard. Both are plain URLs (a form, a mailto:, a
// private Discord invite) — no secrets. Null when unset.
export function getAmbassadorFeedbackUrl(): string | null {
  const u = process.env.AMBASSADOR_FEEDBACK_URL;
  return u && u.length > 0 ? u : null;
}
export function getAmbassadorEarlyAccessUrl(): string | null {
  const u = process.env.AMBASSADOR_EARLY_ACCESS_URL;
  return u && u.length > 0 ? u : null;
}

// Default ambassador terms, all env-overridable so the pilot can be re-tuned
// without a code change. These are the values written onto a fresh ambassador
// profile at invite time; per-ambassador overrides then live on the user row.
export type AmbassadorTerms = {
  // Cash commission rate in basis points (20% = 2000).
  commissionBps: number;
  // Account-credit reward rate in basis points (25% = 2500).
  creditBps: number;
  // How many months of a referred customer's paid invoices earn commission.
  commissionWindowMonths: number;
  // Click -> registration attribution window, in days.
  attributionWindowDays: number;
  // Holding period before an earned commission becomes payable/creditable.
  holdingPeriodDays: number;
  // Default pilot length, in days.
  pilotDays: number;
};

export function getAmbassadorTerms(): AmbassadorTerms {
  return {
    commissionBps: readInt('AMBASSADOR_COMMISSION_BPS', 2000),
    creditBps: readInt('AMBASSADOR_CREDIT_BPS', 2500),
    commissionWindowMonths: readInt('AMBASSADOR_COMMISSION_WINDOW_MONTHS', 12),
    attributionWindowDays: readInt('AMBASSADOR_ATTRIBUTION_WINDOW_DAYS', 60),
    holdingPeriodDays: readInt('AMBASSADOR_HOLDING_PERIOD_DAYS', 30),
    pilotDays: readInt('AMBASSADOR_PILOT_DAYS', 90),
  };
}

// Commissions at or above this amount (in minor units / cents) are held back
// from automatic hold-release and surfaced to an admin for manual approval
// before they become payable — the "review large/suspicious rewards" guard.
// 0 disables the gate (everything auto-releases). Default $200.
export function getAmbassadorReviewThresholdMinor(): number {
  const v = readInt('AMBASSADOR_REVIEW_THRESHOLD_CENTS', 20000);
  return v > 0 ? v : 0;
}

// -- Pure money helpers (decimal-safe: integer minor units only) ------------

// Commission on `billedMinor` (smallest currency unit already collected) at
// `bps` basis points. Integer math end-to-end — no floating-point dollars — so
// there is never fractional-cent drift. Rounds to the nearest minor unit.
export function computeCommissionMinor(billedMinor: number, bps: number): number {
  if (!Number.isFinite(billedMinor) || !Number.isFinite(bps)) return 0;
  if (billedMinor <= 0 || bps <= 0) return 0;
  return Math.round((billedMinor * bps) / 10000);
}

// The portion of `commissionMinor` to reverse when `refundedMinor` of the
// original `billedMinor` was refunded. Proportional and integer-safe; clamps to
// [0, commissionMinor] so a rounding artifact can never over-reverse.
export function proportionalReversalMinor(
  commissionMinor: number,
  refundedMinor: number,
  billedMinor: number,
): number {
  if (commissionMinor <= 0 || refundedMinor <= 0 || billedMinor <= 0) return 0;
  if (refundedMinor >= billedMinor) return commissionMinor;
  const reversal = Math.round((commissionMinor * refundedMinor) / billedMinor);
  return Math.max(0, Math.min(commissionMinor, reversal));
}

// -- Pure time helpers ------------------------------------------------------

// Whether a referral click at `firstTouchAt` converted to a registration at
// `conversionAt` inside the `windowDays` attribution window. Missing/invalid
// timestamps fail OPEN (return true) so a lost first-touch cookie never silently
// drops an otherwise-valid attribution — the window is an upper bound on a KNOWN
// gap, not a requirement that the gap be known.
export function isAttributionWithinWindow(
  firstTouchAt: string | number | Date | null | undefined,
  conversionAt: string | number | Date,
  windowDays: number,
): boolean {
  if (firstTouchAt == null) return true;
  const first = new Date(firstTouchAt).getTime();
  const conv = new Date(conversionAt).getTime();
  if (Number.isNaN(first) || Number.isNaN(conv)) return true;
  if (conv < first) return true; // clock skew — don't punish the referral
  const windowMs = Math.max(0, windowDays) * 24 * 60 * 60 * 1000;
  return conv - first <= windowMs;
}

// The ISO instant a commission earned at `earnedAt` clears its holding period.
export function computeHoldReleaseAt(earnedAt: string | number | Date, holdingDays: number): string {
  const base = new Date(earnedAt).getTime();
  const ms = (Number.isNaN(base) ? Date.now() : base) + Math.max(0, holdingDays) * 24 * 60 * 60 * 1000;
  return new Date(ms).toISOString();
}

// Add `months` calendar months to `startAt`, returning the ISO deadline. Used
// for the commission-duration window (first N months of a referee's invoices).
export function addMonthsIso(startAt: string | number | Date, months: number): string {
  const d = new Date(startAt);
  if (Number.isNaN(d.getTime())) return new Date().toISOString();
  d.setMonth(d.getMonth() + months);
  return d.toISOString();
}

// -- Privacy helpers --------------------------------------------------------

// Mask an email for privacy-conscious display of a referred customer, e.g.
// "jane.doe@example.com" -> "ja••@example.com". Never reveals the full local
// part. Falls back to a fully-masked token for degenerate inputs.
export function maskEmail(email: string | null | undefined): string {
  if (!email) return 'anonymous customer';
  const at = email.indexOf('@');
  if (at <= 0) return '••••';
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  const shown = local.slice(0, Math.min(2, local.length));
  return `${shown}${'•'.repeat(Math.max(2, local.length - shown.length))}@${domain}`;
}
