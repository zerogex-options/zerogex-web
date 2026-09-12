// The Stripe-customer → local-user lookup, and the soft-delete guard that makes
// it safe. Extracted from the Stripe webhook so the guard is unit-tested against
// a real SQLite schema (tests/billingUser.test.ts) instead of resting on a
// typecheck and a call-site audit — it is the only thing standing between a
// deleted account and being re-granted a paid tier or emailed.
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
       first_payment_at`;

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
