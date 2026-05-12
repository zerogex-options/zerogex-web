import { NextRequest, NextResponse } from 'next/server';
import {
  attachSessionCookie,
  getSessionFromRequest,
  listUserIdentities,
  userHasPassword,
} from '@/core/serverAuth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    const unauth = NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    unauth.headers.set('Cache-Control', 'no-store, private');
    return unauth;
  }

  const identities = listUserIdentities(session.user.id);
  const response = NextResponse.json({
    hasPassword: userHasPassword(session.user.id),
    identities: identities.map((i) => ({ provider: i.provider, createdAt: i.createdAt })),
  });
  // User-specific payload — nginx's /api/ proxy_cache slot is partitioned by
  // Authorization / X-API-Key but NOT by the session cookie, so without this
  // a stale post-unlink view would survive for the 5s cache TTL.
  response.headers.set('Cache-Control', 'no-store, private');
  if (session.rotatedToken) {
    attachSessionCookie(response, session.rotatedToken);
  }
  return response;
}
