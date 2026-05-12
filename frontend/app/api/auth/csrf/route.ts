import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { CSRF_COOKIE_NAME } from '@/core/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const token = randomBytes(24).toString('hex');
  const response = NextResponse.json({ csrfToken: token });
  // Each call mints a new token and pairs it to a fresh cookie. nginx's
  // /api/ cache must never reuse one client's token for another.
  response.headers.set('Cache-Control', 'no-store, private');
  response.cookies.set({
    name: CSRF_COOKIE_NAME,
    value: token,
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60,
  });
  return response;
}
