// A Cancel on a subscription whose payment has already failed ends it NOW and
// voids its open bill, instead of scheduling the cancel for period end.
//
// WHY. When a renewal, or a trial's first charge, is declined, the subscription
// goes `past_due` and Stripe keeps retrying the open invoice for up to two
// weeks. Scheduling the cancel (cancel_at_period_end) leaves those retries
// running, so a retry that clears charges a member AFTER they canceled, for a
// period the 3-day payment-grace cutoff (core/paymentGraceEnforcement.ts) has
// usually already taken their access away from. That is a likely dispute. It
// happened on 2026-10-16 and twice on 2026-11-08, and each time it was fixed by
// hand with `make cancel-subscription EMAIL=... VOID_INVOICE=1`
// (docs/outreach/2026-10-16-payment-failure-followups.md, "Canceled
// themselves: cancel and void instead"). This is that fix, done at the click.
//
// Nothing the member paid for is taken away. The open invoice bills a period
// they have not paid for; what they lose is at most the rest of the grace
// window, which exists so a retry can keep a member who wants to stay.
//
// Two callers, one code path: the in-app cancel flow
// (app/api/billing/cancel-flow) and the operator script
// (scripts/cancel-subscription.mts --void-invoice). The script runs under plain
// `node`, so this file imports nothing but types and is handed its Stripe
// client.

import type Stripe from 'stripe';

// The states a subscription is in while a declined charge is unrecovered:
// `past_due` while Stripe retries it, and `unpaid` if retries end that way
// rather than in a cancel. The Account page offers Cancel in both
// (CANCELABLE_STATUSES in app/account/page.tsx).
export function isPaymentFailedStatus(status: string | null | undefined): boolean {
  return status === 'past_due' || status === 'unpaid';
}

export type CancelNowAndVoidOptions = {
  // The subscription is already over (canceled / incomplete_expired), so only
  // void. The operator script's "already terminal" case.
  skipCancel?: boolean;
  // false: cancel only and leave the invoices as they are (the script without
  // --void-invoice). Defaults to true.
  voidOpenInvoices?: boolean;
  // The invoices to void. When omitted, every invoice still open on the
  // subscription, listed AFTER the cancel.
  invoices?: ReadonlyArray<{ id?: string | null }>;
  // The member's reason, recorded on the canceled subscription so the
  // customer.subscription.deleted webhook carries it onto the churn row.
  // feedback must already be one of Stripe's values (validateCancelFeedback).
  cancellationDetails?: { feedback?: string | null; comment?: string | null } | null;
};

export type CancelNowAndVoidResult = {
  // Stripe's status after the cancel ('canceled'), or null when it was skipped.
  status: string | null;
  // Invoices now void.
  voided: string[];
  // Invoices that could not be voided. They stay open and payable.
  voidFailed: Array<{ invoiceId: string; message: string }>;
  // Set when the open invoices could not even be listed, so none was voided.
  listError: string | null;
};

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * Cancel a subscription now, then void its open invoices. In that order.
 *
 * Cancel FIRST, on purpose: canceling a past_due subscription moves it straight
 * to 'canceled', and customer.subscription.deleted disarms the payment-recovery
 * latch without any email. Voiding first would remove the only unpaid invoice
 * and flip the subscription back to 'active', which fires the webhook's
 * "payment recovered" email (maybeHandlePaymentRecovery, past_due -> active) at
 * someone who is leaving. Once the subscription is canceled, a void can no
 * longer reactivate it.
 *
 * The void is still needed after the cancel. A canceled subscription's open
 * invoice keeps its hosted payment page, the one linked from every dunning
 * email, and paying it after the period ends takes money for nothing (see
 * core/staleInvoice.ts). Voiding is final, which is the point here.
 *
 * Throws when the cancel fails. Nothing has changed then, so the caller can stop
 * cleanly. Once the cancel has gone through, nothing throws: a void or listing
 * failure is reported in the result, because the caller still has to record
 * the cancel.
 */
export async function cancelNowAndVoid(
  stripe: Stripe,
  subscriptionId: string,
  opts: CancelNowAndVoidOptions = {},
): Promise<CancelNowAndVoidResult> {
  const result: CancelNowAndVoidResult = { status: null, voided: [], voidFailed: [], listError: null };

  if (!opts.skipCancel) {
    const details = opts.cancellationDetails;
    const feedback = details?.feedback || null;
    const comment = details?.comment || null;
    const canceled = await stripe.subscriptions.cancel(subscriptionId, {
      // No final invoice and no proration credit. Stripe's defaults, stated
      // because the period of a failed payment was never paid for.
      invoice_now: false,
      prorate: false,
      ...(feedback || comment
        ? {
            cancellation_details: {
              ...(feedback
                ? { feedback: feedback as Stripe.SubscriptionCancelParams.CancellationDetails.Feedback }
                : {}),
              ...(comment ? { comment } : {}),
            },
          }
        : {}),
    });
    result.status = canceled.status;
  }

  if (opts.voidOpenInvoices === false) return result;

  let invoices = opts.invoices;
  if (!invoices) {
    try {
      const list = await stripe.invoices.list({ subscription: subscriptionId, status: 'open', limit: 100 });
      invoices = list.data;
    } catch (err) {
      result.listError = errorMessage(err);
      return result;
    }
  }

  for (const invoice of invoices) {
    if (!invoice.id) continue;
    try {
      await stripe.invoices.voidInvoice(invoice.id);
      result.voided.push(invoice.id);
    } catch (err) {
      result.voidFailed.push({ invoiceId: invoice.id, message: errorMessage(err) });
    }
  }
  return result;
}

// True when the unpaid bill was voided and nothing was left open: at least one
// invoice voided, none failed, and the listing worked. Only then may the member
// be told the bill is canceled and nothing more will be charged.
//
// Finding NO open invoice is not enough. A subscription in a failed-payment
// state has one, so an empty list means something else happened: a retry
// cleared it a moment before the cancel (the member paid and has now lost the
// period), or it was marked uncollectible, which the 'open' filter misses and
// which can still be paid.
export function billWasVoided(result: CancelNowAndVoidResult): boolean {
  return result.listError === null && result.voidFailed.length === 0 && result.voided.length > 0;
}

// A subscription that is already over: nothing left to cancel.
export function isEndedStatus(status: string | null | undefined): boolean {
  return status === 'canceled' || status === 'incomplete_expired';
}
