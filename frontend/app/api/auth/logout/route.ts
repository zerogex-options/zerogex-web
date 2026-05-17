import { NextRequest, NextResponse } from 'next/server';
import { clearAuthCookies, clearSession, validateCsrf } from '@/core/serverAuth';

// Carries Set-Cookie (clears session/CSRF); must not be cached by the
// /api/ proxy. See /api/auth/session.
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  if (!validateCsrf(request)) {
    return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
  }

  await clearSession(request);
  const response = NextResponse.json({ ok: true });
  response.headers.set('Cache-Control', 'no-store, private');
  clearAuthCookies(response);
  return response;
}
