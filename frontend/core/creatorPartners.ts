import { getDb } from '@/core/db';
import type { BillingCadence } from '@/core/stripe';

// Master switch. The whole program is inert (no creator-tier flips, no
// audience coupons applied at checkout, no commissions accrued) unless the
// operator opts in, mirroring isReferralProgramEnabled().
export function isCreatorPartnerProgramEnabled(): boolean {
  return process.env.CREATOR_PARTNER_PROGRAM_ENABLED === '1';
}

export type CreatorPartnerRow = {
  id: string;
  email: string;
  referral_code: string | null;
  partner_tier: string | null;
  partner_commission_bps: number;
  partner_commission_window_months: number;
  partner_audience_coupon_id: string | null;
  partner_audience_promo_code: string | null;
  partner_disclosure_url: string | null;
  partner_activated_at: string | null;
  partner_pro_grant_expires_at: string | null;
};

const PARTNER_SELECT_COLUMNS = `
  id, email, referral_code, partner_tier, partner_commission_bps,
  partner_commission_window_months, partner_audience_coupon_id,
  partner_audience_promo_code, partner_disclosure_url, partner_activated_at,
  partner_pro_grant_expires_at
`;

// True only when the user's partner_tier was set by the grant script AND the
// program is enabled. Returning false when disabled is intentional: it makes
// every partner-only code path a no-op the moment the kill switch is flipped.
export function isCreatorPartner(row: { partner_tier: string | null } | null | undefined): boolean {
  if (!isCreatorPartnerProgramEnabled()) return false;
  return row?.partner_tier === 'creator';
}

// Resolve a referral code to the creator partner who owns it, if any. Used
// at checkout to decide whether to apply the partner audience coupon vs. the
// standard referee coupon. Returns null for unknown codes, codes owned by
// standard (non-creator) users, or when the program is disabled.
//
// Matches against BOTH the 8-char auto-minted `referral_code` and the
// human-readable `partner_audience_promo_code`, so the same code works in
// `?ref=` whether the creator shared their link or just told their audience
// "use code SPYLEVELS25". The two columns are independently unique and
// belong to disjoint sets of users (only partners have the promo column
// populated), so a single OR query is unambiguous.
export function findCreatorByReferralCode(code: string): CreatorPartnerRow | null {
  if (!isCreatorPartnerProgramEnabled()) return null;
  const normalized = code.trim().toUpperCase();
  if (!normalized) return null;
  const row = getDb()
    .prepare(
      `SELECT ${PARTNER_SELECT_COLUMNS}
       FROM users
       WHERE partner_tier = 'creator'
         AND (referral_code = ? OR partner_audience_promo_code = ?)`,
    )
    .get(normalized, normalized) as CreatorPartnerRow | undefined;
  return row ?? null;
}

// Resolve a Stripe promotion_code's metadata.partner_user_id back to the
// partner record. Used by the webhook back-attribution path so an audience
// member who skipped the `?ref=` link and typed the code at Stripe's
// checkout still gets attributed to the right partner. Defensive: returns
// null if the id isn't a real partner (e.g. a stale promotion code that
// outlived its partner's account).
export function findCreatorByUserId(userId: string): CreatorPartnerRow | null {
  if (!isCreatorPartnerProgramEnabled()) return null;
  const row = getDb()
    .prepare(
      `SELECT ${PARTNER_SELECT_COLUMNS}
       FROM users
       WHERE id = ? AND partner_tier = 'creator'`,
    )
    .get(userId) as CreatorPartnerRow | undefined;
  return row ?? null;
}

// The Stripe coupon ID to apply to a checkout where the referrer is a
// creator partner. Per-partner override wins so a top-tier creator can be
// given a richer audience deal; falls back to the global env coupon. The
// partner-audience coupon is recommended to be `duration:repeating,
// duration_in_months:3` for 25% off the first three months, monthly cadence
// only — see .env.example.
//
// Returns null for annual cadence: the partner offer is designed around the
// monthly path. An annual referee under a creator falls through to the
// standard annual referee coupon (or none).
export function getPartnerAudienceCouponId(
  partner: CreatorPartnerRow,
  cadence: BillingCadence,
): string | null {
  if (cadence !== 'monthly') return null;
  if (partner.partner_audience_coupon_id) return partner.partner_audience_coupon_id;
  const globalId = process.env.STRIPE_COUPON_PARTNER_AUDIENCE;
  return globalId && globalId.length > 0 ? globalId : null;
}
