import type Stripe from 'stripe';

// Preview the next invoice for a subscription, on either billing mode.
//
// Stripe's original endpoint (GET /v1/invoices/upcoming, `invoices.retrieveUpcoming`)
// refuses a subscription whose `billing_mode` is `flexible` — it answers
//   "The Upcoming Invoice API does not support `billing_mode = flexible`
//    subscriptions. To preview invoices for these subscriptions, use the Create
//    Preview Invoice API instead."
// Every subscription Checkout creates today is `classic`, because the app pins
// an API version predating flexible mode (core/stripe.ts), so nothing broke on
// its own. But a subscription created OUTSIDE that pin — an ops script on the
// account default version, or anything made by hand in the Dashboard — comes out
// flexible, and then every "what will this member actually be charged" read
// fails: the ~48h trial reminder silently drops the line quoting the charge and
// the card, `diagnose-user` cannot show the next invoice, and the held-rate
// detection in `upgrade-at-current-price` has nothing to detect. The same thing
// happens to EVERY subscription the day the API pin moves past flexible mode.
//
// So: prefer createPreview, which handles both modes, and keep retrieveUpcoming
// as the fallback for an SDK too old to have it. Errors propagate unchanged, so
// each caller keeps whatever handling it already had.

// The parameters our callers actually use, in one shape. The two endpoints
// disagree about where subscription-modifying options live (top-level
// `subscription_*` fields on the old one, a `subscription_details` object on the
// new one), which is exactly the translation this module exists to hide.
export type InvoicePreviewOptions = {
  subscription: string;
  customer?: string | null;
  // Item changes to price INTO the preview (e.g. "what would they pay on the
  // Pro plan?"), rather than previewing the subscription as it stands.
  items?: Array<{ id?: string; price?: string }>;
  prorationBehavior?: 'none' | 'create_prorations' | 'always_invoice';
  // Discounts to apply for the preview only — modelling a coupon before it is
  // attached. An empty array explicitly previews with NO discount.
  discounts?: Array<{ coupon: string }>;
};

type InvoicesApi = {
  createPreview?: (params: Record<string, unknown>) => Promise<Stripe.Invoice>;
  retrieveUpcoming?: (params: Record<string, unknown>) => Promise<Stripe.Invoice>;
};

export async function previewNextInvoice(
  stripe: Stripe,
  options: InvoicePreviewOptions,
): Promise<Stripe.Invoice> {
  const invoices = stripe.invoices as unknown as InvoicesApi;
  const { subscription, customer, items, prorationBehavior, discounts } = options;

  if (typeof invoices.createPreview === 'function') {
    const subscriptionDetails: Record<string, unknown> = {};
    if (items) subscriptionDetails.items = items;
    if (prorationBehavior) subscriptionDetails.proration_behavior = prorationBehavior;
    return invoices.createPreview({
      subscription,
      ...(customer ? { customer } : {}),
      ...(Object.keys(subscriptionDetails).length
        ? { subscription_details: subscriptionDetails }
        : {}),
      ...(discounts ? { discounts } : {}),
    });
  }

  if (typeof invoices.retrieveUpcoming === 'function') {
    return invoices.retrieveUpcoming({
      subscription,
      ...(customer ? { customer } : {}),
      ...(items ? { subscription_items: items } : {}),
      ...(prorationBehavior ? { subscription_proration_behavior: prorationBehavior } : {}),
      // The legacy endpoint takes a single coupon id, not a discounts array.
      ...(discounts && discounts.length === 1 ? { coupon: discounts[0].coupon } : {}),
    });
  }

  throw new Error(
    'This stripe SDK exposes neither invoices.createPreview nor invoices.retrieveUpcoming.',
  );
}

// "There is nothing to preview" is a normal answer, not a failure — a
// subscription set to cancel at period end has no next invoice. Callers show a
// friendlier line for it, so keep the detection in one place: the newer endpoint
// does not always reuse the old `invoice_upcoming_none` code.
export function isNoUpcomingInvoiceError(err: unknown): boolean {
  const code = (err as { code?: unknown })?.code;
  if (code === 'invoice_upcoming_none') return true;
  const message = (err as { message?: unknown })?.message;
  return typeof message === 'string' && /no upcoming invoice/i.test(message);
}
