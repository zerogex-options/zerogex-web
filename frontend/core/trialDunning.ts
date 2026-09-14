// Pure detection of a TRIAL-CONVERSION charge — the first real charge when a
// free trial ends — as distinct from an established-subscription RENEWAL
// charge. Both outcomes of that charge need their own copy:
//
//   - Declined → sendTrialConversionFailedEmail. A trialer who just got
//     declined never "subscribed", so renewal-framed wording ("your
//     subscription payment was declined") confuses them.
//   - Cleared → sendTrialConvertedEmail. The one moment the member actually
//     starts paying, which a renewal receipt must not be confused with.
//
// Both webhook branches (invoice.payment_failed / invoice.paid) classify the
// invoice through the SAME predicate below, so a member whose conversion
// charge fails and one whose clears can never be classified differently.
//
// Kept PURE (no imports) so it's unit-tested without Stripe — same discipline as
// core/paymentGrace.ts. Locked down in tests/trialDunning.test.ts.
//
// The signal is order-independent (unlike reading the member's live DB status,
// which races the subscription.updated event): a subscription's `trial_end`
// stays pinned to when its trial actually ended, so the first post-trial invoice
// is created right at `trial_end`, while a later renewal's invoice is created a
// full billing cycle after it. "Invoice created within a short window after
// trial_end, on a normal cycle charge" therefore uniquely identifies the
// trial-conversion charge.

const DAY_SECONDS = 24 * 60 * 60;
// Small back-buffer so clock skew / event timing can't push a genuine
// trial-conversion invoice just before trial_end out of the window.
const SKEW_SECONDS = 60 * 60;

export type TrialConversionInvoiceInput = {
  // subscription.trial_end (Unix seconds), or null when the sub never had a trial.
  trialEndUnix: number | null;
  // invoice.created (Unix seconds) of the invoice being classified.
  invoiceCreatedUnix: number | null;
  // invoice.billing_reason. When known, only the normal cycle charge that ends a
  // trial qualifies — this excludes proration/manual invoices that might happen to
  // fall near trial_end. Tolerates null/undefined (treated as "unknown, allow").
  billingReason?: string | null;
  // How long after trial_end the conversion invoice may be created to still count
  // (days). Default 2 — the first charge lands at trial_end; a renewal is a whole
  // cycle (≥ a week for weekly, ~a month for monthly) later, well outside this.
  windowDays?: number;
};

// Is this invoice the charge that ended the member's free trial?
export function isTrialConversionInvoice(input: TrialConversionInvoiceInput): boolean {
  const { trialEndUnix, invoiceCreatedUnix, billingReason, windowDays = 2 } = input;
  if (trialEndUnix == null || invoiceCreatedUnix == null) return false;
  if (!Number.isFinite(trialEndUnix) || !Number.isFinite(invoiceCreatedUnix)) return false;
  // Only the normal recurring charge ends a trial. A proration
  // ('subscription_update'), the initial $0 trial invoice ('subscription_create'),
  // or a manual invoice is never a trial conversion.
  if (billingReason != null && billingReason !== 'subscription_cycle') return false;
  const deltaSeconds = invoiceCreatedUnix - trialEndUnix;
  return deltaSeconds >= -SKEW_SECONDS && deltaSeconds <= windowDays * DAY_SECONDS;
}

// Failure-path spelling of the identical question, kept so the dunning call site
// and its tests read in their own domain. Deliberately an alias, not a copy:
// the two paths must never drift apart on what counts as a conversion charge.
export const isTrialConversionFailure = isTrialConversionInvoice;
export type TrialConversionFailureInput = TrialConversionInvoiceInput;

// Whether a subscription's trial ended recently enough that a payment problem
// observed at `nowMs` belongs to its FIRST charge rather than a later renewal.
// Same window and skew as isTrialConversionInvoice, for callers that hold the
// SUBSCRIPTION but no invoice — notably the `customer.subscription.updated`
// grace decision (core/paymentGrace), which cannot see the invoice at all.
//
// Order-independence is the whole point here too: at trial end Stripe moves the
// sub to `active` (cycle invoice created) and only to `past_due` once that
// invoice finalizes and the charge is declined, so the last-synced status is
// `active` by the time the failure lands. trial_end stays pinned to when the
// trial actually ended, so it identifies the conversion regardless of sync order.
export function isWithinTrialConversionWindow(
  trialEndUnix: number | null | undefined,
  nowMs: number,
  windowDays = 2,
): boolean {
  if (trialEndUnix == null || !Number.isFinite(trialEndUnix)) return false;
  if (!Number.isFinite(nowMs)) return false;
  const deltaSeconds = nowMs / 1000 - trialEndUnix;
  return deltaSeconds >= -SKEW_SECONDS && deltaSeconds <= windowDays * DAY_SECONDS;
}

// Does this member have a trial-conversion charge that has NOT settled yet —
// i.e. is money about to move right now?
//
// Stripe does not charge a `subscription_cycle` invoice the instant it creates
// it. At trial end the invoice is created as a DRAFT and auto-finalizes roughly
// an hour later; only then is the card charged. A member who cancels inside
// that hour has genuinely canceled before the charge — but `cancel_at_period_end`
// does nothing to an already-created invoice, so the charge still lands on them
// half an hour later.
//
// Letting that charge land is deliberate: the trial ran its full length, and a
// cancel after it expires still owes the period. What is NOT acceptable is our
// email contradicting itself — acknowledging the cancellation with "nothing
// changes yet on your end" and then charging them thirty minutes later. This
// predicate is what lets the cancellation acknowledgment say so up front.
export type ConversionChargeInFlightInput = {
  // subscription.status as Stripe reports it at the moment of the cancellation.
  status: string | null | undefined;
  // subscription.trial_end (Unix seconds), or null when the sub never had one.
  trialEndUnix: number | null | undefined;
  // users.first_payment_at — ISO instant this account's first real invoice was
  // actually PAID, or null if none ever has been. Still null after trial_end is
  // exactly what says the conversion charge has not settled yet.
  firstPaymentAtIso: string | null | undefined;
  nowMs: number;
};

export function hasConversionChargeInFlight(input: ConversionChargeInFlightInput): boolean {
  const { status, trialEndUnix, firstPaymentAtIso, nowMs } = input;
  // A first payment already on record means this account's conversion charge
  // settled at some point — an ordinary member canceling, nothing in flight.
  if (firstPaymentAtIso != null) return false;
  // Still `trialing` means the cycle invoice does not exist yet, and canceling
  // now means they are never charged at all — the happy path, which must keep
  // its existing reassuring copy. `past_due` is deliberately excluded too:
  // those members already received the payment-failed email, which owns that
  // conversation and states the amount itself.
  if (status !== 'active') return false;
  if (trialEndUnix == null || !Number.isFinite(trialEndUnix)) return false;
  if (!Number.isFinite(nowMs)) return false;
  // The trial must actually be over. isWithinTrialConversionWindow tolerates an
  // hour of skew on EITHER side by design; here a trial_end still in the future
  // means no invoice yet, so it is pinned strictly to the past.
  if (trialEndUnix * 1000 > nowMs) return false;
  // Past the conversion window an unpaid `active` sub is some other billing
  // state, not a trial that just converted.
  return isWithinTrialConversionWindow(trialEndUnix, nowMs);
}
