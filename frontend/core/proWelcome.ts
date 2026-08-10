import type { TierId } from '@/core/auth';

// sessionStorage flag, set once the Pro welcome has been shown in this browser
// session. A client-only backstop so that if the server "seen" write fails, the
// modal still can't re-pop on the next client-side navigation within the tab.
// The authoritative one-time gate is the server column (pro_welcome_seen_at).
export const PRO_WELCOME_SESSION_KEY = 'zgx.proWelcomeShown';

// Minimal shape the eligibility check needs. Kept loose so the client session
// user (hooks/useAuthSession) can be passed straight through.
export type ProWelcomeUser = {
  tier: TierId;
  hasActiveSubscription?: boolean;
  proWelcomeSeenAt?: string | null;
};

// Whether the one-time "Welcome to Pro" onboarding modal (which announces
// self-service API-key generation) should greet this user. It fires for a Pro
// member with a live Stripe subscription who hasn't seen it yet — i.e. on their
// first landing back after the checkout redirect. Excluded by design:
//   - basic / public: not a Pro benefit.
//   - admin: granted, never subscribed — no active subscription, and the
//     "welcome to your trial" framing doesn't apply.
//   - grandfathered Pro (tier=pro, no Stripe sub): the active-subscription gate
//     drops them, matching "when they first subscribe for a trial".
// The seen-stamp (server column, backfilled for the existing paid base) makes
// it strictly one-time and scopes it to members who subscribe after launch.
export function isProWelcomeEligible(user: ProWelcomeUser | null | undefined): boolean {
  if (!user) return false;
  return user.tier === 'pro' && user.hasActiveSubscription === true && !user.proWelcomeSeenAt;
}
