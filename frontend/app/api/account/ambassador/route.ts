import { NextRequest, NextResponse } from 'next/server';
import {
  attachSessionCookie,
  getSessionFromRequest,
  requireSession,
  validateCsrf,
  appendAuditEvent,
  getClientIp,
} from '@/core/serverAuth';
import {
  isAmbassadorProgramEnabled,
  getAmbassadorTermsVersion,
  getAmbassadorFeedbackUrl,
  getAmbassadorEarlyAccessUrl,
} from '@/core/ambassadorConfig';
import {
  getAmbassadorDashboard,
  acceptAmbassadorInvitation,
  setRewardPreference,
  getAmbassadorRow,
  notifyAmbassadorActivated,
} from '@/core/ambassadors';
import { getAppUrl } from '@/core/stripe';

export const dynamic = 'force-dynamic';

// GET the authenticated user's ambassador dashboard. Returns { enabled:false }
// when the program is off, { isAmbassador:false } for a non-ambassador, or the
// full dashboard payload otherwise. Never exposes another user's data — it only
// ever reads the session user's own profile.
export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    const unauth = NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    unauth.headers.set('Cache-Control', 'no-store, private');
    return unauth;
  }
  const finish = (payload: unknown, status = 200) => {
    const res = NextResponse.json(payload, { status });
    res.headers.set('Cache-Control', 'no-store, private');
    if (session.rotatedToken) attachSessionCookie(res, session.rotatedToken);
    return res;
  };

  if (!isAmbassadorProgramEnabled()) return finish({ enabled: false });

  const dashboard = await getAmbassadorDashboard(session.user.id);
  if (!dashboard) return finish({ enabled: true, isAmbassador: false });
  return finish({
    enabled: true,
    isAmbassador: true,
    currentTermsVersion: getAmbassadorTermsVersion(),
    links: {
      feedbackUrl: getAmbassadorFeedbackUrl(),
      earlyAccessUrl: getAmbassadorEarlyAccessUrl(),
      termsUrl: '/ambassador-terms',
    },
    dashboard,
  });
}

// POST — the ambassador acting on their OWN profile:
//   { action: 'accept', rewardPreference } — accept the invitation + terms.
//   { action: 'setReward', rewardPreference } — change reward preference (prospective).
export async function POST(request: NextRequest) {
  if (!validateCsrf(request)) {
    return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
  }
  const actor = await requireSession();
  if (!actor) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  if (!isAmbassadorProgramEnabled()) {
    return NextResponse.json({ error: 'Ambassador program is not enabled' }, { status: 403 });
  }

  // Authorization: the caller must be the ambassador themselves. getAmbassadorRow
  // returns null for a non-ambassador, so a normal user cannot mutate anything.
  const row = getAmbassadorRow(actor.user.id);
  if (!row) return NextResponse.json({ error: 'You are not an ambassador' }, { status: 403 });

  const body = (await request.json().catch(() => ({}))) as {
    action?: string;
    rewardPreference?: unknown;
  };
  const pref =
    body.rewardPreference === 'cash' || body.rewardPreference === 'account_credit'
      ? body.rewardPreference
      : null;

  try {
    if (body.action === 'accept') {
      if (!pref) return NextResponse.json({ error: 'A reward preference is required' }, { status: 400 });
      acceptAmbassadorInvitation({
        userId: actor.user.id,
        rewardPreference: pref,
        termsVersion: getAmbassadorTermsVersion(),
      });
      appendAuditEvent({
        type: 'ambassador_terms_accepted',
        userId: actor.user.id,
        email: actor.user.email,
        ip: getClientIp(request),
        message: `Accepted ambassador terms ${getAmbassadorTermsVersion()} (reward=${pref})`,
      });
      // Best-effort activation email.
      await notifyAmbassadorActivated(actor.user.email, getAppUrl());
    } else if (body.action === 'setReward') {
      if (!pref) return NextResponse.json({ error: 'A reward preference is required' }, { status: 400 });
      setRewardPreference(actor.user.id, pref);
    } else {
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Request failed';
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const dashboard = await getAmbassadorDashboard(actor.user.id);
  const res = NextResponse.json({ ok: true, dashboard });
  res.headers.set('Cache-Control', 'no-store, private');
  return res;
}
