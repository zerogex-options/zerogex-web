import { cookies } from 'next/headers';
import { getActivePromoCouponId, getActivePromoDeadlineLabel } from '@/core/stripe';
import { isReferralProgramEnabled } from '@/core/referrals';
import { normalizeCampaignCode } from '@/core/campaigns';
import { REFERRAL_COOKIE_NAME } from '@/core/serverAuth';
import PricingClient from './Client';
import { getServerT } from '@/core/localizedContent';
import { dict as metaDict } from './meta.i18n';
import type { Metadata } from 'next';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getServerT(metaDict);
  return {
    title: t('title'),
    description: t('description'),
    alternates: { canonical: '/pricing' },
  };
}

// Public pricing page. Reads env state server-side (active promo coupon
// configuration per cadence) and hands the client just enough to render the
// right CTAs. The actual price-charged decision is always the server's: the
// client passes (tier, cadence) and the /api/billing/checkout route resolves
// the Stripe price ID + applicable coupon.
//
// The founding-member rate has its own page at /founding (server-gated by
// FOUNDING_PROMO_CODE env) — we don't surface a "Founding member?" code
// input here so the public pricing page reads clean.
export default async function PricingPage() {
  const promoMonthlyActive =
    getActivePromoCouponId({ tier: 'basic', cadence: 'monthly' }) !== null &&
    getActivePromoCouponId({ tier: 'pro', cadence: 'monthly' }) !== null;
  const promoAnnualActive =
    getActivePromoCouponId({ tier: 'basic', cadence: 'annual' }) !== null &&
    getActivePromoCouponId({ tier: 'pro', cadence: 'annual' }) !== null;
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
      promoMonthlyActive={promoMonthlyActive}
      promoAnnualActive={promoAnnualActive}
      promoDeadlineLabel={promoDeadlineLabel}
      referralEnabled={isReferralProgramEnabled()}
      campaignActive={campaignActive}
    />
  );
}
