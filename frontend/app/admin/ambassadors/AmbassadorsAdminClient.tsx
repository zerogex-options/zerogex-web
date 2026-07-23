'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Award,
  Users,
  TrendingUp,
  Wallet,
  UserPlus,
  Search,
  RefreshCw,
  Download,
  Copy,
  X,
  Check,
  Power,
  Pause,
  Play,
  Ban,
  AlertTriangle,
  Link2,
  DollarSign,
  Gift,
  Sparkles,
  Calendar,
  Percent,
  ShieldCheck,
} from 'lucide-react';

// ---- API contract types (mirror /api/admin/ambassadors) --------------------

type RewardPreference = 'cash' | 'account_credit';
type AmbassadorStatus = 'active' | 'paused' | 'inactive' | 'rejected' | 'invited';

type Analytics = {
  ambassadors: { total: number; active: number; invited: number; paused: number; inactive: number };
  funnel: { visits: number; registrations: number; activeTrials: number; payingCustomers: number };
  money: {
    currency: string;
    collectedRevenueMinor: number;
    pendingCashMinor: number;
    payableCashMinor: number;
    paidCashMinor: number;
    issuedCreditMinor: number;
    reversedMinor: number;
  };
  conversion: { visitToRegistration: number; registrationToPaid: number };
};

type AmbassadorRow = {
  userId: string;
  email: string;
  xHandle: string | null;
  status: AmbassadorStatus;
  designation: string | null;
  referralCode: string;
  referralLink: string;
  rewardPreference: RewardPreference;
  commissionBps: number;
  creditBps: number;
  earlyAccess: boolean;
  pilotStartAt: string | null;
  pilotEndAt: string | null;
  invitedAt: string | null;
  acceptedAt: string | null;
  activatedAt: string | null;
  termsVersion: string | null;
  registrations: number;
  payingCustomers: number;
  pendingCashMinor: number;
  payableCashMinor: number;
  paidCashMinor: number;
  creditedMinor: number;
  currency: string;
};

type Defaults = {
  commissionBps: number;
  creditBps: number;
  commissionWindowMonths: number;
  attributionWindowDays: number;
  holdingPeriodDays: number;
  pilotDays: number | null;
};

type ListPayload = {
  enabled: boolean;
  analytics?: Analytics;
  ambassadors?: AmbassadorRow[];
  defaults?: Defaults;
};

type SearchResult = {
  userId: string;
  email: string;
  tier: string;
  partnerTier: string | null;
  partnerStatus: string | null;
};

type SearchPayload = { enabled: boolean; results?: SearchResult[] };

type Commission = {
  id: string;
  refereeLabel: string;
  invoiceId: string | null;
  billedMinor: number;
  rewardMinor: number;
  currency: string;
  status: string;
  rewardType: string;
  holdReleaseAt: string | null;
  createdAt: string;
};

type Referral = {
  refereeLabel: string;
  status: string;
  createdAt: string;
  partnerType: string | null;
};

type Detail = {
  profile: AmbassadorRow;
  funnel: { registrations: number; activeTrials: number; payingCustomers: number; visits: number };
  ledger: {
    pendingCashMinor: number;
    payableCashMinor: number;
    paidCashMinor: number;
    pendingCreditMinor: number;
    creditedMinor: number;
    reversedMinor: number;
    collectedRevenueMinor: number;
    currency: string;
  };
  commissions: Commission[];
  referrals: Referral[];
  notes: string | null;
};

type DetailPayload = { enabled: boolean; detail?: Detail };

type ReleaseResult = {
  cashReleased: number;
  creditsIssued: number;
  creditMinorIssued: number;
  heldForReview: number;
  errors: number;
};

type FeedbackState = { type: 'success' | 'error'; message: string } | null;

type InviteFormState = {
  designation: string;
  rewardPreference: RewardPreference;
  commissionBps: number;
  creditBps: number;
  commissionWindowMonths: number;
  attributionWindowDays: number;
  holdingPeriodDays: number;
  pilotEnabled: boolean;
  pilotDays: number;
  earlyAccess: boolean;
  notes: string;
};

// Window fields start blank because the per-user current value is not returned
// by the API; a blank field is omitted from the patch so it is left unchanged.
type TermsFormState = {
  designation: string;
  commissionBps: number;
  creditBps: number;
  commissionWindowMonths: string;
  attributionWindowDays: string;
  holdingPeriodDays: string;
  pilotStartAt: string;
  pilotEndAt: string;
  earlyAccess: boolean;
  notes: string;
};

type CommissionAction =
  | { kind: 'markPaid'; id: string; reference: string }
  | { kind: 'cancel'; id: string; reason: string };

const C = {
  card: 'var(--color-surface)',
  light: 'var(--color-text-primary)',
  muted: 'var(--color-text-secondary)',
  amber: 'var(--color-brand-primary)',
  accent: 'var(--color-brand-accent)',
  border: 'var(--color-border)',
};

// ---- Formatting helpers ----------------------------------------------------

function money(minor: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency.toUpperCase() }).format(
      minor / 100,
    );
  } catch {
    return `${(minor / 100).toFixed(2)} ${currency.toUpperCase()}`;
  }
}

function pct(fraction: number): string {
  if (!Number.isFinite(fraction)) return '—';
  return `${(fraction * 100).toFixed(1)}%`;
}

function bpsPct(bps: number): string {
  return `${bps / 100}%`;
}

function rewardLabel(a: { rewardPreference: RewardPreference; commissionBps: number; creditBps: number }): string {
  return a.rewardPreference === 'cash' ? `${a.commissionBps / 100}% cash` : `${a.creditBps / 100}% credit`;
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(
      new Date(iso),
    );
  } catch {
    return iso;
  }
}

function toDateInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

function num(value: string): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

async function csrfToken(): Promise<string | null> {
  try {
    const r = await fetch('/api/auth/csrf', { credentials: 'include' });
    const j = (await r.json()) as { csrfToken?: string };
    return j.csrfToken ?? null;
  } catch {
    return null;
  }
}

// ---- Main component --------------------------------------------------------

export default function AmbassadorsAdminClient() {
  const [payload, setPayload] = useState<ListPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const [releaseResult, setReleaseResult] = useState<ReleaseResult | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Invite / search
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [inviteUser, setInviteUser] = useState<SearchResult | null>(null);
  const [invite, setInvite] = useState<InviteFormState | null>(null);

  // Detail drawer
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [termsForm, setTermsForm] = useState<TermsFormState | null>(null);
  const [rewardDraft, setRewardDraft] = useState<RewardPreference>('cash');
  const [pendingStatus, setPendingStatus] = useState<AmbassadorStatus | null>(null);
  const [commissionAction, setCommissionAction] = useState<CommissionAction | null>(null);
  const [adjAmount, setAdjAmount] = useState('');
  const [adjReason, setAdjReason] = useState('');

  // ---- Loaders -------------------------------------------------------------

  const load = useCallback(async () => {
    setError(null);
    try {
      const r = await fetch('/api/admin/ambassadors', { credentials: 'include', cache: 'no-store' });
      if (!r.ok) {
        setError(r.status === 403 ? 'Admin access required.' : `Failed to load (HTTP ${r.status}).`);
        setPayload(null);
        return;
      }
      const j = (await r.json()) as ListPayload;
      setPayload(j);
    } catch {
      setError('Could not load the ambassador console.');
      setPayload(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadDetail = useCallback(async (userId: string) => {
    setDetailLoading(true);
    try {
      const r = await fetch(`/api/admin/ambassadors?userId=${encodeURIComponent(userId)}`, {
        credentials: 'include',
        cache: 'no-store',
      });
      const j = (await r.json()) as DetailPayload;
      setDetail(j.detail ?? null);
    } catch {
      setFeedback({ type: 'error', message: 'Could not load ambassador detail.' });
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const refresh = useCallback(async () => {
    await load();
    if (selectedUserId) await loadDetail(selectedUserId);
  }, [load, loadDetail, selectedUserId]);

  // Prefill drawer forms whenever a fresh detail loads.
  useEffect(() => {
    if (!detail) {
      setTermsForm(null);
      return;
    }
    const p = detail.profile;
    setTermsForm({
      designation: p.designation ?? '',
      commissionBps: p.commissionBps,
      creditBps: p.creditBps,
      commissionWindowMonths: '',
      attributionWindowDays: '',
      holdingPeriodDays: '',
      pilotStartAt: toDateInput(p.pilotStartAt),
      pilotEndAt: toDateInput(p.pilotEndAt),
      earlyAccess: p.earlyAccess,
      notes: detail.notes ?? '',
    });
    setRewardDraft(p.rewardPreference);
  }, [detail]);

  // Debounced user search.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setSearchResults(null);
      setSearching(false);
      return;
    }
    setSearching(true);
    const handle = setTimeout(async () => {
      try {
        const r = await fetch(`/api/admin/ambassadors?q=${encodeURIComponent(q)}`, {
          credentials: 'include',
          cache: 'no-store',
        });
        const j = (await r.json()) as SearchPayload;
        setSearchResults(j.results ?? []);
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(handle);
  }, [query]);

  // ---- POST helper ---------------------------------------------------------

  const post = useCallback(async (body: Record<string, unknown>): Promise<Record<string, unknown> | null> => {
    setBusy(true);
    setFeedback(null);
    try {
      const token = await csrfToken();
      if (!token) {
        setFeedback({ type: 'error', message: 'Session expired — please refresh and try again.' });
        return null;
      }
      const r = await fetch('/api/admin/ambassadors', {
        method: 'POST',
        headers: { 'x-csrf-token': token, 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      const j = (await r.json().catch(() => ({}))) as Record<string, unknown>;
      if (!r.ok || j.ok !== true) {
        setFeedback({ type: 'error', message: typeof j.error === 'string' ? j.error : 'Something went wrong.' });
        return null;
      }
      return j;
    } catch {
      setFeedback({ type: 'error', message: 'Something went wrong.' });
      return null;
    } finally {
      setBusy(false);
    }
  }, []);

  // ---- Actions -------------------------------------------------------------

  const copyLink = async (a: AmbassadorRow) => {
    try {
      await navigator.clipboard.writeText(a.referralLink);
      setCopiedId(a.userId);
      setTimeout(() => setCopiedId((id) => (id === a.userId ? null : id)), 2000);
    } catch {
      setFeedback({ type: 'error', message: 'Could not copy the link.' });
    }
  };

  const downloadCsv = (userId?: string) => {
    const url = userId
      ? `/api/admin/ambassadors?export=csv&userId=${encodeURIComponent(userId)}`
      : '/api/admin/ambassadors?export=csv';
    window.location.href = url;
  };

  const handleRunRelease = async () => {
    const j = await post({ action: 'runRelease' });
    if (!j) return;
    const result =
      j.result && typeof j.result === 'object' ? (j.result as ReleaseResult) : null;
    setReleaseResult(result);
    setFeedback({ type: 'success', message: 'Reward release completed.' });
    await refresh();
  };

  const openInvite = (u: SearchResult) => {
    const d = payload?.defaults;
    setInviteUser(u);
    setInvite({
      designation: '',
      rewardPreference: 'cash',
      commissionBps: d?.commissionBps ?? 2000,
      creditBps: d?.creditBps ?? 2500,
      commissionWindowMonths: d?.commissionWindowMonths ?? 12,
      attributionWindowDays: d?.attributionWindowDays ?? 60,
      holdingPeriodDays: d?.holdingPeriodDays ?? 30,
      pilotEnabled: d?.pilotDays != null,
      pilotDays: d?.pilotDays ?? 90,
      earlyAccess: false,
      notes: '',
    });
  };

  const handleInvite = async () => {
    if (!inviteUser || !invite) return;
    const body: Record<string, unknown> = {
      action: 'invite',
      userId: inviteUser.userId,
      designation: invite.designation.trim() || undefined,
      rewardPreference: invite.rewardPreference,
      commissionBps: invite.commissionBps,
      creditBps: invite.creditBps,
      commissionWindowMonths: invite.commissionWindowMonths,
      attributionWindowDays: invite.attributionWindowDays,
      holdingPeriodDays: invite.holdingPeriodDays,
      pilotDays: invite.pilotEnabled ? invite.pilotDays : null,
      earlyAccess: invite.earlyAccess,
      notes: invite.notes.trim() || undefined,
    };
    const ok = await post(body);
    if (ok) {
      setFeedback({ type: 'success', message: `Invited ${inviteUser.email} to the Ambassador Program.` });
      setInviteUser(null);
      setInvite(null);
      setQuery('');
      setSearchResults(null);
      await load();
    }
  };

  const handleSetStatus = async (status: AmbassadorStatus) => {
    if (!selectedUserId) return;
    const ok = await post({ action: 'setStatus', userId: selectedUserId, status });
    if (ok) {
      setFeedback({ type: 'success', message: `Status set to ${status}.` });
      setPendingStatus(null);
      await refresh();
    }
  };

  const handleUpdateTerms = async () => {
    if (!selectedUserId || !termsForm) return;
    const patch: Record<string, unknown> = {
      designation: termsForm.designation.trim() || null,
      commissionBps: termsForm.commissionBps,
      creditBps: termsForm.creditBps,
      pilotStartAt: termsForm.pilotStartAt || null,
      pilotEndAt: termsForm.pilotEndAt || null,
      earlyAccess: termsForm.earlyAccess,
      notes: termsForm.notes.trim() || null,
    };
    if (termsForm.commissionWindowMonths.trim() !== '')
      patch.commissionWindowMonths = num(termsForm.commissionWindowMonths);
    if (termsForm.attributionWindowDays.trim() !== '')
      patch.attributionWindowDays = num(termsForm.attributionWindowDays);
    if (termsForm.holdingPeriodDays.trim() !== '')
      patch.holdingPeriodDays = num(termsForm.holdingPeriodDays);
    const ok = await post({ action: 'updateTerms', userId: selectedUserId, patch });
    if (ok) {
      setFeedback({ type: 'success', message: 'Terms updated.' });
      await refresh();
    }
  };

  const handleSetReward = async () => {
    if (!selectedUserId) return;
    const ok = await post({ action: 'setReward', userId: selectedUserId, rewardPreference: rewardDraft });
    if (ok) {
      setFeedback({ type: 'success', message: 'Reward preference updated.' });
      await refresh();
    }
  };

  const handleApprove = async (commissionId: string) => {
    const ok = await post({ action: 'approveCommission', commissionId });
    if (ok) {
      setFeedback({ type: 'success', message: 'Commission approved.' });
      await refresh();
    }
  };

  const handleMarkPaid = async (commissionId: string, reference: string) => {
    const ok = await post({
      action: 'markPaid',
      commissionId,
      payoutReference: reference.trim() || undefined,
    });
    if (ok) {
      setFeedback({ type: 'success', message: 'Commission marked paid.' });
      setCommissionAction(null);
      await refresh();
    }
  };

  const handleCancelCommission = async (commissionId: string, reason: string) => {
    if (!reason.trim()) {
      setFeedback({ type: 'error', message: 'A reason is required to cancel a commission.' });
      return;
    }
    const ok = await post({
      action: 'adjust',
      commissionId,
      adjustAction: 'cancel',
      reason: reason.trim(),
    });
    if (ok) {
      setFeedback({ type: 'success', message: 'Commission cancelled.' });
      setCommissionAction(null);
      await refresh();
    }
  };

  const handleAdjust = async () => {
    if (!selectedUserId || !detail) return;
    const dollars = Number(adjAmount);
    if (!Number.isFinite(dollars) || dollars === 0) {
      setFeedback({ type: 'error', message: 'Enter a non-zero amount.' });
      return;
    }
    if (!adjReason.trim()) {
      setFeedback({ type: 'error', message: 'A reason is required for a manual adjustment.' });
      return;
    }
    const ok = await post({
      action: 'adjust',
      adjustAction: 'adjust',
      partnerUserId: selectedUserId,
      amountMinor: Math.round(dollars * 100),
      currency: detail.ledger.currency,
      reason: adjReason.trim(),
    });
    if (ok) {
      setFeedback({ type: 'success', message: 'Adjustment recorded.' });
      setAdjAmount('');
      setAdjReason('');
      await refresh();
    }
  };

  const openManage = (userId: string) => {
    setSelectedUserId(userId);
    setDetail(null);
    setCommissionAction(null);
    setPendingStatus(null);
    setAdjAmount('');
    setAdjReason('');
    loadDetail(userId);
  };

  const closeDrawer = () => {
    setSelectedUserId(null);
    setDetail(null);
    setCommissionAction(null);
    setPendingStatus(null);
    setAdjAmount('');
    setAdjReason('');
  };

  // ---- Top-level states ----------------------------------------------------

  if (loading) {
    return (
      <main style={{ minHeight: '100vh', padding: '48px 24px', color: C.light }}>
        <p style={{ color: C.muted }}>Loading the ambassador console…</p>
      </main>
    );
  }

  if (error && !payload) {
    return (
      <Shell>
        <section style={cardStyle}>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>Ambassador Program</h1>
          <p style={{ marginTop: 12, color: 'var(--color-bear)', fontSize: 14 }}>{error}</p>
          <button type="button" onClick={load} style={{ ...secondaryBtn, marginTop: 14 }}>
            <RefreshCw size={14} /> Retry
          </button>
        </section>
      </Shell>
    );
  }

  if (!payload?.enabled) {
    return (
      <Shell>
        <section style={cardStyle}>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>Ambassador Program</h1>
          <p style={{ marginTop: 12, color: C.muted, fontSize: 14, lineHeight: 1.6 }}>
            The ZeroGEX Ambassador Program is currently turned off. Enable it in the program configuration to
            manage ambassadors, invitations, and rewards.
          </p>
        </section>
      </Shell>
    );
  }

  const a = payload.analytics;
  const ambassadors = payload.ambassadors ?? [];
  const currency = a?.money.currency ?? 'USD';

  return (
    <Shell wide>
      <Feedback feedback={feedback} onClose={() => setFeedback(null)} />

      {/* Header */}
      <header
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 16,
          flexWrap: 'wrap',
          marginBottom: 8,
        }}
      >
        <div>
          <h1
            style={{
              margin: 0,
              fontSize: 30,
              fontWeight: 800,
              letterSpacing: '-0.5px',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <Award size={26} color={C.amber} /> Ambassador Program
          </h1>
          <p style={{ margin: '8px 0 0', color: C.muted, fontSize: 14 }}>
            Manage invitations, terms, rewards, and payouts for the ZeroGEX Ambassador Program.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={handleRunRelease}
            disabled={busy}
            style={{ ...primaryBtnSm, display: 'inline-flex', alignItems: 'center', gap: 6, opacity: busy ? 0.6 : 1 }}
          >
            <RefreshCw size={14} /> Run reward release
          </button>
          <button
            type="button"
            onClick={() => downloadCsv()}
            style={{ ...secondaryBtn }}
          >
            <Download size={14} /> Export CSV
          </button>
        </div>
      </header>

      {releaseResult && (
        <div style={{ ...successBox, marginTop: 14, display: 'flex', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 800 }}>Release results:</span>
          <span>Cash released: {releaseResult.cashReleased}</span>
          <span>· Credits issued: {releaseResult.creditsIssued}</span>
          <span>· Credit value: {money(releaseResult.creditMinorIssued, currency)}</span>
          <span>· Held for review: {releaseResult.heldForReview}</span>
          <span>· Errors: {releaseResult.errors}</span>
          <button
            type="button"
            onClick={() => setReleaseResult(null)}
            aria-label="Dismiss"
            style={{ marginLeft: 'auto', background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer' }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Analytics — ambassadors */}
      {a && (
        <>
          <Section icon={<Users size={18} />} title="Ambassadors">
            <div style={statGrid}>
              <Stat label="Total" value={a.ambassadors.total} />
              <Stat label="Active" value={a.ambassadors.active} accent />
              <Stat label="Invited" value={a.ambassadors.invited} />
              <Stat label="Paused" value={a.ambassadors.paused} />
              <Stat label="Inactive" value={a.ambassadors.inactive} />
            </div>
          </Section>

          <Section icon={<TrendingUp size={18} />} title="Funnel">
            <div style={statGrid}>
              <Stat label="Link visits" value={a.funnel.visits} />
              <Stat label="Registrations" value={a.funnel.registrations} />
              <Stat label="Active trials" value={a.funnel.activeTrials} />
              <Stat label="Paying customers" value={a.funnel.payingCustomers} />
              <Stat label="Visit → registration" value={pct(a.conversion.visitToRegistration)} />
              <Stat label="Registration → paid" value={pct(a.conversion.registrationToPaid)} />
            </div>
          </Section>

          <Section icon={<Wallet size={18} />} title="Money">
            <div style={statGrid}>
              <Stat label="Collected revenue" value={money(a.money.collectedRevenueMinor, currency)} accent />
              <Stat label="Pending cash" value={money(a.money.pendingCashMinor, currency)} sub="in holding period" />
              <Stat label="Payable cash" value={money(a.money.payableCashMinor, currency)} sub="ready for payout" />
              <Stat label="Paid cash" value={money(a.money.paidCashMinor, currency)} sub="paid out" />
              <Stat label="Issued credit" value={money(a.money.issuedCreditMinor, currency)} />
              <Stat label="Reversed" value={money(a.money.reversedMinor, currency)} sub="refunds / disputes" />
            </div>
          </Section>
        </>
      )}

      {/* Invite panel */}
      <Section icon={<UserPlus size={18} />} title="Invite an ambassador">
        <div style={{ ...linkRow, marginBottom: 12 }}>
          <Search size={16} color={C.muted} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search users by email…"
            autoComplete="off"
            spellCheck={false}
            style={{ ...linkInput }}
          />
          {searching && <span style={{ color: C.muted, fontSize: 12 }}>Searching…</span>}
        </div>

        {query.trim().length >= 2 && searchResults && searchResults.length === 0 && !searching && (
          <p style={{ color: C.muted, fontSize: 13 }}>No users match “{query.trim()}”.</p>
        )}

        {searchResults && searchResults.length > 0 && (
          <div style={{ display: 'grid', gap: 8 }}>
            {searchResults.map((u) => {
              const isAmbassador = u.partnerTier === 'ambassador';
              const isCreator = u.partnerTier === 'creator';
              return (
                <div
                  key={u.userId}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                    padding: '12px 14px',
                    borderRadius: 12,
                    border: `1px solid ${C.border}`,
                    background: 'var(--bg-active)',
                    flexWrap: 'wrap',
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: C.light, wordBreak: 'break-all' }}>{u.email}</div>
                    <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
                      Tier: {u.tier}
                      {u.partnerTier ? ` · Partner: ${u.partnerTier}` : ''}
                      {u.partnerStatus ? ` (${u.partnerStatus})` : ''}
                    </div>
                  </div>
                  {isAmbassador ? (
                    <StatusBadge status={(u.partnerStatus ?? 'active') as string} />
                  ) : isCreator ? (
                    <span style={{ fontSize: 12, color: C.muted, fontWeight: 700 }}>Ineligible (creator)</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => openInvite(u)}
                      style={{ ...primaryBtnSm, display: 'inline-flex', alignItems: 'center', gap: 6 }}
                    >
                      <UserPlus size={14} /> Invite
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {inviteUser && invite && (
          <div style={{ ...panelStyle, marginTop: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 12 }}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800 }}>
                Invite <span style={{ color: C.amber }}>{inviteUser.email}</span>
              </h3>
              <button
                type="button"
                onClick={() => {
                  setInviteUser(null);
                  setInvite(null);
                }}
                aria-label="Close invite form"
                style={{ background: 'transparent', border: 'none', color: C.muted, cursor: 'pointer' }}
              >
                <X size={16} />
              </button>
            </div>

            <div style={formGrid}>
              <Field label="Designation">
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <input
                    value={invite.designation}
                    onChange={(e) => setInvite((p) => (p ? { ...p, designation: e.target.value } : p))}
                    placeholder="e.g. Founding Ambassador"
                    style={{ ...inputStyle, flex: 1, minWidth: 160 }}
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setInvite((p) =>
                        p
                          ? {
                              ...p,
                              designation: p.designation === 'Founding Ambassador' ? '' : 'Founding Ambassador',
                            }
                          : p,
                      )
                    }
                    style={{
                      ...secondaryBtn,
                      borderColor: invite.designation === 'Founding Ambassador' ? C.amber : C.border,
                      color: invite.designation === 'Founding Ambassador' ? C.amber : C.light,
                    }}
                  >
                    <Sparkles size={14} /> Founding
                  </button>
                </div>
              </Field>

              <Field label="Reward preference">
                <select
                  value={invite.rewardPreference}
                  onChange={(e) =>
                    setInvite((p) => (p ? { ...p, rewardPreference: e.target.value as RewardPreference } : p))
                  }
                  style={selectStyle}
                >
                  <option value="cash">Cash commission</option>
                  <option value="account_credit">Account credit</option>
                </select>
              </Field>

              <Field label={`Commission (bps · = ${bpsPct(invite.commissionBps)})`}>
                <input
                  type="number"
                  value={invite.commissionBps}
                  onChange={(e) => setInvite((p) => (p ? { ...p, commissionBps: num(e.target.value) } : p))}
                  style={inputStyle}
                />
              </Field>

              <Field label={`Credit (bps · = ${bpsPct(invite.creditBps)})`}>
                <input
                  type="number"
                  value={invite.creditBps}
                  onChange={(e) => setInvite((p) => (p ? { ...p, creditBps: num(e.target.value) } : p))}
                  style={inputStyle}
                />
              </Field>

              <Field label="Commission window (months)">
                <input
                  type="number"
                  value={invite.commissionWindowMonths}
                  onChange={(e) => setInvite((p) => (p ? { ...p, commissionWindowMonths: num(e.target.value) } : p))}
                  style={inputStyle}
                />
              </Field>

              <Field label="Attribution window (days)">
                <input
                  type="number"
                  value={invite.attributionWindowDays}
                  onChange={(e) => setInvite((p) => (p ? { ...p, attributionWindowDays: num(e.target.value) } : p))}
                  style={inputStyle}
                />
              </Field>

              <Field label="Holding period (days)">
                <input
                  type="number"
                  value={invite.holdingPeriodDays}
                  onChange={(e) => setInvite((p) => (p ? { ...p, holdingPeriodDays: num(e.target.value) } : p))}
                  style={inputStyle}
                />
              </Field>

              <Field label="Pilot period">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: C.light }}>
                    <input
                      type="checkbox"
                      checked={invite.pilotEnabled}
                      onChange={(e) => setInvite((p) => (p ? { ...p, pilotEnabled: e.target.checked } : p))}
                    />
                    Enable
                  </label>
                  <input
                    type="number"
                    value={invite.pilotDays}
                    disabled={!invite.pilotEnabled}
                    onChange={(e) => setInvite((p) => (p ? { ...p, pilotDays: num(e.target.value) } : p))}
                    style={{ ...inputStyle, flex: 1, opacity: invite.pilotEnabled ? 1 : 0.5 }}
                  />
                  <span style={{ color: C.muted, fontSize: 12 }}>days</span>
                </div>
              </Field>
            </div>

            <label
              style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginTop: 12, fontSize: 13.5, color: C.light }}
            >
              <input
                type="checkbox"
                checked={invite.earlyAccess}
                onChange={(e) => setInvite((p) => (p ? { ...p, earlyAccess: e.target.checked } : p))}
              />
              Grant early access
            </label>

            <div style={{ marginTop: 12 }}>
              <Field label="Internal notes">
                <textarea
                  value={invite.notes}
                  onChange={(e) => setInvite((p) => (p ? { ...p, notes: e.target.value } : p))}
                  rows={2}
                  style={textareaStyle}
                />
              </Field>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={handleInvite}
                disabled={busy}
                style={{ ...primaryBtnSm, opacity: busy ? 0.6 : 1 }}
              >
                {busy ? 'Sending…' : 'Send invite'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setInviteUser(null);
                  setInvite(null);
                }}
                style={secondaryBtn}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </Section>

      {/* Ambassadors table */}
      <Section icon={<Award size={18} />} title={`Ambassadors (${ambassadors.length})`}>
        {ambassadors.length === 0 ? (
          <p style={{ color: C.muted, fontSize: 13 }}>No ambassadors yet. Invite your first ambassador above.</p>
        ) : (
          <div style={tableWrap}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Ambassador</th>
                  <th style={thStyle}>Status</th>
                  <th style={thStyle}>Designation</th>
                  <th style={thStyle}>Reward</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Regs</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Paying</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Pending</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Payable</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Paid</th>
                  <th style={thStyle}></th>
                </tr>
              </thead>
              <tbody>
                {ambassadors.map((amb) => (
                  <tr key={amb.userId}>
                    <td style={tdStyle}>
                      <div style={{ fontWeight: 700, color: C.light }}>{amb.email}</div>
                      {amb.xHandle && <div style={{ fontSize: 12, color: C.muted }}>@{amb.xHandle}</div>}
                    </td>
                    <td style={tdStyle}>
                      <StatusBadge status={amb.status} />
                    </td>
                    <td style={tdStyle}>{amb.designation ?? '—'}</td>
                    <td style={tdStyle}>{rewardLabel(amb)}</td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>{amb.registrations}</td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>{amb.payingCustomers}</td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>{money(amb.pendingCashMinor, amb.currency)}</td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>{money(amb.payableCashMinor, amb.currency)}</td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>{money(amb.paidCashMinor, amb.currency)}</td>
                    <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        <button
                          type="button"
                          onClick={() => copyLink(amb)}
                          title="Copy referral link"
                          style={{ ...iconBtn }}
                        >
                          <Copy size={13} /> {copiedId === amb.userId ? 'Copied' : 'Copy'}
                        </button>
                        <button type="button" onClick={() => openManage(amb.userId)} style={{ ...primaryBtnXs }}>
                          Manage
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {/* Detail drawer */}
      {selectedUserId && (
        <div style={backdropStyle} onClick={closeDrawer} role="presentation">
          <div style={drawerStyle} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: 12,
                marginBottom: 14,
              }}
            >
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>Ambassador detail</h2>
              <button
                type="button"
                onClick={closeDrawer}
                aria-label="Close"
                style={{ background: 'transparent', border: 'none', color: C.muted, cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            {detailLoading && !detail ? (
              <p style={{ color: C.muted, fontSize: 14 }}>Loading detail…</p>
            ) : !detail ? (
              <p style={{ color: C.muted, fontSize: 14 }}>Ambassador not found.</p>
            ) : (
              <DrawerBody
                detail={detail}
                busy={busy}
                termsForm={termsForm}
                setTermsForm={setTermsForm}
                rewardDraft={rewardDraft}
                setRewardDraft={setRewardDraft}
                pendingStatus={pendingStatus}
                setPendingStatus={setPendingStatus}
                commissionAction={commissionAction}
                setCommissionAction={setCommissionAction}
                adjAmount={adjAmount}
                setAdjAmount={setAdjAmount}
                adjReason={adjReason}
                setAdjReason={setAdjReason}
                onCopyLink={copyLink}
                copiedId={copiedId}
                onExportCsv={() => downloadCsv(detail.profile.userId)}
                onSetStatus={handleSetStatus}
                onUpdateTerms={handleUpdateTerms}
                onSetReward={handleSetReward}
                onApprove={handleApprove}
                onMarkPaid={handleMarkPaid}
                onCancelCommission={handleCancelCommission}
                onAdjust={handleAdjust}
              />
            )}
          </div>
        </div>
      )}
    </Shell>
  );
}

// ---- Drawer body -----------------------------------------------------------

type DrawerBodyProps = {
  detail: Detail;
  busy: boolean;
  termsForm: TermsFormState | null;
  setTermsForm: React.Dispatch<React.SetStateAction<TermsFormState | null>>;
  rewardDraft: RewardPreference;
  setRewardDraft: React.Dispatch<React.SetStateAction<RewardPreference>>;
  pendingStatus: AmbassadorStatus | null;
  setPendingStatus: React.Dispatch<React.SetStateAction<AmbassadorStatus | null>>;
  commissionAction: CommissionAction | null;
  setCommissionAction: React.Dispatch<React.SetStateAction<CommissionAction | null>>;
  adjAmount: string;
  setAdjAmount: React.Dispatch<React.SetStateAction<string>>;
  adjReason: string;
  setAdjReason: React.Dispatch<React.SetStateAction<string>>;
  onCopyLink: (a: AmbassadorRow) => void;
  copiedId: string | null;
  onExportCsv: () => void;
  onSetStatus: (status: AmbassadorStatus) => void;
  onUpdateTerms: () => void;
  onSetReward: () => void;
  onApprove: (id: string) => void;
  onMarkPaid: (id: string, reference: string) => void;
  onCancelCommission: (id: string, reason: string) => void;
  onAdjust: () => void;
};

function DrawerBody(props: DrawerBodyProps) {
  const {
    detail,
    busy,
    termsForm,
    setTermsForm,
    rewardDraft,
    setRewardDraft,
    pendingStatus,
    setPendingStatus,
    commissionAction,
    setCommissionAction,
    adjAmount,
    setAdjAmount,
    adjReason,
    setAdjReason,
    onCopyLink,
    copiedId,
    onExportCsv,
    onSetStatus,
    onUpdateTerms,
    onSetReward,
    onApprove,
    onMarkPaid,
    onCancelCommission,
    onAdjust,
  } = props;

  const p = detail.profile;
  const cur = detail.ledger.currency;

  return (
    <div>
      {/* Identity */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 16, fontWeight: 800, color: C.light, wordBreak: 'break-all' }}>{p.email}</span>
        <StatusBadge status={p.status} />
        {p.earlyAccess && (
          <span style={{ ...pill, color: C.accent, borderColor: `${C.accent}66`, background: `${C.accent}12` }}>
            <Sparkles size={12} /> Early access
          </span>
        )}
      </div>
      {p.xHandle && <div style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>@{p.xHandle}</div>}

      <div style={{ marginTop: 12 }}>
        <button type="button" onClick={onExportCsv} style={secondaryBtn}>
          <Download size={14} /> Export this ambassador&rsquo;s CSV
        </button>
      </div>

      {/* Referral link */}
      <div style={{ ...linkRow, marginTop: 16 }}>
        <Link2 size={15} color={C.muted} />
        <input readOnly value={p.referralLink} onFocus={(e) => e.currentTarget.select()} style={linkInput} />
        <button
          type="button"
          onClick={() => onCopyLink(p)}
          style={{ ...primaryBtnXs, display: 'inline-flex', alignItems: 'center', gap: 6 }}
        >
          <Copy size={13} /> {copiedId === p.userId ? 'Copied' : 'Copy'}
        </button>
      </div>
      <p style={{ color: C.muted, fontSize: 12.5, marginTop: 6 }}>
        Code: <strong style={{ color: C.light, letterSpacing: 1 }}>{p.referralCode}</strong>
      </p>

      {/* Status controls */}
      <DrawerSection icon={<Power size={16} />} title="Status">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {p.status !== 'active' && (
            <button
              type="button"
              onClick={() => onSetStatus('active')}
              disabled={busy}
              style={{ ...secondaryBtn, borderColor: 'var(--color-bull)', color: 'var(--color-bull)' }}
            >
              <Play size={14} /> Activate
            </button>
          )}
          {p.status === 'active' && (
            <button type="button" onClick={() => onSetStatus('paused')} disabled={busy} style={secondaryBtn}>
              <Pause size={14} /> Pause
            </button>
          )}
          {p.status !== 'inactive' && (
            <button
              type="button"
              onClick={() => setPendingStatus('inactive')}
              disabled={busy}
              style={{ ...secondaryBtn, borderColor: 'var(--color-bear)', color: 'var(--color-bear)' }}
            >
              <Power size={14} /> Deactivate
            </button>
          )}
          {p.status === 'invited' && (
            <button
              type="button"
              onClick={() => setPendingStatus('rejected')}
              disabled={busy}
              style={{ ...secondaryBtn, borderColor: 'var(--color-bear)', color: 'var(--color-bear)' }}
            >
              <Ban size={14} /> Reject
            </button>
          )}
        </div>

        {pendingStatus && (
          <ConfirmBlock
            title={pendingStatus === 'inactive' ? 'Deactivate this ambassador?' : 'Reject this invitation?'}
            body={
              pendingStatus === 'inactive'
                ? 'They will stop earning on new referrals. Previously earned rewards are preserved.'
                : 'This declines the pending invitation. This cannot be undone from here.'
            }
            confirmLabel={pendingStatus === 'inactive' ? 'Deactivate' : 'Reject'}
            busy={busy}
            onConfirm={() => onSetStatus(pendingStatus)}
            onCancel={() => setPendingStatus(null)}
          />
        )}
      </DrawerSection>

      {/* Funnel */}
      <DrawerSection icon={<TrendingUp size={16} />} title="Funnel">
        <div style={statGrid}>
          <Stat label="Visits" value={detail.funnel.visits} />
          <Stat label="Registrations" value={detail.funnel.registrations} />
          <Stat label="Active trials" value={detail.funnel.activeTrials} />
          <Stat label="Paying" value={detail.funnel.payingCustomers} />
        </div>
      </DrawerSection>

      {/* Ledger */}
      <DrawerSection icon={<Wallet size={16} />} title="Ledger">
        <div style={statGrid}>
          <Stat label="Pending cash" value={money(detail.ledger.pendingCashMinor, cur)} />
          <Stat label="Payable cash" value={money(detail.ledger.payableCashMinor, cur)} accent />
          <Stat label="Paid cash" value={money(detail.ledger.paidCashMinor, cur)} />
          <Stat label="Pending credit" value={money(detail.ledger.pendingCreditMinor, cur)} />
          <Stat label="Issued credit" value={money(detail.ledger.creditedMinor, cur)} />
          <Stat label="Reversed" value={money(detail.ledger.reversedMinor, cur)} />
          <Stat label="Collected revenue" value={money(detail.ledger.collectedRevenueMinor, cur)} />
        </div>
      </DrawerSection>

      {/* Terms summary */}
      <DrawerSection icon={<ShieldCheck size={16} />} title="Current terms">
        <div style={{ display: 'grid', gap: 0 }}>
          <InfoRow label="Reward preference" value={rewardLabel(p)} />
          <InfoRow label="Commission" value={`${bpsPct(p.commissionBps)} (${p.commissionBps} bps)`} />
          <InfoRow label="Credit" value={`${bpsPct(p.creditBps)} (${p.creditBps} bps)`} />
          <InfoRow label="Pilot" value={p.pilotStartAt || p.pilotEndAt ? `${fmtDate(p.pilotStartAt)} → ${fmtDate(p.pilotEndAt)}` : '—'} />
          <InfoRow label="Terms version" value={p.termsVersion ?? '—'} />
          <InfoRow label="Invited" value={fmtDate(p.invitedAt)} />
          <InfoRow label="Accepted" value={fmtDate(p.acceptedAt)} />
          <InfoRow label="Activated" value={fmtDate(p.activatedAt)} />
        </div>
        {detail.notes && (
          <div style={{ marginTop: 10, padding: '10px 12px', borderRadius: 10, border: `1px solid ${C.border}`, background: 'var(--bg-active)' }}>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: C.muted, marginBottom: 4 }}>
              Internal notes
            </div>
            <div style={{ fontSize: 13, color: C.light, whiteSpace: 'pre-wrap' }}>{detail.notes}</div>
          </div>
        )}
      </DrawerSection>

      {/* Reward preference */}
      <DrawerSection icon={<Gift size={16} />} title="Reward preference">
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <select
            value={rewardDraft}
            onChange={(e) => setRewardDraft(e.target.value as RewardPreference)}
            style={selectStyle}
          >
            <option value="cash">Cash commission ({bpsPct(p.commissionBps)})</option>
            <option value="account_credit">Account credit ({bpsPct(p.creditBps)})</option>
          </select>
          <button
            type="button"
            onClick={onSetReward}
            disabled={busy || rewardDraft === p.rewardPreference}
            style={{ ...primaryBtnSm, opacity: busy || rewardDraft === p.rewardPreference ? 0.5 : 1 }}
          >
            Save
          </button>
        </div>
      </DrawerSection>

      {/* Edit terms */}
      {termsForm && (
        <DrawerSection icon={<Percent size={16} />} title="Edit terms">
          <div style={formGrid}>
            <Field label="Designation">
              <input
                value={termsForm.designation}
                onChange={(e) => setTermsForm((f) => (f ? { ...f, designation: e.target.value } : f))}
                style={inputStyle}
              />
            </Field>
            <Field label={`Commission (bps · = ${bpsPct(termsForm.commissionBps)})`}>
              <input
                type="number"
                value={termsForm.commissionBps}
                onChange={(e) => setTermsForm((f) => (f ? { ...f, commissionBps: num(e.target.value) } : f))}
                style={inputStyle}
              />
            </Field>
            <Field label={`Credit (bps · = ${bpsPct(termsForm.creditBps)})`}>
              <input
                type="number"
                value={termsForm.creditBps}
                onChange={(e) => setTermsForm((f) => (f ? { ...f, creditBps: num(e.target.value) } : f))}
                style={inputStyle}
              />
            </Field>
            <Field label="Commission window (months)">
              <input
                type="number"
                value={termsForm.commissionWindowMonths}
                placeholder="Unchanged"
                onChange={(e) => setTermsForm((f) => (f ? { ...f, commissionWindowMonths: e.target.value } : f))}
                style={inputStyle}
              />
            </Field>
            <Field label="Attribution window (days)">
              <input
                type="number"
                value={termsForm.attributionWindowDays}
                placeholder="Unchanged"
                onChange={(e) => setTermsForm((f) => (f ? { ...f, attributionWindowDays: e.target.value } : f))}
                style={inputStyle}
              />
            </Field>
            <Field label="Holding period (days)">
              <input
                type="number"
                value={termsForm.holdingPeriodDays}
                placeholder="Unchanged"
                onChange={(e) => setTermsForm((f) => (f ? { ...f, holdingPeriodDays: e.target.value } : f))}
                style={inputStyle}
              />
            </Field>
            <Field label="Pilot start">
              <input
                type="date"
                value={termsForm.pilotStartAt}
                onChange={(e) => setTermsForm((f) => (f ? { ...f, pilotStartAt: e.target.value } : f))}
                style={inputStyle}
              />
            </Field>
            <Field label="Pilot end">
              <input
                type="date"
                value={termsForm.pilotEndAt}
                onChange={(e) => setTermsForm((f) => (f ? { ...f, pilotEndAt: e.target.value } : f))}
                style={inputStyle}
              />
            </Field>
          </div>

          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginTop: 12, fontSize: 13.5, color: C.light }}>
            <input
              type="checkbox"
              checked={termsForm.earlyAccess}
              onChange={(e) => setTermsForm((f) => (f ? { ...f, earlyAccess: e.target.checked } : f))}
            />
            <Calendar size={14} /> Early access
          </label>

          <div style={{ marginTop: 12 }}>
            <Field label="Internal notes">
              <textarea
                value={termsForm.notes}
                onChange={(e) => setTermsForm((f) => (f ? { ...f, notes: e.target.value } : f))}
                rows={2}
                style={textareaStyle}
              />
            </Field>
          </div>

          <p style={{ color: C.muted, fontSize: 12, marginTop: 8 }}>
            Blank window fields are left unchanged.
          </p>

          <button
            type="button"
            onClick={onUpdateTerms}
            disabled={busy}
            style={{ ...primaryBtnSm, marginTop: 10, opacity: busy ? 0.6 : 1 }}
          >
            Save terms
          </button>
        </DrawerSection>
      )}

      {/* Commissions */}
      <DrawerSection icon={<DollarSign size={16} />} title={`Commissions (${detail.commissions.length})`}>
        {detail.commissions.length === 0 ? (
          <p style={{ color: C.muted, fontSize: 13 }}>No commissions recorded yet.</p>
        ) : (
          <div style={tableWrap}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Referee</th>
                  <th style={thStyle}>Invoice</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Billed</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Reward</th>
                  <th style={thStyle}>Type</th>
                  <th style={thStyle}>Status</th>
                  <th style={thStyle}>Hold release</th>
                  <th style={thStyle}></th>
                </tr>
              </thead>
              <tbody>
                {detail.commissions.map((c) => (
                  <tr key={c.id}>
                    <td style={tdStyle}>{c.refereeLabel}</td>
                    <td style={{ ...tdStyle, fontFamily: 'monospace', fontSize: 12 }}>{c.invoiceId ?? '—'}</td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>{money(c.billedMinor, c.currency)}</td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>{money(c.rewardMinor, c.currency)}</td>
                    <td style={tdStyle}>{c.rewardType === 'cash' ? 'Cash' : 'Credit'}</td>
                    <td style={tdStyle}>
                      <StatusBadge status={c.status} />
                    </td>
                    <td style={tdStyle}>{fmtDate(c.holdReleaseAt)}</td>
                    <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                        {c.status === 'pending' && (
                          <button type="button" onClick={() => onApprove(c.id)} disabled={busy} style={iconBtn}>
                            <Check size={13} /> Approve
                          </button>
                        )}
                        {c.status === 'payable' && c.rewardType === 'cash' && (
                          <button
                            type="button"
                            onClick={() => setCommissionAction({ kind: 'markPaid', id: c.id, reference: '' })}
                            disabled={busy}
                            style={iconBtn}
                          >
                            <DollarSign size={13} /> Mark paid
                          </button>
                        )}
                        {(c.status === 'pending' || c.status === 'payable' || c.status === 'approved') && (
                          <button
                            type="button"
                            onClick={() => setCommissionAction({ kind: 'cancel', id: c.id, reason: '' })}
                            disabled={busy}
                            style={{ ...iconBtn, borderColor: 'var(--color-bear)', color: 'var(--color-bear)' }}
                          >
                            <Ban size={13} /> Cancel
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {commissionAction && (
          <div style={{ ...panelStyle, marginTop: 12 }}>
            {commissionAction.kind === 'markPaid' ? (
              <>
                <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 8 }}>Mark commission paid</div>
                <Field label="Payout reference (optional)">
                  <input
                    value={commissionAction.reference}
                    onChange={(e) =>
                      setCommissionAction((s) =>
                        s && s.kind === 'markPaid' ? { ...s, reference: e.target.value } : s,
                      )
                    }
                    placeholder="e.g. wire ref, PayPal id…"
                    style={inputStyle}
                  />
                </Field>
                <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => onMarkPaid(commissionAction.id, commissionAction.reference)}
                    disabled={busy}
                    style={{ ...primaryBtnSm, opacity: busy ? 0.6 : 1 }}
                  >
                    Confirm paid
                  </button>
                  <button type="button" onClick={() => setCommissionAction(null)} style={secondaryBtn}>
                    Cancel
                  </button>
                </div>
              </>
            ) : (
              <>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    fontSize: 14,
                    fontWeight: 800,
                    marginBottom: 8,
                    color: 'var(--color-bear)',
                  }}
                >
                  <AlertTriangle size={16} /> Cancel this commission
                </div>
                <Field label="Reason (required)">
                  <input
                    value={commissionAction.reason}
                    onChange={(e) =>
                      setCommissionAction((s) => (s && s.kind === 'cancel' ? { ...s, reason: e.target.value } : s))
                    }
                    placeholder="Audit reason…"
                    style={inputStyle}
                  />
                </Field>
                <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => onCancelCommission(commissionAction.id, commissionAction.reason)}
                    disabled={busy || !commissionAction.reason.trim()}
                    style={dangerBtnStyle(busy || !commissionAction.reason.trim())}
                  >
                    Confirm cancel
                  </button>
                  <button type="button" onClick={() => setCommissionAction(null)} style={secondaryBtn}>
                    Keep
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </DrawerSection>

      {/* Manual adjustment */}
      <DrawerSection icon={<DollarSign size={16} />} title="Manual adjustment">
        <p style={{ color: C.muted, fontSize: 12.5, margin: '0 0 10px' }}>
          Record a manual cash adjustment against this ambassador. Positive credits, negative debits.
        </p>
        <div style={formGrid}>
          <Field label={`Amount (${cur.toUpperCase()})`}>
            <input
              type="number"
              step="0.01"
              value={adjAmount}
              onChange={(e) => setAdjAmount(e.target.value)}
              placeholder="0.00"
              style={inputStyle}
            />
          </Field>
          <Field label="Reason (required)">
            <input
              value={adjReason}
              onChange={(e) => setAdjReason(e.target.value)}
              placeholder="Audit reason…"
              style={inputStyle}
            />
          </Field>
        </div>
        <button
          type="button"
          onClick={onAdjust}
          disabled={busy || !adjAmount.trim() || !adjReason.trim()}
          style={{ ...primaryBtnSm, marginTop: 12, opacity: busy || !adjAmount.trim() || !adjReason.trim() ? 0.5 : 1 }}
        >
          Record adjustment
        </button>
      </DrawerSection>

      {/* Referrals */}
      <DrawerSection icon={<Users size={16} />} title={`Referrals (${detail.referrals.length})`}>
        {detail.referrals.length === 0 ? (
          <p style={{ color: C.muted, fontSize: 13 }}>No referrals yet.</p>
        ) : (
          <div style={tableWrap}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Referred</th>
                  <th style={thStyle}>Status</th>
                  <th style={thStyle}>Type</th>
                  <th style={thStyle}>Date</th>
                </tr>
              </thead>
              <tbody>
                {detail.referrals.map((r, i) => (
                  <tr key={`${r.refereeLabel}-${i}`}>
                    <td style={tdStyle}>{r.refereeLabel}</td>
                    <td style={tdStyle}>{r.status}</td>
                    <td style={tdStyle}>{r.partnerType ?? '—'}</td>
                    <td style={tdStyle}>{fmtDate(r.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DrawerSection>
    </div>
  );
}

// ---- Presentational helpers ------------------------------------------------

function Shell({ children, wide }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <main style={{ minHeight: '100vh', padding: '48px 24px', color: C.light }}>
      <div style={{ maxWidth: wide ? 1160 : 720, margin: '0 auto' }}>{children}</div>
    </main>
  );
}

function Feedback({ feedback, onClose }: { feedback: FeedbackState; onClose: () => void }) {
  if (!feedback) return null;
  return (
    <div
      role="status"
      style={{
        marginBottom: 18,
        borderRadius: 12,
        padding: '12px 16px',
        fontSize: 14,
        fontWeight: 600,
        border: '1px solid',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        borderColor: feedback.type === 'success' ? 'var(--color-bull)' : 'var(--color-bear)',
        color: feedback.type === 'success' ? 'var(--color-bull)' : 'var(--color-bear)',
        background: feedback.type === 'success' ? 'var(--color-bull-soft)' : 'var(--color-bear-soft)',
      }}
    >
      <span>{feedback.message}</span>
      <button
        type="button"
        onClick={onClose}
        aria-label="Dismiss"
        style={{ background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer' }}
      >
        <X size={16} />
      </button>
    </div>
  );
}

function Section({
  icon,
  title,
  right,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section style={{ marginTop: 26 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          marginBottom: 12,
          flexWrap: 'wrap',
        }}
      >
        <h2
          style={{
            margin: 0,
            fontSize: 18,
            fontWeight: 800,
            color: C.light,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <span style={{ display: 'inline-flex', color: C.amber }}>{icon}</span>
          {title}
        </h2>
        {right}
      </div>
      {children}
    </section>
  );
}

function DrawerSection({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginTop: 22, paddingTop: 18, borderTop: `1px solid ${C.border}` }}>
      <h3
        style={{
          margin: '0 0 12px',
          fontSize: 15,
          fontWeight: 800,
          color: C.light,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <span style={{ display: 'inline-flex', color: C.amber }}>{icon}</span>
        {title}
      </h3>
      {children}
    </section>
  );
}

function Stat({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: number | string;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div
      style={{
        flex: '1 1 140px',
        minWidth: 140,
        padding: '14px 16px',
        borderRadius: 12,
        border: `1px solid ${accent ? `${C.amber}66` : C.border}`,
        background: accent ? `${C.amber}0f` : 'var(--bg-active)',
      }}
    >
      <div style={{ fontSize: 20, fontWeight: 800, color: accent ? C.amber : C.light }}>{value}</div>
      <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: C.muted, marginTop: 2, opacity: 0.85 }}>{sub}</div>}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    active: 'var(--color-bull)',
    invited: 'var(--color-info)',
    paused: 'var(--color-brand-primary)',
    inactive: 'var(--color-text-secondary)',
    rejected: 'var(--color-bear)',
  };
  const color = map[status] ?? C.muted;
  const label = status.charAt(0).toUpperCase() + status.slice(1);
  return <span style={{ ...pill, color, borderColor: `${color}66`, background: `${color}12` }}>{label}</span>;
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        gap: 12,
        padding: '7px 0',
        borderBottom: `1px solid ${C.border}`,
        fontSize: 13,
      }}
    >
      <span style={{ color: C.muted }}>{label}</span>
      <span style={{ color: C.light, fontWeight: 600, textAlign: 'right', wordBreak: 'break-word' }}>{value}</span>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'block', fontSize: 13 }}>
      <span style={{ color: C.muted, display: 'block', marginBottom: 4, fontWeight: 600 }}>{label}</span>
      {children}
    </label>
  );
}

function ConfirmBlock({
  title,
  body,
  confirmLabel,
  busy,
  onConfirm,
  onCancel,
}: {
  title: string;
  body: string;
  confirmLabel: string;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      style={{
        marginTop: 12,
        padding: '14px 16px',
        borderRadius: 12,
        border: '1px solid var(--color-bear)',
        background: 'var(--color-bear-soft)',
      }}
    >
      <p style={{ margin: '0 0 6px', color: C.light, fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
        <AlertTriangle size={16} color="var(--color-bear)" /> {title}
      </p>
      <p style={{ margin: '0 0 12px', color: C.muted, fontSize: 13 }}>{body}</p>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button type="button" onClick={onConfirm} disabled={busy} style={dangerBtnStyle(busy)}>
          {confirmLabel}
        </button>
        <button type="button" onClick={onCancel} disabled={busy} style={secondaryBtn}>
          Cancel
        </button>
      </div>
    </div>
  );
}

// ---- Style tokens ----------------------------------------------------------

const cardStyle: React.CSSProperties = {
  background: `linear-gradient(145deg, ${C.card} 0%, var(--bg-active) 100%)`,
  border: `1px solid ${C.border}`,
  borderRadius: 18,
  padding: 28,
  boxShadow: '0 12px 40px rgba(0,0,0,0.18)',
};

const panelStyle: React.CSSProperties = {
  border: `1px solid ${C.border}`,
  borderRadius: 14,
  padding: 18,
  background: 'var(--bg-active)',
};

const pill: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '4px 11px',
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 800,
  border: '1px solid',
};

const statGrid: React.CSSProperties = { display: 'flex', gap: 12, flexWrap: 'wrap' };

const formGrid: React.CSSProperties = {
  display: 'grid',
  gap: 12,
  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
};

const linkRow: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '10px 14px',
  borderRadius: 12,
  border: `1px solid ${C.border}`,
  background: 'var(--bg-active)',
};

const linkInput: React.CSSProperties = {
  flex: 1,
  background: 'transparent',
  border: 'none',
  color: C.light,
  fontSize: 14,
  fontWeight: 600,
  outline: 'none',
  minWidth: 0,
};

const primaryBtn: React.CSSProperties = {
  background: `linear-gradient(135deg, ${C.amber} 0%, var(--heat-mid) 100%)`,
  border: 'none',
  borderRadius: 12,
  padding: '12px 20px',
  color: 'var(--text-inverse)',
  fontWeight: 800,
  fontSize: 14,
  cursor: 'pointer',
};

const primaryBtnSm: React.CSSProperties = {
  ...primaryBtn,
  borderRadius: 10,
  padding: '9px 16px',
  fontSize: 13,
  whiteSpace: 'nowrap',
};

const primaryBtnXs: React.CSSProperties = {
  ...primaryBtn,
  borderRadius: 8,
  padding: '6px 12px',
  fontSize: 12.5,
  whiteSpace: 'nowrap',
};

const secondaryBtn: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  background: 'transparent',
  border: `1px solid ${C.border}`,
  color: C.light,
  borderRadius: 10,
  padding: '9px 14px',
  fontWeight: 700,
  fontSize: 13,
  textDecoration: 'none',
  cursor: 'pointer',
};

const iconBtn: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 5,
  background: 'transparent',
  border: `1px solid ${C.border}`,
  color: C.light,
  borderRadius: 8,
  padding: '5px 10px',
  fontWeight: 700,
  fontSize: 12,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
};

function dangerBtnStyle(disabled: boolean): React.CSSProperties {
  return {
    background: 'var(--color-bear)',
    border: '1px solid var(--color-bear)',
    color: 'var(--text-inverse)',
    borderRadius: 10,
    padding: '9px 16px',
    fontWeight: 800,
    fontSize: 13,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
  };
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: 'var(--color-surface)',
  border: `1px solid ${C.border}`,
  color: C.light,
  borderRadius: 10,
  padding: '9px 12px',
  fontSize: 14,
  fontWeight: 600,
  outline: 'none',
};

const selectStyle: React.CSSProperties = { ...inputStyle };

const textareaStyle: React.CSSProperties = {
  ...inputStyle,
  resize: 'vertical',
  fontFamily: 'inherit',
  lineHeight: 1.5,
};

const successBox: React.CSSProperties = {
  padding: '12px 16px',
  borderRadius: 12,
  border: '1px solid var(--color-bull)',
  background: 'var(--color-bull-soft)',
  color: 'var(--color-bull)',
  fontSize: 13.5,
  fontWeight: 600,
};

const tableWrap: React.CSSProperties = {
  overflowX: 'auto',
  border: `1px solid ${C.border}`,
  borderRadius: 12,
};

const tableStyle: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: 13,
};

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '10px 12px',
  color: C.muted,
  fontWeight: 700,
  fontSize: 12,
  borderBottom: `1px solid ${C.border}`,
  whiteSpace: 'nowrap',
  background: 'var(--bg-active)',
};

const tdStyle: React.CSSProperties = {
  padding: '10px 12px',
  color: C.light,
  fontSize: 13,
  borderBottom: `1px solid ${C.border}`,
  whiteSpace: 'nowrap',
};

const backdropStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.5)',
  zIndex: 60,
  display: 'flex',
  justifyContent: 'flex-end',
};

const drawerStyle: React.CSSProperties = {
  width: 'min(720px, 100%)',
  maxWidth: '100vw',
  height: '100%',
  overflowY: 'auto',
  background: 'var(--color-surface)',
  borderLeft: `1px solid ${C.border}`,
  padding: '24px 24px 64px',
  boxShadow: '-16px 0 48px rgba(0,0,0,0.28)',
  color: C.light,
};
