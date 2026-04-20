import { NextRequest, NextResponse } from 'next/server';
import { createOrLoginOAuthUser, attachSessionCookie, issueCsrfCookie } from '@/core/serverAuth';
import { getOAuthConfig, getOAuthStateCookieName } from '@/core/oauth';

export async function GET(request: NextRequest) {
  const state = request.nextUrl.searchParams.get('state');
  const code = request.nextUrl.searchParams.get('code');
  const expectedState = request.cookies.get(getOAuthStateCookieName('google'))?.value;

  if (!state || !code || !expectedState || state !== expectedState) {
    return NextResponse.redirect(new URL('/login?error=oauth_state_mismatch', request.url));
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
    return NextResponse.redirect(new URL('/login?error=oauth_token_exchange_failed', request.url));
  }

  const tokenPayload = (await tokenResponse.json()) as { access_token?: string };
  if (!tokenPayload.access_token) {
    return NextResponse.redirect(new URL('/login?error=oauth_missing_access_token', request.url));
  }

  const userResponse = await fetch(config.userInfoUrl, {
    headers: { Authorization: `Bearer ${tokenPayload.access_token}` },
  });

  if (!userResponse.ok) {
    return NextResponse.redirect(new URL('/login?error=oauth_userinfo_failed', request.url));
  }

  const profile = (await userResponse.json()) as { sub?: string; email?: string };
  if (!profile.sub || !profile.email) {
    return NextResponse.redirect(new URL('/login?error=oauth_profile_invalid', request.url));
  }

  const session = await createOrLoginOAuthUser(request, {
    provider: 'google',
    providerId: profile.sub,
    email: profile.email,
  });

  const redirectTo = new URL('/dashboard', request.url);
  const response = NextResponse.redirect(redirectTo);
  attachSessionCookie(response, session.token);
  issueCsrfCookie(response, session.csrfToken);
  response.cookies.set({ name: getOAuthStateCookieName('google'), value: '', path: '/', maxAge: 0 });
  return response;
}
