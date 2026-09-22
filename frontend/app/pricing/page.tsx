import { cookies } from 'next/headers';
import {
  BILLABLE_TIERS,
  BILLING_CADENCES,
  getActivePromoCouponId,
  getActivePromoDeadlineLabel,
  getSellableCadences,
  getTrialPlans,
  type BillingCadence,
} from '@/core/stripe';
import { isReferralProgramEnabled } from '@/core/referrals';
import { normalizeCampaignCode } from '@/core/campaigns';
import { REFERRAL_COOKIE_NAME } from '@/core/serverAuth';
import PricingClient from './Client';

// /pricing takes ~4,400 search impressions a quarter at position ~3 (it is a
// brand sitelink) and converts about 1% of them. The snippet names what the
// plans buy, the trial and the guarantee.
export const metadata = {
  title: 'ZeroGEX Pricing: Basic & Pro Plans, 7-Day Free Trial',
  description:
    'ZeroGEX pricing: Basic and Pro plans for real-time GEX, dealer positioning and signals on SPX, SPY, QQQ and NDX. 7-day free trial on Basic, 7-day money-back guarantee on every other plan. Monthly, quarterly or annual billing.',
  alternates: { canonical: '/pricing' },
};

// Public pricing page. Reads env state server-side (active promo coupon
// configuration per cadence, which billing periods have Stripe prices, which
// plans trial) and hands the client just enough to render the right CTAs. The
// actual price-charged decision is always the server's: the client passes
// (tier, cadence) and the /api/billing/checkout route resolves the Stripe price
// ID, the trial and the applicable coupon.
//
// The founding-member rate has its own page at /founding (server-gated by
// FOUNDING_PROMO_CODE env) — we don't surface a "Founding member?" code
// input here so the public pricing page reads clean.
export default async function PricingPage() {
  // A cadence's promo is live only when BOTH tiers carry the coupon — the page
  // shows one offer per cadence, never a half-configured one.
  const promoActiveByCadence = Object.fromEntries(
    BILLING_CADENCES.map((cadence) => [
      cadence,
      BILLABLE_TIERS.every((tier) => getActivePromoCouponId({ tier, cadence }) !== null),
    ]),
  ) as Record<BillingCadence, boolean>;
  const promoDeadlineLabel = getActivePromoDeadlineLabel();

  // A campaign visitor (business-card ?ref=TARGET) carries the zgx_ref cookie
  // set on /register. Classify it server-side so the client shows the neutral
  // discount banner rather than the person-to-person "a friend referred you"
  // copy — campaign codes resolve to a coupon, not a referrer.
  const cookieStore = await cookies();
  const campaignActive =
    normalizeCampaignCode(cookieStore.get(REFERRAL_COOKIE_NAME)?.value ?? null) !== null;

  return (
    <PricingClient
      promoActiveByCadence={promoActiveByCadence}
      promoDeadlineLabel={promoDeadlineLabel}
      sellableCadences={getSellableCadences()}
      trialPlanKeys={[...getTrialPlans()]}
      referralEnabled={isReferralProgramEnabled()}
      campaignActive={campaignActive}
    />
  );
}
