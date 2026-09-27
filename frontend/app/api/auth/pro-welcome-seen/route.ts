import { NextRequest, NextResponse } from 'next/server';
import {
  attachSessionCookie,
  issueCsrfCookie,
  markProWelcomeSeenForRequest,
  validateCsrf,
} from '@/core/serverAuth';
import { isUnderlyingSymbol } from '@/core/symbolPersistence';

// Optional JSON body { market: 'ES' }: the first-run welcome's answer to
// "which market do you trade?". Anything missing, malformed or not one of the
// six symbols is ignored, never an error, so a dismissal always records.
async function readMarket(request: NextRequest): Promise<string | null> {
  try {
    const body = (await request.json()) as { market?: unknown } | null;
    const market = typeof body?.market === 'string' ? body.market : null;
    return isUnderlyingSymbol(market) ? market : null;
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  if (!validateCsrf(request)) {
    return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
  }

  const result = await markProWelcomeSeenForRequest(request, await readMarket(request));
  if (!result) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true, seenAt: result.seenAt });
  response.headers.set('Cache-Control', 'no-store, private');
  issueCsrfCookie(response, result.csrfToken);
  if (result.rotatedToken) {
    attachSessionCookie(response, result.rotatedToken);
  }
  return response;
}
