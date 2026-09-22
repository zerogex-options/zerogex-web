// When a subscription dies for nonpayment, Stripe leaves its final invoice
// OPEN and payable — forever, with a live hosted payment page whose URL is in
// every dunning email Stripe already sent. This module decides when that
// invoice has outlived the thing it can buy, and must be voided.
//
// THE TRAP, as it played out in production:
//
//   A trial converted on Aug 19 and the $29.00 charge was declined five times.
//   Stripe cancelled the subscription for nonpayment on Aug 22 and left the
//   invoice open. It covered Aug 19 - Sep 19. Then:
//
//     - Pay it on Aug 23 and you get almost the whole month you bought. The
//       invoice.paid orphan-recovery path (core/orphanPayment.ts) re-creates the
//       subscription anchored at Sep 19 and it works exactly as intended.
//     - Pay it on Sep 18 and you get ONE DAY, then renew at full price the next
//       morning.
//     - Pay it on Sep 20 and you get NOTHING. decideOrphanPayment returns
//       `period_already_elapsed` — Stripe will not accept a billing anchor in
//       the past — so the money lands with no entitlement and waits for a human
//       to notice and refund it.
//
//   Nothing in the system marked that cliff, so a recovery campaign mailed the
//   member on Sep 17 inviting them to settle it. Two days later the same link
//   would have taken $29.00 for nothing.
//
// WHY THIS IS NOT "VOID IT AT CANCELLATION". At the moment dunning gives up,
// the period the invoice covers has usually barely started — voiding then
// destroys a real option the member still holds, and it is the option the whole
// orphan-recovery path exists to honour. The invoice only becomes a trap at the
// far end, when it can no longer buy access. That is the moment to void, and it
// is a moment nothing was watching.

export type StaleInvoiceInput = {
  // invoice.status. Only an 'open' invoice is both payable and voidable;
  // 'draft' is still Stripe's to finalize, and paid/void/uncollectible are done.
  invoiceStatus: string | null;
  // invoice.amount_due, minor units. A zero-due invoice takes no money and so
  // can spring no trap.
  amountDue: number;
  // End of the period this invoice covers (readInvoicePeriodEndUnix), or null
  // when it could not be read.
  periodEndUnix: number | null;
  // LIVE status of the subscription this invoice billed, read back from Stripe,
  // or null when it no longer exists. Anything still live is not stale: paying
  // it moves the subscription back to active through the ordinary sync.
  subscriptionStatus: string | null;
  // Stripe's cancellation_details.reason on that subscription — authoritative
  // about HOW it ended, and the difference between a trap and a debt.
  //
  // 'payment_failed' means dunning killed it: access was cut at cancellation,
  // so the period this invoice bills for was never delivered. Once that period
  // is behind us the invoice can only take money for nothing.
  //
  // Anything else (a member who cancelled, an operator who cancelled) may be a
  // genuine receivable for a period the member DID have. Forgiving that
  // automatically is not this function's call, so it is kept.
  cancellationReason: string | null;
  // Operator override for a deliberate sweep that also clears voluntary-cancel
  // leftovers. Never set from the webhook.
  includeVoluntary?: boolean;
  nowUnix: number;
};

// Mirrors LIVE_SUBSCRIPTION_STATUSES in core/orphanPayment.ts. Kept as its own
// copy rather than imported so the two decisions can be read independently, and
// deliberately identical: an invoice one module calls recoverable must never be
// one the other calls void-able.
const LIVE_SUBSCRIPTION_STATUSES = new Set([
  'active',
  'trialing',
  'past_due',
  'unpaid',
  'incomplete',
  'paused',
]);

export type StaleInvoiceDecision =
  // Void it: it can no longer buy anything, so every dollar it could still
  // collect is a dollar collected for nothing.
  | { kind: 'void'; reason: string }
  // Leave it payable, and say when it stops being worth paying. The caller
  // surfaces that date so no campaign ever solicits payment past it.
  | { kind: 'keep'; reason: string; buysAccessUntilUnix: number | null };

/**
 * Whether an open invoice on a dead subscription has outlived its value.
 *
 * The rule is narrow on purpose. Voiding is FINAL — it cannot be undone and it
 * removes the member's ability to buy back the period they lost — so it is
 * reserved for invoices that provably cannot buy anything: the subscription is
 * gone, and the period the invoice covers is already behind us. An invoice
 * whose period we cannot read is kept, because "unknown" must not authorize an
 * irreversible write.
 */
export function decideStaleInvoice(input: StaleInvoiceInput): StaleInvoiceDecision {
  if (input.invoiceStatus !== 'open') {
    return { kind: 'keep', reason: `invoice_${input.invoiceStatus ?? 'unknown'}`, buysAccessUntilUnix: null };
  }
  if (!(input.amountDue > 0)) {
    return { kind: 'keep', reason: 'zero_amount_due', buysAccessUntilUnix: null };
  }
  if (input.subscriptionStatus && LIVE_SUBSCRIPTION_STATUSES.has(input.subscriptionStatus)) {
    // Paying this one restores the subscription through the ordinary sync.
    return { kind: 'keep', reason: 'subscription_live', buysAccessUntilUnix: input.periodEndUnix };
  }
  if (input.periodEndUnix == null) {
    // Unreadable period. Voiding is irreversible; not knowing is not a licence.
    return { kind: 'keep', reason: 'period_unresolved', buysAccessUntilUnix: null };
  }
  if (input.periodEndUnix > input.nowUnix) {
    // Still buys real access. This is the window orphan recovery honours.
    return { kind: 'keep', reason: 'still_buys_access', buysAccessUntilUnix: input.periodEndUnix };
  }
  if (input.cancellationReason !== 'payment_failed' && input.includeVoluntary !== true) {
    // The period is gone, but the member may well have HAD it — a voluntary
    // cancel after a failed renewal leaves a bill for time actually served.
    // Writing that off is an operator's decision, not an automatic one.
    return {
      kind: 'keep',
      reason: `not_a_dunning_cancellation_${input.cancellationReason ?? 'unknown'}`,
      buysAccessUntilUnix: input.periodEndUnix,
    };
  }
  return { kind: 'void', reason: 'period_elapsed_on_dead_subscription' };
}

/**
 * How long an open invoice is still worth paying, in whole hours.
 *
 * Used for the warning the webhook writes at cancellation: an operator reading
 * the audit trail a month later should not have to derive this cliff by hand
 * off a period end, which is exactly what happened in the incident above.
 */
export function hoursOfValueRemaining(input: {
  periodEndUnix: number | null;
  nowUnix: number;
}): number | null {
  if (input.periodEndUnix == null) return null;
  const seconds = input.periodEndUnix - input.nowUnix;
  return seconds <= 0 ? 0 : Math.floor(seconds / 3600);
}
