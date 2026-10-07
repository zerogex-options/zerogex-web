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

// Whether the two PaymentMethod objects actually represent different money.
// Two ids differing is NOT enough: Stripe mints a fresh PaymentMethod on many
// checkouts, so a member who re-paid with the very same card leaves behind two
// objects for one instrument, and re-pointing between them changes nothing.
// Resolved by the caller from the identity scripts/dedupe-payment-methods.mjs
// already uses — card.fingerprint for cards, link.email for Link wallets.
//
//   'different' — provably distinct instruments (different fingerprints, or
//                 different types entirely). The finding worth acting on.
//   'same'      — one instrument behind two objects, as far as Stripe exposes.
//                 For Link that means one wallet address; the funding card
//                 inside it is never exposed, so this is the weaker claim of
//                 the two and the copy must not promise a re-point will help.
//   'unknown'   — a method could not be read, or exposes no comparable
//                 identity. Reported as drift: an unread method is a reason to
//                 look, not a reason to stay quiet.
export type InstrumentSameness = 'same' | 'different' | 'unknown';

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
  // How the pinned method compares to the customer default as an INSTRUMENT
  // rather than as an id. Only consulted when the two ids already disagree.
  // Defaults to 'unknown' so a caller that cannot compare still gets the
  // finding rather than silently losing it.
  instrumentSameness?: InstrumentSameness;
};

export type PaymentMethodPinVerdict =
  // The pinned method cannot be charged at all. The next renewal fails no
  // matter what the member's bank would have said.
  | { kind: 'broken'; reason: string }
  // Pin and customer default are both live and are different instruments: the
  // member chose other money and the subscription never heard about it.
  | { kind: 'drift'; reason: string }
  // The ids disagree but the instrument behind them looks like one and the
  // same. Re-pointing is close to a no-op, so this must not be reported beside
  // real drift — it would send an operator to "fix" a member whose card was
  // never the problem, and make the genuine findings harder to see.
  | { kind: 'duplicate'; reason: string }
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
    instrumentSameness = 'unknown',
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
    // Two ids is not two instruments. Stripe mints a new PaymentMethod on many
    // checkouts, so a member who rescued an invoice with the same card leaves
    // two objects for one card — which reads as textbook drift and is nothing
    // of the kind. Separate them, or the report sends an operator chasing
    // members whose payment method was never the problem.
    if (instrumentSameness === 'same') {
      return {
        kind: 'duplicate',
        reason:
          'pin and default are two PaymentMethod objects for what looks like one instrument',
      };
    }
    return {
      kind: 'drift',
      reason: 'subscription charges a method the member has since replaced as their default',
    };
  }

  return { kind: 'ok', reason: 'pin is live, owned, and agrees with the customer default' };
}

// What the report will actually PRINT, decided apart from the printing itself.
//
// This is here because the visibility rules and the all-clear line drifted apart
// twice: the all-clear was keyed on what the sweep FOUND while the sections were
// keyed on what it would SHOW, so a base whose only pairs were same-instrument
// and healthy printed nothing at all between the scanned count and the footer.
// An operator cannot tell that from truncated output or a crashed sweep, which
// makes a clean run indistinguishable from a broken one.
//
// The invariant worth protecting is simply: a run is never silent. Either the
// all-clear prints, or at least one findings section does — never neither, and
// never both.
export type DriftReportVisibility = {
  // Same-instrument pairs this run will list.
  shownDuplicateCount: number;
  // Same-instrument pairs held back, so the all-clear can mention they exist
  // rather than implying the sweep found nothing whatsoever.
  hiddenDuplicateCount: number;
  // Whether to print the "nothing to do" line.
  allClear: boolean;
};

export function decideDriftReportVisibility(input: {
  brokenCount: number;
  driftCount: number;
  duplicateCount: number;
  // Same-instrument pairs whose subscription is ALREADY failing. Shown even
  // without --verbose: there a re-point is cheap enough to try at low
  // confidence, and the operator needs to know the pair is not the tidy
  // old-card/new-card story before they write to the member.
  failingDuplicateCount: number;
  verbose: boolean;
}): DriftReportVisibility {
  const { brokenCount, driftCount, duplicateCount, failingDuplicateCount, verbose } = input;
  const shownDuplicateCount = verbose ? duplicateCount : failingDuplicateCount;
  return {
    shownDuplicateCount,
    hiddenDuplicateCount: duplicateCount - shownDuplicateCount,
    allClear: brokenCount === 0 && driftCount === 0 && shownDuplicateCount === 0,
  };
}

// When a paid invoice should re-point its subscription at the method that paid.
//
// The fix for the failure this module's header names, applied at the moment it
// is created rather than found a month later: a member rescues a failed invoice
// on Stripe's invoice page with a new method, Stripe saves it as the CUSTOMER
// default, and leaves the subscription pinned to the method that just failed.
// The webhook's invoice.paid handler asks this whether to pin the subscription
// to the method that paid, so the next renewal goes to the money that worked.
//
// Deliberately narrow about when it says yes:
//   - Something was actually charged. A $0 invoice, a credit-balance payment or
//     one marked paid out of band names no method.
//   - The subscription will renew. Re-pointing a canceled one changes nothing,
//     and an orphan recovery builds its own subscription on the paying card.
//   - The method is saved to this same customer. A one-off method that was never
//     attached cannot be charged again, and Stripe would refuse the update.
//   - It differs from what the subscription would charge now. With no pin,
//     Stripe falls back to the customer default, so a payment made with that
//     default changes nothing either.
// Two ids for one card (see InstrumentSameness) still re-point: the new object
// is live and attached, so pointing at it is harmless, and checking would cost a
// Stripe read on every renewal for nothing.
export type RepointOnPaymentInput = {
  // invoice.amount_paid, in the smallest currency unit.
  amountPaid: number;
  // subscription.status at the time the invoice was paid.
  subscriptionStatus: string;
  // The subscription's customer.
  customerId: string;
  // subscription.default_payment_method, resolved to a bare id, or null.
  pinnedPaymentMethodId: string | null;
  // customer.invoice_settings.default_payment_method, or null. Only consulted
  // when there is no pin, since that is the only time Stripe falls back to it.
  customerDefaultPaymentMethodId: string | null;
  // The PaymentMethod that paid the invoice, or null when none could be read.
  paidWithPaymentMethodId: string | null;
  // The customer that method is attached to, or null when it is attached to
  // nobody (a one-off payment).
  paidWithOwnerCustomerId: string | null;
};

export type RepointOnPaymentDecision = {
  repoint: boolean;
  reason: string;
};

// Statuses whose subscription will bill again, so a pin still matters.
const RENEWING_STATUSES = new Set(['active', 'trialing', 'past_due', 'unpaid']);

export function decideRepointOnPayment(input: RepointOnPaymentInput): RepointOnPaymentDecision {
  const {
    amountPaid,
    subscriptionStatus,
    customerId,
    pinnedPaymentMethodId,
    customerDefaultPaymentMethodId,
    paidWithPaymentMethodId,
    paidWithOwnerCustomerId,
  } = input;

  if (!(amountPaid > 0)) {
    return { repoint: false, reason: 'nothing was charged, so no method paid' };
  }
  if (!paidWithPaymentMethodId) {
    return { repoint: false, reason: 'the paying method could not be read' };
  }
  if (!RENEWING_STATUSES.has(subscriptionStatus)) {
    return { repoint: false, reason: `subscription is ${subscriptionStatus}; nothing renews` };
  }
  if (paidWithOwnerCustomerId !== customerId) {
    return {
      repoint: false,
      reason: 'the paying method is not saved to this customer, so it cannot be charged again',
    };
  }
  if (pinnedPaymentMethodId === paidWithPaymentMethodId) {
    return { repoint: false, reason: 'the subscription already renews on the method that paid' };
  }
  if (!pinnedPaymentMethodId && customerDefaultPaymentMethodId === paidWithPaymentMethodId) {
    return {
      repoint: false,
      reason: 'no pin, and the customer default Stripe falls back to is the method that paid',
    };
  }
  return {
    repoint: true,
    reason: pinnedPaymentMethodId
      ? 'paid with a different saved method than the one the subscription charges'
      : 'paid with a saved method, and the subscription has no method of its own',
  };
}
