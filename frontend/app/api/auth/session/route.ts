import { NextRequest, NextResponse } from 'next/server';
import { attachSessionCookie, getSessionFromRequest, issueCsrfCookie } from '@/core/serverAuth';

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request);

  if (!session) {
    return NextResponse.json({ authenticated: false }, { status: 200 });
  }

  const response = NextResponse.json({
    authenticated: true,
    user: session.user,
    expiresAt: session.expiresAt,
  });

  issueCsrfCookie(response, session.csrfToken);
  if (session.rotatedToken) {
    attachSessionCookie(response, session.rotatedToken);
  }

  return response;
}
