// When to offer a monthly member a longer billing period: a few days before
// their FIRST renewal.
//
// That is when paying members leave. In the 90 days to 2026-10-01, every paid
// cancel whose payment history was on record came after exactly one payment,
// and the members who left were not idle (three in four had visited on four or
// more of their last 30 days). A member deciding whether to pay again is told,
// before the second charge, that the year costs about five months of monthly.
//
// The email links to the pricing page, where the switch is priced by Stripe and
// confirmed before anything is charged (app/api/billing/change-plan, the
// `in_app_lengthen` path in core/planSwitch.ts).
//
// It is an offer, so it honors the marketing opt-out. Latched per subscription
// (users.plan_offer_email_sent_for holds the subscription id it went out for):
// one per subscription, and a member who leaves and comes back on a new
// subscription is eligible once more.
//
// Pure apart from the payment-evidence rule it shares with the ledger —
// tests/planOffer.test.ts.

import type { BillingCadence } from './billingPlans.ts';
import { isSubscriptionPaymentEvidence } from './subscriptionPayments.ts';

const DAY_MS = 86_400_000;

// How many days before the renewal the offer can go out. A daily run catches a
// member on the first day inside the window, about three weeks into the month.
// Not inside the last day: an offer that lands after the renewal has charged is
// one the member can no longer act on before paying another month.
export const PLAN_OFFER_WINDOW_DAYS = { latest: 8, earliest: 1 } as const;

export type PlanOfferInput = {
  cadence: BillingCadence | null;
  status: string | null;
  cancelAtPeriodEnd: boolean;
  paused: boolean;
  marketingUnsubscribed: boolean;
  subscriptionId: string | null;
  // users.current_period_end (ISO): the renewal the member is approaching.
  periodEndIso: string | null;
  // Payments cleared on this subscription so far (countPaidPeriods). One means
  // the member is in their first paid month.
  paidPeriods: number;
  // users.plan_offer_email_sent_for: the subscription it already went out for.
  sentForSubscriptionId: string | null;
  nowMs: number;
};

export function isPlanOfferDue(input: PlanOfferInput): boolean {
  if (input.cadence !== 'monthly') return false;
  if (input.status !== 'active' || input.cancelAtPeriodEnd || input.paused) return false;
  if (input.marketingUnsubscribed) return false;
  if (!input.subscriptionId || input.sentForSubscriptionId === input.subscriptionId) return false;
  if (input.paidPeriods !== 1) return false;
  if (!input.periodEndIso) return false;
  const periodEndMs = Date.parse(input.periodEndIso);
  if (!Number.isFinite(periodEndMs)) return false;
  const untilMs = periodEndMs - input.nowMs;
  return untilMs > PLAN_OFFER_WINDOW_DAYS.earliest * DAY_MS && untilMs <= PLAN_OFFER_WINDOW_DAYS.latest * DAY_MS;
}

/**
 * Billing periods paid on one subscription, from its payment audit rows
 * (`stripe_first_payment`, `stripe_invoice_paid`). Counts distinct invoices
 * that opened a period: the first one (however it was raised) and each renewal.
 * The $0 invoice that opens a trial is not a payment, and an invoice raised by a
 * mid-period change (billing_reason subscription_update) opens no period of its
 * own. Both rows for one first payment name the same invoice, so it counts once.
 */
export function countPaidPeriods(
  rows: ReadonlyArray<{ type: string; message: string }>,
  subscriptionId: string,
): number {
  const invoices = new Set<string>();
  // The id as a whole word, so sub_1 never matches a row about sub_12.
  const names = new RegExp(`(^|[^A-Za-z0-9_])${subscriptionId}($|[^A-Za-z0-9_])`);
  for (const row of rows) {
    if (!names.test(row.message)) continue;
    if (!isSubscriptionPaymentEvidence(row.type, row.message)) continue;
    if (row.type === 'stripe_invoice_paid') {
      const reason = row.message.match(/\bbilling_reason=([a-z_]+)/)?.[1];
      if (reason !== 'subscription_create' && reason !== 'subscription_cycle') continue;
    }
    const invoice = row.message.match(/\b(in_[A-Za-z0-9]+)/)?.[1];
    if (invoice) invoices.add(invoice);
  }
  return invoices.size;
}
