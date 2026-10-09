// The Stripe-customer → local-user lookup, and the soft-delete guard that makes
// it safe. Extracted from the Stripe webhook so the guard is unit-tested against
// a real SQLite schema (tests/billingUser.test.ts) instead of resting on a
// typecheck and a call-site audit — it is the only thing standing between a
// deleted account and being re-granted a paid tier or emailed. The row clear on
// a subscription's end (markSubscriptionEnded) lives here for the same reason.
//
// Loadable outside Next on purpose: no `server-only`, no '@/' alias, so a plain
// `node --experimental-strip-types` test or operator script can import it. Same
// property core/dailyMetrics.ts depends on.

import { getDb } from './db.ts';

// The columns every webhook branch reads off a member. Kept as one list so the
// two lookups below can never drift into returning different shapes.
const BILLING_USER_COLUMNS = `id, email, deleted_at, tier, founding_member_started_at,
       founding_lifetime_applied_at, referred_by_code, referral_credit_months, stripe_customer_id,
       stripe_subscription_id, stripe_price_id, subscription_status, cancel_at_period_end,
       payment_grace_started_at, payment_grace_reason, paused_until, trial_converted_email_sent_at,
       first_payment_at, last_paid_subscription_id, last_paid_invoice_at`;

export type BillingUserRow = {
  id: string;
  email: string;
  // Soft-delete marker (users.deleted_at). Non-null means the person asked us
  // to delete their account and the row is retained only for referential
  // integrity. Carried here so the webhook can refuse to re-grant a tier to,
  // or email, someone who is gone — see findUserByCustomerId below.
  deleted_at: string | null;
  founding_member_started_at: string | null;
  founding_lifetime_applied_at: string | null;
  referred_by_code: string | null;
  referral_credit_months: number;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  // Last-synced tier, read pre-UPDATE so a drop out of Pro can trigger
  // auto-revocation of the member's personal API keys.
  tier: string;
  // Last-synced price id, read pre-UPDATE so a plan/cadence switch (old price
  // != new price) can be detected and the member's rate carried across it.
  stripe_price_id: string | null;
  // Last-synced Stripe status, used to detect transitions (e.g. trialing →
  // active) so the funnel events fire exactly once on the actual change.
  subscription_status: string | null;
  // Last-synced cancel_at_period_end flag (0/1). Read pre-UPDATE so the
  // 0→1 transition fires the cancellation acknowledgment email once.
  cancel_at_period_end: number;
  // ISO timestamp anchoring an open payment-recovery grace window, or null.
  // Read pre-UPDATE so each past_due sync can enforce the bounded window
  // (see the grace block in syncSubscriptionToUser).
  payment_grace_started_at: string | null;
  // Which failure opened that window ('renewal' | 'trial'), or null when none is
  // open. Read pre-UPDATE so the follow-up past_due syncs (whose previousStatus
  // is itself `past_due`) carry the original cohort forward instead of losing it.
  payment_grace_reason: string | null;
  // Last-synced pause auto-resume instant (ISO), or null when not paused. Read
  // pre-UPDATE so a pause→resume transition can be detected for the audit log.
  paused_until: string | null;
  // Stamp for the trial-conversion confirmation email, or null when it hasn't
  // been sent. Read only as a cheap short-circuit (see
  // maybeSendTrialConvertedEmail) — the CAS UPDATE there stays the authority.
  trial_converted_email_sent_at: string | null;
  // ISO instant this member's first subscription invoice was actually PAID, or
  // null if none ever has been. Read as a cheap short-circuit for the once-per
  // -account stamp in maybeStampFirstPayment; the CAS UPDATE there is the
  // authority. See core/db.ts for why subscription_status can't answer this.
  first_payment_at: string | null;
  // Which subscription last had an invoice PAID on it, and when. Unlike
  // first_payment_at these are per-SUBSCRIPTION: the id is compared against
  // stripe_subscription_id to answer "has the subscription this member is on
  // right now actually been charged", which first_payment_at cannot do for
  // anyone on their second subscription. Read pre-UPDATE so the cancellation
  // acknowledgment can tell a conversion charge in flight from an ordinary
  // cancel. See core/db.ts for why this is a pointer rather than a stamp that
  // gets cleared.
  last_paid_subscription_id: string | null;
  last_paid_invoice_at: string | null;
};

// The DEFAULT lookup, and deliberately the safe one: it never returns a
// soft-deleted account. A deleted row keeps its stripe_customer_id, and Stripe
// keeps emitting events against that customer — a still-open invoice can be
// paid from a hosted link months later, and a canceled subscription can still
// raise events. Matching those to the deleted row would let the webhook
// re-grant a paid tier, re-create a subscription (maybeRecoverOrphanPayment),
// or email someone who asked to be forgotten. Every branch that grants
// entitlement or sends mail uses this, so a branch added later is safe by
// default rather than safe only if its author remembered.
export function findUserByCustomerId(customerId: string): BillingUserRow | null {
  const row = getDb()
    .prepare(
      `SELECT ${BILLING_USER_COLUMNS}
       FROM users WHERE stripe_customer_id = ? AND deleted_at IS NULL`,
    )
    .get(customerId) as BillingUserRow | undefined;
  return row ?? null;
}

// The escape hatch, for the few branches that must still see a deleted account:
// bookkeeping that keeps the retained row internally consistent, and audit rows
// that would otherwise lose their attribution. Neither grants a tier nor sends
// mail. Anything that does must use findUserByCustomerId above.
export function findUserByCustomerIdIncludingDeleted(customerId: string): BillingUserRow | null {
  const row = getDb()
    .prepare(
      `SELECT ${BILLING_USER_COLUMNS}
       FROM users WHERE stripe_customer_id = ?`,
    )
    .get(customerId) as BillingUserRow | undefined;
  return row ?? null;
}

// What customer.subscription.deleted does to the member's row: drop them to
// public and clear everything that belonged to the subscription that ended.
//
// subscription_lapsed = 1 is the signal the webhook's maybeSendPaidWelcomeEmail
// consumes (race-safely, via CAS) to fire a welcome-back if and when the
// customer resubscribes. Cleared back to 0 atomically in that send path.
//
// payment_recovery_pending is disarmed here: if a past_due sub exhausts its
// retries and is deleted, any pending recovery email must NOT survive to fire on
// a later resubscribe — that return should read as a welcome-back, not a
// spurious "your payment went through."
//
// cancel_ack_email_sent_at goes with cancel_at_period_end. It latches the
// acknowledgment of THIS subscription's pending cancel (core/cancelAck.ts), so
// it ends with the subscription. Left set, it outlived the lapse, and when a
// returning member later canceled their new subscription the claim found it
// taken and sent nothing: no acknowledgment, no one-click save offer.
//
// Only when the row still points at THIS subscription (or at none). The
// webhook's ordering guard compares events per subscription, so a deletion
// delivered late — Stripe retrying an event that failed during a deploy restart
// — for a subscription the member has since replaced (bought again after a
// money-back refund, or a recovery re-created it) must not clear the new one.
// Returns false, having changed nothing, in that case.
export function markSubscriptionEnded(input: {
  userId: string;
  subscriptionId: string;
  // Stripe's status for the ended subscription, mirrored as-is.
  status: string;
  nowIso: string;
}): boolean {
  const result = getDb()
    .prepare(
      `UPDATE users SET
         tier = 'public',
         stripe_subscription_id = NULL,
         stripe_price_id = NULL,
         last_paid_subscription_id = NULL,
         last_paid_invoice_at = NULL,
         subscription_status = ?,
         current_period_end = NULL,
         cancel_at_period_end = 0,
         cancel_ack_email_sent_at = NULL,
         subscription_lapsed = 1,
         payment_recovery_pending = 0,
         payment_grace_started_at = NULL,
         payment_grace_reason = NULL,
         updated_at = ?
       WHERE id = ? AND (stripe_subscription_id IS NULL OR stripe_subscription_id = ?)`,
    )
    .run(input.status, input.nowIso, input.userId, input.subscriptionId) as {
    changes: number | bigint;
  };
  return Number(result.changes) > 0;
}

// A subscription whose first payment never went through. Stripe creates the
// subscription when Checkout first tries the card, so a decline leaves one
// behind in `incomplete`; 23 hours later Stripe moves it to `incomplete_expired`
// and voids its invoice. Neither ever granted access or took money, so neither
// is a subscription the member has. Counting one as such sent the member to the
// billing portal, which cannot finish a first payment, and made checkout refuse
// them with "You already have an active subscription" for good, because
// nothing ever took the id off the row.
export function isUnstartedSubscriptionStatus(status: string | null | undefined): boolean {
  return status === 'incomplete' || status === 'incomplete_expired';
}

// Takes a never-started subscription off the member's row so they can check
// out again. Not churn, unlike markSubscriptionEnded: the member never had the
// subscription, so subscription_lapsed is left alone (setting it would cost a
// first-timer their free trial on the retry and queue win-back mail to someone
// who never subscribed), and so is the tier, which an unstarted subscription
// never granted. The payment-recovery latch goes, for the reason given above
// markSubscriptionEnded.
//
// Same guard as markSubscriptionEnded: only when the row still points at THIS
// subscription, or at none. Returns false, having changed nothing, otherwise.
export function releaseUnstartedSubscription(input: {
  userId: string;
  subscriptionId: string;
  // Stripe's status for the subscription, mirrored as-is.
  status: string;
  nowIso: string;
}): boolean {
  const result = getDb()
    .prepare(
      `UPDATE users SET
         stripe_subscription_id = NULL,
         stripe_price_id = NULL,
         subscription_status = ?,
         current_period_end = NULL,
         cancel_at_period_end = 0,
         payment_recovery_pending = 0,
         payment_grace_started_at = NULL,
         payment_grace_reason = NULL,
         updated_at = ?
       WHERE id = ? AND (stripe_subscription_id IS NULL OR stripe_subscription_id = ?)`,
    )
    .run(input.status, input.nowIso, input.userId, input.subscriptionId) as {
    changes: number | bigint;
  };
  return Number(result.changes) > 0;
}
