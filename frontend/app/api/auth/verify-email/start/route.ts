import { NextRequest, NextResponse } from 'next/server';
import { isEmailVerified, issueEmailVerification, requireSession, validateCsrf } from '@/core/serverAuth';

// Auth mutation route; never cache the response at the /api/ proxy.
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  if (!validateCsrf(request)) {
    return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
  }

  const actor = await requireSession();
  if (!actor) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  if (isEmailVerified(actor.user.id)) {
    // Already done — don't waste a Resend send and don't tick the per-user
    // rate-limit counter on a no-op. 409 lets the client suppress the
    // "Sent" toast and refresh the session to drop the banner.
    return NextResponse.json({ error: 'Email is already verified.' }, { status: 409 });
  }

  try {
    await issueEmailVerification(request, actor.user.id, actor.user.email);
    const response = NextResponse.json({ ok: true });
    response.headers.set('Cache-Control', 'no-store, private');
    return response;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unable to send verification email.';
    // issueEmailVerification throws this exact phrasing on rate-limit; route
    // it to 429 so the client can render a "try again later" hint instead
    // of a generic failure.
    const isRateLimit = message.startsWith('Too many verification emails.');
    return NextResponse.json({ error: message }, { status: isRateLimit ? 429 : 500 });
  }
}
