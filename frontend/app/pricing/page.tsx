import { getActivePromoCouponId } from '@/core/stripe';
import { isReferralProgramEnabled } from '@/core/referrals';
import PricingClient from './Client';

export const metadata = {
  title: 'Pricing — ZeroGEX',
  description:
    'ZeroGEX paid plans. Monthly and annual billing for Basic and Pro tiers.',
  alternates: { canonical: '/pricing' },
};

// Public pricing page. Reads env state server-side (active promo coupon
// configuration) and hands the client just enough to render the right CTAs.
// The actual price-charged decision is always the server's: the client
// passes (tier, cadence) and the /api/billing/checkout route resolves the
// Stripe price ID + applicable coupon.
//
// The founding-member rate has its own page at /founding (server-gated by
// FOUNDING_PROMO_CODE env) — we don't surface a "Founding member?" code
// input here so the public pricing page reads clean.
export default function PricingPage() {
  const promoActive = getActivePromoCouponId({ tier: 'basic', cadence: 'monthly' }) !== null;

  return <PricingClient promoActive={promoActive} referralEnabled={isReferralProgramEnabled()} />;
}
