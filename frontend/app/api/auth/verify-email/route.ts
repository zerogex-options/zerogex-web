import { NextRequest, NextResponse } from 'next/server';
import { consumeEmailVerification } from '@/core/serverAuth';

// Auth mutation route; never cache the response at the /api/ proxy.
export const dynamic = 'force-dynamic';

// GET is intentional: this is the URL a user opens from their inbox. The
// token itself is the proof, so there's no CSRF cookie/header to validate.
// Single-use + 24h-TTL + sha256-at-rest are the controls that make GET safe
// here. Mirrors the password-reset link-in-email pattern.
export async function GET(request: NextRequest) {
  const token = new URL(request.url).searchParams.get('token') ?? '';
  const result = await consumeEmailVerification(request, token);

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ?? new URL(request.url).origin;
  const target =
    result.status === 'ok'
      ? `${baseUrl}/pricing?verified=1`
      : `${baseUrl}/pricing?verify_error=${result.status}`;

  // 303 forces the redirect to be followed as a GET regardless of whatever
  // the user's mail client passed in originally. Cache-Control: no-store
  // keeps an intermediary from memoizing the consumed token's response.
  const response = NextResponse.redirect(target, 303);
  response.headers.set('Cache-Control', 'no-store, private');
  return response;
}
