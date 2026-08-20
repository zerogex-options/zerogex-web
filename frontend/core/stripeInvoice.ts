// Version-tolerant readers for the handful of Stripe INVOICE fields the billing
// code depends on. Kept PURE (no imports, plain structural reads) so they are
// unit-tested without Stripe — same discipline as core/paymentGrace.ts and
// core/trialDunning.ts.
//
// Why this exists: a webhook event is rendered in the API version configured on
// the WEBHOOK ENDPOINT, which is not necessarily the version core/stripe.ts pins
// for our own API calls (STRIPE_API_VERSION). Stripe's 2025-03-31.basil release
// moved several invoice fields:
//
//   subscription id   acacia: invoice.subscription
//                     basil:  invoice.parent.subscription_details.subscription
//   line price id     acacia: line.price.id
//                     basil:  line.pricing.price_details.price
//
// Reading only the acacia shape means a basil-rendered event silently yields
// null — and null is indistinguishable from "this invoice has no subscription",
// which is exactly the branch that decides dunning copy and orphan recovery. So
// every read tries both shapes and returns the first that resolves.

// A Stripe object as delivered on the wire: string ids may arrive expanded.
type Expandable = string | { id?: unknown } | null | undefined;

function idOf(value: Expandable): string | null {
  if (typeof value === 'string') return value || null;
  if (value && typeof value === 'object') {
    const id = (value as { id?: unknown }).id;
    if (typeof id === 'string' && id) return id;
  }
  return null;
}

function obj(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

// The subscription this invoice bills for, or null when it has no subscription
// parent (a one-off / manual invoice).
export function readInvoiceSubscriptionId(invoice: unknown): string | null {
  const inv = obj(invoice);
  if (!inv) return null;

  // acacia and earlier: top-level `subscription`.
  const flat = idOf(inv.subscription as Expandable);
  if (flat) return flat;

  // basil and later: `parent.subscription_details.subscription`.
  const parent = obj(inv.parent);
  const details = parent ? obj(parent.subscription_details) : null;
  const nested = details ? idOf(details.subscription as Expandable) : null;
  if (nested) return nested;

  // Last resort: a subscription line item carries the same id in both shapes.
  for (const line of readInvoiceLines(inv)) {
    const lineFlat = idOf(line.subscription as Expandable);
    if (lineFlat) return lineFlat;
    const lineParent = obj(line.parent);
    const itemDetails = lineParent ? obj(lineParent.subscription_item_details) : null;
    const lineNested = itemDetails ? idOf(itemDetails.subscription as Expandable) : null;
    if (lineNested) return lineNested;
  }

  return null;
}

function readInvoiceLines(inv: Record<string, unknown>): Record<string, unknown>[] {
  const lines = obj(inv.lines);
  const data = lines ? lines.data : null;
  if (!Array.isArray(data)) return [];
  return data.filter((line): line is Record<string, unknown> => obj(line) !== null);
}

// The recurring price this invoice billed. Picks the FIRST line that resolves a
// price id — a subscription invoice's proration/credit lines carry the same
// price, and we only ever need it to re-create the same plan.
export function readInvoicePriceId(invoice: unknown): string | null {
  const inv = obj(invoice);
  if (!inv) return null;
  for (const line of readInvoiceLines(inv)) {
    // acacia and earlier: `line.price`.
    const flat = idOf(line.price as Expandable);
    if (flat) return flat;
    // basil and later: `line.pricing.price_details.price`.
    const pricing = obj(line.pricing);
    const priceDetails = pricing ? obj(pricing.price_details) : null;
    const nested = priceDetails ? idOf(priceDetails.price as Expandable) : null;
    if (nested) return nested;
  }
  return null;
}

// The END of the service period this invoice paid for (Unix seconds), or null
// when it can't be determined. Line-level `period.end` is authoritative — it is
// the same in every API version and, unlike the invoice-level field, is the
// period of the SUBSCRIPTION line rather than of the invoice document. Falls
// back to the invoice-level `period_end`.
export function readInvoicePeriodEndUnix(invoice: unknown): number | null {
  const inv = obj(invoice);
  if (!inv) return null;
  let latest: number | null = null;
  for (const line of readInvoiceLines(inv)) {
    const period = obj(line.period);
    const end = period ? period.end : null;
    if (typeof end === 'number' && Number.isFinite(end)) {
      if (latest == null || end > latest) latest = end;
    }
  }
  if (latest != null) return latest;
  const invEnd = inv.period_end;
  return typeof invEnd === 'number' && Number.isFinite(invEnd) ? invEnd : null;
}

// The START of the service period this invoice paid for (Unix seconds), read
// with the same line-level-first preference as readInvoicePeriodEndUnix. Used to
// backdate a re-created subscription onto the period the member actually bought.
export function readInvoicePeriodStartUnix(invoice: unknown): number | null {
  const inv = obj(invoice);
  if (!inv) return null;
  let earliest: number | null = null;
  for (const line of readInvoiceLines(inv)) {
    const period = obj(line.period);
    const start = period ? period.start : null;
    if (typeof start === 'number' && Number.isFinite(start)) {
      if (earliest == null || start < earliest) earliest = start;
    }
  }
  if (earliest != null) return earliest;
  const invStart = inv.period_start;
  return typeof invStart === 'number' && Number.isFinite(invStart) ? invStart : null;
}

// The payment method that actually settled this invoice, so a re-created
// subscription renews on the card the member just used rather than on the one
// that failed. Reads the charge/payment-intent shapes an expanded invoice
// carries; null when the invoice was not settled by a stored payment method
// (bank transfer, credit balance, manual "mark as paid").
export function readInvoicePaymentMethodId(invoice: unknown): string | null {
  const inv = obj(invoice);
  if (!inv) return null;

  // basil: `confirmation_secret`/`payments` — the settled payment intent hangs
  // off `payments.data[].payment.payment_intent`.
  const payments = obj(inv.payments);
  const paymentsData = payments ? payments.data : null;
  if (Array.isArray(paymentsData)) {
    for (const entry of paymentsData) {
      const payment = obj(obj(entry)?.payment);
      const pi = obj(payment?.payment_intent);
      const pm = pi ? idOf(pi.payment_method as Expandable) : null;
      if (pm) return pm;
    }
  }

  // acacia: expanded `payment_intent` / `charge`.
  const pi = obj(inv.payment_intent);
  const fromIntent = pi ? idOf(pi.payment_method as Expandable) : null;
  if (fromIntent) return fromIntent;

  const charge = obj(inv.charge);
  const fromCharge = charge ? idOf(charge.payment_method as Expandable) : null;
  if (fromCharge) return fromCharge;

  // Some invoices carry the member's chosen default directly.
  return idOf(inv.default_payment_method as Expandable);
}
