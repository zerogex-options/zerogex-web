import { NextRequest, NextResponse } from 'next/server';
import { clearAuthCookies, clearSession, validateCsrf } from '@/core/serverAuth';

export async function POST(request: NextRequest) {
  if (!validateCsrf(request)) {
    return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
  }

  await clearSession(request);
  const response = NextResponse.json({ ok: true });
  clearAuthCookies(response);
  return response;
}
