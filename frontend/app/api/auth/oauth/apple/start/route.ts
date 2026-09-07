import { NextRequest, NextResponse } from 'next/server';
import { APPLE_LINK_TICKET_COOKIE_NAME, createOAuthNonce, createOAuthState, getOAuthConfig, getOAuthNonceCookieName, getOAuthStateCookieName } from '@/core/oauth';
import { createLinkTicket, isLinkTicketAvailable } from '@/core/oauthLinkTicket';
import { requireSession } from '@/core/serverAuth';

// Apple answers with response_mode=form_post — a cross-site POST from
// appleid.apple.com back to our callback. A SameSite=Lax cookie is withheld on
// cross-site POSTs (Lax only rides top-level GET navigations), so the Google
// flow's `lax` would drop state/nonce and every Apple sign-in would bounce off
// apple_state_mismatch. SameSite=None is required here, and browsers only
// honour it alongside Secure — which is fine because Apple refuses non-HTTPS
// redirect URIs anyway (see docs/apple-sign-in-setup.md for local tunnelling).
function setAppleFlowCookie(response: NextResponse, name: string, value: string) {
  response.cookies.set({
    name,
    value,
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    path: '/',
    maxAge: 60 * 10,
  });
}

export async function GET(request: NextRequest) {
  const config = getOAuthConfig('apple');
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.url;
  const isLink = request.nextUrl.searchParams.get('intent') === 'link';

  // Resolve the linking user HERE, not in the callback: the session cookie is
  // SameSite=Lax and will not survive Apple's cross-site POST back to us.
  let linkTicket: string | null = null;
  if (isLink) {
    if (!isLinkTicketAvailable()) {
      // /account renders `reason` verbatim, so this has to read as a sentence
      // (the Google path forwards err.message the same way).
      const reason = encodeURIComponent('Apple account linking is not available right now.');
      return NextResponse.redirect(new URL(`/account?link=error&reason=${reason}`, baseUrl));
    }
    const actor = await requireSession();
    if (!actor) {
      return NextResponse.redirect(new URL('/login?error=oauth_link_unauthenticated', baseUrl));
    }
    linkTicket = createLinkTicket('apple', actor.user.id);
  }

  const state = createOAuthState();
  const nonce = createOAuthNonce();

  const url = new URL(config.authUrl);
  url.searchParams.set('client_id', config.clientId);
  url.searchParams.set('redirect_uri', config.redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', config.scope);
  url.searchParams.set('state', state);
  url.searchParams.set('nonce', nonce);
  url.searchParams.set('response_mode', config.responseMode);

  const response = NextResponse.redirect(url);
  setAppleFlowCookie(response, getOAuthStateCookieName('apple'), state);
  setAppleFlowCookie(response, getOAuthNonceCookieName('apple'), nonce);
  if (linkTicket) {
    setAppleFlowCookie(response, APPLE_LINK_TICKET_COOKIE_NAME, linkTicket);
  }

  return response;
}
