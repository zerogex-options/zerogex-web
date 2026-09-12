import { NextResponse } from 'next/server';
import { requireSession } from '@/core/serverAuth';
import { getCohortRetentionReport } from '@/core/cohortRetentionServer';

export const dynamic = 'force-dynamic';

export async function GET() {
  const actor = await requireSession();
  if (!actor || actor.user.tier !== 'admin') {
    const forbidden = NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    forbidden.headers.set('Cache-Control', 'no-store, private');
    return forbidden;
  }
  const response = NextResponse.json({ ok: true, ...getCohortRetentionReport() });
  response.headers.set('Cache-Control', 'no-store, private');
  return response;
}
