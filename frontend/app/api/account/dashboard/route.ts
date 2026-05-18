import { NextRequest, NextResponse } from 'next/server';
import {
  attachSessionCookie,
  getSessionFromRequest,
  requireSession,
  validateCsrf,
} from '@/core/serverAuth';
import {
  getDashboardLayout,
  sanitizeLayout,
  saveDashboardLayout,
} from '@/core/dashboardLayout';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    const unauth = NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    unauth.headers.set('Cache-Control', 'no-store, private');
    return unauth;
  }

  const stored = getDashboardLayout(session.user.id);
  const response = NextResponse.json({ widgets: stored?.widgets ?? null });
  // User-specific payload — nginx's /api/ proxy_cache key isn't partitioned
  // by the session cookie, so opt out explicitly.
  response.headers.set('Cache-Control', 'no-store, private');
  if (session.rotatedToken) {
    attachSessionCookie(response, session.rotatedToken);
  }
  return response;
}

export async function PUT(request: NextRequest) {
  if (!validateCsrf(request)) {
    return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
  }
  const actor = await requireSession();
  if (!actor) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as { widgets?: unknown };
  const widgets = sanitizeLayout(body.widgets);
  if (!widgets) {
    return NextResponse.json({ error: 'Invalid layout' }, { status: 400 });
  }

  saveDashboardLayout(actor.user.id, widgets);
  return NextResponse.json({ ok: true });
}
