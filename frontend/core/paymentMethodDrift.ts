// Pure decision logic for "is this subscription about to charge a payment
// method the member has moved on from?", extracted from
// scripts/scan-payment-method-drift.mts so the classification can be unit-tested
// without a Stripe account and a live customer base (mirrors core/paymentGrace.ts
// and core/orphanPayment.ts).
//
// The problem it names: Stripe charges a subscription's OWN
// default_payment_method whenever one is set, and only falls back to the
// customer's invoice_settings default when it is not — the same precedence
// core/stripeCard.ts walks to decide which card the dunning email should name.
// So when a member rescues a failed invoice with a new card, Stripe attaches
// that card and makes it the CUSTOMER default, but leaves the subscription
// pinned to the old one. The invoice clears, the payment-recovered email fires,
// and the next renewal bills the replaced method all over again.
//
// That failure is invisible to everything else we watch: the webhook records an
// ordinary stripe_payment_failed, the decline arrives with no useful code, and
// the dunning copy correctly stays neutral. The only trace is two Stripe fields
// quietly disagreeing, which is what this classifies.

// A pin is only meaningful once the payment method behind it has been resolved,
// so the caller does the Stripe reads and hands the facts in — same shape as
// decideOrphanPayment.
export type PaymentMethodPinInput = {
  // The customer the subscription belongs to. A pinned method that belongs to
  // anyone else cannot be charged for this subscription.
  customerId: string;
  // subscription.default_payment_method, resolved to a bare id. Null when the
  // subscription has no pin of its own.
  pinnedPaymentMethodId: string | null;
  // customer.invoice_settings.default_payment_method, resolved to a bare id.
  // Null when the customer names no default either.
  customerDefaultPaymentMethodId: string | null;
  // Whether the pinned method could be retrieved from Stripe at all. False when
  // the retrieve 404s — a detached or deleted method. Meaningless (and ignored)
  // when there is no pin.
  pinnedExists: boolean;
  // The customer the pinned method is currently attached to, or null when it is
  // attached to nobody. Ignored when the pin does not exist.
  pinnedOwnerCustomerId: string | null;
};

export type PaymentMethodPinVerdict =
  // The pinned method cannot be charged at all. The next renewal fails no
  // matter what the member's bank would have said.
  | { kind: 'broken'; reason: string }
  // Pin and customer default are both live and different: the member chose
  // something else and the subscription never heard about it.
  | { kind: 'drift'; reason: string }
  // Nothing is named anywhere, so Stripe falls back to the legacy
  // default_source. Often harmless, occasionally a charge with no instrument.
  | { kind: 'no_default'; reason: string }
  // Consistent — either the pin agrees with the default, or there is no pin and
  // the fallback resolves to a real method.
  | { kind: 'ok'; reason: string };

export function classifyPaymentMethodPin(
  input: PaymentMethodPinInput,
): PaymentMethodPinVerdict {
  const {
    customerId,
    pinnedPaymentMethodId,
    customerDefaultPaymentMethodId,
    pinnedExists,
    pinnedOwnerCustomerId,
  } = input;

  // No pin at all is NOT drift: Stripe's own fallback to the customer default
  // is exactly what we would re-point the subscription to anyway. Reporting
  // these would bury the real findings under every healthy subscription that
  // simply never set one.
  if (!pinnedPaymentMethodId) {
    if (customerDefaultPaymentMethodId) {
      return { kind: 'ok', reason: 'no pin; falls back to the customer default' };
    }
    return {
      kind: 'no_default',
      reason: 'neither the subscription nor the customer names a default payment method',
    };
  }

  // Ordering matters from here: a pin that cannot be charged is a harder
  // finding than one that merely disagrees, and a broken pin whose customer
  // default also disagrees would otherwise be filed as ordinary drift and
  // under-read as "might still be fine".
  if (!pinnedExists) {
    return { kind: 'broken', reason: 'pinned method no longer exists in Stripe' };
  }

  if (pinnedOwnerCustomerId !== customerId) {
    return {
      kind: 'broken',
      reason: pinnedOwnerCustomerId
        ? 'pinned method is attached to a different customer'
        : 'pinned method is detached from every customer',
    };
  }

  // A customer default that is absent cannot disagree with anything. The pin is
  // then the only instruction Stripe has, and it is live and owned — nothing to
  // report, even though there is no second opinion to check it against.
  if (customerDefaultPaymentMethodId && customerDefaultPaymentMethodId !== pinnedPaymentMethodId) {
    return {
      kind: 'drift',
      reason: 'subscription charges a method the member has since replaced as their default',
    };
  }

  return { kind: 'ok', reason: 'pin is live, owned, and agrees with the customer default' };
}
