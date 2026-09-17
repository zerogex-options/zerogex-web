import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/core/serverAuth';
import { getPaymentDeclineReport } from '@/core/paymentDeclinesServer';

export const dynamic = 'force-dynamic';

// Admin-only. Kept on its own route rather than folded into
// /api/admin/monitoring because its window is caller-chosen, because it runs a
// reconcile pass (a write) that has no business firing on every poll of the main
// dashboard, and because the report is heavy enough that the Frontend tab should
// not pay for it.

/** All time, plus the windows an operator actually compares against. */
const ALLOWED_WINDOWS = new Set([7, 30, 90, 180, 365]);
const DEFAULT_WINDOW_DAYS = 90;

export async function GET(request: NextRequest) {
  const actor = await requireSession();
  if (!actor || actor.user.tier !== 'admin') {
    const forbidden = NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    forbidden.headers.set('Cache-Control', 'no-store, private');
    return forbidden;
  }

  const raw = request.nextUrl.searchParams.get('days');
  // `days=all` is the only way to get the unbounded window; an unrecognized
  // value falls back to the default rather than being honored, so a typo cannot
  // quietly change what the operator is looking at.
  const windowDays =
    raw === 'all' ? null : ALLOWED_WINDOWS.has(Number(raw)) ? Number(raw) : DEFAULT_WINDOW_DAYS;

  try {
    const report = getPaymentDeclineReport({ windowDays });
    const response = NextResponse.json({ ok: true, ...report });
    // Admin-only data; nginx's /api/ cache slot isn't partitioned by session.
    response.headers.set('Cache-Control', 'no-store, private');
    return response;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to build the decline report';
    const failed = NextResponse.json({ error: message }, { status: 500 });
    failed.headers.set('Cache-Control', 'no-store, private');
    return failed;
  }
}
