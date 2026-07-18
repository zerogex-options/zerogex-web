import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { isReferralProgramEnabled } from '@/core/referrals';
import { normalizeCampaignCode } from '@/core/campaigns';
import { REFERRAL_COOKIE_NAME } from '@/core/serverAuth';
import RegisterClient from './RegisterClient';

// noindex,follow so Google can crawl /register, see the directive, and drop
// any externally-discovered variants from the index (the same fix applied
// to /login). Robots.txt no longer blocks the route, otherwise the meta tag
// here would never reach Googlebot.
export const metadata: Metadata = {
  robots: { index: false, follow: true },
};

// Server component: reads the server-only REFERRAL_PROGRAM_ENABLED flag and
// hands it to the client form so the "you were referred" banner only shows
// when the program is actually live (otherwise we'd promise a discount that
// checkout won't apply).
//
// It also classifies the inbound ?ref= (or the persisted zgx_ref cookie) as a
// CAMPAIGN code (business-card / offline collateral, e.g. ?ref=TARGET) vs a
// person-to-person referral. Campaign codes resolve to a coupon, not a
// referrer, so they must NOT show the "a friend referred you" copy — the
// client swaps in a neutral discount banner instead. Only the server can tell
// them apart (campaign codes live in STRIPE_CAMPAIGN_* env).
export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const cookieStore = await cookies();
  const rawRef =
    (typeof params.ref === 'string' ? params.ref : null) ??
    cookieStore.get(REFERRAL_COOKIE_NAME)?.value ??
    null;
  const campaignActive = normalizeCampaignCode(rawRef) !== null;

  return (
    <RegisterClient
      referralEnabled={isReferralProgramEnabled()}
      campaignActive={campaignActive}
    />
  );
}
