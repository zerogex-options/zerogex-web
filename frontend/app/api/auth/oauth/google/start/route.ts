import { NextResponse } from 'next/server';
import { createOAuthState, getOAuthConfig, getOAuthStateCookieName } from '@/core/oauth';

export async function GET() {
  const config = getOAuthConfig('google');
  const state = createOAuthState();

  const url = new URL(config.authUrl);
  url.searchParams.set('client_id', config.clientId);
  url.searchParams.set('redirect_uri', config.redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', config.scope);
  url.searchParams.set('state', state);
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

  return response;
}
