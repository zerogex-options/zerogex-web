import { notFound } from 'next/navigation';
import {
  getActivePromoCouponId,
  getFoundingPromoCode,
} from '@/core/stripe';
import PreviewClient from './Client';

export const metadata = {
  title: 'Early Access — ZeroGEX',
  robots: { index: false, follow: false },
};

// Hidden paid-pricing page used to onboard hand-picked subscribers before
// the public /pricing page is flipped over to paid. Soft-gated by the
// EARLY_ACCESS_KEY env compared against ?key=<token>; mismatch renders the
// standard Next 404 (notFound()) so the URL gives no signal that the page
// exists. Server reads env state and hands the client just what it needs.
export default async function PreviewPage({
  searchParams,
}: {
  searchParams: Promise<{ key?: string | string[] }>;
}) {
  const expectedKey = process.env.EARLY_ACCESS_KEY;
  const params = await searchParams;
  const provided = typeof params.key === 'string' ? params.key : null;

  if (!expectedKey || !provided || provided !== expectedKey) {
    notFound();
  }

  // getActivePromoCouponId already checks that PROMO_END_AT is in the future
  // and that the monthly promo coupon is configured — it returns null
  // otherwise. Reusing it here means the page itself never touches Date.now()
  // (which the react-hooks/purity lint rule flags even in Server Components).
  const promoActive = getActivePromoCouponId({ tier: 'basic', cadence: 'monthly' }) !== null;

  return (
    <PreviewClient
      accessKey={provided}
      promoActive={promoActive}
      foundingCodeConfigured={getFoundingPromoCode() !== null}
    />
  );
}
