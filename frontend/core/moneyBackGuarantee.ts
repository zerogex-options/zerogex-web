// The 7-day money-back guarantee, as pure decisions: may THIS subscription be
// refunded under the guarantee right now, which payments does that cover, and
// has this customer already used their one refund.
//
// THE PROMISE (stated on the pricing page, above the Subscribe button, in the
// welcome email and in the Terms): every plan except the trial plan is paid up
// front, and if it isn't for you, a full refund can be requested from the
// Account page within 7 days of paying. Access ends when the refund is issued.
// Limit one refund per customer — matched on the account, the email address
// (canonicalized, see canonicalEmail) or the card, so a second account on the
// same card or a +alias of the same inbox is the same customer.
//
// WHICH SUBSCRIPTIONS ARE COVERED. The first money-moving invoice on the
// subscription decides it, read live from Stripe (never from local mirrors, and
// never from anything the client sends):
//
//   • checkout stamps metadata money_back=1 on every guarantee-plan purchase,
//     and the in-app trial upgrade stamps it when it ends a trial to move the
//     member onto a guarantee plan. A stamped subscription is covered from the
//     invoice that started it being paid for — a create/update invoice, or the
//     one the upgrade itself raised at the moment it ended the trial.
//   • An unstamped subscription whose first paid invoice is a plan-change
//     (update) invoice for a guarantee plan is covered: that is a Basic trial
//     moved to a guarantee plan in the Stripe billing portal, which ends the
//     trial and bills the new plan without our stamp.
//   • Never covered: an unstamped purchase (create invoice). Checkout stamps
//     every purchase it sells under the guarantee, so an unstamped one was sold
//     without it: before the guarantee existed, or on the trial plan. Also
//     never covered: a trial that simply ran out and converted (that customer
//     had the free trial instead), and a subscription whose first paid invoice
//     is an ordinary renewal (their first period was free — a referral month).
//
// WHAT IS REFUNDED: every payment on the subscription that has not already been
// given back — normally just the one, plus any proration from an upgrade made
// inside the window. Always in full, never a pro-rata remainder: a partial
// refund is exactly the state core/orphanPayment.ts refuses to reason about
// alone, so the flow never creates one.
//
// Kept PURE (the only import is another pure module) so every branch is
// unit-tested without Stripe or a database — tests/moneyBackGuarantee.test.ts.

import { isTrialConversionInvoice } from './trialDunning.ts';

export type GuaranteeInvoice = {
  id: string;
  status: string | null;
  billingReason: string | null;
  // Minor units (cents).
  amountPaid: number;
  // How much of this invoice has already been given back, or null when that
  // could not be read — which refuses the refund rather than guessing.
  amountRefunded: number | null;
  paidAtUnix: number | null;
  createdUnix: number | null;
  priceId: string | null;
  chargeId: string | null;
  paymentIntentId: string | null;
  currency: string | null;
};

export type GuaranteeSubscription = {
  id: string;
  status: string;
  trialEndUnix: number | null;
  // metadata.money_back === '1'
  stampedMoneyBack: boolean;
};

export type RefundItem = {
  invoiceId: string;
  chargeId: string | null;
  paymentIntentId: string | null;
  // What is still unrefunded on this invoice, in minor units.
  amount: number;
  currency: string;
};

export type MoneyBackIneligibleReason =
  | 'no_subscription'
  | 'subscription_ended'
  | 'no_payment'
  | 'not_covered'
  | 'window_elapsed'
  | 'prior_refund'
  | 'already_refunded'
  | 'refund_state_unknown'
  | 'needs_manual_refund';

export type MoneyBackDecision =
  | {
      eligible: true;
      // Last instant a request is honored (ms since epoch).
      deadlineMs: number;
      firstPaidInvoiceId: string;
      firstPaidPriceId: string | null;
      firstPaidAtMs: number;
      refunds: RefundItem[];
      totalAmount: number;
      currency: string;
    }
  | {
      eligible: false;
      reason: MoneyBackIneligibleReason;
      // Set when a covered payment exists, so the UI can say "your window
      // closed on …" rather than just "no".
      deadlineMs?: number;
    };

export type MoneyBackInput = {
  nowMs: number;
  windowDays: number;
  subscription: GuaranteeSubscription | null;
  // Every invoice on the subscription Stripe returned, any status, any order.
  invoices: ReadonlyArray<GuaranteeInvoice>;
  // Whether a price id belongs to a plan sold under the guarantee (the caller
  // maps price → SKU → skuHasMoneyBackGuarantee). An unknown price is false.
  priceCovered: (priceId: string | null) => boolean;
  // A COMPLETED or in-flight guarantee refund already exists for this customer
  // on a DIFFERENT subscription (account, canonical email or card match).
  priorRefundElsewhere: boolean;
  // A guarantee request for THIS subscription was already started (a ledger
  // row that is pending or failed). It is being resumed, so the window and the
  // one-refund limit were already satisfied when it was first made.
  resuming: boolean;
  // Only payments made at or before this instant are refunded. For a fresh
  // request that is simply "now"; for a resumed one it is when the member first
  // asked, so a request that stalled and is finished later can never sweep up
  // a renewal they paid after asking.
  refundCutoffMs?: number;
};

const DAY_MS = 86_400_000;
const ENDED_STATUSES = new Set(['canceled', 'incomplete_expired']);

function paidAtMs(invoice: GuaranteeInvoice): number | null {
  const unix = invoice.paidAtUnix ?? invoice.createdUnix;
  return unix == null ? null : unix * 1000;
}

// The invoices that actually moved money, oldest payment first.
export function paidInvoices(invoices: ReadonlyArray<GuaranteeInvoice>): GuaranteeInvoice[] {
  return invoices
    .filter((invoice) => invoice.status === 'paid' && invoice.amountPaid > 0 && paidAtMs(invoice) != null)
    .sort((a, b) => (paidAtMs(a) ?? 0) - (paidAtMs(b) ?? 0));
}

// Is this subscription sold under the guarantee, judged from the invoice that
// first took money on it? See the header for the three shapes.
export function isCoveredStart(
  subscription: GuaranteeSubscription,
  first: GuaranteeInvoice,
  priceCovered: (priceId: string | null) => boolean,
): boolean {
  if (first.billingReason === 'subscription_create') return subscription.stampedMoneyBack;
  if (first.billingReason === 'subscription_update') {
    return subscription.stampedMoneyBack || priceCovered(first.priceId);
  }
  // A cycle invoice raised the moment the trial ended. Covered only when we
  // stamped the subscription — i.e. our own upgrade ended the trial, which
  // Stripe may bill as a cycle. A trial that simply ran out is not covered.
  const raisedAtTrialEnd = isTrialConversionInvoice({
    trialEndUnix: subscription.trialEndUnix,
    invoiceCreatedUnix: first.createdUnix,
    billingReason: first.billingReason,
  });
  return raisedAtTrialEnd && subscription.stampedMoneyBack;
}

export function decideMoneyBack(input: MoneyBackInput): MoneyBackDecision {
  const { subscription } = input;
  if (!subscription) return { eligible: false, reason: 'no_subscription' };
  if (ENDED_STATUSES.has(subscription.status) && !input.resuming) {
    return { eligible: false, reason: 'subscription_ended' };
  }

  // A refund leaves an invoice reading status=paid with amount_paid untouched,
  // so a refunded payment still appears here — which is what lets a resumed
  // request find its first payment again and see how much is left.
  const paid = paidInvoices(input.invoices);
  const first = paid[0];
  if (!first) return { eligible: false, reason: 'no_payment' };

  if (!isCoveredStart(subscription, first, input.priceCovered)) {
    return { eligible: false, reason: 'not_covered' };
  }

  const firstPaidAtMs = paidAtMs(first) as number;
  const deadlineMs = firstPaidAtMs + input.windowDays * DAY_MS;
  if (!input.resuming) {
    if (input.nowMs > deadlineMs) return { eligible: false, reason: 'window_elapsed', deadlineMs };
    if (input.priorRefundElsewhere) return { eligible: false, reason: 'prior_refund', deadlineMs };
  }

  const cutoffMs = input.refundCutoffMs ?? input.nowMs;
  const refunds: RefundItem[] = [];
  let unknown = false;
  let manual = false;
  for (const invoice of paid) {
    if ((paidAtMs(invoice) ?? 0) > cutoffMs) continue;
    if (invoice.amountRefunded == null) {
      unknown = true;
      continue;
    }
    const remaining = invoice.amountPaid - invoice.amountRefunded;
    if (remaining <= 0) continue;
    if (!invoice.chargeId && !invoice.paymentIntentId) {
      // Paid out of band or with no card charge behind it: nothing the refunds
      // API can reverse. A human has to look.
      manual = true;
      continue;
    }
    refunds.push({
      invoiceId: invoice.id,
      chargeId: invoice.chargeId,
      paymentIntentId: invoice.paymentIntentId,
      amount: remaining,
      currency: (invoice.currency ?? 'usd').toLowerCase(),
    });
  }
  if (unknown) return { eligible: false, reason: 'refund_state_unknown', deadlineMs };
  if (manual) return { eligible: false, reason: 'needs_manual_refund', deadlineMs };
  if (refunds.length === 0 && !input.resuming) {
    return { eligible: false, reason: 'already_refunded', deadlineMs };
  }

  const currencies = new Set(refunds.map((r) => r.currency));
  if (currencies.size > 1) return { eligible: false, reason: 'needs_manual_refund', deadlineMs };

  return {
    eligible: true,
    deadlineMs,
    firstPaidInvoiceId: first.id,
    firstPaidPriceId: first.priceId,
    firstPaidAtMs,
    refunds,
    totalAmount: refunds.reduce((sum, r) => sum + r.amount, 0),
    currency: refunds[0]?.currency ?? (first.currency ?? 'usd').toLowerCase(),
  };
}

// Canonical form of an email address for the one-refund-per-customer match:
// lower-cased, "+tag" dropped from the local part, and for Gmail the dots too
// (Gmail ignores them, so j.doe@ and jdoe@ are one inbox). Deliberately
// conservative beyond that — only rules that are true of the mailbox, never a
// guess that could lump two real people together.
export function canonicalEmail(raw: string): string {
  const email = raw.trim().toLowerCase();
  const at = email.lastIndexOf('@');
  if (at <= 0) return email;
  let local = email.slice(0, at);
  let domain = email.slice(at + 1);
  const plus = local.indexOf('+');
  if (plus > 0) local = local.slice(0, plus);
  if (domain === 'googlemail.com') domain = 'gmail.com';
  if (domain === 'gmail.com') local = local.replaceAll('.', '');
  return `${local}@${domain}`;
}
