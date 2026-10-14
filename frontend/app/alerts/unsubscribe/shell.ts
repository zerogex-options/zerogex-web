// The one-screen HTML the wall-alert unsubscribe link lands on.
//
// Inline HTML from a route handler, same palette and structure as
// app/levels-email/shell.ts and app/unsubscribe/route.ts, so every opt-out
// screen is visibly the same product — and so it renders with no session, no
// app shell and no client bundle.

export type WallAlertsUnsubPageOptions = {
  status: number;
  heading: string;
  /** Trusted HTML — callers pass literals in this module's own voice. */
  body: string;
  /** A POST form (the confirmation button). Values are escaped here. */
  form?: { u: string; t: string; label: string };
  cta?: { href: string; label: string };
  secondary?: { href: string; label: string };
};

const SITE_URL = (
  process.env.NEXT_PUBLIC_APP_URL ||
  process.env.NEXT_PUBLIC_SITE_URL ||
  'https://zerogex.io'
).replace(/\/+$/, '');

function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const BUTTON =
  'display:inline-block; padding:11px 20px; background:#f5b400; color:#000; font-weight:600; text-decoration:none; border-radius:8px; font-size:14px; border:0; cursor:pointer; font-family:inherit;';

export function wallAlertsUnsubPage(opts: WallAlertsUnsubPageOptions): Response {
  const form = opts.form
    ? `<form method="post" action="${SITE_URL}/alerts/unsubscribe" style="margin:26px 0 0;">
         <input type="hidden" name="u" value="${esc(opts.form.u)}">
         <input type="hidden" name="t" value="${esc(opts.form.t)}">
         <button type="submit" style="${BUTTON}">${esc(opts.form.label)}</button>
       </form>`
    : '';
  const cta = opts.cta
    ? `<p style="margin:26px 0 0;"><a href="${SITE_URL}${opts.cta.href}" style="${BUTTON}">${esc(opts.cta.label)}</a></p>`
    : '';
  const secondary = opts.secondary
    ? `<p style="margin:16px 0 0;"><a href="${SITE_URL}${opts.secondary.href}" style="color:#3a4650; font-size:14px;">${esc(opts.secondary.label)}</a></p>`
    : '';

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>ZeroGEX - Wall alert emails</title></head>
<body style="margin:0; padding:0 16px; background:#0f2234; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
  <div style="max-width:520px; margin:12vh auto; background:#ffffff; border-radius:14px; padding:36px 34px; text-align:center;">
    <a href="${SITE_URL}" style="text-decoration:none;"><div style="font-size:22px; font-weight:800; letter-spacing:-0.4px; color:#12283c;">zerogex<span style="color:#f45854;">.io</span></div></a>
    <h1 style="font-size:20px; color:#12283c; margin:22px 0 10px;">${opts.heading}</h1>
    <p style="font-size:15px; line-height:1.6; color:#3a4650; margin:0;">${opts.body}</p>
    ${form}${cta}${secondary}
  </div>
</body></html>`;

  return new Response(html, {
    status: opts.status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  });
}
