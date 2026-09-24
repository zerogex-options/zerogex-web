import { NextRequest, NextResponse } from 'next/server';
import {
  attachSessionCookie,
  issueCsrfCookie,
  readWorkingBoardForRequest,
  saveWorkingBoardForRequest,
  validateCsrf,
} from '@/core/serverAuth';

/**
 * The member's live My Dashboard board.
 *
 * GET returns it (`layout: null` when nothing is saved yet); PUT replaces it.
 * The page keeps a copy in the browser for instant loads, but this is the one
 * that survives a browser clearing its site data. Named boards the member
 * chose to keep live under /api/account/layouts.
 */

// Carries per-member data and Set-Cookie, so it must never be cached at the
// edge — same reason /api/auth/session opts out.
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const result = await readWorkingBoardForRequest(request);
  if (!result) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }
  const response = NextResponse.json({ ok: true, layout: result.layout, updatedAt: result.updatedAt });
  response.headers.set('Cache-Control', 'no-store, private');
  issueCsrfCookie(response, result.csrfToken);
  if (result.rotatedToken) attachSessionCookie(response, result.rotatedToken);
  return response;
}

export async function PUT(request: NextRequest) {
  if (!validateCsrf(request)) {
    return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
  }

  let body: { layout?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Malformed body' }, { status: 400 });
  }

  const result = await saveWorkingBoardForRequest(request, body);
  if (!result) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }
  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  const response = NextResponse.json({ ok: true, updatedAt: result.updatedAt });
  response.headers.set('Cache-Control', 'no-store, private');
  issueCsrfCookie(response, result.csrfToken);
  if (result.rotatedToken) attachSessionCookie(response, result.rotatedToken);
  return response;
}
