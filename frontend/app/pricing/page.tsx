import { getActivePromoCouponId, getFoundingPromoCode } from '@/core/stripe';
import PricingClient from './Client';

export const metadata = {
  title: 'Pricing — ZeroGEX',
  description:
    'ZeroGEX paid plans. Monthly and annual billing for Basic and Pro tiers, with a founding-member discount for existing accounts.',
};

// Public pricing page. Reads env state server-side (active promo coupon
// configuration, whether the founding code is configured) and hands the
// client just enough to render the right CTAs. The actual price-charged
// decision is always the server's: the client passes (tier, cadence,
// foundingCode?) and the /api/billing/checkout route resolves the Stripe
// price ID + applicable coupon.
export default function PricingPage() {
  const promoActive = getActivePromoCouponId({ tier: 'basic', cadence: 'monthly' }) !== null;
  const foundingCodeConfigured = getFoundingPromoCode() !== null;

  return <PricingClient promoActive={promoActive} foundingCodeConfigured={foundingCodeConfigured} />;
}
