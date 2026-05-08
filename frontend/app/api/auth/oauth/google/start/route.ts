import { NextRequest, NextResponse } from 'next/server';
import { createOAuthNonce, createOAuthState, getOAuthConfig, getOAuthNonceCookieName, getOAuthStateCookieName, OAUTH_INTENT_COOKIE_NAME } from '@/core/oauth';

export async function GET(request: NextRequest) {
  const config = getOAuthConfig('google');
  const state = createOAuthState();
  const nonce = createOAuthNonce();
  const intent = request.nextUrl.searchParams.get('intent') === 'link' ? 'link' : null;

  const url = new URL(config.authUrl);
  url.searchParams.set('client_id', config.clientId);
  url.searchParams.set('redirect_uri', config.redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', config.scope);
  url.searchParams.set('state', state);
  url.searchParams.set('nonce', nonce);
  url.searchParams.set('access_type', 'offline');

  const response = NextResponse.redirect(url);
  response.cookies.set({
    name: getOAuthStateCookieName('google'),
    value: state,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 10,
  });
  response.cookies.set({
    name: getOAuthNonceCookieName('google'),
    value: nonce,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 10,
  });
  if (intent) {
    response.cookies.set({
      name: OAUTH_INTENT_COOKIE_NAME,
      value: intent,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 10,
    });
  }

  return response;
}
