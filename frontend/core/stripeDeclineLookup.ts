// Given a failed invoice, go and get the reason the issuer actually gave.
//
// Stripe does not put the decline reason on the invoice. It is on the CHARGE
// the attempt produced (`failure_code`, `outcome.reason`,
// `outcome.network_decline_code`, `outcome.seller_message`), or — when the
// attempt never got as far as a charge, which is what an abandoned 3DS step-up
// looks like — on the payment intent's `last_payment_error`. Either way it takes
// a live API read, and this is the one place that knows which object to read and
// in which order.
//
// Separated from the webhook route so the backfill script can re-run exactly the
// same lookup over historical invoices, and so a failure here is visibly
// best-effort: EVERY path returns nulls rather than throwing. A decline recorded
// without its reason is a gap in one column; a webhook that 500s because Stripe
// was slow makes Stripe retry the whole event and re-send the member's dunning
// email.

import type Stripe from 'stripe';
import { readChargeDecline, readPaymentIntentDecline, type ChargeDecline } from './declineReason.ts';
import { readInvoiceChargeId, readInvoicePaymentIntentId } from './stripeInvoice.ts';

export type DeclineCard = {
  brand: string | null;
  last4: string | null;
  /** credit | debit | prepaid | unknown — prepaid cards decline differently. */
  funding: string | null;
  /** Issuing country. A cross-border charge is the classic issuer block. */
  country: string | null;
};

export type InvoiceDeclineLookup = {
  chargeId: string | null;
  decline: ChargeDecline | null;
  card: DeclineCard | null;
};

const EMPTY: InvoiceDeclineLookup = { chargeId: null, decline: null, card: null };

function cardOf(charge: Stripe.Charge | null | undefined): DeclineCard | null {
  const card = charge?.payment_method_details?.card;
  if (!card) return null;
  return {
    brand: card.brand ?? null,
    last4: card.last4 ?? null,
    funding: card.funding ?? null,
    country: card.country ?? null,
  };
}

/**
 * Read the decline off a failed invoice. `invoice` is the raw webhook object, so
 * the field reads are version-tolerant (see core/stripeInvoice.ts).
 *
 * Order matters: the charge is preferred because `outcome.reason` is Stripe's
 * NORMALIZED decline code and `outcome.network_decline_code` is the raw ISO-8583
 * one — neither of which appears on the payment intent. The intent is the
 * fallback, not the equal.
 */
export async function lookupInvoiceDecline(
  stripe: Stripe,
  invoice: unknown,
): Promise<InvoiceDeclineLookup> {
  try {
    const chargeId = readInvoiceChargeId(invoice);
    if (chargeId) {
      const charge = await stripe.charges.retrieve(chargeId);
      return { chargeId, decline: readChargeDecline(charge), card: cardOf(charge) };
    }

    const intentId = readInvoicePaymentIntentId(invoice);
    if (intentId) {
      const intent = await stripe.paymentIntents.retrieve(intentId, { expand: ['latest_charge'] });
      const latest = intent.latest_charge;
      const charge = latest && typeof latest === 'object' ? (latest as Stripe.Charge) : null;
      // A charge exists on most declines even here, and it is the richer object;
      // last_payment_error is what is left when the attempt died before one.
      const decline = readChargeDecline(charge) ?? readPaymentIntentDecline(intent);
      return { chargeId: charge?.id ?? null, decline, card: cardOf(charge) };
    }
  } catch {
    // Best-effort by design — see the module header.
  }
  return EMPTY;
}
