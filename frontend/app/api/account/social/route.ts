import { NextRequest, NextResponse } from 'next/server';
import {
  appendAuditEvent,
  attachSessionCookie,
  getClientIp,
  getSessionFromRequest,
  getUserXHandle,
  requireSession,
  setUserXHandle,
  validateCsrf,
} from '@/core/serverAuth';

export const dynamic = 'force-dynamic';

// Return the caller's current X handle (null when unset).
export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    const unauth = NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    unauth.headers.set('Cache-Control', 'no-store, private');
    return unauth;
  }

  const response = NextResponse.json({ xHandle: getUserXHandle(session.user.id) });
  // User-specific payload — same no-store rationale as the identities route
  // (nginx's /api/ cache slot isn't partitioned by the session cookie).
  response.headers.set('Cache-Control', 'no-store, private');
  if (session.rotatedToken) {
    attachSessionCookie(response, session.rotatedToken);
  }
  return response;
}

// Set or clear the caller's X handle. An empty string clears it.
export async function POST(request: NextRequest) {
  if (!validateCsrf(request)) {
    return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
  }

  const actor = await requireSession();
  if (!actor) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as { xHandle?: unknown };
  if (typeof body.xHandle !== 'string') {
    return NextResponse.json({ error: 'xHandle is required' }, { status: 400 });
  }

  try {
    const { xHandle } = setUserXHandle(actor.user.id, body.xHandle);
    appendAuditEvent({
      type: 'x_handle_update',
      userId: actor.user.id,
      email: actor.user.email,
      ip: getClientIp(request),
      message: xHandle ? `X handle set to @${xHandle}` : 'X handle cleared',
    });
    return NextResponse.json({ ok: true, xHandle });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to save X handle';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
