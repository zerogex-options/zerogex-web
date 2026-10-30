// Which invoice did a charge pay? Asked by the charge.refunded webhook, which
// logs the refund against that invoice and reverses any creator-partner
// commission accrued on it, and by scripts/repair-refund-commissions.mts, which
// re-runs the same lookup over refunds logged before this existed.
//
// A webhook event is rendered in the API version set on the webhook ENDPOINT
// (see core/stripeInvoice.ts), and 2025-03-31.basil removed `invoice` from the
// Charge. So a charge.refunded payload on our endpoint never names its invoice:
// the handler logged every subscription refund "(no invoice — one-off charge)"
// and never reversed the commission on it, the 7-day money-back refunds
// included, since core/moneyBackServer.ts leaves that reversal to the webhook.
// The client in core/stripe.ts is pinned to acacia, whose charges still carry
// the field, so re-reading the charge through it recovers the invoice — the
// same repair core/stripeDeclineLookup.ts makes for invoices.
//
// Best-effort: nothing here throws. The refund is a fact and is recorded
// whatever this finds; a lookup that cannot settle the question says so, with
// the reason, rather than calling the charge a one-off.

import type Stripe from 'stripe';
import { readChargeInvoice } from './stripeInvoice.ts';

export type ChargeInvoiceLookup =
  | { kind: 'invoice'; invoiceId: string }
  | { kind: 'none' }
  | { kind: 'unknown'; reason: string };

/**
 * The invoice `charge` paid: read off the charge when it carries the field,
 * otherwise re-read through `stripe`. One extra API read, and only for a
 * payload that cannot answer: an acacia-rendered event, or a charge fetched
 * through our own client, is used as it is.
 */
export async function lookupChargeInvoice(
  stripe: Stripe,
  charge: unknown,
): Promise<ChargeInvoiceLookup> {
  const inHand = readChargeInvoice(charge);
  if (inHand.kind !== 'unknown') return inHand;

  const id = charge && typeof charge === 'object' ? (charge as { id?: unknown }).id : null;
  if (typeof id !== 'string' || !id) return { kind: 'unknown', reason: 'the charge has no id' };

  try {
    const reread = readChargeInvoice(await stripe.charges.retrieve(id));
    if (reread.kind !== 'unknown') return reread;
    // Only once core/stripe.ts is pinned past acacia, where the API read drops
    // the field too. Say so rather than guess.
    return { kind: 'unknown', reason: 'the API read carries no invoice field either' };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { kind: 'unknown', reason: `charge lookup failed: ${message.slice(0, 200)}` };
  }
}

// How a refund_issued row ends when it cannot name the invoice. The repair
// script finds the rows to recheck by these, so they live here beside the
// lookup rather than inline in the webhook.
const ONE_OFF_CHARGE_NOTE = ' (no invoice — one-off charge)';
const UNRESOLVED_INVOICE_NOTE = ' (invoice could not be resolved';

/**
 * The refund_issued audit message. `amount_refunded` is CUMULATIVE, not this
 * event's delta: a second partial refund reports the running total, so it is
 * always stated as "X of Y charged" rather than reading as the size of this one
 * refund. Names the invoice the lookup found, or why it found none — never
 * "one-off charge" for a lookup that merely failed.
 */
export function refundAuditMessage(
  charge: { id: string; amount: number; amount_refunded: number; currency: string },
  invoice: ChargeInvoiceLookup,
): string {
  const isFullRefund = charge.amount_refunded >= charge.amount;
  const note =
    invoice.kind === 'invoice'
      ? `, invoice ${invoice.invoiceId}`
      : invoice.kind === 'none'
        ? ONE_OFF_CHARGE_NOTE
        : `${UNRESOLVED_INVOICE_NOTE}: ${invoice.reason})`;
  return (
    `${isFullRefund ? 'Full' : 'Partial'} refund on charge ${charge.id}: ` +
    `${charge.amount_refunded} of ${charge.amount} ${charge.currency} charged${note}`
  );
}

export type RefundAuditRow = {
  chargeId: string;
  /** The invoice the row names, when it names one. */
  invoiceId: string | null;
  /**
   * The row could not name the invoice, so Stripe has to be asked: logged live
   * as a one-off charge (every refund the webhook saw while its endpoint
   * rendered basil), or as unresolved. A backfilled row (" [backfilled re_…]")
   * is not: scripts/backfill-refund-audit.mts read each charge through the
   * API, which carries the invoice, so its "one-off" is right.
   */
  needsLookup: boolean;
};

/** Reads back a refund_issued message: refundAuditMessage's, or the backfill's copy of it. */
export function readRefundAuditRow(message: string): RefundAuditRow | null {
  const charge = /refund on charge (\S+?):/.exec(message);
  if (!charge) return null;
  const invoice = / charged, invoice (in_[A-Za-z0-9]+)/.exec(message);
  return {
    chargeId: charge[1],
    invoiceId: invoice ? invoice[1] : null,
    needsLookup:
      message.endsWith(ONE_OFF_CHARGE_NOTE) || message.includes(UNRESOLVED_INVOICE_NOTE),
  };
}
