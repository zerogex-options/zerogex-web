import { NextResponse } from 'next/server';
import { requireSession } from '@/core/serverAuth';
import { getSnapshot } from '@/core/monitoring';

export const dynamic = 'force-dynamic';

export async function GET() {
  const actor = await requireSession();
  if (!actor || actor.user.tier !== 'admin') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }
  return NextResponse.json({ ok: true, ...getSnapshot() });
}
