import { NextRequest, NextResponse } from 'next/server';
import { attachSessionCookie, getSessionFromRequest, issueCsrfCookie } from '@/core/serverAuth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request);

  if (!session) {
    const anon = NextResponse.json({ authenticated: false }, { status: 200 });
    anon.headers.set('Cache-Control', 'no-store, private');
    return anon;
  }

  const response = NextResponse.json({
    authenticated: true,
    user: session.user,
    expiresAt: session.expiresAt,
  });

  // User-specific payload; nginx's /api/ cache key isn't partitioned by the
  // session cookie, so we must opt out explicitly.
  response.headers.set('Cache-Control', 'no-store, private');
  issueCsrfCookie(response, session.csrfToken);
  if (session.rotatedToken) {
    attachSessionCookie(response, session.rotatedToken);
  }

  return response;
}
