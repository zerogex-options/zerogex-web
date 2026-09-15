import { NextRequest, NextResponse } from 'next/server';
import {
  attachSessionCookie,
  issueCsrfCookie,
  saveAppearanceForRequest,
  validateCsrf,
} from '@/core/serverAuth';

/**
 * Save the signed-in member's theme and palette against their account.
 *
 * The browser cookie set by ThemeContext is still what paints the page; this
 * is the durable copy that follows the member to another device and seeds the
 * cookie again at login. Anonymous visitors get a 401 and simply keep the
 * cookie-only behaviour they have always had.
 */
export async function POST(request: NextRequest) {
  if (!validateCsrf(request)) {
    return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
  }

  let body: { theme?: unknown; palette?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Malformed body' }, { status: 400 });
  }

  const result = await saveAppearanceForRequest(request, body);
  if (!result) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const response = NextResponse.json({
    ok: true,
    theme: result.theme,
    palette: result.palette,
  });
  response.headers.set('Cache-Control', 'no-store, private');
  issueCsrfCookie(response, result.csrfToken);
  if (result.rotatedToken) {
    attachSessionCookie(response, result.rotatedToken);
  }
  return response;
}
