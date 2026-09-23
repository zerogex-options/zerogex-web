// Referee (the newly-referred friend) discount coupon, keyed by the cadence
// they buy (STRIPE_COUPON_REFERRAL_REFEREE_<CADENCE>):
//   monthly   -> "first month free"  (a 100%-off, duration:once coupon)
//   quarterly -> whatever the operator configures; unset by default
//   annual    -> "10% off first year" (a 10%-off, duration:once coupon)
// Returns null when not configured for that cadence, in which case checkout
// simply proceeds without a referral discount. Quarterly deliberately has its
// own key rather than borrowing another cadence's coupon: the monthly one is
// 100% off (a free QUARTER on a quarterly invoice) and the annual one is named
// "first year" on the Stripe checkout page.
//
// Its own module (re-exported by core/referrals.ts) so core/switchDiscounts.ts
// stays importable from operator scripts, which can't pull in referrals' db and
// mailer imports.

import type { BillingCadence } from './billingPlans.ts';

export function getRefereeCouponId(cadence: BillingCadence): string | null {
  const id = process.env[`STRIPE_COUPON_REFERRAL_REFEREE_${cadence.toUpperCase()}`];
  return id && id.trim().length > 0 ? id.trim() : null;
}
