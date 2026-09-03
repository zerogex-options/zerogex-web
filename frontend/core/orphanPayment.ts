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
// charged twice, and renew normally afterward. That re-created subscription
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
  // shape we don't recognize degrades to "detected", never to a silent skip.
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
    // A price outside our current catalog (a retired SKU, a custom deal).
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

// --- Discount carry-over ---------------------------------------------------
//
// The re-created subscription is a NEW Stripe object, so it starts with no
// discounts. The canceled one may have carried a coupon, and whether that coupon
// should follow depends entirely on its duration:
//
//   forever    A permanent entitlement — the founding lifetime 25%, a forever
//              winback rate. Losing it silently overcharges the member on every
//              future renewal. Carry it.
//   once       Fully spent, on the very invoice that was just paid. Re-applying
//              it would discount the NEXT period too, which the member never
//              bought. Do not carry — and this needs no review: the intro price
//              ending is exactly what the pricing page promised ("$229 first
//              year, then $299"), so the undiscounted renewal is correct.
//   repeating  Partly spent, by an amount this module cannot see (the count
//              lives in the old subscription's invoice history). Re-applying
//              restarts the clock. Do not carry, and DO flag for review — how
//              much of it the member is still owed is a judgment call.
//
// Anything not carried is reported rather than dropped in silence, so the
// recovery script names every coupon while it is still a dry run. Only the
// genuinely ambiguous ones (`needsReview`) reach the audit log — a first-year
// promo expiring on schedule is not an incident, and treating it as one buries
// the cases that are.

export type SubscriptionDiscount = {
  couponId: string | null;
  duration: string | null;
  durationInMonths: number | null;
};

export type DiscountCarryOver = {
  // Coupon ids to re-apply to the re-created subscription.
  carry: string[];
  // Coupons deliberately NOT re-applied, with the duration that decided it.
  // `needsReview` separates "a human should look at this" (a partly-spent
  // repeating coupon, a duration we could not read) from "this is the designed
  // outcome" (a fully-spent `once` intro price).
  flagged: Array<{ couponId: string; duration: string; needsReview: boolean }>;
};

export function decideDiscountCarryOver(discounts: SubscriptionDiscount[]): DiscountCarryOver {
  const carry: string[] = [];
  const flagged: DiscountCarryOver['flagged'] = [];
  for (const discount of discounts) {
    const couponId = discount.couponId;
    if (!couponId) continue;
    if (discount.duration === 'forever') {
      if (!carry.includes(couponId)) carry.push(couponId);
      continue;
    }
    // 'once', 'repeating', and an unresolved duration all land here: never hand
    // out a discount we cannot show the member is still owed. Only the ones
    // whose remaining value is genuinely unclear are raised for review.
    flagged.push({
      couponId,
      duration: discount.duration ?? 'unknown',
      needsReview: discount.duration !== 'once',
    });
  }
  return { carry, flagged };
}

// Structural read of a Stripe subscription's discounts, tolerant of the shapes
// the field takes across API versions and expansion levels: `discounts` may hold
// expanded discount objects or bare ids, each wrapping a coupon that is itself
// either an object or an id, and older payloads carry a single `discount`.
// Bare-id forms yield a null duration, which the policy above treats as
// "unknown" and refuses to carry.
export function readSubscriptionDiscounts(subscription: unknown): SubscriptionDiscount[] {
  const sub =
    subscription && typeof subscription === 'object'
      ? (subscription as Record<string, unknown>)
      : null;
  if (!sub) return [];

  const raw: unknown[] = Array.isArray(sub.discounts) ? [...sub.discounts] : [];
  if (raw.length === 0 && sub.discount) raw.push(sub.discount);

  const out: SubscriptionDiscount[] = [];
  for (const entry of raw) {
    if (typeof entry === 'string') {
      // A bare discount id tells us nothing about the coupon behind it.
      out.push({ couponId: null, duration: null, durationInMonths: null });
      continue;
    }
    if (!entry || typeof entry !== 'object') continue;
    const coupon = (entry as { coupon?: unknown }).coupon;
    if (typeof coupon === 'string') {
      out.push({ couponId: coupon, duration: null, durationInMonths: null });
      continue;
    }
    if (coupon && typeof coupon === 'object') {
      const c = coupon as { id?: unknown; duration?: unknown; duration_in_months?: unknown };
      out.push({
        couponId: typeof c.id === 'string' ? c.id : null,
        duration: typeof c.duration === 'string' ? c.duration : null,
        durationInMonths: typeof c.duration_in_months === 'number' ? c.duration_in_months : null,
      });
    }
  }
  return out;
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
//   discounts             any forever coupon the canceled subscription carried
//                         (decideDiscountCarryOver) — a permanent rate the member
//                         keeps, which a brand-new subscription would silently
//                         lose.
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
  // Coupon ids that must follow the member onto the new subscription
  // (decideDiscountCarryOver's `carry`).
  carryCouponIds?: string[];
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
  if (opts.carryCouponIds && opts.carryCouponIds.length > 0) {
    params.discounts = opts.carryCouponIds.map((coupon) => ({ coupon }));
  }
  return params;
}

// --- Elapsed paid periods --------------------------------------------------
//
// Once the period an invoice paid for has run out, no subscription can restore
// it, so decideOrphanPayment stops at 'period_already_elapsed'. But that reason
// covers two opposite situations, and only one of them owes the member anything:
//
//   consumed  They paid, held the tier for the period, and it ran out. Ordinary
//             churn.
//   lost      Their access was taken away BEFORE the period they had bought was
//             over. Seen a month late, this is the same bug that stranded a
//             member on the free tier — except the remedy is now a refund or a
//             credit, because the days themselves are gone.
//
// Stripe cannot separate them; the local audit log can, since a tier reset is
// recorded as a subscription deletion. A deletion timestamped inside the paid
// window means paid days were taken.
//
// Two exceptions keep this honest.
//
// The deletion must belong to THE SUBSCRIPTION THIS INVOICE PAID FOR. A member
// who switches plans has their old subscription torn down at the very moment the
// new one starts, so a switch otherwise reads as "cut off on day one of the
// period they just paid for" — which is how the first sweep produced its single
// finding, on a member who had simply upgraded. Matching on subscription id
// separates the two: a switch deletes a different subscription than the one
// being paid for, a genuine loss deletes the same one.
//
// And a member who asks to cancel immediately gives up the rest of the period by
// choice. Stripe records that on the subscription as
// cancellation_details.reason='cancellation_requested', which is the ONLY
// trustworthy signal for it: our own audit rows are written by our cancel flow,
// so a member who cancels straight from Stripe's billing portal leaves none, and
// their deliberate cancellation would otherwise read as access being taken away.
// The audit rows remain a fallback for when Stripe reports no reason at all.
// Cancel-at-period-end never trips the rule either way — its deletion lands AT
// the period end, and the window below is deliberately exclusive at both edges.

export type ElapsedPeriodVerdict =
  | { kind: 'consumed'; reason: string }
  | { kind: 'lost'; lostAtUnix: number; lostSeconds: number };

export const VOLUNTARY_CANCEL_WINDOW_SECONDS = 7 * 24 * 60 * 60;

export function classifyElapsedPaidPeriod(input: {
  periodStartUnix: number | null;
  periodEndUnix: number | null;
  // The subscription the paid invoice belongs to. Without it a deletion cannot
  // be tied to this period, and nothing is claimed.
  invoiceSubscriptionId: string | null;
  // Stripe's cancellation_details.reason on that subscription — authoritative
  // about HOW it ended. 'cancellation_requested' means the member asked, however
  // they asked; 'payment_failed' means dunning ended it.
  cancellationReason: string | null;
  // Tier-resetting subscription deletions for this member, each naming the
  // subscription that ended.
  deletions: Array<{ atUnix: number; subscriptionId: string | null }>;
  // Timestamps of cancellations the member asked for themselves.
  cancelRequestUnixes: number[];
  voluntaryWindowSeconds?: number;
}): ElapsedPeriodVerdict {
  const {
    periodStartUnix,
    periodEndUnix,
    invoiceSubscriptionId,
    cancellationReason,
    deletions,
    cancelRequestUnixes,
  } = input;
  const voluntaryWindow = input.voluntaryWindowSeconds ?? VOLUNTARY_CANCEL_WINDOW_SECONDS;

  // Without both edges of the paid window there is nothing to compare against;
  // claiming a loss on a guess would send a refund to someone owed nothing.
  if (periodStartUnix == null || periodEndUnix == null) {
    return { kind: 'consumed', reason: 'period_bounds_unresolved' };
  }
  if (!invoiceSubscriptionId) {
    return { kind: 'consumed', reason: 'subscription_unresolved' };
  }
  if (cancellationReason === 'cancellation_requested') {
    // The member ended it themselves. Whatever days remained were theirs to
    // give up, and no refund is owed for them.
    return { kind: 'consumed', reason: 'member_requested_cancellation' };
  }

  const insideWindow = deletions
    .filter((d) => d.subscriptionId === invoiceSubscriptionId)
    .map((d) => d.atUnix)
    .filter((t) => t > periodStartUnix && t < periodEndUnix);
  if (insideWindow.length === 0) {
    return { kind: 'consumed', reason: 'access_ran_to_period_end' };
  }


  const involuntary = insideWindow.filter(
    (deletedAt) =>
      !cancelRequestUnixes.some(
        (requestedAt) => requestedAt <= deletedAt && deletedAt - requestedAt <= voluntaryWindow,
      ),
  );
  if (involuntary.length === 0) {
    return { kind: 'consumed', reason: 'member_cancelled_early' };
  }

  // Earliest involuntary loss — the member was without what they paid for from
  // that moment until the period ran out.
  const lostAtUnix = Math.min(...involuntary);
  return { kind: 'lost', lostAtUnix, lostSeconds: periodEndUnix - lostAtUnix };
}
