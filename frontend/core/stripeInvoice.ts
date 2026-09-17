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

// The CHARGE this invoice's payment attempt produced — the only object that
// carries the issuer's decline reason. Same version split as everything above:
//
//   acacia and earlier: `invoice.charge`
//   basil and later:    the charge hangs off the settled payment intent at
//                       `payments.data[].payment.payment_intent.latest_charge`
//
// Returns null when the invoice carries no charge (never attempted, paid from
// credit balance, or rendered without the expansion), in which case the caller
// falls back to the payment intent below.
export function readInvoiceChargeId(invoice: unknown): string | null {
  const inv = obj(invoice);
  if (!inv) return null;

  const flat = idOf(inv.charge as Expandable);
  if (flat) return flat;

  const payments = obj(inv.payments);
  const paymentsData = payments ? payments.data : null;
  if (Array.isArray(paymentsData)) {
    for (const entry of paymentsData) {
      const payment = obj(obj(entry)?.payment);
      const pi = obj(payment?.payment_intent);
      const latest = pi ? idOf(pi.latest_charge as Expandable) : null;
      if (latest) return latest;
    }
  }

  const expandedIntent = obj(inv.payment_intent);
  return expandedIntent ? idOf(expandedIntent.latest_charge as Expandable) : null;
}

// The payment intent behind this invoice's attempt. Read when no charge is to
// hand: a payment that never produced a charge (a 3DS step-up abandoned before
// authorization) still records its failure in `last_payment_error`.
export function readInvoicePaymentIntentId(invoice: unknown): string | null {
  const inv = obj(invoice);
  if (!inv) return null;

  const flat = idOf(inv.payment_intent as Expandable);
  if (flat) return flat;

  const payments = obj(inv.payments);
  const paymentsData = payments ? payments.data : null;
  if (Array.isArray(paymentsData)) {
    for (const entry of paymentsData) {
      const payment = obj(obj(entry)?.payment);
      const pi = payment ? idOf(payment.payment_intent as Expandable) : null;
      if (pi) return pi;
    }
  }
  return null;
}

// EVERY payment intent this invoice has attempted through, oldest first.
//
// `readInvoicePaymentIntentId` returns one; a retried invoice has more than one
// in the basil shape, where `payments` is the list of attempts and each carries
// its own intent. That matters for finding the ORIGINAL decline on an invoice
// that later succeeded: the last attempt is the one that worked, and reading
// only it yields a successful charge with no decline data at all — which is
// exactly how a recovered invoice ends up reported as having failed for no
// reason.
export function readInvoicePaymentIntentIds(invoice: unknown): string[] {
  const inv = obj(invoice);
  if (!inv) return [];
  const ids: string[] = [];
  const push = (id: string | null) => {
    if (id && !ids.includes(id)) ids.push(id);
  };

  const payments = obj(inv.payments);
  const paymentsData = payments ? payments.data : null;
  if (Array.isArray(paymentsData)) {
    for (const entry of paymentsData) {
      const payment = obj(obj(entry)?.payment);
      if (payment) push(idOf(payment.payment_intent as Expandable));
    }
  }

  push(idOf(inv.payment_intent as Expandable));
  return ids;
}

// Every coupon id carrying a discount on this invoice, or null when that cannot
// be determined.
//
// The null is the point. A Discount arrives either as a bare id string or as an
// expanded object, and the coupon sits one level DOWN (`discount.coupon.id`) —
// an unexpanded discount names itself, not the coupon it carries. Returning []
// for that case would be indistinguishable from "this invoice has no discounts",
// and the caller's next move on an empty read is to conclude the intended
// coupon is missing and rewrite the invoice. So an unresolvable entry returns
// null ("don't know") and the caller declines to act. Expand `discounts` to get
// a real answer.
//
// Pre-basil invoices carry a single `discount`; basil and later carry
// `discounts[]`. Both shapes are read, deduped, first-seen order preserved.
export function readInvoiceCouponIds(invoice: unknown): string[] | null {
  const inv = obj(invoice);
  if (!inv) return null;

  const out: string[] = [];
  let unresolved = false;

  const push = (value: unknown) => {
    if (value == null) return;
    const d = obj(value);
    if (!d) {
      // A bare id string: present, but its coupon is unknowable from here.
      unresolved = true;
      return;
    }
    const coupon = idOf(d.coupon as Expandable);
    if (!coupon) {
      unresolved = true;
      return;
    }
    if (!out.includes(coupon)) out.push(coupon);
  };

  if (Array.isArray(inv.discounts)) for (const d of inv.discounts) push(d);
  if (inv.discount) push(inv.discount);

  return unresolved ? null : out;
}

export type LateDiscountFix =
  | { action: 'none'; reason: string; missing: string[]; stale: string[] }
  | { action: 'patch_draft'; reason: string; missing: string[]; stale: string[] }
  | { action: 'too_late'; reason: string; missing: string[]; stale: string[] };

// Does the invoice a plan switch just landed on still match the discounts we
// reconciled onto the SUBSCRIPTION, and can it still be corrected?
//
// `subscriptions.update({discounts})` binds the next cycle. When the switch
// takes effect at a period boundary, Stripe has already drawn that boundary's
// invoice, so the subscription and the invoice disagree and only the invoice is
// the one being charged. Draft invoices can still be rewritten; anything
// further along needs a credit note.
//
// Kept pure so the ordering rules are tested without Stripe.
export function decideLateDiscountFix(input: {
  invoiceStatus: string | null | undefined;
  invoiceCouponIds: string[] | null;
  intendedCouponIds: string[];
  managedCouponIds: string[];
}): LateDiscountFix {
  const { invoiceStatus, invoiceCouponIds, intendedCouponIds, managedCouponIds } = input;
  const nothing = { missing: [] as string[], stale: [] as string[] };

  if (invoiceCouponIds === null) {
    return { action: 'none', reason: 'invoice discounts not expanded', ...nothing };
  }

  const intended = intendedCouponIds.filter(Boolean);
  const managed = new Set(managedCouponIds.filter(Boolean));

  // Missing: a coupon we intend that the invoice does not carry — the member is
  // charged MORE than the plan they switched to should cost.
  const missing = intended.filter((id) => !invoiceCouponIds.includes(id));
  // Stale: a coupon WE manage that the invoice carries and we no longer intend
  // — typically the outgoing cadence's promo, which discounts the wrong plan.
  const stale = invoiceCouponIds.filter((id) => managed.has(id) && !intended.includes(id));

  if (missing.length === 0 && stale.length === 0) {
    return { action: 'none', reason: 'invoice already matches the reconciled set', ...nothing };
  }

  // Draft is the whole window: Stripe holds a subscription invoice in draft for
  // roughly an hour before finalizing it, which is the only period in which the
  // amount can still be changed without a credit note.
  if (invoiceStatus === 'draft') {
    return { action: 'patch_draft', reason: 'draft invoice can still be rewritten', missing, stale };
  }

  return {
    action: 'too_late',
    reason: `invoice already ${invoiceStatus ?? 'unknown'} — needs a credit note`,
    missing,
    stale,
  };
}
