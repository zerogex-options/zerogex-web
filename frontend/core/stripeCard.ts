import type Stripe from 'stripe';

import { readInvoicePaymentIntentId, readInvoicePaymentMethodId } from './stripeInvoice.ts';

// Stripe reports card brands as lowercase codes (visa, mastercard, amex, …).
// Map the documented set to display-ready names for customer-facing copy.
// Anything unmapped — including 'unknown' and the 'link' wallet — resolves to
// null so callers fall back to "the payment method ending in ….", never a
// mis-cased or code-y label. Shared by the trial-reminder cron and the
// payment-failed dunning email so both name a card identically.
const CARD_BRAND_LABELS: Record<string, string> = {
  amex: 'American Express',
  diners: 'Diners Club',
  discover: 'Discover',
  eftpos_au: 'EFTPOS',
  jcb: 'JCB',
  mastercard: 'Mastercard',
  unionpay: 'UnionPay',
  visa: 'Visa',
};

// Normalize a raw Stripe brand code to a display-ready label, or null when the
// brand is missing/unrecognized (wallet, Link, an unmapped code) so the caller
// can drop to neutral phrasing.
export function formatCardBrand(brand: string | null | undefined): string | null {
  if (!brand) return null;
  return CARD_BRAND_LABELS[brand.toLowerCase()] ?? null;
}

// Resolve a Stripe reference that may be either a bare id string or an expanded
// object down to its id.
function idOf(ref: unknown): string | null {
  if (!ref) return null;
  if (typeof ref === 'string') return ref;
  if (typeof ref === 'object' && typeof (ref as { id?: unknown }).id === 'string') {
    return (ref as { id: string }).id;
  }
  return null;
}

// Brand (display-ready) + last four of the card on a subscription: its own
// default payment method if set, else the customer's invoice-settings default
// (Stripe's fallback when the sub has none). For a failed renewal this is the
// card Stripe just tried to charge, so it's the one to name in the dunning
// nudge. Returns null when no card is resolvable (a wallet/Link method with no
// card object, or no subscription/customer). Stripe errors propagate — callers
// that treat the card as best-effort should wrap the call.
export async function resolveSubscriptionCard(
  stripe: Stripe,
  subscriptionId: string | null,
  customerId: string | null,
): Promise<{ brand: string | null; last4: string } | null> {
  if (subscriptionId) {
    const sub = await stripe.subscriptions.retrieve(subscriptionId, {
      expand: ['default_payment_method'],
    });
    const subPm = sub.default_payment_method;
    if (subPm && typeof subPm === 'object' && 'card' in subPm && subPm.card?.last4) {
      return { brand: formatCardBrand(subPm.card.brand), last4: subPm.card.last4 };
    }
  }

  if (customerId) {
    const customer = await stripe.customers.retrieve(customerId);
    if (!('deleted' in customer && customer.deleted)) {
      const pmId = idOf((customer as Stripe.Customer).invoice_settings?.default_payment_method);
      if (pmId) {
        const pm = await stripe.paymentMethods.retrieve(pmId);
        if (pm.card?.last4) return { brand: formatCardBrand(pm.card.brand), last4: pm.card.last4 };
      }
    }
  }

  return null;
}

// The payment method that actually SETTLED an invoice, resolved in full: read
// it straight off the payload when it is there, else follow the invoice's
// PaymentIntent and read it from that. Returns null when neither yields one.
//
// Recovery is the caller that matters. Re-creating a subscription for a member
// whose payment was orphaned must renew on the card that just worked, not the
// one that failed its way into cancellation — but a webhook invoice arrives
// unexpanded, so the method is usually absent and only the intent's id is
// present. Without the round trip the new subscription is created with NO
// default payment method on either the subscription or the customer, leaving
// Stripe to guess at renewal time; with one card on file it guesses right, and
// with two it is a coin toss on a member who has already been through one
// failed charge.
//
// Lives here, shared, because the webhook and scripts/recover-orphan-payment
// both build that subscription and must not drift: the script previously read
// only the payload and had no fallback at all.
export async function resolveInvoicePaymentMethodId(
  stripe: Stripe,
  invoice: unknown,
): Promise<string | null> {
  const fromPayload = readInvoicePaymentMethodId(invoice);
  if (fromPayload) return fromPayload;

  const paymentIntentId = readInvoicePaymentIntentId(invoice);
  if (!paymentIntentId) return null;

  try {
    const pi = await stripe.paymentIntents.retrieve(paymentIntentId);
    return typeof pi.payment_method === 'string'
      ? pi.payment_method
      : (pi.payment_method?.id ?? null);
  } catch {
    // Non-fatal by design: the caller still creates the subscription, Stripe
    // still falls back to a method on the customer, and a member who has paid
    // must never be left on 'public' over an optional parameter.
    return null;
  }
}
