// Which audit rows are evidence that a SUBSCRIPTION's own invoice was PAID.
//
// The Subscriber Ledger's Converting -> Full Subscriber step and the Conversion
// Conveyor's conversion confirmation both need to know that money actually moved
// on a given subscription. Nothing about the subscription itself changes when
// its invoice is paid, so the `stripe_subscription_sync` stream those views are
// built on cannot see it — this is the only record.
//
// Kept PURE (no imports) so the rule is unit-testable; core/monitoring.ts does
// the SQL and the sub-id parsing around it.

// The two audit types that can carry that evidence. NEITHER alone covers
// everyone:
//
//   stripe_first_payment  is stamped at most once per ACCOUNT — maybeStampFirstPayment
//                         in the Stripe webhook route short-circuits on a non-null
//                         users.first_payment_at — so a returning member's SECOND
//                         subscription never produces one. Both views key on the
//                         SUBSCRIPTION, so on this stream alone a reactivated
//                         member's conversion is invisible to them: they enter
//                         Converting when the trial ends and never leave, until
//                         the fallback confirmation window eventually promotes
//                         them two days late under the wrong explanation.
//
//   stripe_invoice_paid   is written for EVERY paid subscription invoice, but only
//                         since that event type shipped (see the stripe_invoice_history
//                         note in core/db.ts). Conversions older than it have a
//                         stripe_first_payment row and nothing else.
//
// Reading both and letting each consumer keep the FIRST hit per subscription
// covers the whole history without double-counting: the ledger already ignores
// every payment after a subscription's first, and the conveyor only asks whether
// a subscription appears at all.
export const SUBSCRIPTION_PAYMENT_AUDIT_TYPES = [
  'stripe_first_payment',
  'stripe_invoice_paid',
] as const;

// The $0 invoice Stripe raises and settles the instant a trial starts. It is a
// genuinely paid invoice on the subscription, but no money moved and the trial
// has not converted, so it must never count as that subscription's first
// payment. Getting this wrong is not cosmetic:
//   • the ledger would see every trial as paid on day one, classify the
//     trial->paid step straight to Full Subscriber, and the Converting band
//     would disappear from it entirely — reinstating the sawtooth that band
//     exists to prevent;
//   • the conveyor would treat the conversion as CONFIRMED at boarding, making a
//     charge that later declines unrevokable and inflating the conversion rate.
// Same rule and same reason as maybeStampFirstPayment in the Stripe webhook
// route, which excludes it before ever writing a stripe_first_payment row.
//
// A no-trial signup's `subscription_create` invoice always carries a real
// amount, so this only ever matches the trial-opening one. An amount that does
// not parse is deliberately NOT excluded: under-reporting a real payment parks a
// paying member on Converting, which is the worse of the two failures.
function isTrialOpeningInvoice(message: string): boolean {
  if (!/\bbilling_reason=subscription_create\b/.test(message)) return false;
  const amount = message.match(/\bamount=(\d+)\b/)?.[1];
  return amount != null && Number(amount) === 0;
}

/**
 * Whether one audit row proves a payment cleared on the subscription it names.
 * Anything outside SUBSCRIPTION_PAYMENT_AUDIT_TYPES is not payment evidence, so
 * a widened query can never smuggle another event type in.
 */
export function isSubscriptionPaymentEvidence(type: string, message: string): boolean {
  // Already filtered at write time by maybeStampFirstPayment, which applies the
  // trial-opening exclusion before it stamps.
  if (type === 'stripe_first_payment') return true;
  if (type !== 'stripe_invoice_paid') return false;
  return !isTrialOpeningInvoice(message);
}

/**
 * Whether a paid invoice for `invoiceSubscriptionId` should move this member's
 * users.last_paid_subscription_id pointer.
 *
 * Almost always yes. The pointer is what tells Full Subscriber from Converting,
 * and it is deliberately NOT cleared when the subscription changes: `invoice.paid`
 * and `customer.subscription.created` arrive in no guaranteed order, so a
 * clear-on-change scheme would drop the stamp whenever the payment landed first
 * — routine for a no-trial signup, and it would park a brand-new paying member
 * on Converting indefinitely. Accepting the write whenever nothing is recorded
 * yet is what makes the pair order-independent.
 *
 * The one write to refuse is a LATE invoice on a subscription the member has
 * already moved off: paying an old invoice must not drag the pointer backwards
 * off the subscription they are actually on, which would read as an established
 * member falling back into Converting.
 */
export function acceptsSubscriptionPaymentStamp(input: {
  // users.last_paid_subscription_id as it stands now.
  lastPaidSubscriptionId: string | null;
  // users.stripe_subscription_id — the subscription the member is on.
  currentSubscriptionId: string | null;
  // The subscription the freshly-paid invoice belongs to.
  invoiceSubscriptionId: string;
}): boolean {
  const { lastPaidSubscriptionId, currentSubscriptionId, invoiceSubscriptionId } = input;
  // Nothing recorded yet — including the ordering case above, where the sync
  // that sets stripe_subscription_id has not landed.
  if (lastPaidSubscriptionId == null) return true;
  // The same subscription paying again: an ordinary renewal moving the date on.
  if (lastPaidSubscriptionId === invoiceSubscriptionId) return true;
  // The sync has not caught up, so we cannot tell this is stale. Accept — the
  // failure mode of refusing here (a paying member stuck on Converting) is worse
  // than of accepting (corrected by their next invoice).
  if (currentSubscriptionId == null) return true;
  // This IS the subscription they are on: a returning member's first payment on
  // their new subscription, which is exactly what has to move the pointer.
  return currentSubscriptionId === invoiceSubscriptionId;
}
