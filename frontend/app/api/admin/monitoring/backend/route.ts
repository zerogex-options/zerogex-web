import { NextResponse } from 'next/server';
import { requireSession } from '@/core/serverAuth';
import { getBackendSnapshot } from '@/core/backendMonitoring';

export const dynamic = 'force-dynamic';

export async function GET() {
  const actor = await requireSession();
  if (!actor || actor.user.tier !== 'admin') {
    const forbidden = NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    forbidden.headers.set('Cache-Control', 'no-store, private');
    return forbidden;
  }
  const response = NextResponse.json({ ok: true, ...getBackendSnapshot() });
  response.headers.set('Cache-Control', 'no-store, private');
  return response;
}
