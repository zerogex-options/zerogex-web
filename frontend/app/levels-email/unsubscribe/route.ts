import { NextRequest } from 'next/server';

import { unsubscribeLevelsSubscriber } from '@/core/levelsSubscribers';
import { levelsEmailPage } from '../shell';

// Opt-out for the free daily levels email.
//
// GET renders a confirmation page — the visible link at the foot of every
// digest. POST is the RFC 8058 one-click endpoint Gmail and Apple Mail call
// from their own native "Unsubscribe" button, which they only surface when the
// message carries List-Unsubscribe and List-Unsubscribe-Post headers. Both
// verify the signed token and are idempotent.
//
// This mirrors app/unsubscribe/route.ts, which does the same job for account
// marketing mail. They are deliberately separate endpoints over separate
// stores: a levels subscriber has no users row, so neither one can serve the
// other's audience, and opting out of one must not silently opt out of the
// other.

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function apply(request: NextRequest, id: string | null, token: string | null): boolean {
  if (!id) return false;
  const { outcome } = unsubscribeLevelsSubscriber(id, token);
  return outcome === 'unsubscribed' || outcome === 'already-unsubscribed';
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const done = apply(request, searchParams.get('s'), searchParams.get('t'));
  return done
    ? levelsEmailPage({
        status: 200,
        heading: "You're unsubscribed",
        body:
          'No more daily levels emails will be sent to this address. The free levels pages stay open to everyone, no account needed. Changed your mind? Just subscribe again from any of them.',
        cta: { href: '/spx-gamma-levels', label: 'Free SPX gamma levels' },
      })
    : levelsEmailPage({
        status: 400,
        heading: 'This link looks invalid',
        body:
          'We could not process this unsubscribe request. Reply to the email you received and I will take care of it for you.',
        cta: { href: '/spx-gamma-levels', label: 'Back to the levels page' },
      });
}

// RFC 8058 one-click. The parameters may arrive in the query string or the
// form body depending on the mail client, so accept both.
export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  let id = searchParams.get('s');
  let token = searchParams.get('t');
  if (!id || !token) {
    try {
      const form = new URLSearchParams(await request.text());
      id = id ?? form.get('s');
      token = token ?? form.get('t');
    } catch {
      /* malformed body — fall through to the invalid answer below */
    }
  }
  const done = apply(request, id, token);
  return new Response(done ? 'unsubscribed' : 'invalid', {
    status: done ? 200 : 400,
    headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' },
  });
}
