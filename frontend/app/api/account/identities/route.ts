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
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const identities = listUserIdentities(session.user.id);
  const response = NextResponse.json({
    hasPassword: userHasPassword(session.user.id),
    identities: identities.map((i) => ({ provider: i.provider, createdAt: i.createdAt })),
  });
  if (session.rotatedToken) {
    attachSessionCookie(response, session.rotatedToken);
  }
  return response;
}
