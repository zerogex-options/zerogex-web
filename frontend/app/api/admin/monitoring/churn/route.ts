import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/core/serverAuth';
import { getChurnReport, MAX_CHURN_WINDOW_DAYS } from '@/core/churnReportServer';

export const dynamic = 'force-dynamic';

function adminOnly(response: NextResponse): NextResponse {
  // Admin-only data; nginx's /api/ cache slot isn't partitioned by session.
  response.headers.set('Cache-Control', 'no-store, private');
  return response;
}

export async function GET(request: NextRequest) {
  const actor = await requireSession();
  if (!actor || actor.user.tier !== 'admin') {
    return adminOnly(NextResponse.json({ error: 'Admin access required' }, { status: 403 }));
  }

  const requested = Number.parseInt(request.nextUrl.searchParams.get('days') ?? '', 10);
  const days = Number.isFinite(requested) ? Math.max(7, Math.min(MAX_CHURN_WINDOW_DAYS, requested)) : 90;

  try {
    return adminOnly(NextResponse.json({ ok: true, ...getChurnReport(days) }));
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to build the churn report';
    return adminOnly(NextResponse.json({ error: message }, { status: 500 }));
  }
}
