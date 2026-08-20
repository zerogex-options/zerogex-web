// Pure decision logic for an ORPHANED PAYMENT — money Stripe collected on an
// invoice whose subscription no longer exists, so nothing in the normal webhook
// flow ever grants the member their tier back.
//
// The failure it fixes, seen in production:
//
//   1. A trial ends, the conversion charge fails, Stripe's Smart Retries run.
//   2. Retries are exhausted; Stripe cancels the subscription for nonpayment.
//      customer.subscription.deleted lands, clearSubscriptionFromUser drops the
//      member to 'public'. Correct so far.
//   3. Stripe leaves the failed invoice OPEN and still payable — its hosted
//      invoice URL is in every dunning email Stripe already sent.
//   4. Days later the member fixes their card and pays that invoice. We collect
//      the full amount. Stripe does NOT resurrect a canceled subscription when
//      its final invoice is paid out of band, so NO customer.subscription.*
//      event fires — only invoice.paid, which until now touched nothing but
//      partner commissions.
//   5. The member stays on 'public' having paid in full, and nothing in the
//      system knows. They email support instead.
//
// The fix is to notice the orphaned payment on invoice.paid and re-create the
// subscription in Stripe with its billing anchored at the END of the period the
// member just paid for — so they get exactly the access they bought, are not
// charged twice, and renew normally afterwards. That re-created subscription
// emits customer.subscription.created, and the ordinary sync grants the tier.
//
// This module holds only the decision (unit-tested in tests/orphanPayment.test.ts);
// app/api/webhooks/stripe/route.ts performs the Stripe + DB writes, and
// scripts/recover-orphan-payment.mts is the manual twin for payments that were
// orphaned before this shipped (their invoice.paid is already recorded in
// stripe_webhook_events, so a Stripe re-delivery would be deduped, not replayed).

// Statuses in which a subscription still exists and can still grant access on
// its own. For any of these the ordinary customer.subscription.* sync is the
// thing that decides the tier — an invoice payment on them is never orphaned.
// `unpaid` is included deliberately: paying its invoice moves Stripe's own
// subscription back to active and emits the update we already handle.
const LIVE_SUBSCRIPTION_STATUSES = new Set([
  'active',
  'trialing',
  'past_due',
  'unpaid',
  'incomplete',
  'paused',
]);

// Billing reasons that mean "this invoice is a subscription's own charge".
// A manual or standalone invoice that merely happens to name a subscription is
// not something we re-create a plan from.
const SUBSCRIPTION_BILLING_REASONS = new Set([
  'subscription_cycle',
  'subscription_create',
  'subscription_update',
  'subscription',
  'subscription_threshold',
]);

export type OrphanPaymentInput = {
  // invoice.amount_paid, in the smallest currency unit.
  amountPaid: number;
  // invoice.status — only a settled 'paid' invoice buys anything.
  invoiceStatus: string | null;
  // invoice.billing_reason. null/unknown is tolerated (treated as allowed) so a
  // shape we don't recognise degrades to "detected", never to a silent skip.
  billingReason: string | null;
  // The subscription this invoice billed for, or null when it has no
  // subscription parent (readInvoiceSubscriptionId).
  subscriptionId: string | null;
  // LIVE status of that subscription read back from Stripe, or null when it no
  // longer exists / could not be retrieved. Read live rather than trusted from
  // the event body, because the event was rendered before the payment landed.
  subscriptionStatus: string | null;
  // users.tier for the paying customer, as currently persisted.
  localTier: string;
  // users.stripe_subscription_id — non-null means the member already has a
  // subscription mirrored locally, so their entitlement is not orphaned.
  localSubscriptionId: string | null;
  // The recurring price this invoice billed (readInvoicePriceId).
  priceId: string | null;
  // Whether that price maps to one of our paid tiers. A price we can't map
  // can't be re-created into a meaningful subscription.
  priceMapsToPaidTier: boolean;
  // End of the service period this invoice paid for, Unix seconds
  // (readInvoicePeriodEndUnix).
  coveredPeriodEndUnix: number | null;
  // Injected clock (seconds) so the decision is deterministic under test.
  nowUnix: number;
};

export type OrphanPaymentDecision =
  // Not an orphaned payment at all — the normal flow covers this invoice.
  | { kind: 'none'; reason: string }
  // Money collected with no entitlement, but we must not act automatically.
  // The caller logs it loudly for an operator instead of guessing.
  | { kind: 'detected'; recoverable: false; reason: string }
  // Money collected with no entitlement, and we know exactly which plan to
  // restore and until when. `billingCycleAnchorUnix` is the instant the paid
  // period runs out — the subscription is created to bill FIRST at that moment,
  // with proration suppressed, so the member is not charged again for a period
  // they have already bought.
  | {
      kind: 'detected';
      recoverable: true;
      reason: string;
      priceId: string;
      billingCycleAnchorUnix: number;
    };

export function decideOrphanPayment(input: OrphanPaymentInput): OrphanPaymentDecision {
  const {
    amountPaid,
    invoiceStatus,
    billingReason,
    subscriptionId,
    subscriptionStatus,
    localTier,
    localSubscriptionId,
    priceId,
    priceMapsToPaidTier,
    coveredPeriodEndUnix,
    nowUnix,
  } = input;

  // --- Is anything actually orphaned? ------------------------------------
  if (invoiceStatus !== 'paid') return { kind: 'none', reason: 'invoice_not_paid' };
  // A $0 invoice buys nothing — the trial-create invoice, a fully-credited
  // cycle, a 100%-off coupon. Nothing was collected, so nothing is owed.
  if (!(amountPaid > 0)) return { kind: 'none', reason: 'zero_amount' };
  // The member already holds a subscription (this is an ordinary renewal, or a
  // second plan). Their tier is the subscription sync's business, not ours.
  if (localSubscriptionId) return { kind: 'none', reason: 'local_subscription_present' };
  if (localTier !== 'public') return { kind: 'none', reason: 'already_entitled' };
  // The subscription is alive in Stripe: paying its invoice produces the
  // subscription.updated we already handle (past_due/unpaid -> active).
  if (subscriptionStatus && LIVE_SUBSCRIPTION_STATUSES.has(subscriptionStatus)) {
    return { kind: 'none', reason: 'subscription_live' };
  }

  // Past here: a paid, non-zero invoice, and the payer holds no entitlement.
  // That is money in with nothing granted — always worth a record, even when we
  // decline to act on it.

  // --- Can we act on it automatically? -----------------------------------
  if (!subscriptionId) {
    // A one-off invoice (a manual charge, an old standalone item). There is no
    // plan to re-create; whatever it bought is not a subscription.
    return { kind: 'detected', recoverable: false, reason: 'no_subscription_parent' };
  }
  if (billingReason != null && !SUBSCRIPTION_BILLING_REASONS.has(billingReason)) {
    return { kind: 'detected', recoverable: false, reason: `billing_reason_${billingReason}` };
  }
  if (!priceId) {
    return { kind: 'detected', recoverable: false, reason: 'price_unresolved' };
  }
  if (!priceMapsToPaidTier) {
    // A price outside our current catalogue (a retired SKU, a custom deal).
    // Re-creating it would grant an undefined tier, so leave it to a human.
    return { kind: 'detected', recoverable: false, reason: 'price_not_in_catalogue' };
  }
  if (coveredPeriodEndUnix == null) {
    return { kind: 'detected', recoverable: false, reason: 'period_unresolved' };
  }
  if (coveredPeriodEndUnix <= nowUnix) {
    // The period this invoice paid for has already elapsed — paying a
    // long-stale invoice buys no future access, and Stripe rejects a
    // billing_cycle_anchor in the past. Record it; a refund is the operator's
    // call, not ours.
    return { kind: 'detected', recoverable: false, reason: 'period_already_elapsed' };
  }

  return {
    kind: 'detected',
    recoverable: true,
    reason: 'subscription_canceled_after_payment',
    priceId,
    billingCycleAnchorUnix: coveredPeriodEndUnix,
  };
}

// The exact Stripe subscriptions.create params that restore a recoverable
// orphaned payment. Shared by the webhook and the manual recovery script so
// both produce byte-identical subscriptions.
//
//   billing_cycle_anchor  the end of the period already paid for → Stripe's
//                         first charge on this subscription is the RENEWAL,
//                         never a second charge for the paid period.
//   proration_behavior    'none' — without it Stripe prorates the gap between
//                         now and the anchor onto an immediate invoice, i.e.
//                         bills the member a second time for what they just
//                         paid.
//   backdate_start_date   starts the subscription at the beginning of the paid
//                         period so reporting and the member's own invoice
//                         history line up with what they bought.
//   metadata              stamps which invoice this was recovered from, which
//                         is also the idempotency key: before creating, callers
//                         look for an existing subscription already carrying
//                         this invoice id.
export const RECOVERED_FROM_INVOICE_KEY = 'recovered_from_invoice';

export function buildRecoverySubscriptionParams(opts: {
  customerId: string;
  priceId: string;
  billingCycleAnchorUnix: number;
  invoiceId: string;
  // Start of the paid period (Unix seconds), when known.
  periodStartUnix?: number | null;
  // The payment method that settled the invoice, wired as the subscription's
  // default so the renewal uses the card that just worked.
  defaultPaymentMethodId?: string | null;
}): Record<string, unknown> {
  const params: Record<string, unknown> = {
    customer: opts.customerId,
    items: [{ price: opts.priceId }],
    billing_cycle_anchor: opts.billingCycleAnchorUnix,
    proration_behavior: 'none',
    metadata: { [RECOVERED_FROM_INVOICE_KEY]: opts.invoiceId },
  };
  if (opts.periodStartUnix != null && Number.isFinite(opts.periodStartUnix)) {
    params.backdate_start_date = opts.periodStartUnix;
  }
  if (opts.defaultPaymentMethodId) {
    params.default_payment_method = opts.defaultPaymentMethodId;
  }
  return params;
}
