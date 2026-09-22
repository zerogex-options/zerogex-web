import { NextRequest, NextResponse } from 'next/server';

import { buildLevelsConfirmUrl } from '@/core/levelsEmail';
import { levelsSignupLimiter } from '@/core/levelsRateLimit';
import { recordLevelsSubscription } from '@/core/levelsSubscribers';
import { sendLevelsConfirmationEmail } from '@/core/mailer';
import { getClientIp } from '@/core/serverAuth';

// Public, unauthenticated signup for the free daily levels email.
//
// NO CSRF TOKEN, deliberately. The auth routes validate one because they act
// on behalf of a logged-in session; there is no session here and no privileged
// action to forge. A cross-site POST could at most cause one confirmation
// email to an address the attacker already knows, which is the same thing they
// could do by loading the page — and it still subscribes nobody, because the
// address is not on the list until the link in that email is clicked. The real
// threats are spam and table-filling, handled by the rate limit, the honeypot
// and double opt-in.
//
// THE RESPONSE IS THE SAME FOR EVERY OUTCOME. New, pending, already confirmed,
// previously unsubscribed, malformed, honeypot-tripped: all 200 with one body.
// Differentiating any of them turns a public endpoint into an oracle for
// whether a given address reads this site. The distinctions exist server-side
// for the send decision (core/levelsSubscribers.ts) and nowhere else.

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const APP_URL = (
  process.env.NEXT_PUBLIC_APP_URL ||
  process.env.NEXT_PUBLIC_SITE_URL ||
  'https://zerogex.io'
).replace(/\/+$/, '');

// One body, one status, every time. See the note above.
const GENERIC_OK = {
  ok: true,
  message:
    'Check your inbox. If that address can receive mail, a confirmation link is on its way — the levels start the next trading morning after you click it.',
} as const;

function ok() {
  const response = NextResponse.json(GENERIC_OK);
  response.headers.set('Cache-Control', 'no-store, private');
  return response;
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);

  const limit = levelsSignupLimiter.check(ip);
  if (!limit.allowed) {
    const response = NextResponse.json(
      { ok: false, error: 'Too many requests. Please try again later.' },
      { status: 429 },
    );
    response.headers.set('Retry-After', String(limit.retryAfterSeconds));
    response.headers.set('Cache-Control', 'no-store, private');
    return response;
  }

  const body = (await request.json().catch(() => ({}))) as {
    email?: unknown;
    symbol?: unknown;
    source?: unknown;
    // Honeypot. A real form leaves it empty because it is hidden from people;
    // most naive bots fill every input they find.
    website?: unknown;
  };

  // Honeypot tripped: answer exactly as if it succeeded, and do nothing. A
  // distinct error would tell the author of the bot which field to skip.
  if (typeof body.website === 'string' && body.website.trim() !== '') {
    return ok();
  }

  const email = typeof body.email === 'string' ? body.email : '';
  const source = typeof body.source === 'string' ? body.source : null;
  // Not validated here: normalizeLevelsSymbol() checks it against the shared
  // SYMBOLS registry and falls back to SPX, so a junk value costs the caller
  // nothing and still cannot reach the database.
  const symbol = typeof body.symbol === 'string' ? body.symbol : null;

  let result: ReturnType<typeof recordLevelsSubscription> = null;
  try {
    result = recordLevelsSubscription({ email, symbol, source, ip: ip === 'unknown' ? null : ip });
  } catch {
    // A storage failure must not hand the caller a different answer from a
    // success — see the oracle note above. It is logged and swallowed.
    return ok();
  }

  // Malformed address, already confirmed, previously unsubscribed, or inside
  // the per-address cooldown. All of them: say nothing, send nothing.
  if (!result || !result.shouldSend) return ok();

  try {
    await sendLevelsConfirmationEmail(
      result.subscriber.email,
      buildLevelsConfirmUrl(APP_URL, result.subscriber.id),
    );
  } catch (err) {
    // confirm_sent_at was already stamped, so the visitor waits out one
    // cooldown before a retry can reach the mailer again. That is the
    // deliberate trade: a delivery failure costs one window, whereas not
    // stamping first would let a retry loop volley at whatever address was
    // typed. Logged for the operator; the response does not change.
    console.error('[levels-email] confirmation send failed', err);
  }

  return ok();
}
