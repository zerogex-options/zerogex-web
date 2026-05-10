import { NextRequest, NextResponse } from 'next/server';
import { resetPasswordWithToken, validateCsrf } from '@/core/serverAuth';

export async function POST(request: NextRequest) {
  if (!validateCsrf(request)) {
    return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as { token?: string; password?: string };
  const token = body.token ?? '';
  const password = body.password ?? '';

  if (!token || !password) {
    return NextResponse.json({ error: 'Token and new password are required' }, { status: 400 });
  }

  try {
    const result = await resetPasswordWithToken(request, token, password);
    return NextResponse.json({ ok: true, email: result.email });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to reset password';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
