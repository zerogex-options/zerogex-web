// The /register link a logged-out visitor follows from a plan card on /pricing.
// It returns them to /pricing with the same plan and billing period selected,
// and with whichever offer they arrived through.
//
// The offer flags are the only thing that tells checkout the visitor came in
// through a win-back (?winback=1) or reactivation (?reactivate=1) email; the
// server then re-verifies eligibility itself. A link that drops one turns a
// promised offer into a full-price charge without any error. The plan cards'
// link carried reactivate but not winback, so members who clicked the win-back
// email while logged out, then picked a plan, came back from sign-in without
// the flag and paid full price.
//
// Pure, so tests/pricingLinks.test.ts can check it without rendering the page.

import type { BillableTier, BillingCadence } from './billingPlans.ts';

export function planRegisterHref(input: {
  tier: BillableTier;
  cadence: BillingCadence;
  winback: boolean;
  reactivate: boolean;
}): string {
  const params = new URLSearchParams({ trial: '1', plan: input.tier, cadence: input.cadence });
  if (input.reactivate) params.set('reactivate', '1');
  if (input.winback) params.set('winback', '1');
  return `/register?next=${encodeURIComponent(`/pricing?${params.toString()}`)}`;
}
