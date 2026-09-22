import { NextRequest, NextResponse } from 'next/server';
import { applyAppearanceCookies, attachSessionCookie, createSessionForUserCredentials, issueCsrfCookie, validateCsrf } from '@/core/serverAuth';

// This response carries Set-Cookie (session + CSRF). nginx's /api/ cache
// key isn't partitioned by cookie, so a cached login response could leak
// one user's session token to the next caller. Opt out explicitly, like
// /api/auth/session does.
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  if (!validateCsrf(request)) {
    return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as { email?: string; password?: string };
  const email = body.email?.trim().toLowerCase();
  const password = body.password ?? '';

  if (!email || !password) {
    return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
  }

  try {
    const session = await createSessionForUserCredentials(request, email, password);
    const response = NextResponse.json({ ok: true, user: session.user, expiresAt: session.expiresAt });
    response.headers.set('Cache-Control', 'no-store, private');
    attachSessionCookie(response, session.token);
    issueCsrfCookie(response, session.csrfToken);
    // Seed the look from the account, so signing in on a new browser paints in
    // the member's own theme rather than the default followed by a repaint.
    applyAppearanceCookies(response, session.user.id);
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Login failed';
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
