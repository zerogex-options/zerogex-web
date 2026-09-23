// The rules behind scripts/resend-payment-failed.mts, kept pure so who gets a
// second copy of the payment-failed email can be tested without Stripe or a
// database.
//
// Why a second copy at all: until the dunning emails moved to our own /pay
// link (core/payLink.ts) they buttoned straight to Stripe's hosted invoice
// page, and a tokenized invoice.stripe.com payment link inside a "your payment
// failed" email is the shape spam filters look for in phishing. Members sent
// that version may never have seen it. The resend reaches the ones whose money
// is still outstanding — and nobody else.

import type { DeclineCategory } from './declineReason.ts';

/** What the webhook's `payment_failed_email_sent` audit row says it sent. */
export type SentPaymentFailedEmail = {
  invoiceId: string;
  /** Which of the two emails went out. The resend keeps the same framing. */
  trialConversion: boolean;
};

/**
 * Reads the message the Stripe webhook writes when the email goes out:
 *   `Sent ${trialConversion ? 'trial-conversion ' : ''}payment-failed email for invoice ${id}`
 */
export function parsePaymentFailedAudit(message: string): SentPaymentFailedEmail | null {
  const match = message.match(/^Sent (trial-conversion )?payment-failed email for invoice (in_[A-Za-z0-9]+)/);
  return match ? { invoiceId: match[2], trialConversion: Boolean(match[1]) } : null;
}

/** Latch type: one resend per invoice, ever. */
export const RESEND_AUDIT_TYPE = 'payment_failed_email_resent';

export function resendAuditMessage(sent: SentPaymentFailedEmail): string {
  return `Resent ${sent.trialConversion ? 'trial-conversion ' : ''}payment-failed email for invoice ${sent.invoiceId}`;
}

export function parseResendAudit(message: string): string | null {
  return message.match(/\b(in_[A-Za-z0-9]+)\b/)?.[1] ?? null;
}

// Stripe still holds the subscription and may retry. The same set the account
// page reads as a payment issue (app/api/billing/status/route.ts).
const DUNNING_STATUSES = new Set(['past_due', 'unpaid', 'incomplete']);

export type ResendSkip =
  /** Settled since, or nothing left owing. Nothing to say. */
  | 'paid'
  /** Voided, written off or still a draft: nothing to pay. */
  | 'closed'
  /**
   * The subscription is canceled or back to active. "Stripe will try again"
   * would be false; a canceled member with an open invoice is what
   * scripts/send-open-invoice-recovery.mts is for.
   */
  | 'not_in_dunning';

export type ResendDecision = { send: true } | { send: false; skip: ResendSkip };

/** The Stripe half of the decision; the script checks the latch and the account first. */
export function decideResend(input: {
  invoiceStatus: string | null | undefined;
  amountDue: number | null | undefined;
  subscriptionStatus: string | null | undefined;
}): ResendDecision {
  if (input.invoiceStatus === 'paid') return { send: false, skip: 'paid' };
  if (input.invoiceStatus !== 'open') return { send: false, skip: 'closed' };
  if (typeof input.amountDue !== 'number' || input.amountDue <= 0) return { send: false, skip: 'paid' };
  if (!input.subscriptionStatus || !DUNNING_STATUSES.has(input.subscriptionStatus)) {
    return { send: false, skip: 'not_in_dunning' };
  }
  return { send: true };
}

/**
 * Why an invoice that is still open is not in dunning any more, in words for
 * the report. Stripe records who ended a subscription in
 * `cancellation_details.reason`: 'payment_failed' is Stripe giving up after its
 * last retry; 'cancellation_requested' is a person — the member in the billing
 * portal, or the operator in the Stripe dashboard.
 */
export function notInDunningLabel(sub: {
  status: string | null | undefined;
  cancellationReason?: string | null;
}): string {
  switch (sub.status) {
    case 'canceled':
      if (sub.cancellationReason === 'payment_failed') {
        return 'Stripe gave up retrying and canceled it — see make open-invoice-recovery';
      }
      if (sub.cancellationReason === 'cancellation_requested') {
        return 'canceled on request (the member, or you in Stripe)';
      }
      if (sub.cancellationReason === 'payment_disputed') return 'canceled over a payment dispute';
      return 'subscription canceled';
    case 'active':
    case 'trialing':
      return 'subscription is active again';
    case 'incomplete_expired':
      return 'subscription expired before its first payment';
    case 'paused':
      return 'subscription paused';
    case null:
    case undefined:
      return 'no subscription on this invoice';
    default:
      return `subscription is ${sub.status}`;
  }
}

const DECLINE_CATEGORIES: ReadonlySet<string> = new Set<DeclineCategory>([
  'insufficient_funds',
  'issuer_block',
  'card_problem',
  'authentication_required',
  'try_again',
  'blocked_by_risk',
  'unknown',
]);

/** A stored payment_declines.category, or null when it is not one we write copy for. */
export function toDeclineCategory(value: string | null | undefined): DeclineCategory | null {
  return value && DECLINE_CATEGORIES.has(value) ? (value as DeclineCategory) : null;
}
