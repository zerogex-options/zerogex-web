import { NextRequest, NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { getStripe } from '@/core/stripe';
import { decidePayRedirect, verifyPayToken } from '@/core/payLink';

// One click from a dunning or recovery email to Stripe's payment page for that
// invoice, without a Stripe URL in the email. See core/payLink.ts for why the
// link is signed instead of sitting behind a login.
//
// GET is safe to follow blind — link scanners like Outlook SafeLinks open every
// URL in a message — because it changes nothing: it reads the invoice and
// redirects. Paying happens on Stripe's page, and access comes back through the
// ordinary invoice.paid webhook, same as when the email linked Stripe directly.
//
// Not under /account/*: that prefix is login-gated in the proxy, and the point
// of a signed link is that it works for someone who isn't signed in.
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function shell(heading: string, bodyHtml: string): string {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>ZeroGEX — Pay your invoice</title></head>
<body style="margin:0; padding:0 16px; background:#0f2234; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
  <div style="max-width:520px; margin:12vh auto; background:#ffffff; border-radius:14px; padding:36px 34px; text-align:center;">
    <div style="font-size:22px; font-weight:800; letter-spacing:-0.4px; color:#12283c;">zerogex<span style="color:#f45854;">.io</span></div>
    <h1 style="font-size:20px; color:#12283c; margin:22px 0 10px;">${heading}</h1>
    <p style="font-size:15px; line-height:1.6; color:#3a4650; margin:0;">${bodyHtml}</p>
  </div>
</body></html>`;
}

function htmlResponse(html: string, status: number): Response {
  return new Response(html, {
    status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex',
    },
  });
}

const INVALID_PAGE = shell(
  'This link looks invalid',
  'We couldn&rsquo;t verify this payment link. Reply to the email it came in and I&rsquo;ll sort it out for you.',
);
const PAID_PAGE = shell(
  'You&rsquo;re all set',
  'This invoice has already been paid, so there&rsquo;s nothing more to do. Thank you!',
);
const CLOSED_PAGE = shell(
  'This invoice is closed',
  'It can&rsquo;t be paid online any more. If you&rsquo;d like to pick your subscription back up, you can restart it from the <a href="/pricing" style="color:#12283c; font-weight:700;">pricing page</a> &mdash; or reply to the email this link came in and I&rsquo;ll help.',
);
const UNAVAILABLE_PAGE = shell(
  'Something went wrong',
  'I couldn&rsquo;t load this invoice just now. Please try the link again in a minute &mdash; or reply to the email it came in and I&rsquo;ll help.',
);

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const invoiceId = searchParams.get('i');
  const token = searchParams.get('t');

  let valid: boolean;
  try {
    valid = !!invoiceId && !!token && verifyPayToken(invoiceId, token);
  } catch {
    // No signing secret configured: a real link and a forged one look the same.
    return htmlResponse(UNAVAILABLE_PAGE, 503);
  }
  if (!valid || !invoiceId) return htmlResponse(INVALID_PAGE, 400);

  let invoice: Stripe.Invoice;
  try {
    invoice = await getStripe().invoices.retrieve(invoiceId);
  } catch {
    return htmlResponse(UNAVAILABLE_PAGE, 503);
  }

  const decision = decidePayRedirect(invoice);
  if (decision.kind === 'paid') return htmlResponse(PAID_PAGE, 200);
  if (decision.kind === 'closed') return htmlResponse(CLOSED_PAGE, 200);

  // 303 so the browser follows with a GET whatever the mail client sent.
  const response = NextResponse.redirect(decision.url, 303);
  response.headers.set('Cache-Control', 'no-store, private');
  return response;
}
