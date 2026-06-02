import { notFound } from 'next/navigation';
import {
  getActivePromoCouponId,
  getFoundingIntroCouponId,
  getFoundingPromoCode,
} from '@/core/stripe';
import FoundingClient from './Client';

export const metadata = {
  title: 'Founding Member Activation — ZeroGEX',
  robots: { index: false, follow: false },
};

// Convenience landing page for the founding-member cohort. Reads
// FOUNDING_PROMO_CODE server-side and hands it to the client so the
// /api/billing/checkout call auto-includes it — eligible users get the
// $12/$19 intro rate without ever typing the code. Eligibility itself
// is enforced server-side (users.founding_eligible=1); non-eligible
// visitors who land here see the same UI but get a 403 on submit.
//
// Hidden from sitemap and search engines (noindex,nofollow). 404s when
// the founding flow isn't fully configured so the URL leaks no signal.
export default function FoundingPage() {
  const foundingCode = getFoundingPromoCode();
  const basicMonthlyCoupon = getFoundingIntroCouponId('basic', 'monthly');
  const proMonthlyCoupon = getFoundingIntroCouponId('pro', 'monthly');
  // Founding is "configured" only when the code AND both monthly intro coupons
  // exist. Missing either means subscribe-side will 500 — better to 404 the
  // page. Annual coupons are opt-in: when both basic + pro annual coupons are
  // present the client renders the cadence toggle; otherwise the page renders
  // monthly-only.
  if (!foundingCode || !basicMonthlyCoupon || !proMonthlyCoupon) {
    notFound();
  }
  const basicAnnualCoupon = getFoundingIntroCouponId('basic', 'annual');
  const proAnnualCoupon = getFoundingIntroCouponId('pro', 'annual');
  const annualEnabled = !!basicAnnualCoupon && !!proAnnualCoupon;

  const promoActive = getActivePromoCouponId({ tier: 'basic', cadence: 'monthly' }) !== null;
  return (
    <FoundingClient
      foundingCode={foundingCode}
      promoActive={promoActive}
      annualEnabled={annualEnabled}
    />
  );
}
