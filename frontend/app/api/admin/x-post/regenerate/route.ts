import { NextRequest, NextResponse } from 'next/server';

import { requireSession, validateCsrf } from '@/core/serverAuth';
import { regenerateXPost, XPostAdminError } from '@/core/xPost';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  // CSRF first (double-submit), then session + admin tier — mirrors the
  // other state-changing admin routes.
  if (!validateCsrf(request)) {
    return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
  }
  const actor = await requireSession();
  if (!actor || actor.user.tier !== 'admin') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    symbol?: unknown;
    mode?: unknown;
  };
  const symbol = typeof body.symbol === 'string' ? body.symbol : undefined;
  const mode = typeof body.mode === 'string' ? body.mode : undefined;

  try {
    const data = await regenerateXPost(symbol, mode);
    const response = NextResponse.json({ ok: true, ...data });
    response.headers.set('Cache-Control', 'no-store, private');
    return response;
  } catch (err) {
    const status = err instanceof XPostAdminError && err.status ? err.status : 502;
    const message = err instanceof Error ? err.message : 'X-post service error';
    const response = NextResponse.json({ error: message }, { status });
    response.headers.set('Cache-Control', 'no-store, private');
    return response;
  }
}
