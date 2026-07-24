import { NextRequest, NextResponse } from 'next/server';

import { requireSession } from '@/core/serverAuth';
import { getLatestXPost, XPostAdminError } from '@/core/xPost';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const actor = await requireSession();
  if (!actor || actor.user.tier !== 'admin') {
    const forbidden = NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    forbidden.headers.set('Cache-Control', 'no-store, private');
    return forbidden;
  }
  const symbol = request.nextUrl.searchParams.get('symbol') || undefined;
  const mode = request.nextUrl.searchParams.get('mode') || undefined;
  try {
    const data = await getLatestXPost(symbol, mode);
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
