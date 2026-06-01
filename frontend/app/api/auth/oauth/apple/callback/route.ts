import { NextRequest, NextResponse } from 'next/server';
import { createOrLoginOAuthUser, attachSessionCookie, issueCsrfCookie } from '@/core/serverAuth';
import { getOAuthConfig, getOAuthNonceCookieName, getOAuthStateCookieName, verifyAppleIdToken } from '@/core/oauth';

async function handleCallback(request: NextRequest, state: string | null, code: string | null) {
  const expectedState = request.cookies.get(getOAuthStateCookieName('apple'))?.value;
  const expectedNonce = request.cookies.get(getOAuthNonceCookieName('apple'))?.value;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.url;

  if (!state || !code || !expectedState || state !== expectedState || !expectedNonce) {
    return NextResponse.redirect(new URL('/login?error=apple_state_mismatch', baseUrl));
  }

  const config = getOAuthConfig('apple');
  const tokenResponse = await fetch(config.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      grant_type: 'authorization_code',
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      client_secret: config.clientSecret,
    }),
  });

  if (!tokenResponse.ok) {
    return NextResponse.redirect(new URL('/login?error=apple_token_exchange_failed', baseUrl));
  }

  const tokenPayload = (await tokenResponse.json()) as { id_token?: string; sub?: string };
  if (!tokenPayload.id_token) {
    return NextResponse.redirect(new URL('/login?error=apple_missing_id_token', baseUrl));
  }

  let payload: { sub: string; email: string };
  try {
    payload = await verifyAppleIdToken(tokenPayload.id_token, config.clientId, expectedNonce);
  } catch {
    return NextResponse.redirect(new URL('/login?error=apple_profile_invalid', baseUrl));
  }

  const session = await createOrLoginOAuthUser(request, {
    provider: 'apple',
    providerId: payload.sub,
    email: payload.email,
  });

  // Public users have no paid access; /dashboard would just bounce them to
  // /unauthorized. Route them straight to /pricing — the conversion path is
  // the right next step for a fresh, unpaid signup.
  const destination = session.user.tier === 'public' ? '/pricing' : '/dashboard';
  const response = NextResponse.redirect(new URL(destination, baseUrl));
  attachSessionCookie(response, session.token);
  issueCsrfCookie(response, session.csrfToken);
  response.cookies.set({ name: getOAuthStateCookieName('apple'), value: '', path: '/', maxAge: 0 });
  response.cookies.set({ name: getOAuthNonceCookieName('apple'), value: '', path: '/', maxAge: 0 });
  return response;
}

export async function GET(request: NextRequest) {
  return handleCallback(
    request,
    request.nextUrl.searchParams.get('state'),
    request.nextUrl.searchParams.get('code')
  );
}

export async function POST(request: NextRequest) {
  const form = await request.formData();
  return handleCallback(
    request,
    (form.get('state') as string | null) ?? null,
    (form.get('code') as string | null) ?? null
  );
}
