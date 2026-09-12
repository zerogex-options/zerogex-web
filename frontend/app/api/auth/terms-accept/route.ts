import { NextRequest, NextResponse } from 'next/server';
import {
  acceptTermsForRequest,
  attachSessionCookie,
  issueCsrfCookie,
  validateCsrf,
} from '@/core/serverAuth';
import { TERMS_VERSION, isAcceptedTermsVersionCurrent } from '@/core/legalTerms';

/**
 * Records the acceptance collected by the gate in ClientLayout, for members
 * whose account carries no current acceptance — every account created before
 * the signup checkbox shipped, and every Google/Apple signup, which mints an
 * account through a callback that has no checkbox to read.
 *
 * Mirrors /api/auth/register in reading the version the CLIENT rendered rather
 * than assuming the server's: a tab left open across a terms revision must be
 * rejected, not recorded as accepting text its owner never saw. The value that
 * gets stored is always the server's TERMS_VERSION.
 */
export async function POST(request: NextRequest) {
  if (!validateCsrf(request)) {
    return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as { acceptedTermsVersion?: unknown };
  if (!isAcceptedTermsVersionCurrent(body.acceptedTermsVersion)) {
    return NextResponse.json(
      { error: 'The Terms of Service have been updated. Please reload and accept the current version.' },
      { status: 409 },
    );
  }

  const result = await acceptTermsForRequest(request, TERMS_VERSION);
  if (!result) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }
  // Defence in depth: acceptTermsForRequest re-checks the version it is handed,
  // so this is unreachable while the call above passes TERMS_VERSION. It stays
  // because the check being in both places is what stops a future caller from
  // quietly recording an acceptance of superseded text.
  if ('error' in result) {
    return NextResponse.json(
      { error: 'The Terms of Service have been updated. Please reload and accept the current version.' },
      { status: 409 },
    );
  }

  const response = NextResponse.json({
    ok: true,
    acceptedAt: result.acceptedAt,
    version: result.version,
  });
  response.headers.set('Cache-Control', 'no-store, private');
  issueCsrfCookie(response, result.csrfToken);
  if (result.rotatedToken) {
    attachSessionCookie(response, result.rotatedToken);
  }
  return response;
}
