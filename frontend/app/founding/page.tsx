import { notFound } from 'next/navigation';
import {
  getActivePromoCouponId,
  getFoundingIntroCouponId,
  getFoundingPromoCode,
} from '@/core/stripe';
import { isFoundingLockinOpen } from '@/core/foundingLockin';
import FoundingClient from './Client';
import { dict as metaDict } from './meta.i18n';
import { getServerT } from '@/core/localizedContent';
import type { Metadata } from 'next';

// Cache the page for at most 60s so the 404 cut-over at the deadline lands
// quickly even if Next.js has the route statically cached from a build that
// pre-dates the deadline crossing. (Default revalidate would be permanent for
// a page with no other dynamic inputs.)
export const revalidate = 60;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getServerT(metaDict);
  return {
    title: t('title'),
    robots: { index: false, follow: false },
    alternates: { canonical: '/founding' },
  };
}

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
  // Hard cutoff: after FOUNDING_LOCKIN_DEADLINE_ISO the lock-in offer is
  // gone (checkout API would no longer mint the deferred-July-1 trial), so
  // the page should stop advertising "lock in your founding rate" and
  // "first payment isn't until July 1, 2026". 404 rather than render a
  // closed-state message — it matches the noindex/nofollow stance of this
  // route (the URL was never meant to be discoverable) and bounces stale
  // links cleanly to /pricing.
  if (!isFoundingLockinOpen()) {
    notFound();
  }
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
