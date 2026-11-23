import { NextRequest } from 'next/server';
import { verifyPreopenReadStopToken } from '@/core/preopenRead';
import { stopPreopenRead } from '@/core/preopenReadRecipients';
import { preopenReadStopPage } from './shell';

// The "Stop these morning emails" link in Today's Read (scripts/send-preopen-
// read.mts). Stops that one email; every other ZeroGEX email, and the read on
// the dashboard, are untouched, and the page says so.
//
// GET only CONFIRMS; it changes nothing. Corporate mail scanners and link
// previewers fetch every URL in a message, and an opt-out that fired on GET
// would silently stop a member's morning read the day their company's filter
// opened it (app/alerts/unsubscribe/route.ts makes the same choice, for the
// same reason). The button POSTs.
//
// POST is also the RFC 8058 one-click endpoint mail clients call from their
// native "Unsubscribe" button (body `List-Unsubscribe=One-Click`), so the
// header in the email and the button on this page share one code path.
//
// Anonymous on purpose (core/auth.ts PUBLIC_ROUTE_PATTERNS): a member reading
// on their phone is often signed out, and the link authenticates itself with
// an HMAC over the member id.
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function readParams(request: NextRequest): Promise<{ u: string | null; t: string | null; oneClick: boolean }> {
  const { searchParams } = new URL(request.url);
  let u = searchParams.get('u');
  let t = searchParams.get('t');
  let oneClick = false;
  try {
    const form = new URLSearchParams(await request.text());
    u = u ?? form.get('u');
    t = t ?? form.get('t');
    oneClick = form.get('List-Unsubscribe') === 'One-Click';
  } catch {
    /* malformed body: the query string may still carry the params */
  }
  return { u, t, oneClick };
}

function invalid(): Response {
  return preopenReadStopPage({
    status: 400,
    heading: 'This link looks invalid',
    body: 'We couldn&rsquo;t verify this link. Reply to any ZeroGEX email and I&rsquo;ll stop the morning emails for you.',
  });
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const u = searchParams.get('u');
  const t = searchParams.get('t');
  if (!verifyPreopenReadStopToken(u, t)) return invalid();
  return preopenReadStopPage({
    status: 200,
    heading: 'Stop the morning emails?',
    body: 'You won&rsquo;t get Today&rsquo;s Read by email before the open anymore. It stays on your dashboard, and every other ZeroGEX email is unaffected.',
    form: { u: u!, t: t!, label: 'Stop the morning emails' },
  });
}

export async function POST(request: NextRequest) {
  const { u, t, oneClick } = await readParams(request);
  if (!verifyPreopenReadStopToken(u, t)) {
    return oneClick ? new Response('invalid', { status: 400, headers: { 'Cache-Control': 'no-store' } }) : invalid();
  }
  let ok = false;
  try {
    stopPreopenRead(u!);
    ok = true;
  } catch (err) {
    console.error('[preopen-read-stop] write failed', err);
  }
  if (oneClick) {
    return new Response(ok ? 'unsubscribed' : 'temporarily unavailable', {
      status: ok ? 200 : 503,
      headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' },
    });
  }
  return ok
    ? preopenReadStopPage({
        status: 200,
        heading: 'The morning emails are off',
        body: 'You won&rsquo;t get Today&rsquo;s Read by email anymore. It&rsquo;s still on your dashboard. Changed your mind? Reply to any ZeroGEX email and I&rsquo;ll switch it back on.',
        cta: { href: '/dashboard', label: 'Open your dashboard' },
      })
    : preopenReadStopPage({
        status: 503,
        heading: 'That didn&rsquo;t go through',
        body: 'Something went wrong on our side. Please try again in a minute.',
        form: { u: u!, t: t!, label: 'Try again' },
      });
}
