// Which post-checkout banner copy a just-returned member sees, decided from the
// `trial` query param that app/api/billing/checkout/route.ts writes into
// Stripe's success_url alongside the load-bearing `trial_started=1`.
//
// Kept in a plain .ts module — no JSX, no 'use client' — so the node test
// runner can import it directly (see tests/trialStartedBanner.test.ts), the
// same split app/backtesting/insights/view.ts uses.
//
// Checkout grants three materially different things, and the banner used to
// greet all three with "your 7-day free trial is now active. No charge until
// day 7":
//
//   days      a day-count trial — the standard TRIAL_PERIOD_DAYS, or the
//             longer REACTIVATION_TRIAL_DAYS a cold signup is invited back
//             with (default 30). The only case that may name a number, and the
//             case the old copy got wrong by three weeks.
//   deferred  the founding absolute trial_end: a real trial, but one that ends
//             on a fixed calendar date rather than after a length.
//   none      no trial at all — a returning ex-subscriber is charged at
//             checkout (the once-per-account trial gate), so "no charge until
//             day 7" was not merely imprecise for them, it was false.
export type TrialStartedCopy =
  | { variant: 'days'; days: number }
  | { variant: 'deferred' }
  | { variant: 'none' };

// Widest trial we will print a number for. Far above anything checkout can
// actually grant (REACTIVATION_TRIAL_DAYS is clamped to 90); it exists so a
// hand-edited URL can't put an arbitrary figure in front of the member.
const MAX_NAMEABLE_TRIAL_DAYS = 365;

export function resolveTrialStartedCopy(param: string | null): TrialStartedCopy {
  if (param === 'none') return { variant: 'none' };
  const days = Number(param);
  if (Number.isInteger(days) && days >= 1 && days <= MAX_NAMEABLE_TRIAL_DAYS) {
    return { variant: 'days', days };
  }
  // 'deferred', absent (a checkout session created before this param shipped
  // can still land here for up to a day), or anything unrecognized. Naming no
  // length is true of every trial, so it is the safe landing spot for whatever
  // we cannot read — a wrong day count is a billing promise, a missing one is
  // only vaguer.
  return { variant: 'deferred' };
}
