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
import {
  readInvoiceChargeId,
  readInvoicePaymentIntentId,
  readInvoicePaymentIntentIds,
} from './stripeInvoice.ts';

export type DeclineCard = {
  /**
   * WHAT the payment method is — card, link, cashapp, … On a live product this
   * separated a 59% decline rate from a 30% one, which no other dimension on the
   * charge came close to. A wallet is not a card and does not fail like one, so
   * reading only `card` details throws away the better predictor and reports
   * every wallet as "brand unknown".
   */
  type: string | null;
  brand: string | null;
  last4: string | null;
  /**
   * credit | debit | prepaid. Debit and prepaid decline far more often than
   * credit, because the money has to actually BE there at the moment of an
   * off-session charge — which is the whole insufficient-funds story.
   */
  funding: string | null;
  /** Issuing country. A cross-border charge is the classic issuer block. */
  country: string | null;
};

export type InvoiceDeclineLookup = {
  chargeId: string | null;
  /** The decline this lookup is FOR — see `declines` for how it is chosen. */
  decline: ChargeDecline | null;
  card: DeclineCard | null;
  /**
   * Every failed charge on the invoice, OLDEST FIRST, when the enumeration path
   * ran. Lets a caller line an attempt up with its own decline instead of
   * stamping one reason across every retry — a card that was short on Monday and
   * blocked on Thursday failed for two different reasons, and the invoice's
   * first failure is the one that explains why it entered dunning at all.
   */
  declines: ChargeDecline[];
  /** True when the reason came from a charge OTHER than the invoice's latest. */
  fromHistory: boolean;
};

const EMPTY: InvoiceDeclineLookup = {
  chargeId: null,
  decline: null,
  card: null,
  declines: [],
  fromHistory: false,
};

function cardOf(charge: Stripe.Charge | null | undefined): DeclineCard | null {
  const details = charge?.payment_method_details;
  if (!details) return null;
  // Read the TYPE even when there is no card object behind it. A Link or wallet
  // charge has no `card`, and returning null for it loses the one field that
  // most distinguishes how it fails.
  const card = details.card;
  return {
    type: details.type ?? null,
    brand: card?.brand ?? null,
    last4: card?.last4 ?? null,
    funding: card?.funding ?? null,
    country: card?.country ?? null,
  };
}

/**
 * Read the decline off an invoice. `invoice` is the raw webhook object, so the
 * field reads are version-tolerant (see core/stripeInvoice.ts).
 *
 * Order matters:
 *
 *   1. The invoice's LATEST charge. On the webhook path this is the failure that
 *      just happened, so the common case costs one API read. The charge is
 *      preferred over the payment intent because `outcome.reason` is Stripe's
 *      NORMALIZED decline code and `outcome.network_decline_code` is the raw
 *      ISO-8583 one — neither appears on the intent.
 *   2. The intent's own `last_payment_error`, for an attempt that died before
 *      producing a charge (an abandoned 3DS step-up).
 *   3. FAILED CHARGES IN HISTORY. Only reached when the first two find nothing,
 *      which is precisely the case of an invoice that was declined and later
 *      PAID: its latest charge succeeded and carries no decline data, so reading
 *      only that reports a recovered invoice as having failed for no reason at
 *      all. Since recovered invoices are the ones that tell you which declines
 *      are worth chasing, losing their reasons makes recovery-by-reason — the
 *      most actionable cut there is — permanently unanswerable.
 *
 * Step 3 costs extra reads, so it runs only when the cheap paths came back
 * empty. The webhook never reaches it.
 *
 * Before any of that, an invoice that names no charge and no intent is re-read
 * through our own client — see invoiceWithPaymentRefs. That is the webhook's
 * case, and without it every decline captured live came back empty.
 */
export async function lookupInvoiceDecline(
  stripe: Stripe,
  invoice: unknown,
): Promise<InvoiceDeclineLookup> {
  try {
    invoice = await invoiceWithPaymentRefs(stripe, invoice);

    const chargeId = readInvoiceChargeId(invoice);
    if (chargeId) {
      const charge = await stripe.charges.retrieve(chargeId);
      const decline = readChargeDecline(charge);
      if (decline) {
        return { chargeId, decline, card: cardOf(charge), declines: [decline], fromHistory: false };
      }
    }

    const intentId = readInvoicePaymentIntentId(invoice);
    if (intentId) {
      const intent = await stripe.paymentIntents.retrieve(intentId, { expand: ['latest_charge'] });
      const latest = intent.latest_charge;
      const charge = latest && typeof latest === 'object' ? (latest as Stripe.Charge) : null;
      const decline = readChargeDecline(charge) ?? readPaymentIntentDecline(intent);
      if (decline) {
        return {
          chargeId: charge?.id ?? null,
          decline,
          card: cardOf(charge),
          declines: [decline],
          fromHistory: false,
        };
      }
    }

    return await lookupDeclinesInHistory(stripe, invoice);
  } catch {
    // Best-effort by design — see the module header.
  }
  return EMPTY;
}

/**
 * The invoice to read the decline from: the one given, or — when it names no
 * charge and no payment intent — a fresh copy from our own API client.
 *
 * A webhook event is rendered in the API version set on the webhook ENDPOINT
 * (see core/stripeInvoice.ts). From 2025-03-31.basil on, an invoice there has
 * no `charge` or `payment_intent`, and its `payments` list is only returned
 * when asked for, which an event never is. So an event-shaped invoice names no
 * charge at all, every lookup on the webhook path came back empty, and every
 * live decline was stored as "unknown" — which is also what the dunning email
 * chose its wording from. The client in core/stripe.ts is pinned to acacia,
 * whose invoices still carry both fields, so re-reading through it recovers
 * the charge.
 *
 * One extra read, and only when the object in hand has nothing to go on: an
 * invoice fetched through our client (the backfill, the resend script) is
 * used as it is.
 */
async function invoiceWithPaymentRefs(stripe: Stripe, invoice: unknown): Promise<unknown> {
  if (readInvoiceChargeId(invoice) || readInvoicePaymentIntentId(invoice)) return invoice;
  const id =
    invoice && typeof invoice === 'object' ? (invoice as { id?: unknown }).id : null;
  if (typeof id !== 'string' || !id.startsWith('in_')) return invoice;
  return stripe.invoices.retrieve(id);
}

/**
 * Walk every payment intent the invoice has attempted through and collect the
 * charges that FAILED, oldest first. This is the only way to recover the reason
 * an invoice entered dunning once it has been paid.
 */
async function lookupDeclinesInHistory(
  stripe: Stripe,
  invoice: unknown,
): Promise<InvoiceDeclineLookup> {
  const intentIds = readInvoicePaymentIntentIds(invoice);
  if (intentIds.length === 0) return EMPTY;

  const failed: Stripe.Charge[] = [];
  for (const intentId of intentIds) {
    const charges = await stripe.charges.list({ payment_intent: intentId, limit: 100 });
    for (const charge of charges.data) {
      if (charge.status === 'failed') failed.push(charge);
    }
  }
  if (failed.length === 0) return EMPTY;

  // Oldest first: the first failure is the one that explains why this invoice
  // entered dunning, and it is the reason worth reporting against it.
  failed.sort((a, b) => a.created - b.created);
  const declines = failed
    .map((charge) => readChargeDecline(charge))
    .filter((decline): decline is ChargeDecline => decline !== null);
  if (declines.length === 0) return EMPTY;

  return {
    chargeId: failed[0].id,
    decline: declines[0],
    card: cardOf(failed[0]),
    declines,
    fromHistory: true,
  };
}

/**
 * The decline belonging to one ATTEMPT, when the lookup recovered several. Falls
 * back to the first failure, which is the reason the invoice entered dunning —
 * never to the last, which on a recovered invoice is the closest thing to the
 * payment that worked.
 */
export function declineForAttempt(
  lookup: InvoiceDeclineLookup,
  attemptCount: number,
): ChargeDecline | null {
  if (lookup.declines.length === 0) return lookup.decline;
  const index = Math.max(1, Math.trunc(attemptCount)) - 1;
  return lookup.declines[index] ?? lookup.declines[0];
}
