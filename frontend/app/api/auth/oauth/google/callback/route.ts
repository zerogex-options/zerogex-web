import { NextRequest, NextResponse } from 'next/server';
import { createOrLoginOAuthUser, attachSessionCookie, issueCsrfCookie } from '@/core/serverAuth';
import { getOAuthConfig, getOAuthNonceCookieName, getOAuthStateCookieName, verifyGoogleIdToken } from '@/core/oauth';

export async function GET(request: NextRequest) {
  const state = request.nextUrl.searchParams.get('state');
  const code = request.nextUrl.searchParams.get('code');
  const expectedState = request.cookies.get(getOAuthStateCookieName('google'))?.value;
  const expectedNonce = request.cookies.get(getOAuthNonceCookieName('google'))?.value;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.url;

  if (!state || !code || !expectedState || state !== expectedState || !expectedNonce) {
    return NextResponse.redirect(new URL('/login?error=oauth_state_mismatch', baseUrl));
  }

  const config = getOAuthConfig('google');

  const tokenResponse = await fetch(config.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri,
      grant_type: 'authorization_code',
    }),
  });

  if (!tokenResponse.ok) {
    return NextResponse.redirect(new URL('/login?error=oauth_token_exchange_failed', baseUrl));
  }

  const tokenPayload = (await tokenResponse.json()) as { id_token?: string };
  if (!tokenPayload.id_token) {
    return NextResponse.redirect(new URL('/login?error=oauth_missing_id_token', baseUrl));
  }
  let profile: { sub: string; email: string };
  try {
    profile = await verifyGoogleIdToken(tokenPayload.id_token, config.clientId, expectedNonce);
  } catch {
    return NextResponse.redirect(new URL('/login?error=oauth_profile_invalid', baseUrl));
  }

  const session = await createOrLoginOAuthUser(request, {
    provider: 'google',
    providerId: profile.sub,
    email: profile.email,
  });

  const redirectTo = new URL('/dashboard', baseUrl);
  const response = NextResponse.redirect(redirectTo);
  attachSessionCookie(response, session.token);
  issueCsrfCookie(response, session.csrfToken);
  response.cookies.set({ name: getOAuthStateCookieName('google'), value: '', path: '/', maxAge: 0 });
  response.cookies.set({ name: getOAuthNonceCookieName('google'), value: '', path: '/', maxAge: 0 });
  return response;
}
