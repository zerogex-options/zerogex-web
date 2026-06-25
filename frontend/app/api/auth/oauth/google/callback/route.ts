import { NextRequest, NextResponse } from 'next/server';
import { createOrLoginOAuthUser, attachSessionCookie, enforceSignupRateLimit, getClientIp, isOAuthReturningUser, issueCsrfCookie, linkUserIdentity, requireSession } from '@/core/serverAuth';
import { getOAuthConfig, getOAuthNonceCookieName, getOAuthStateCookieName, OAUTH_INTENT_COOKIE_NAME, verifyGoogleIdToken } from '@/core/oauth';

function clearOAuthCookies(response: NextResponse) {
  response.cookies.set({ name: getOAuthStateCookieName('google'), value: '', path: '/', maxAge: 0 });
  response.cookies.set({ name: getOAuthNonceCookieName('google'), value: '', path: '/', maxAge: 0 });
  response.cookies.set({ name: OAUTH_INTENT_COOKIE_NAME, value: '', path: '/', maxAge: 0 });
}

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

  // Per-IP signup-attempt limit, shared with /api/auth/register. Only debit
  // the bucket when this callback is about to mint a NEW account: a returning
  // user behind a shared NAT / VPN / mobile carrier would otherwise burn the
  // bucket for every other user behind the same IP after five sign-ins/hour.
  // State + token verification above already gate the abuse path.
  if (!isOAuthReturningUser('google', profile.sub, profile.email)) {
    const ipLimit = enforceSignupRateLimit(getClientIp(request));
    if (!ipLimit.allowed) {
      return NextResponse.redirect(new URL('/login?error=oauth_rate_limited', baseUrl));
    }
  }

  const intent = request.cookies.get(OAUTH_INTENT_COOKIE_NAME)?.value;
  if (intent === 'link') {
    const actor = await requireSession();
    if (!actor) {
      const response = NextResponse.redirect(new URL('/login?error=oauth_link_unauthenticated', baseUrl));
      clearOAuthCookies(response);
      return response;
    }
    try {
      linkUserIdentity(actor.user.id, 'google', profile.sub);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'link_failed';
      const response = NextResponse.redirect(new URL(`/account?link=error&reason=${encodeURIComponent(message)}`, baseUrl));
      clearOAuthCookies(response);
      return response;
    }
    const response = NextResponse.redirect(new URL('/account?link=success&provider=google', baseUrl));
    clearOAuthCookies(response);
    return response;
  }

  const session = await createOrLoginOAuthUser(request, {
    provider: 'google',
    providerId: profile.sub,
    email: profile.email,
  });

  // Public users have no paid access; /dashboard would just bounce them to
  // /unauthorized. Route them straight to /pricing — the conversion path is
  // the right next step for a fresh, unpaid signup.
  const destination = session.user.tier === 'public' ? '/pricing' : '/dashboard';
  const redirectTo = new URL(destination, baseUrl);
  const response = NextResponse.redirect(redirectTo);
  attachSessionCookie(response, session.token);
  issueCsrfCookie(response, session.csrfToken);
  clearOAuthCookies(response);
  return response;
}
