import { NextRequest } from 'next/server';
import { getDb } from '@/core/db';
import { verifyUnsubToken } from '@/core/unsubToken';

// One-click marketing-email opt-out. GET renders a confirmation page (the
// visible "Unsubscribe" link in the footer); POST is the RFC 8058 one-click
// endpoint that Gmail/Apple call from the native "Unsubscribe" button. Both
// verify the signed token and stamp users.marketing_unsubscribed_at, which the
// product-update send script excludes. Idempotent — re-clicking is a no-op.
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function applyUnsubscribe(userId: string | null, token: string | null): boolean {
  if (!userId || !token || !verifyUnsubToken(userId, token)) return false;
  const nowIso = new Date().toISOString();
  const db = getDb();
  // COALESCE preserves the original opt-out time on repeat clicks.
  db.prepare(
    `UPDATE users
        SET marketing_unsubscribed_at = COALESCE(marketing_unsubscribed_at, ?),
            updated_at = ?
      WHERE id = ?`,
  ).run(nowIso, nowIso, userId);
  return true;
}

function page(heading: string, body: string): string {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>ZeroGEX — Email preferences</title></head>
<body style="margin:0; background:#0f2234; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
  <div style="max-width:520px; margin:12vh auto; background:#ffffff; border-radius:14px; padding:36px 34px; text-align:center;">
    <div style="font-size:22px; font-weight:800; letter-spacing:-0.4px; color:#12283c;">zerogex<span style="color:#f45854;">.io</span></div>
    <h1 style="font-size:20px; color:#12283c; margin:22px 0 10px;">${heading}</h1>
    <p style="font-size:15px; line-height:1.6; color:#3a4650; margin:0;">${body}</p>
  </div>
</body></html>`;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const ok = applyUnsubscribe(searchParams.get('u'), searchParams.get('t'));
  const html = ok
    ? page(
        'You&rsquo;re unsubscribed',
        "You won't receive ZeroGEX product-update emails anymore. You'll still get essential account and billing messages. Changed your mind? Just reply to any email and I'll add you back.",
      )
    : page(
        'This link looks invalid',
        'We couldn&rsquo;t process this unsubscribe request. Reply to any ZeroGEX email and I&rsquo;ll take care of it for you.',
      );
  return new Response(html, {
    status: ok ? 200 : 400,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

// RFC 8058 one-click. Params may arrive in the query string or the form body.
export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  let u = searchParams.get('u');
  let t = searchParams.get('t');
  if (!u || !t) {
    try {
      const form = new URLSearchParams(await request.text());
      u = u ?? form.get('u');
      t = t ?? form.get('t');
    } catch {
      /* ignore malformed body */
    }
  }
  const ok = applyUnsubscribe(u, t);
  return new Response(ok ? 'unsubscribed' : 'invalid', {
    status: ok ? 200 : 400,
    headers: { 'Cache-Control': 'no-store' },
  });
}
