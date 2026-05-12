import { NextResponse } from 'next/server';
import { requireSession } from '@/core/serverAuth';
import { getSnapshot } from '@/core/monitoring';

export const dynamic = 'force-dynamic';

export async function GET() {
  const actor = await requireSession();
  if (!actor || actor.user.tier !== 'admin') {
    const forbidden = NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    forbidden.headers.set('Cache-Control', 'no-store, private');
    return forbidden;
  }
  const response = NextResponse.json({ ok: true, ...getSnapshot() });
  // Admin-only data; nginx's /api/ cache slot isn't partitioned by session.
  response.headers.set('Cache-Control', 'no-store, private');
  return response;
}
