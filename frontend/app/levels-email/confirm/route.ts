import { NextRequest } from 'next/server';

import { confirmLevelsSubscriber } from '@/core/levelsSubscribers';
import { getClientIp } from '@/core/serverAuth';
import { levelsEmailPage } from '../shell';

// The double opt-in click. A route handler returning inline HTML rather than a
// React page, matching app/unsubscribe/route.ts — the house pattern for a link
// clicked out of an email, where the full app shell (layout, theme cookies,
// fonts) buys nothing and costs a render.
//
// Must stay anonymous-accessible: the whole point is that the recipient has no
// account. core/auth.ts lists /levels-email/* as public so the middleware does
// not bounce this to /login, and the response carries noindex because a
// confirmation receipt is not a page for Google.

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('s') ?? '';
  const token = searchParams.get('t');
  const ip = getClientIp(request);

  const { outcome } = confirmLevelsSubscriber(id, token, ip === 'unknown' ? null : ip);

  switch (outcome) {
    case 'confirmed':
    case 'already-confirmed':
      // Both say the same thing on purpose. A mail client or security scanner
      // that prefetches the link lands on 'already-confirmed' by the time the
      // human clicks, and telling them "you already did this" when they have
      // just clicked once reads as a bug.
      return levelsEmailPage({
        status: 200,
        heading: "You're on the list",
        body:
          'Your first levels email arrives before the open on the next trading day &mdash; the gamma flip, call wall, put wall, max pain and net GEX for SPX, SPY, QQQ, NDX, ES and NQ. Every one of them has an unsubscribe link at the bottom.',
        cta: { href: '/spx-gamma-levels', label: "See today's levels now" },
      });
    case 'unsubscribed':
      return levelsEmailPage({
        status: 200,
        heading: 'This address has opted out',
        body:
          'This address previously unsubscribed from the daily levels email, so confirming will not restart it. If you would like it back, reply to any ZeroGEX email and I will sort it out.',
        cta: { href: '/spx-gamma-levels', label: 'See the free levels page' },
      });
    default:
      return levelsEmailPage({
        status: 400,
        heading: 'This link looks invalid',
        body:
          'The confirmation link could not be verified. It may have been altered in transit, or truncated by your mail client. Try subscribing again from the levels page, or reply to any ZeroGEX email and I will sort it out.',
        cta: { href: '/spx-gamma-levels', label: 'Back to the levels page' },
      });
  }
}
