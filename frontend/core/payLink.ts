import { createHmac, timingSafeEqual } from 'crypto';

// Signed, stateless links that pay ONE open invoice, on our own domain.
//
// WHY THIS EXISTS. The dunning emails used to button straight to Stripe's
// hosted_invoice_url. That page is the right destination — it takes any card
// and settles the debt in one step — but a long tokenized invoice.stripe.com
// payment link inside a "your payment failed" email is the shape spam filters
// look for in phishing, and it was the prime suspect when these emails started
// landing in spam. /pay (app/pay/route.ts) keeps the one click behind a URL on
// our domain: it checks the signature, asks Stripe for the invoice's CURRENT
// hosted page, and redirects there. Fetching it at click time also retires a
// quieter bug: hosted URLs are minted per fetch, so one baked into an email is
// a snapshot that may not be the URL Stripe would serve today.
//
// WHY SIGNED RATHER THAN BEHIND A LOGIN. Routing the member through sign-in
// loses a share of them on the way: Google and Apple sign-in ignore ?next= and
// drop a lapsed member on /pricing, where the obvious move is a fresh checkout
// rather than the invoice they came to pay. The signature grants exactly what
// Stripe's own hosted URL already granted anyone holding the email — view and
// pay that one invoice — and nothing else: no session, no account, no other
// invoice.
//
// Reuses ZEROGEX_END_USER_TOKEN_SECRET, namespaced ('pay:v1') like
// core/retentionToken.ts, so a valid save or unsubscribe token is never a valid
// pay token and vice versa.

function secret(): string {
  const s = process.env.ZEROGEX_END_USER_TOKEN_SECRET;
  if (!s) throw new Error('ZEROGEX_END_USER_TOKEN_SECRET is not set');
  return s;
}

export function payToken(invoiceId: string): string {
  return createHmac('sha256', secret()).update(`pay:v1:${invoiceId}`).digest('base64url');
}

export function verifyPayToken(invoiceId: string, token: string): boolean {
  if (!invoiceId || !token) return false;
  const expected = Buffer.from(payToken(invoiceId));
  const given = Buffer.from(token);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

export function buildPayUrl(appUrl: string, invoiceId: string): string {
  const base = appUrl.replace(/\/+$/, '');
  return `${base}/pay?i=${encodeURIComponent(invoiceId)}&t=${payToken(invoiceId)}`;
}

/**
 * The only pay link an email may carry: ours. Returns `payUrl` when it is a
 * /pay link on `appUrl`, else null so the caller falls back to the account
 * page. Enforced where the email is rendered, not where the URL is built, so a
 * caller that hands over a Stripe URL gets the fallback instead of a phishing-
 * shaped link.
 */
export function onSitePayUrl(appUrl: string, payUrl: string | null | undefined): string | null {
  if (!payUrl) return null;
  const base = appUrl.replace(/\/+$/, '');
  return payUrl.startsWith(`${base}/pay?`) ? payUrl : null;
}

/** The invoice fields /pay needs, loose enough to take a Stripe.Invoice. */
export type PayableInvoice = {
  status?: string | null;
  amount_due?: number | null;
  hosted_invoice_url?: string | null;
};

export type PayDecision =
  | { kind: 'redirect'; url: string }
  /** Nothing is owed any more — settled, or reduced to zero. */
  | { kind: 'paid' }
  /** Voided, written off, still a draft, or has no payment page. */
  | { kind: 'closed' };

export function decidePayRedirect(invoice: PayableInvoice): PayDecision {
  if (invoice.status === 'paid') return { kind: 'paid' };
  if (invoice.status !== 'open') return { kind: 'closed' };
  if (typeof invoice.amount_due !== 'number' || invoice.amount_due <= 0) return { kind: 'paid' };
  const url = invoice.hosted_invoice_url;
  if (typeof url !== 'string' || !url.startsWith('https://')) return { kind: 'closed' };
  return { kind: 'redirect', url };
}
