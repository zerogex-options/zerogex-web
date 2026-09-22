import { NextRequest, NextResponse } from 'next/server';
import {
  attachSessionCookie,
  issueCsrfCookie,
  listSavedLayoutsForRequest,
  saveLayoutForRequest,
  validateCsrf,
} from '@/core/serverAuth';

/**
 * A member's saved My Dashboard boards.
 *
 * GET lists them; POST saves the board in the request body under a name,
 * replacing a board of the same name. The live working board still lives in
 * the browser — these are the named copies the member keeps and switches
 * between, stored on the account so they survive a new browser or device.
 */

// Carries per-member data and Set-Cookie, so it must never be cached at the
// edge — same reason /api/auth/session opts out.
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const result = await listSavedLayoutsForRequest(request);
  if (!result) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }
  const response = NextResponse.json({ ok: true, layouts: result.layouts });
  response.headers.set('Cache-Control', 'no-store, private');
  issueCsrfCookie(response, result.csrfToken);
  if (result.rotatedToken) attachSessionCookie(response, result.rotatedToken);
  return response;
}

export async function POST(request: NextRequest) {
  if (!validateCsrf(request)) {
    return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
  }

  let body: { name?: unknown; layout?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Malformed body' }, { status: 400 });
  }

  const result = await saveLayoutForRequest(request, body);
  if (!result) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }
  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  const response = NextResponse.json({ ok: true, layouts: result.layouts });
  response.headers.set('Cache-Control', 'no-store, private');
  issueCsrfCookie(response, result.csrfToken);
  if (result.rotatedToken) attachSessionCookie(response, result.rotatedToken);
  return response;
}
