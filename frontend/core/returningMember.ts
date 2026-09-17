// Pure decision logic for the ACCESS WALL at /unauthorized — specifically, which
// of its audiences a visitor belongs to and what the page may honestly promise
// them.
//
// Why this exists: the wall used to branch on nothing but the querystring, and
// showed every logged-in Public user the same screen — "Start your ZeroGEX trial
// … 7-day free trial. No charge until day 7." That copy is false for anyone who
// has paid before. /api/billing/checkout suppresses the trial for them
// (hasPriorPaid), and app/pricing/Client.tsx already knows it (isResubscribe →
// startsTrial={false}), so a returning member was promised a free trial by one
// page and charged immediately by the next. That is the worst possible moment to
// break a promise: they are a former customer who came back on their own.
//
// Kept PURE (no imports at all) so the decision is unit-tested without a session,
// a DB, or Next.js — the same discipline as core/cancelRetention.ts and
// core/foundingRestore.ts. Locked down in tests/returningMember.test.ts.

export type WallAudience =
  // Logged-in, unentitled, and has paid before: a former customer who came back.
  // Never promised a trial; offered a resubscribe instead.
  | 'returning'
  // Logged-in, unentitled, never paid: the post-registration funnel leak the
  // trial screen was built for. Keeps it.
  | 'newcomer'
  // A Basic member reaching for a Pro page. Wants an upgrade, not a plan.
  | 'upgrade'
  // Everything else (an entitled member on an odd route, an unresolvable state).
  | 'denied';

export type WallInput = {
  // The visitor's tier as read from THEIR SESSION, not from `?current=`. The
  // querystring is visitor-controlled: trusting it lets anyone hand themselves
  // the upgrade screen, and — more importantly here — lets a stale link show a
  // paying member the subscribe wall. Null when no session resolved.
  sessionTier: string | null;
  // The tier the route demands, from `?required=`. Visitor-controlled too, but
  // harmless: it only picks which plan the copy names, and the middleware — not
  // this page — is what actually enforces access.
  requiredTier: string | null;
  // session.user.hasPriorPaid — true iff the account has ever held a paid
  // subscription (stamped paid welcome, or the churn flag). Null when no session
  // resolved, which is NOT the same as false; see promiseTrial below.
  hasPriorPaid: boolean | null;
  // session.user.foundingMember — a redeemed founding rate, which survives a
  // lapse. Mirrors core/foundingRestore.ts's gate.
  foundingMember: boolean;
};

export type WallDecision = {
  audience: WallAudience;
  // Whether the page may say the words "free trial".
  //
  // ONLY ever true when we positively know the visitor is trial-eligible — a
  // resolved session that has never paid. An unresolved session degrades to
  // false and the page renders neutral "choose a plan" copy, because the two
  // failure modes are not symmetric: showing a newcomer plan copy costs them
  // nothing (/pricing still offers them the trial one click later), while
  // showing a returning member trial copy re-creates the exact broken promise
  // this module exists to prevent.
  promiseTrial: boolean;
  // Whether to tell a returning founder their locked-in rate is still theirs.
  // True only for the returning audience: it is a resubscribe fact, and on any
  // other screen it is noise at best and confusing at worst.
  showFoundingRestore: boolean;
};

// Tiers that grant paid access. A visitor sitting on one of these is not
// looking at a subscribe wall, whatever the querystring claims.
const ENTITLED_TIERS = new Set(['basic', 'pro', 'admin']);
// The two tiers a route can demand that a Public visitor buys their way into.
const PURCHASABLE_TIERS = new Set(['basic', 'pro']);

export function resolveWall(input: WallInput): WallDecision {
  const required = input.requiredTier ?? 'basic';
  // No session → fall back to treating them as unentitled, since proxy.ts only
  // routes AUTHENTICATED visitors here (anonymous ones go to /login). A session
  // that failed to resolve is a cookie/read race, not an anonymous visitor.
  const tier = input.sessionTier ?? 'public';

  const needsSubscription = !ENTITLED_TIERS.has(tier) && PURCHASABLE_TIERS.has(required);
  const needsUpgrade = tier === 'basic' && required === 'pro';

  if (needsSubscription) {
    // hasPriorPaid === true  → returning. They cannot have a trial.
    // hasPriorPaid === false → newcomer. They can, and we say so.
    // hasPriorPaid === null  → unresolved. Treat as a newcomer for layout (the
    //   plan chooser is the right screen either way) but promise nothing.
    const returning = input.hasPriorPaid === true;
    return {
      audience: returning ? 'returning' : 'newcomer',
      promiseTrial: input.hasPriorPaid === false,
      showFoundingRestore: returning && input.foundingMember,
    };
  }

  if (needsUpgrade) {
    return { audience: 'upgrade', promiseTrial: false, showFoundingRestore: false };
  }

  return { audience: 'denied', promiseTrial: false, showFoundingRestore: false };
}

// Where the plan chooser should send this audience.
//
// The returning member skips the trial-flavoured entry point entirely:
// `?trial=1` makes /pricing render its trial hero, which is the same false
// promise in a different place. `?winback=1` is deliberately NOT added here —
// that parameter attaches a discount coupon at checkout, and a member who
// walked back to the site on their own does not need to be paid to return.
// Discounting them would erode the margin on someone already converting, the
// same reasoning core/trialOffer.ts applies to stacking a second coupon.
export function pricingHrefFor(decision: WallDecision, plan?: 'basic' | 'pro'): string {
  const params: string[] = [];
  if (decision.promiseTrial) params.push('trial=1');
  if (plan) params.push(`plan=${plan}`);
  return params.length > 0 ? `/pricing?${params.join('&')}` : '/pricing';
}
