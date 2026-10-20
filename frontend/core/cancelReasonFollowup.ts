// Who gets the one-off cancel-reason follow-up (scripts/send-cancel-reason-followup.mts):
// a member whose recent cancel gave "Too expensive" or "Too complex / hard to use",
// answered the way the in-app cancel modal now answers those reasons.
//
//   • Still has access (cancel scheduled, sub live):
//       too_expensive → one-click 50% save link (app/save?o=price)
//       too_complex   → My Dashboard + Education hub, and how to keep the plan
//   • Already ended (sub gone, subscription_lapsed = 1):
//       too_expensive → 50% off coming back (/pricing?winback=1; the script
//                       stamps winback_email_sent_at, which is what makes
//                       checkout attach the win-back coupon)
//       too_complex   → the same two links and a way back in
//
// Pure (no runtime imports) so the matrix is unit-tested and --dry-run can say
// why each member was skipped. Locked down in tests/cancelReasonFollowup.test.ts.

import type { ExclusionReason } from './excludedAccounts.ts';

export type FollowupReason = 'too_expensive' | 'too_complex';
export type FollowupState = 'pending' | 'lapsed';

export type FollowupSkip =
  | 'other_reason'
  // Not a customer (core/excludedAccounts.ts): 'admin', 'partner_grant' or
  // 'comped'. A partner or comped member who once paid can still have a recent
  // cancel on file, but there is no price to answer and no plan to save.
  | ExclusionReason
  | 'deleted'
  | 'unsubscribed'
  | 'already_sent'
  // Asked for their money back under the guarantee: not someone to pitch.
  | 'refunded'
  // Kept their plan, resubscribed, or the sub is in a state we don't write to
  // (past_due, paused).
  | 'no_longer_canceling'
  // The 50% save shares the one-claim latch with the 25% one; the link would
  // only show "already claimed".
  | 'offer_already_claimed'
  // Checkout refuses an unverified account, so a way back in would dead-end.
  | 'email_unverified';

export type FollowupInput = {
  feedback: string | null;
  /** classifyExclusion() for the account, null for a customer. */
  exclusion: ExclusionReason | null;
  deleted: boolean;
  marketingUnsubscribed: boolean;
  alreadySent: boolean;
  moneyBackRefunded: boolean;
  hasSubscriptionOnFile: boolean;
  cancelAtPeriodEnd: boolean;
  subscriptionStatus: string | null;
  subscriptionLapsed: boolean;
  retentionOfferClaimed: boolean;
  emailVerified: boolean;
};

export type FollowupDecision =
  | { send: true; reason: FollowupReason; state: FollowupState }
  | { send: false; skip: FollowupSkip };

const LIVE_STATUSES = new Set(['active', 'trialing']);

export function decideCancelReasonFollowup(input: FollowupInput): FollowupDecision {
  const reason = input.feedback;
  if (reason !== 'too_expensive' && reason !== 'too_complex') return { send: false, skip: 'other_reason' };
  if (input.exclusion) return { send: false, skip: input.exclusion };
  if (input.deleted) return { send: false, skip: 'deleted' };
  if (input.marketingUnsubscribed) return { send: false, skip: 'unsubscribed' };
  if (input.alreadySent) return { send: false, skip: 'already_sent' };
  if (input.moneyBackRefunded) return { send: false, skip: 'refunded' };

  let state: FollowupState;
  if (
    input.hasSubscriptionOnFile &&
    input.cancelAtPeriodEnd &&
    LIVE_STATUSES.has(input.subscriptionStatus ?? '')
  ) {
    state = 'pending';
  } else if (input.subscriptionLapsed && !input.hasSubscriptionOnFile) {
    state = 'lapsed';
  } else {
    return { send: false, skip: 'no_longer_canceling' };
  }

  if (state === 'pending' && reason === 'too_expensive' && input.retentionOfferClaimed) {
    return { send: false, skip: 'offer_already_claimed' };
  }
  if (state === 'lapsed' && !input.emailVerified) return { send: false, skip: 'email_unverified' };

  return { send: true, reason, state };
}
