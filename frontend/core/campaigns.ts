// Relative imports only: core/switchDiscounts.ts imports this module, and the
// operator scripts load that one under plain node.
import type { BillingCadence } from './billingPlans.ts';

// Campaign codes are marketing codes printed on physical / offline collateral —
// e.g. the business-card QR points at `/register?ref=TARGET`. Unlike referral
// codes they do NOT belong to a referrer user: they resolve straight to a
// Stripe coupon and are recorded on the buyer's `referred_by_code` purely for
// attribution / reporting. Everything is env-driven, so launching a new
// campaign needs no code change:
//
//   STRIPE_CAMPAIGN_<CODE>_MONTHLY   = <stripe coupon id>
//   STRIPE_CAMPAIGN_<CODE>_QUARTERLY = <stripe coupon id>   (optional)
//   STRIPE_CAMPAIGN_<CODE>_ANNUAL    = <stripe coupon id>
//
// e.g. the card promo (50% off the first year, code TARGET):
//   STRIPE_CAMPAIGN_TARGET_MONTHLY   = <50%-off coupon, duration: repeating, 12 months>
//   STRIPE_CAMPAIGN_TARGET_QUARTERLY = <the same coupon: 12 months covers four quarterly bills>
//   STRIPE_CAMPAIGN_TARGET_ANNUAL    = <50%-off coupon, duration: once>
//
// A campaign may configure only one cadence; the other simply gets no campaign
// discount. Codes are case-insensitive and restricted to A-Z0-9. Restricting a
// code to first-time customers / capping redemptions / expiring it is done on
// the Stripe coupon (or its promotion code), not here.
//
// A campaign rate is exclusive: the public promo never stacks on it, neither at
// checkout (resolveDiscount in app/api/billing/checkout/route.ts) nor on a later
// plan switch (core/switchDiscounts.ts).

const CADENCES: readonly BillingCadence[] = ['monthly', 'quarterly', 'annual'];

function envKey(code: string, cadence: BillingCadence): string {
  return `STRIPE_CAMPAIGN_${code}_${cadence.toUpperCase()}`;
}

function couponFor(code: string, cadence: BillingCadence): string | null {
  const value = process.env[envKey(code, cadence)];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

// Canonical (upper-cased) code when at least one cadence coupon is configured
// for it, else null. This is what makes a `?ref=` value "a campaign" rather
// than a referral code or noise.
export function normalizeCampaignCode(code: string | null | undefined): string | null {
  if (!code) return null;
  const normalized = code.trim().toUpperCase();
  if (!/^[A-Z0-9]+$/.test(normalized)) return null;
  return CADENCES.some((cadence) => couponFor(normalized, cadence)) ? normalized : null;
}

export function isCampaignCode(code: string | null | undefined): boolean {
  return normalizeCampaignCode(code) !== null;
}

// Stripe coupon id for this campaign + cadence, or null when the campaign
// isn't configured for that cadence.
export function getCampaignCouponId(
  code: string | null | undefined,
  cadence: BillingCadence,
): string | null {
  const normalized = normalizeCampaignCode(code);
  return normalized ? couponFor(normalized, cadence) : null;
}

// Every campaign coupon configured in env, across all codes and cadences. A plan
// switch reads it to recognize a member on a campaign rate, who must not be
// given the public promo on top.
export function getCampaignCouponIds(): string[] {
  const ids = new Set<string>();
  for (const key of Object.keys(process.env)) {
    const match = /^STRIPE_CAMPAIGN_([A-Z0-9]+)_(MONTHLY|QUARTERLY|ANNUAL)$/.exec(key);
    if (!match) continue;
    const coupon = couponFor(match[1], match[2].toLowerCase() as BillingCadence);
    if (coupon) ids.add(coupon);
  }
  return [...ids];
}
