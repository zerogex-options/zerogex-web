import { getActivePromoCouponId, getActivePromoDeadlineLabel } from '@/core/stripe';
import { isReferralProgramEnabled } from '@/core/referrals';
import PricingClient from './Client';

export const metadata = {
  title: 'Pricing — ZeroGEX',
  description:
    'ZeroGEX paid plans. Monthly and annual billing for Basic and Pro tiers.',
  alternates: { canonical: '/pricing' },
};

// Public pricing page. Reads env state server-side (active promo coupon
// configuration per cadence) and hands the client just enough to render the
// right CTAs. The actual price-charged decision is always the server's: the
// client passes (tier, cadence) and the /api/billing/checkout route resolves
// the Stripe price ID + applicable coupon.
//
// The founding-member rate has its own page at /founding (server-gated by
// FOUNDING_PROMO_CODE env) — we don't surface a "Founding member?" code
// input here so the public pricing page reads clean.
export default function PricingPage() {
  const promoMonthlyActive =
    getActivePromoCouponId({ tier: 'basic', cadence: 'monthly' }) !== null &&
    getActivePromoCouponId({ tier: 'pro', cadence: 'monthly' }) !== null;
  const promoAnnualActive =
    getActivePromoCouponId({ tier: 'basic', cadence: 'annual' }) !== null &&
    getActivePromoCouponId({ tier: 'pro', cadence: 'annual' }) !== null;
  const promoDeadlineLabel = getActivePromoDeadlineLabel();

  return (
    <PricingClient
      promoMonthlyActive={promoMonthlyActive}
      promoAnnualActive={promoAnnualActive}
      promoDeadlineLabel={promoDeadlineLabel}
      referralEnabled={isReferralProgramEnabled()}
    />
  );
}
