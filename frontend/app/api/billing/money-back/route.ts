import { NextRequest, NextResponse } from 'next/server';
import { attachSessionCookie, getClientIp, getSessionFromRequest, requireSession, validateCsrf } from '@/core/serverAuth';
import { getMoneyBackStatus, requestMoneyBackRefund } from '@/core/moneyBackServer';

// The self-serve 7-day money-back guarantee (core/moneyBackServer.ts).
//
//   GET  — may this member request a refund right now, until when, and how
//          much would it be. Drives the Account page panel. Only reaches Stripe
//          for a member who could plausibly be inside their window.
//   POST — request it: refund in full, cancel immediately, end access. Every
//          eligibility rule is re-derived live and server-side; the request body
//          carries only the optional cancellation reason.
//
// CSRF + session gated like the other billing routes.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    const unauth = NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    unauth.headers.set('Cache-Control', 'no-store, private');
    return unauth;
  }
  const status =
    session.user.tier === 'admin'
      ? ({ state: 'ineligible', reason: 'no_subscription', deadlineIso: null } as const)
      : await getMoneyBackStatus(session.user.id);
  const response = NextResponse.json(status);
  response.headers.set('Cache-Control', 'no-store, private');
  if (session.rotatedToken) attachSessionCookie(response, session.rotatedToken);
  return response;
}

export async function POST(request: NextRequest) {
  if (!validateCsrf(request)) {
    return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
  }
  const actor = await requireSession();
  if (!actor) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }
  if (actor.user.tier === 'admin') {
    return NextResponse.json({ error: 'Admin accounts have no subscription.' }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as { feedback?: unknown; comment?: unknown };
  const result = await requestMoneyBackRefund({
    userId: actor.user.id,
    source: 'self_serve',
    feedback: body.feedback,
    comment: body.comment,
    ip: getClientIp(request),
  });

  if (!result.ok) {
    return NextResponse.json({ ok: false, reason: result.reason, error: result.message }, { status: result.httpStatus });
  }
  return NextResponse.json({
    ok: true,
    amountFormatted: result.amountFormatted,
    canceled: result.canceled,
    // The member only needs to know whether anything is still being finished
    // (a cancel, or a payment that could not be refunded yet); the operator
    // alert carries the detail, and the run that completes it emails them.
    followUp: !result.complete,
  });
}
