import { NextRequest, NextResponse } from 'next/server';
import { requireSession, validateCsrf, appendAuditEvent, getClientIp } from '@/core/serverAuth';
import { getAppUrl } from '@/core/stripe';
import {
  isAmbassadorProgramEnabled,
  getAmbassadorTerms,
  type PartnerStatus,
  type RewardPreference,
} from '@/core/ambassadorConfig';
import {
  listAmbassadors,
  getProgramAnalytics,
  getAmbassadorAdminDetail,
  searchUsersForInvite,
  exportCommissionsCsv,
  inviteAmbassadorAndNotify,
  setAmbassadorStatus,
  updateAmbassadorTerms,
  setRewardPreference,
  approveCommission,
  markCommissionPaid,
  adjustCommission,
  releaseAmbassadorCommissions,
} from '@/core/ambassadors';

export const dynamic = 'force-dynamic';

const PARTNER_STATUSES = new Set<PartnerStatus>(['invited', 'active', 'paused', 'inactive', 'rejected']);
const REWARD_PREFS = new Set<RewardPreference>(['cash', 'account_credit']);

// Every entry point is admin-gated exactly like the other /api/admin/* routes:
// requireSession() + tier === 'admin'. A non-admin (or anonymous) caller gets a
// 403 and no ambassador data is ever returned.
async function requireAdmin() {
  const actor = await requireSession();
  if (!actor || actor.user.tier !== 'admin') return null;
  return actor;
}

function forbidden() {
  const res = NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  res.headers.set('Cache-Control', 'no-store, private');
  return res;
}

export async function GET(request: NextRequest) {
  const actor = await requireAdmin();
  if (!actor) return forbidden();
  if (!isAmbassadorProgramEnabled()) {
    const off = NextResponse.json({ enabled: false });
    off.headers.set('Cache-Control', 'no-store, private');
    return off;
  }

  const url = new URL(request.url);
  const json = (payload: unknown) => {
    const res = NextResponse.json(payload);
    res.headers.set('Cache-Control', 'no-store, private');
    return res;
  };

  // CSV export (admin-only, operator-facing).
  if (url.searchParams.get('export') === 'csv') {
    const userId = url.searchParams.get('userId') || undefined;
    const csv = exportCommissionsCsv(userId);
    appendAuditEvent({
      type: 'ambassador_csv_exported',
      actorUserId: actor.user.id,
      email: actor.user.email,
      ip: getClientIp(request),
      message: `Exported ambassador commissions CSV${userId ? ` for ${userId}` : ''}`,
    });
    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="ambassador-commissions.csv"',
        'Cache-Control': 'no-store, private',
      },
    });
  }

  const userId = url.searchParams.get('userId');
  if (userId) {
    const detail = getAmbassadorAdminDetail(userId);
    if (!detail) return json({ error: 'Ambassador not found' });
    return json({ enabled: true, detail });
  }

  const q = url.searchParams.get('q');
  if (q != null) return json({ enabled: true, results: searchUsersForInvite(q) });

  return json({
    enabled: true,
    analytics: getProgramAnalytics(),
    ambassadors: listAmbassadors(),
    defaults: getAmbassadorTerms(),
  });
}

export async function POST(request: NextRequest) {
  if (!validateCsrf(request)) {
    return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
  }
  const actor = await requireAdmin();
  if (!actor) return forbidden();
  if (!isAmbassadorProgramEnabled()) {
    return NextResponse.json({ error: 'Ambassador program is not enabled' }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const action = typeof body.action === 'string' ? body.action : '';
  const asStr = (v: unknown): string | undefined => (typeof v === 'string' && v.length > 0 ? v : undefined);
  const asNum = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);
  const asBool = (v: unknown): boolean | undefined => (typeof v === 'boolean' ? v : undefined);

  try {
    switch (action) {
      case 'invite': {
        const userId = asStr(body.userId);
        if (!userId) return NextResponse.json({ error: 'userId is required' }, { status: 400 });
        const pref = REWARD_PREFS.has(body.rewardPreference as RewardPreference)
          ? (body.rewardPreference as RewardPreference)
          : undefined;
        const row = await inviteAmbassadorAndNotify({
          userId,
          actorUserId: actor.user.id,
          appUrl: getAppUrl(),
          designation: asStr(body.designation) ?? null,
          rewardPreference: pref,
          commissionBps: asNum(body.commissionBps),
          creditBps: asNum(body.creditBps),
          commissionWindowMonths: asNum(body.commissionWindowMonths),
          attributionWindowDays: asNum(body.attributionWindowDays),
          holdingPeriodDays: asNum(body.holdingPeriodDays),
          pilotDays: body.pilotDays === null ? null : asNum(body.pilotDays),
          earlyAccess: asBool(body.earlyAccess),
          notes: asStr(body.notes) ?? null,
        });
        return NextResponse.json({ ok: true, userId: row.id });
      }
      case 'setStatus': {
        const userId = asStr(body.userId);
        const status = body.status as PartnerStatus;
        if (!userId || !PARTNER_STATUSES.has(status)) {
          return NextResponse.json({ error: 'userId and a valid status are required' }, { status: 400 });
        }
        setAmbassadorStatus(userId, status, actor.user.id);
        return NextResponse.json({ ok: true });
      }
      case 'updateTerms': {
        const userId = asStr(body.userId);
        if (!userId) return NextResponse.json({ error: 'userId is required' }, { status: 400 });
        const patch = (body.patch ?? {}) as Record<string, unknown>;
        const pref = REWARD_PREFS.has(patch.rewardPreference as RewardPreference)
          ? (patch.rewardPreference as RewardPreference)
          : undefined;
        updateAmbassadorTerms(userId, actor.user.id, {
          designation: patch.designation === undefined ? undefined : (asStr(patch.designation) ?? null),
          rewardPreference: pref,
          commissionBps: asNum(patch.commissionBps),
          creditBps: asNum(patch.creditBps),
          commissionWindowMonths: asNum(patch.commissionWindowMonths),
          attributionWindowDays: asNum(patch.attributionWindowDays),
          holdingPeriodDays: asNum(patch.holdingPeriodDays),
          pilotStartAt: patch.pilotStartAt === undefined ? undefined : (asStr(patch.pilotStartAt) ?? null),
          pilotEndAt: patch.pilotEndAt === undefined ? undefined : (asStr(patch.pilotEndAt) ?? null),
          earlyAccess: asBool(patch.earlyAccess),
          notes: patch.notes === undefined ? undefined : (asStr(patch.notes) ?? null),
        });
        return NextResponse.json({ ok: true });
      }
      case 'setReward': {
        const userId = asStr(body.userId);
        const pref = body.rewardPreference as RewardPreference;
        if (!userId || !REWARD_PREFS.has(pref)) {
          return NextResponse.json({ error: 'userId and a valid rewardPreference are required' }, { status: 400 });
        }
        setRewardPreference(userId, pref);
        return NextResponse.json({ ok: true });
      }
      case 'approveCommission': {
        const commissionId = asStr(body.commissionId);
        if (!commissionId) return NextResponse.json({ error: 'commissionId is required' }, { status: 400 });
        await approveCommission(commissionId, actor.user.id);
        return NextResponse.json({ ok: true });
      }
      case 'markPaid': {
        const commissionId = asStr(body.commissionId);
        if (!commissionId) return NextResponse.json({ error: 'commissionId is required' }, { status: 400 });
        markCommissionPaid(commissionId, actor.user.id, asStr(body.payoutReference) ?? null);
        return NextResponse.json({ ok: true });
      }
      case 'adjust': {
        const reason = asStr(body.reason);
        if (!reason) return NextResponse.json({ error: 'A reason is required for auditing' }, { status: 400 });
        adjustCommission({
          commissionId: asStr(body.commissionId),
          action: body.adjustAction === 'cancel' ? 'cancel' : 'adjust',
          amountMinor: asNum(body.amountMinor),
          partnerUserId: asStr(body.partnerUserId),
          refereeUserId: asStr(body.refereeUserId),
          currency: asStr(body.currency),
          reason,
          actorUserId: actor.user.id,
        });
        return NextResponse.json({ ok: true });
      }
      case 'runRelease': {
        const result = await releaseAmbassadorCommissions(true);
        return NextResponse.json({ ok: true, result });
      }
      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Request failed';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
