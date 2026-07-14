import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/core/serverAuth';
import { getPageAnalyticsSnapshot } from '@/core/pageAnalytics';

export const dynamic = 'force-dynamic';

// Admin-only per-page engagement snapshot for /admin/analytics. Mirrors the
// gating + no-store headers of /api/admin/monitoring (nginx's /api/ cache slot
// isn't partitioned by session, so admin data must never be cacheable).
export async function GET(request: NextRequest): Promise<NextResponse> {
  const actor = await requireSession();
  if (!actor || actor.user.tier !== 'admin') {
    const forbidden = NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    forbidden.headers.set('Cache-Control', 'no-store, private');
    return forbidden;
  }

  const daysParam = request.nextUrl.searchParams.get('days');
  const snapshot = getPageAnalyticsSnapshot({
    windowDays: daysParam != null ? Number(daysParam) : 7,
  });

  const response = NextResponse.json({ ok: true, ...snapshot });
  response.headers.set('Cache-Control', 'no-store, private');
  return response;
}
