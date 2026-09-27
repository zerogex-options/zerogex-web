import type { TierId } from '@/core/auth';
// Relative with the extension, not '@/': tests/proWelcome.test.ts loads this
// file under bare node --test, which resolves neither the alias nor a
// suffix-less path (the type-only import above is erased, so it is fine).
import { isNewMember } from './newMember.ts';

// sessionStorage flag, set once the welcome has been shown in this browser
// session. A client-only backstop so that if the server "seen" write fails, the
// modal still can't re-pop on the next client-side navigation within the tab.
// The authoritative one-time gates are the server columns (pro_welcome_seen_at
// and basic_welcome_seen_at).
export const PRO_WELCOME_SESSION_KEY = 'zgx.proWelcomeShown';

// Minimal shape the eligibility check needs. Kept loose so the client session
// user (hooks/useAuthSession) can be passed straight through.
export type WelcomeUser = {
  tier: TierId;
  hasActiveSubscription?: boolean;
  proWelcomeSeenAt?: string | null;
  basicWelcomeSeenAt?: string | null;
  memberSince?: string | null;
};

// Whether the one-time first-run welcome (components/ProWelcomeModal: asks
// which market they trade, points them at the Signal Dashboard, and for Pro
// announces self-service API keys) should greet this user.
//
//   - pro: a live Stripe subscription and pro_welcome_seen_at unset, as it has
//     been since launch. That column was backfilled for the paid base when it
//     shipped, so it greets members who subscribe after that, including a
//     Basic member who upgrades.
//   - basic: a live subscription, basic_welcome_seen_at unset, AND a new
//     member (first subscribed within core/newMember's window). The new-member
//     gate is what keeps it off Basic members who have been here for months;
//     the column needs no backfill. Since 2026-09-22 the only free trial is
//     Basic monthly, so without this branch no trialer saw any orientation.
//   - public / admin / grandfathered (no Stripe sub): never.
export function isWelcomeEligible(
  user: WelcomeUser | null | undefined,
  nowMs: number = Date.now(),
): boolean {
  if (!user || user.hasActiveSubscription !== true) return false;
  if (user.tier === 'pro') return !user.proWelcomeSeenAt;
  if (user.tier === 'basic') {
    return !user.basicWelcomeSeenAt && isNewMember(user.memberSince, nowMs);
  }
  return false;
}
