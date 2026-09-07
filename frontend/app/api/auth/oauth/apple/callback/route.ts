import { NextRequest, NextResponse } from 'next/server';
import { createOrLoginOAuthUser, attachSessionCookie, enforceSignupRateLimit, getClientIp, isOAuthReturningUser, issueCsrfCookie, linkUserIdentity } from '@/core/serverAuth';
import { APPLE_LINK_TICKET_COOKIE_NAME, getAppleClientSecret, getOAuthConfig, getOAuthNonceCookieName, getOAuthStateCookieName, isAppleOAuthConfigured, verifyAppleIdToken } from '@/core/oauth';
import { readLinkTicket } from '@/core/oauthLinkTicket';

function clearAppleFlowCookies(response: NextResponse) {
  // Written with SameSite=None/Secure by apple/start; the clearing Set-Cookie
  // has to match those attributes or the browser keeps the original.
  for (const name of [getOAuthStateCookieName('apple'), getOAuthNonceCookieName('apple'), APPLE_LINK_TICKET_COOKIE_NAME]) {
    response.cookies.set({ name, value: '', path: '/', maxAge: 0, secure: true, sameSite: 'none', httpOnly: true });
  }
}

function fail(baseUrl: string, code: string) {
  const response = NextResponse.redirect(new URL(`/login?error=${code}`, baseUrl));
  clearAppleFlowCookies(response);
  return response;
}

async function handleCallback(request: NextRequest, state: string | null, code: string | null) {
  const expectedState = request.cookies.get(getOAuthStateCookieName('apple'))?.value;
  const expectedNonce = request.cookies.get(getOAuthNonceCookieName('apple'))?.value;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.url;

  if (!isAppleOAuthConfigured()) {
    return fail(baseUrl, 'apple_not_configured');
  }

  if (!state || !code || !expectedState || state !== expectedState || !expectedNonce) {
    return fail(baseUrl, 'apple_state_mismatch');
  }

  const config = getOAuthConfig('apple');

  // Apple has no static client secret: it is an ES256 JWT we sign with the .p8
  // key, so a misconfigured key surfaces here rather than as a 400 from Apple.
  let clientSecret: string;
  try {
    clientSecret = getAppleClientSecret(config.clientId);
  } catch (err) {
    console.error('[oauth] apple client secret unavailable:', err);
    return fail(baseUrl, 'apple_not_configured');
  }

  const tokenResponse = await fetch(config.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      grant_type: 'authorization_code',
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      client_secret: clientSecret,
    }),
  });

  if (!tokenResponse.ok) {
    // Apple's error body is the only way to tell a bad signing key
    // (invalid_client) from an expired code, and it never reaches the user.
    console.error('[oauth] apple token exchange failed:', tokenResponse.status, await tokenResponse.text().catch(() => ''));
    return fail(baseUrl, 'apple_token_exchange_failed');
  }

  const tokenPayload = (await tokenResponse.json()) as { id_token?: string; sub?: string };
  if (!tokenPayload.id_token) {
    return fail(baseUrl, 'apple_missing_id_token');
  }

  let payload: { sub: string; email: string };
  try {
    payload = await verifyAppleIdToken(tokenPayload.id_token, config.clientId, expectedNonce);
  } catch (err) {
    console.error('[oauth] apple id_token rejected:', err);
    return fail(baseUrl, 'apple_profile_invalid');
  }

  // Linking an Apple identity to an already-signed-in account. The user id came
  // from the signed ticket apple/start minted, because the session cookie does
  // not survive Apple's cross-site POST (see core/oauthLinkTicket.ts).
  const linkUserId = readLinkTicket('apple', request.cookies.get(APPLE_LINK_TICKET_COOKIE_NAME)?.value);
  if (linkUserId) {
    try {
      linkUserIdentity(linkUserId, 'apple', payload.sub);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'link_failed';
      const response = NextResponse.redirect(new URL(`/account?link=error&reason=${encodeURIComponent(message)}`, baseUrl));
      clearAppleFlowCookies(response);
      return response;
    }
    const response = NextResponse.redirect(new URL('/account?link=success&provider=apple', baseUrl));
    clearAppleFlowCookies(response);
    return response;
  }

  // Only debit the signup bucket when minting a NEW account; returning users
  // skip it so a shared NAT can't lock everyone out. See the Google callback.
  if (!isOAuthReturningUser('apple', payload.sub, payload.email)) {
    const ipLimit = enforceSignupRateLimit(getClientIp(request));
    if (!ipLimit.allowed) {
      return fail(baseUrl, 'apple_rate_limited');
    }
  }

  let session: Awaited<ReturnType<typeof createOrLoginOAuthUser>>;
  try {
    session = await createOrLoginOAuthUser(request, {
      provider: 'apple',
      providerId: payload.sub,
      email: payload.email,
    });
  } catch (err) {
    // e.g. a soft-deleted account refusing to be revived. Google's callback
    // lets this throw into a 500; Apple's form_post lands the user on an
    // opaque error page, so redirect with a code /login can explain instead.
    console.error('[oauth] apple sign-in rejected:', err);
    return fail(baseUrl, 'apple_account_unavailable');
  }

  // Public users have no paid access; /dashboard would just bounce them to
  // /unauthorized. Route them straight to /pricing — the conversion path is
  // the right next step for a fresh, unpaid signup.
  const destination = session.user.tier === 'public' ? '/pricing' : '/dashboard';
  const response = NextResponse.redirect(new URL(destination, baseUrl));
  attachSessionCookie(response, session.token);
  issueCsrfCookie(response, session.csrfToken);
  clearAppleFlowCookies(response);
  return response;
}

export async function GET(request: NextRequest) {
  // Apple uses form_post, so a GET here is normally its error redirect
  // (user cancelled), but handle it for completeness.
  const error = request.nextUrl.searchParams.get('error');
  if (error) {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.url;
    return fail(baseUrl, error === 'user_cancelled_authorize' ? 'apple_cancelled' : 'apple_authorize_failed');
  }
  return handleCallback(
    request,
    request.nextUrl.searchParams.get('state'),
    request.nextUrl.searchParams.get('code')
  );
}

export async function POST(request: NextRequest) {
  const form = await request.formData();
  const error = form.get('error');
  if (typeof error === 'string' && error) {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.url;
    return fail(baseUrl, error === 'user_cancelled_authorize' ? 'apple_cancelled' : 'apple_authorize_failed');
  }
  return handleCallback(
    request,
    (form.get('state') as string | null) ?? null,
    (form.get('code') as string | null) ?? null
  );
}
