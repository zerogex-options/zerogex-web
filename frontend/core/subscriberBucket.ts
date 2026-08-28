// Which line of the admin "Total Subscribers" chart a single member is on.
//
// The counting itself is done in SQL (currentPayingCounts in core/monitoring.ts)
// because it's a GROUP BY over the whole users table; this is the same decision
// expressed for ONE row, so `make diagnose-user` can answer "why isn't this
// person in Trial Grace?" without anyone re-reading that SQL by hand. The two
// are kept in lockstep by tests/subscriberBucket.test.ts.
//
// Kept PURE (no imports) so it's unit-testable and usable from the standalone
// diagnostic scripts, which run outside Next's module resolution.

export type SubscriberBucketId = 'fullSubscriber' | 'freeTrial' | 'trialGrace' | 'notCounted';

export type SubscriberBucketInput = {
  subscriptionStatus: string | null;
  // Tier as stored on the users row; legacy ids are folded here.
  tier: string | null;
  paymentGraceReason: string | null;
  cancelAtPeriodEnd?: boolean;
};

export type SubscriberBucketVerdict = {
  bucket: SubscriberBucketId;
  label: string;
  // Plain-language reason, written to be read by a human debugging one account.
  why: string;
};

const LABELS: Record<SubscriberBucketId, string> = {
  fullSubscriber: 'Full Subscriber',
  freeTrial: 'Free Trial',
  trialGrace: 'Trial Grace',
  notCounted: 'NOT COUNTED',
};

export function normalizeBucketTier(tier: string | null): string | null {
  if (tier === 'starter') return 'basic';
  if (tier === 'elite') return 'pro';
  return tier;
}

export function classifySubscriberBucket(input: SubscriberBucketInput): SubscriberBucketVerdict {
  const status = input.subscriptionStatus;
  const tier = normalizeBucketTier(input.tier);
  const tierIsPaid = tier === 'pro' || tier === 'basic';
  const verdict = (bucket: SubscriberBucketId, why: string): SubscriberBucketVerdict => ({
    bucket,
    label: LABELS[bucket],
    why,
  });

  // Free Trial is decided by STATUS alone, exactly as the chart's SQL does — a
  // trialer who has already clicked Cancel keeps their access to the end of the
  // trial, so they stay on this line until the trial actually lapses.
  if (status === 'trialing') {
    return verdict(
      'freeTrial',
      input.cancelAtPeriodEnd
        ? 'trialing with a cancel already scheduled — still counted here until the trial ends'
        : 'trialing',
    );
  }

  // Trial Grace: the trial lapsed, the FIRST charge was declined, and a recovery
  // window is holding their paid tier. Requires the tier to still be granted —
  // once it drops to public the member has left the chart entirely.
  if (status === 'past_due' && input.paymentGraceReason === 'trial' && tierIsPaid) {
    return verdict(
      'trialGrace',
      'past_due, the first charge after the trial was declined, still inside the recovery window',
    );
  }

  if (status === 'active') {
    return verdict('fullSubscriber', 'active');
  }

  // A renewal-failure grace window (or one opened before the reason column
  // existed) counts as a full subscriber: an established payer whose access has
  // not actually dropped.
  if (status === 'past_due' && tierIsPaid) {
    return verdict(
      'fullSubscriber',
      `past_due inside a '${input.paymentGraceReason ?? 'unattributed'}' grace window — ` +
        'renewal grace counts as a full subscriber because access never dropped',
    );
  }

  // Everything else is off the chart. The past_due case is the one worth
  // spelling out: it is what a Full Subscriber count falling by one looks like.
  return verdict(
    'notCounted',
    status === 'past_due'
      ? 'past_due AND the tier has already dropped to public — no grace window is protecting this member'
      : `status '${status ?? 'null'}' is outside the chart entirely`,
  );
}
