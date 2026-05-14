import { NextRequest, NextResponse } from 'next/server';
import {
  acknowledgeDisclaimerForRequest,
  attachSessionCookie,
  issueCsrfCookie,
  validateCsrf,
} from '@/core/serverAuth';
import { DISCLAIMER_VERSION } from '@/core/disclaimer';

export async function POST(request: NextRequest) {
  if (!validateCsrf(request)) {
    return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
  }

  const result = await acknowledgeDisclaimerForRequest(request, DISCLAIMER_VERSION);
  if (!result) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const response = NextResponse.json({
    ok: true,
    acknowledgedAt: result.acknowledgedAt,
    version: result.version,
  });
  response.headers.set('Cache-Control', 'no-store, private');
  issueCsrfCookie(response, result.csrfToken);
  if (result.rotatedToken) {
    attachSessionCookie(response, result.rotatedToken);
  }
  return response;
}
