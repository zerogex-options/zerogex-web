import type { Metadata } from 'next';
import { isReferralProgramEnabled } from '@/core/referrals';
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
export default function RegisterPage() {
  return <RegisterClient referralEnabled={isReferralProgramEnabled()} />;
}
