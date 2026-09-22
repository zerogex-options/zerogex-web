// The one-screen HTML the levels-email links land on.
//
// Inline HTML from a route handler rather than a React page, matching
// app/unsubscribe/route.ts. Someone arriving here has clicked a link in an
// email and needs one sentence and a way onward; booting the full app shell
// (layout, theme cookies, font palette, client bundle) to tell them
// "you're subscribed" is all cost and no benefit, and it would also make the
// page depend on a session that by definition does not exist.
//
// Palette and structure are copied from app/unsubscribe/route.ts so the two
// confirmation screens are visibly the same product.

export type LevelsEmailPageOptions = {
  status: number;
  heading: string;
  /** Trusted HTML — callers pass literals in this module's own voice. */
  body: string;
  cta?: { href: string; label: string };
};

const SITE_URL = (
  process.env.NEXT_PUBLIC_APP_URL ||
  process.env.NEXT_PUBLIC_SITE_URL ||
  'https://zerogex.io'
).replace(/\/+$/, '');

export function levelsEmailPage(opts: LevelsEmailPageOptions): Response {
  const cta = opts.cta
    ? `<p style="margin:26px 0 0;">
         <a href="${SITE_URL}${opts.cta.href}" style="display:inline-block; padding:11px 20px; background:#f5b400; color:#000; font-weight:600; text-decoration:none; border-radius:8px; font-size:14px;">${opts.cta.label}</a>
       </p>`
    : '';

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>ZeroGEX — Daily levels email</title></head>
<body style="margin:0; background:#0f2234; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
  <div style="max-width:520px; margin:12vh auto; background:#ffffff; border-radius:14px; padding:36px 34px; text-align:center;">
    <a href="${SITE_URL}" style="text-decoration:none;"><div style="font-size:22px; font-weight:800; letter-spacing:-0.4px; color:#12283c;">zerogex<span style="color:#f45854;">.io</span></div></a>
    <h1 style="font-size:20px; color:#12283c; margin:22px 0 10px;">${opts.heading}</h1>
    <p style="font-size:15px; line-height:1.6; color:#3a4650; margin:0;">${opts.body}</p>
    ${cta}
  </div>
</body></html>`;

  return new Response(html, {
    status: opts.status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      // The header as well as the meta tag: a crawler that reads only headers
      // (and never parses the body) still gets the directive.
      'X-Robots-Tag': 'noindex, nofollow',
    },
  });
}
