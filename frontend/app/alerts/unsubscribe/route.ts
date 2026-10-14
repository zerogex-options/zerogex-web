import { NextRequest } from 'next/server';

import {
  disableWallAlertChannel,
  verifyWallAlertsUnsubToken,
  wallAlertsAdminEnv,
} from '@/core/wallAlertsServer';
import { wallAlertsUnsubPage } from './shell';

// The opt-out link in every wall-alert email: switches wall-alert EMAIL off on
// every alert the member has. In-app alerts, the alerts themselves and every
// other email are untouched — the page says so, and links to the settings for
// anything finer-grained.
//
// GET only CONFIRMS; it changes nothing. Corporate mail scanners and link
// previewers fetch every URL in a message, and an unsubscribe that fires on GET
// silently turns a trader's alerts off the day their company's filter opens the
// email (app/unsubscribe/route.ts, the marketing opt-out, has that weakness; a
// wall alert matters more than a newsletter). The button POSTs.
//
// POST is also the RFC 8058 one-click endpoint mail clients call from their
// native "Unsubscribe" button (body `List-Unsubscribe=One-Click`), so the
// header in the email and the button on this page share one code path.
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const SETTINGS = '/account/alerts';

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
    /* malformed body — the query string may still carry the params */
  }
  return { u, t, oneClick };
}

function invalid(): Response {
  return wallAlertsUnsubPage({
    status: 400,
    heading: 'This link looks invalid',
    body: 'We couldn&rsquo;t verify this unsubscribe link. You can turn wall-alert email off from your alert settings, or reply to any ZeroGEX email and we&rsquo;ll do it for you.',
    cta: { href: SETTINGS, label: 'Open alert settings' },
  });
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const u = searchParams.get('u');
  const t = searchParams.get('t');
  if (!verifyWallAlertsUnsubToken(u, t)) return invalid();
  return wallAlertsUnsubPage({
    status: 200,
    heading: 'Stop wall-alert emails?',
    body: 'Email will be switched off on all of your wall alerts. Your alerts keep running in the app, and every other ZeroGEX email is unaffected.',
    form: { u: u!, t: t!, label: 'Stop wall-alert emails' },
    secondary: { href: SETTINGS, label: 'Adjust alerts instead' },
  });
}

export async function POST(request: NextRequest) {
  const { u, t, oneClick } = await readParams(request);
  if (!verifyWallAlertsUnsubToken(u, t)) {
    return oneClick ? new Response('invalid', { status: 400, headers: { 'Cache-Control': 'no-store' } }) : invalid();
  }
  const env = wallAlertsAdminEnv();
  let ok = false;
  if (env) {
    try {
      await disableWallAlertChannel(env, u!, 'email');
      ok = true;
    } catch (err) {
      console.error('[wall-alerts-unsubscribe] disable-channel failed', err);
    }
  } else {
    console.error('[wall-alerts-unsubscribe] ZEROGEX_API_TOKEN / ZEROGEX_ADMIN_TOKEN not configured');
  }
  if (oneClick) {
    return new Response(ok ? 'unsubscribed' : 'temporarily unavailable', {
      status: ok ? 200 : 503,
      headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' },
    });
  }
  return ok
    ? wallAlertsUnsubPage({
        status: 200,
        heading: 'Wall-alert emails are off',
        body: 'You won&rsquo;t get wall alerts by email anymore. They still appear in the app, and you can switch email back on for any alert in your settings.',
        cta: { href: SETTINGS, label: 'Open alert settings' },
      })
    : wallAlertsUnsubPage({
        status: 503,
        heading: 'That didn&rsquo;t go through',
        body: 'We couldn&rsquo;t reach the alert service just now. Please try again in a minute, or switch email off from your alert settings.',
        form: { u: u!, t: t!, label: 'Try again' },
        secondary: { href: SETTINGS, label: 'Open alert settings' },
      });
}
