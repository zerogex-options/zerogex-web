// Courtesy refunds: the customer's one refund, given outside the money-back
// guarantee.
//
// The guarantee is limited to "one refund per customer, determined by account,
// email address, and payment card" (Terms), and hasPriorMoneyBackRefund
// (core/moneyBackServer.ts) enforced that by reading only its own ledger,
// money_back_refunds. A refund issued in the Stripe Dashboard never reaches that
// ledger, and that is how the courtesy refunds in docs/refund-requests.md are
// given: a free trial that converted, or a renewal, refunded once as a courtesy.
// So a customer who had one could later buy a plan with the guarantee and get a
// second refund through it. This module records those refunds where the limit
// can see them.
//
// What counts, decided by decideCourtesyRefund below:
//   • the charge is now refunded IN FULL. A partial refund is a goodwill credit
//     (say, for an outage), not the customer's money back;
//   • a refund on it has Stripe's reason "requested_by_customer", the
//     Dashboard's "Requested by customer". Any other reason stays out:
//     "duplicate", "fraudulent", or none at all, which is the Dashboard's
//     "Other" and what scripts/comp-member.mts and
//     scripts/restore-trial-after-switch.mts send. A refund that fixes our own
//     billing mistake must not cost the customer their guarantee;
//   • the money-back flow didn't issue it. Its refunds carry metadata
//     money_back=1 and are already in money_back_refunds, whose same-subscription
//     rule lets an unfinished request resume;
//   • it moved money, or is about to: status succeeded or pending;
//   • the charge isn't known to be a one-off. Courtesy refunds are on
//     subscription payments; a charge whose invoice can't be looked up still
//     counts, since the reason already says the customer asked.
//
// Recorded by the charge.refunded webhook as refunds happen, and by
// scripts/backfill-courtesy-refunds.mts for refunds issued before this existed.
// Like money_back_refunds, the table is deliberately not tied to the account and
// never deleted with it: the limit has to survive "delete the account and sign
// up again with the same email". A refund that later fails at the bank stays
// recorded; Stripe reports that rarely enough to fix by hand.
//
// Relative imports only, so the backfill script can load it.

import { getDb } from './db.ts';
import { canonicalEmail } from './moneyBackGuarantee.ts';
import type { ChargeInvoiceLookup } from './chargeInvoice.ts';

// The slices of a Stripe Charge and Refund the decision reads, declared here so
// the pure part is testable with plain objects.
export type CourtesyCharge = {
  id: string;
  amount: number;
  amount_refunded: number;
  currency: string;
  customer?: string | { id: string } | null;
  payment_method_details?: { card?: { fingerprint?: string | null } | null } | null;
  billing_details?: { email?: string | null } | null;
};

export type CourtesyRefundLike = {
  id: string;
  amount: number;
  created: number;
  reason?: string | null;
  status?: string | null;
  charge?: string | { id: string } | null;
  metadata?: Record<string, string> | null;
};

export type NotCourtesyReason =
  | 'one_off_charge'
  | 'no_refund'
  | 'money_back'
  | 'not_customer_requested'
  | 'partial';

export type CourtesyRefundDecision =
  | {
      counts: true;
      refundIds: string[];
      refundedAtMs: number;
      cardFingerprint: string | null;
      customerId: string | null;
      invoiceId: string | null;
    }
  | { counts: false; why: NotCourtesyReason };

const MONEY_MOVING_STATUSES = new Set(['succeeded', 'pending']);

function idOf(ref: string | { id: string } | null | undefined): string | null {
  if (!ref) return null;
  return typeof ref === 'string' ? ref : ref.id ?? null;
}

export function decideCourtesyRefund(input: {
  charge: CourtesyCharge;
  refunds: CourtesyRefundLike[];
  invoice: ChargeInvoiceLookup;
}): CourtesyRefundDecision {
  const { charge, invoice } = input;
  if (invoice.kind === 'none') return { counts: false, why: 'one_off_charge' };

  // This charge's refunds only (a list call can be broader than asked), and
  // only ones that moved money or are about to.
  const live = input.refunds.filter((refund) => {
    const chargeId = idOf(refund.charge);
    return (chargeId === null || chargeId === charge.id) && MONEY_MOVING_STATUSES.has(refund.status ?? '');
  });
  if (live.length === 0) return { counts: false, why: 'no_refund' };

  const outsideGuarantee = live.filter((refund) => refund.metadata?.money_back !== '1');
  if (outsideGuarantee.length === 0) return { counts: false, why: 'money_back' };

  const requested = outsideGuarantee.filter((refund) => refund.reason === 'requested_by_customer');
  if (requested.length === 0) return { counts: false, why: 'not_customer_requested' };

  if (charge.amount <= 0 || charge.amount_refunded < charge.amount) return { counts: false, why: 'partial' };

  return {
    counts: true,
    refundIds: requested.map((refund) => refund.id).sort(),
    refundedAtMs: Math.max(...requested.map((refund) => refund.created)) * 1000,
    cardFingerprint: charge.payment_method_details?.card?.fingerprint ?? null,
    customerId: idOf(charge.customer),
    invoiceId: invoice.kind === 'invoice' ? invoice.invoiceId : null,
  };
}

// Plain-English labels for the reasons a refund isn't a courtesy refund, for
// the backfill's summary.
export const NOT_COURTESY_LABELS: Record<NotCourtesyReason, string> = {
  one_off_charge: 'not a subscription payment',
  no_refund: 'refund failed or canceled',
  money_back: 'money-back guarantee refund (already counted by its own ledger)',
  not_customer_requested: 'reason not "Requested by customer"',
  partial: 'partial refund',
};

export type CourtesyRefundRecord = {
  chargeId: string;
  refundIds: string[];
  customerId: string | null;
  userId: string | null;
  email: string | null;
  cardFingerprint: string | null;
  invoiceId: string | null;
  amountRefunded: number;
  currency: string;
  refundedAtIso: string;
  source: 'webhook' | 'backfill';
};

export function courtesyRefundRecord(
  charge: CourtesyCharge,
  decision: Extract<CourtesyRefundDecision, { counts: true }>,
  user: { id: string; email: string } | null,
  source: CourtesyRefundRecord['source'],
): CourtesyRefundRecord {
  return {
    chargeId: charge.id,
    refundIds: decision.refundIds,
    customerId: decision.customerId,
    userId: user?.id ?? null,
    // The account's address when there is one, else the one the card was
    // billed under, so an account deleted before the refund is still matched.
    email: user?.email ?? charge.billing_details?.email ?? null,
    cardFingerprint: decision.cardFingerprint,
    invoiceId: decision.invoiceId,
    amountRefunded: charge.amount_refunded,
    currency: charge.currency,
    refundedAtIso: new Date(decision.refundedAtMs).toISOString(),
    source,
  };
}

export type RecordOutcome = 'recorded' | 'updated' | 'unchanged';

// Insert, or bring an existing row up to date when a later refund on the same
// charge completes it. Safe to repeat: a webhook redelivery or a second
// backfill run changes nothing.
export function recordCourtesyRefund(record: CourtesyRefundRecord, nowIso: string): RecordOutcome {
  const db = getDb();
  const refundIds = record.refundIds.join(',');
  const inserted = db
    .prepare(
      `INSERT OR IGNORE INTO courtesy_refunds
         (charge_id, refund_ids, customer_id, user_id, email, email_canonical, card_fingerprint,
          invoice_id, amount_refunded, currency, refunded_at, source, recorded_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      record.chargeId,
      refundIds,
      record.customerId,
      record.userId,
      record.email,
      record.email ? canonicalEmail(record.email) : null,
      record.cardFingerprint,
      record.invoiceId,
      record.amountRefunded,
      record.currency,
      record.refundedAtIso,
      record.source,
      nowIso,
      nowIso,
    ) as { changes: number | bigint };
  if (Number(inserted.changes) > 0) return 'recorded';

  const updated = db
    .prepare(
      `UPDATE courtesy_refunds
          SET refund_ids = ?, amount_refunded = ?, refunded_at = ?, updated_at = ?,
              user_id = COALESCE(user_id, ?), email = COALESCE(email, ?),
              email_canonical = COALESCE(email_canonical, ?)
        WHERE charge_id = ? AND refund_ids <> ?`,
    )
    .run(
      refundIds,
      record.amountRefunded,
      record.refundedAtIso,
      nowIso,
      record.userId,
      record.email,
      record.email ? canonicalEmail(record.email) : null,
      record.chargeId,
      refundIds,
    ) as { changes: number | bigint };
  return Number(updated.changes) > 0 ? 'updated' : 'unchanged';
}

export function isCourtesyRefundRecorded(chargeId: string): boolean {
  return !!getDb().prepare('SELECT 1 AS hit FROM courtesy_refunds WHERE charge_id = ?').get(chargeId);
}

// The half of the one-refund limit that money_back_refunds can't see: a
// courtesy refund to this account, canonical email or card.
export function hasPriorCourtesyRefund(input: {
  userId: string;
  email: string;
  cardFingerprint: string | null;
}): boolean {
  const row = getDb()
    .prepare(
      `SELECT 1 AS hit FROM courtesy_refunds
        WHERE user_id = ? OR email_canonical = ?
           OR (card_fingerprint IS NOT NULL AND card_fingerprint = ?)
        LIMIT 1`,
    )
    .get(input.userId, canonicalEmail(input.email), input.cardFingerprint ?? '');
  return !!row;
}

// What the charge.refunded webhook calls: read the charge's refunds (the event's
// charge doesn't carry them), decide, and record a courtesy refund.
export type RefundLister = {
  refunds: { list(params: { charge: string; limit: number }): Promise<{ data: CourtesyRefundLike[] }> };
};

export type CourtesyRefundOutcome =
  | { state: RecordOutcome; record: CourtesyRefundRecord }
  | { state: 'not_courtesy'; why: NotCourtesyReason };

export async function recordCourtesyRefundForCharge(
  stripe: RefundLister,
  charge: CourtesyCharge,
  ctx: { invoice: ChargeInvoiceLookup; user: { id: string; email: string } | null; nowIso: string },
): Promise<CourtesyRefundOutcome> {
  const refunds = (await stripe.refunds.list({ charge: charge.id, limit: 100 })).data;
  const decision = decideCourtesyRefund({ charge, refunds, invoice: ctx.invoice });
  if (!decision.counts) return { state: 'not_courtesy', why: decision.why };
  const record = courtesyRefundRecord(charge, decision, ctx.user, 'webhook');
  return { state: recordCourtesyRefund(record, ctx.nowIso), record };
}
