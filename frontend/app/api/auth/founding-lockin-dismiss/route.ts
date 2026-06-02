import { NextRequest, NextResponse } from 'next/server';
import {
  attachSessionCookie,
  dismissFoundingLockinForRequest,
  issueCsrfCookie,
  validateCsrf,
} from '@/core/serverAuth';

export async function POST(request: NextRequest) {
  if (!validateCsrf(request)) {
    return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
  }

  const result = await dismissFoundingLockinForRequest(request);
  if (!result) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true, dismissedAt: result.dismissedAt });
  response.headers.set('Cache-Control', 'no-store, private');
  issueCsrfCookie(response, result.csrfToken);
  if (result.rotatedToken) {
    attachSessionCookie(response, result.rotatedToken);
  }
  return response;
}
