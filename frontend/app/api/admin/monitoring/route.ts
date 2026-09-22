import { NextResponse } from 'next/server';
import { requireSession } from '@/core/serverAuth';
import { getSnapshot } from '@/core/monitoring';
import { getConversionBySource } from '@/core/pageAnalytics';
import { getLevelsEmailFunnel } from '@/core/levelsSubscribers';

export const dynamic = 'force-dynamic';

export async function GET() {
  const actor = await requireSession();
  if (!actor || actor.user.tier !== 'admin') {
    const forbidden = NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    forbidden.headers.set('Cache-Control', 'no-store, private');
    return forbidden;
  }
  // Conversion-by-source is composed here (not inside getSnapshot) to avoid a
  // monitoring <-> pageAnalytics import cycle; it reads the same auth DB.
  // Composed here rather than inside getSnapshot() for the same reason
  // conversionBySource is: it reads the same auth DB but lives in its own
  // module, and folding it in would create an import cycle.
  const response = NextResponse.json({
    ok: true,
    ...getSnapshot(),
    conversionBySource: getConversionBySource(),
    levelsEmail: getLevelsEmailFunnel(),
  });
  // Admin-only data; nginx's /api/ cache slot isn't partitioned by session.
  response.headers.set('Cache-Control', 'no-store, private');
  return response;
}
