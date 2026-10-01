// Stripe side of core/fohRevenue.ts: pull the invoices that can have been PAID
// inside the quarter and hand them to the pure tally. Read-only — one paginated
// list call, nothing written.

import type Stripe from 'stripe';

import { tallyQuarterRevenue, type Quarter, type QuarterRevenue } from './fohRevenue.ts';

// An invoice is paid after it is created, sometimes long after (an open invoice
// recovered weeks later). Listing by creation from a year before the quarter
// catches those; the tally then keeps only the ones whose paid_at is inside it.
const CREATED_LOOKBACK_SECONDS = 366 * 24 * 60 * 60;

// Refuse rather than report a partial total if the list ever gets this long.
const MAX_INVOICES = 50_000;

export async function computeQuarterRevenue(
  stripe: Stripe,
  quarter: Quarter,
  pledgePct: number,
): Promise<QuarterRevenue> {
  const invoices: Stripe.Invoice[] = [];
  for await (const invoice of stripe.invoices.list({
    status: 'paid',
    created: { gte: quarter.startUnix - CREATED_LOOKBACK_SECONDS, lt: quarter.endUnixExclusive },
    limit: 100,
    // The refund total lives on the charge; expanding it on the list costs no
    // extra round trips.
    expand: ['data.charge'],
  })) {
    invoices.push(invoice);
    if (invoices.length >= MAX_INVOICES) {
      throw new Error(`More than ${MAX_INVOICES} paid invoices in the lookback window; refusing to report a partial total.`);
    }
  }
  return tallyQuarterRevenue(invoices, quarter, pledgePct);
}
