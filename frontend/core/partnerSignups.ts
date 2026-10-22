// Where each member who signed up under a Creator Partner stands now, as one
// short label, for `make partners SIGNUPS=1`.
//
// Built on the admin Total Subscribers chart's own rule (core/subscriberBucket.ts),
// so "Full Subscriber" here means exactly what it means on the dashboard: paying
// right now, with money cleared on the current subscription. The members the
// chart leaves out get a plainer label saying why.
//
// Kept PURE (no "@/" alias, no DB) so the standalone script can load it and
// tests/partnerSignups.test.ts can pin it.

import { classifySubscriberBucket, normalizeBucketTier } from './subscriberBucket.ts';

export type PartnerSignupInput = {
  deleted: boolean;
  tier: string | null;
  subscriptionStatus: string | null;
  paymentGraceReason: string | null;
  cancelAtPeriodEnd: boolean;
  subscriptionLapsed: boolean;
  stripeSubscriptionId: string | null;
  lastPaidSubscriptionId: string | null;
  lastPaidInvoiceAt: string | null;
};

export type PartnerSignupStatus = {
  label: string;
  /** On the dashboard's Full Subscriber line: paying right now. */
  paying: boolean;
};

export function partnerSignupStatus(input: PartnerSignupInput): PartnerSignupStatus {
  if (input.deleted) return { label: 'Deleted account', paying: false };

  const verdict = classifySubscriberBucket({
    subscriptionStatus: input.subscriptionStatus,
    tier: input.tier,
    paymentGraceReason: input.paymentGraceReason,
    cancelAtPeriodEnd: input.cancelAtPeriodEnd,
    stripeSubscriptionId: input.stripeSubscriptionId,
    lastPaidSubscriptionId: input.lastPaidSubscriptionId,
    lastPaidInvoiceAt: input.lastPaidInvoiceAt,
  });
  if (verdict.bucket !== 'notCounted') {
    return {
      label: input.cancelAtPeriodEnd ? `${verdict.label}, canceling` : verdict.label,
      paying: verdict.bucket === 'fullSubscriber',
    };
  }

  if (!input.stripeSubscriptionId) {
    if (input.subscriptionLapsed) return { label: 'Canceled', paying: false };
    // A paid tier with no subscription behind it was granted by hand: a comp,
    // or a creator grant of their own.
    const tier = normalizeBucketTier(input.tier);
    if (tier === 'pro' || tier === 'basic') return { label: 'Free access', paying: false };
    return { label: 'No plan', paying: false };
  }

  // A subscription the chart leaves out, for the reasons classifySubscriberBucket
  // gives: access withheld while the status says otherwise.
  switch (input.subscriptionStatus) {
    case 'trialing':
      return { label: 'Trial on hold (card setup)', paying: false };
    case 'active':
      return { label: 'Paused', paying: false };
    case 'past_due':
      return { label: 'Past due', paying: false };
    case 'incomplete':
      return { label: 'Checkout incomplete', paying: false };
    default:
      return { label: input.subscriptionStatus ?? 'Unknown', paying: false };
  }
}
