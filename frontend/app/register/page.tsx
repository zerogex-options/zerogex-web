import { isReferralProgramEnabled } from '@/core/referrals';
import RegisterClient from './RegisterClient';

// Server component: reads the server-only REFERRAL_PROGRAM_ENABLED flag and
// hands it to the client form so the "you were referred" banner only shows
// when the program is actually live (otherwise we'd promise a discount that
// checkout won't apply).
export default function RegisterPage() {
  return <RegisterClient referralEnabled={isReferralProgramEnabled()} />;
}
