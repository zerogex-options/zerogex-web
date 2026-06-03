import { NextRequest, NextResponse } from 'next/server';
import { attachSessionCookie, getSessionFromRequest } from '@/core/serverAuth';
import { getReferralStats, isReferralProgramEnabled } from '@/core/referrals';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    const unauth = NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    unauth.headers.set('Cache-Control', 'no-store, private');
    return unauth;
  }

  if (!isReferralProgramEnabled()) {
    const off = NextResponse.json({ enabled: false });
    off.headers.set('Cache-Control', 'no-store, private');
    if (session.rotatedToken) attachSessionCookie(off, session.rotatedToken);
    return off;
  }

  const stats = getReferralStats(session.user.id);
  const response = NextResponse.json({ enabled: true, ...stats });
  // User-specific payload; same no-store rationale as the identities route.
  response.headers.set('Cache-Control', 'no-store, private');
  if (session.rotatedToken) {
    attachSessionCookie(response, session.rotatedToken);
  }
  return response;
}
