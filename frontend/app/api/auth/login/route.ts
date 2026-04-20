import { NextRequest, NextResponse } from 'next/server';
import { attachSessionCookie, createSessionForUserCredentials, issueCsrfCookie, validateCsrf } from '@/core/serverAuth';

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
    attachSessionCookie(response, session.token);
    issueCsrfCookie(response, session.csrfToken);
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Login failed';
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
