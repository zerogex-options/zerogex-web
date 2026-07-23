'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Award, Copy, Gift, Link2, Rocket, ShieldCheck, Sparkles, TrendingUp, Wallet } from 'lucide-react';
import AmbassadorTerms from '@/components/AmbassadorTerms';

type RewardPreference = 'cash' | 'account_credit';

type Dashboard = {
  status: 'invited' | 'active' | 'paused' | 'inactive' | 'rejected';
  designation: string | null;
  referralCode: string;
  referralLink: string;
  rewardPreference: RewardPreference;
  earlyAccess: boolean;
  terms: {
    commissionPct: number;
    creditPct: number;
    commissionDurationMonths: number;
    holdingPeriodDays: number;
    attributionWindowDays: number;
    version: string | null;
  };
  pilot: { startAt: string | null; endAt: string | null } | null;
  funnel: { visits: number; registrations: number; activeTrials: number; payingCustomers: number };
  earnings: {
    currency: string;
    pendingCashMinor: number;
    payableCashMinor: number;
    paidCashMinor: number;
    pendingCreditMinor: number;
    issuedCreditMinor: number;
    creditOnNextBillMinor?: number;
  };
  recentReferrals: Array<{ label: string; status: string; createdAt: string }>;
  recentActivity: Array<{
    kind: 'cash' | 'account_credit';
    status: string;
    amountMinor: number;
    currency: string;
    createdAt: string;
  }>;
};

type Payload = {
  enabled: boolean;
  isAmbassador?: boolean;
  currentTermsVersion?: string;
  links?: { feedbackUrl: string | null; earlyAccessUrl: string | null; termsUrl: string };
  dashboard?: Dashboard;
};

const C = {
  card: 'var(--color-surface)',
  light: 'var(--color-text-primary)',
  muted: 'var(--color-text-secondary)',
  amber: 'var(--color-brand-primary)',
  accent: 'var(--color-brand-accent)',
  border: 'var(--color-border)',
};

function money(minor: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency.toUpperCase() }).format(
      minor / 100,
    );
  } catch {
    return `${(minor / 100).toFixed(2)} ${currency.toUpperCase()}`;
  }
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

async function csrfToken(): Promise<string | null> {
  try {
    const r = await fetch('/api/auth/csrf', { credentials: 'include' });
    const j = (await r.json()) as { csrfToken?: string };
    return j.csrfToken ?? null;
  } catch {
    return null;
  }
}

export default function AmbassadorClient() {
  const [payload, setPayload] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [chosenReward, setChosenReward] = useState<RewardPreference>('cash');
  const [showTerms, setShowTerms] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/account/ambassador', { credentials: 'include' });
      const j = (await r.json()) as Payload;
      setPayload(j);
      if (j.dashboard) setChosenReward(j.dashboard.rewardPreference);
    } catch {
      setPayload({ enabled: false });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const dash = payload?.dashboard;

  const post = useCallback(
    async (body: Record<string, unknown>): Promise<boolean> => {
      setBusy(true);
      setFeedback(null);
      try {
        const token = await csrfToken();
        if (!token) {
          setFeedback({ type: 'error', message: 'Session expired — please refresh and try again.' });
          return false;
        }
        const r = await fetch('/api/account/ambassador', {
          method: 'POST',
          headers: { 'x-csrf-token': token, 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(body),
        });
        const j = (await r.json().catch(() => ({}))) as { ok?: boolean; error?: string; dashboard?: Dashboard };
        if (!r.ok || !j.ok) {
          setFeedback({ type: 'error', message: j.error ?? 'Something went wrong.' });
          return false;
        }
        if (j.dashboard) {
          setPayload((p) => (p ? { ...p, dashboard: j.dashboard } : p));
          setChosenReward(j.dashboard.rewardPreference);
        }
        return true;
      } catch {
        setFeedback({ type: 'error', message: 'Something went wrong.' });
        return false;
      } finally {
        setBusy(false);
      }
    },
    [],
  );

  const copyLink = async () => {
    if (!dash?.referralLink) return;
    try {
      await navigator.clipboard.writeText(dash.referralLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setFeedback({ type: 'error', message: 'Could not copy the link.' });
    }
  };

  const socialCopy = useMemo(() => {
    if (!dash) return '';
    return `I use ZeroGEX for real-time options gamma exposure (GEX) analytics and dealer positioning. If you want to try it, here's my link: ${dash.referralLink}\n\nDisclosure: I'm a ZeroGEX affiliate and may earn a commission if you subscribe through my link.`;
  }, [dash]);

  if (loading) {
    return (
      <main style={{ minHeight: '100vh', padding: '48px 24px', color: C.light }}>
        <p style={{ color: C.muted }}>Loading your ambassador dashboard…</p>
      </main>
    );
  }

  if (!payload?.enabled) {
    return (
      <Shell>
        <EmptyState
          title="Ambassador Program"
          body="The ZeroGEX Ambassador Program isn't available right now."
        />
      </Shell>
    );
  }

  if (!payload.isAmbassador || !dash) {
    return (
      <Shell>
        <EmptyState
          title="Ambassador Program"
          body="This is an invite-only program for trusted ZeroGEX customers who actively support and recommend the platform. If you've been invited, your invitation will appear here."
          footer={
            <Link href="/ambassador-terms" style={{ color: C.amber, fontWeight: 700, textDecoration: 'none' }}>
              Read the program terms →
            </Link>
          }
        />
      </Shell>
    );
  }

  // ---- Onboarding (invited) ------------------------------------------------
  if (dash.status === 'invited') {
    return (
      <Shell>
        <Feedback feedback={feedback} />
        <section style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <Award size={20} color={C.amber} />
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>
              You're invited{dash.designation ? `: ${dash.designation}` : ' to the ZeroGEX Ambassador Program'}
            </h1>
          </div>
          <p style={{ color: C.muted, fontSize: 14, lineHeight: 1.6, marginTop: 8 }}>
            You have been invited because of your support for ZeroGEX and the value you have brought to
            the community. The program is designed for trusted customers who genuinely use and recommend
            the platform — there is no follower minimum.
          </p>

          <div style={{ marginTop: 20 }}>
            <h2 style={{ fontSize: 15, fontWeight: 800, margin: '0 0 10px' }}>Choose how you'd like to be rewarded</h2>
            <div style={{ display: 'grid', gap: 10 }}>
              <RewardOption
                selected={chosenReward === 'cash'}
                onSelect={() => setChosenReward('cash')}
                title={`${dash.terms.commissionPct}% cash commission`}
                body={`Earn ${dash.terms.commissionPct}% of collected subscription revenue as cash, for a referred customer's first ${dash.terms.commissionDurationMonths} months.`}
              />
              <RewardOption
                selected={chosenReward === 'account_credit'}
                onSelect={() => setChosenReward('account_credit')}
                title={`${dash.terms.creditPct}% ZeroGEX account credit`}
                body={`Earn ${dash.terms.creditPct}% as ZeroGEX account credit applied to your own billing, for a referred customer's first ${dash.terms.commissionDurationMonths} months.`}
              />
            </div>
            <p style={{ color: C.muted, fontSize: 12.5, marginTop: 8 }}>
              You can change this later — changes apply to future commissions only.
            </p>
          </div>

          <details
            style={{ marginTop: 18, border: `1px solid ${C.border}`, borderRadius: 12, padding: '12px 14px' }}
            open={showTerms}
            onToggle={(e) => setShowTerms((e.target as HTMLDetailsElement).open)}
          >
            <summary style={{ cursor: 'pointer', fontWeight: 700, fontSize: 14 }}>
              Review the program terms
            </summary>
            <div style={{ marginTop: 12 }}>
              <AmbassadorTerms
                version={dash.terms.version ?? payload.currentTermsVersion}
                commissionPct={dash.terms.commissionPct}
                creditPct={dash.terms.creditPct}
                commissionDurationMonths={dash.terms.commissionDurationMonths}
                holdingPeriodDays={dash.terms.holdingPeriodDays}
                attributionWindowDays={dash.terms.attributionWindowDays}
              />
            </div>
          </details>

          <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginTop: 16, fontSize: 13.5, color: C.light }}>
            <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} style={{ marginTop: 3 }} />
            <span>
              I have read and accept the ZeroGEX Ambassador Program Terms
              {dash.terms.version || payload.currentTermsVersion ? ` (${dash.terms.version ?? payload.currentTermsVersion})` : ''}.
            </span>
          </label>

          <button
            type="button"
            disabled={!accepted || busy}
            onClick={async () => {
              const ok = await post({ action: 'accept', rewardPreference: chosenReward });
              if (ok) setFeedback({ type: 'success', message: "You're now a ZeroGEX Ambassador!" });
            }}
            style={{ ...primaryBtn, marginTop: 16, opacity: !accepted || busy ? 0.5 : 1, cursor: !accepted || busy ? 'not-allowed' : 'pointer' }}
          >
            {busy ? 'Activating…' : 'Accept & activate'}
          </button>
        </section>
      </Shell>
    );
  }

  // ---- Active / paused / inactive dashboard --------------------------------
  const e = dash.earnings;
  const inactive = dash.status === 'inactive' || dash.status === 'rejected';
  const paused = dash.status === 'paused';

  return (
    <Shell>
      <Feedback feedback={feedback} />

      <header style={{ marginBottom: 22 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <h1 style={{ margin: 0, fontSize: 30, fontWeight: 800, letterSpacing: '-0.5px' }}>Ambassador dashboard</h1>
          <StatusBadge status={dash.status} designation={dash.designation} />
          {dash.earlyAccess && (
            <span style={{ ...pill, color: C.accent, borderColor: `${C.accent}66`, background: `${C.accent}12` }}>
              <Sparkles size={13} /> Early access
            </span>
          )}
        </div>
        <p style={{ margin: '8px 0 0', color: C.muted, fontSize: 14 }}>
          You earn only after a referred customer makes a successful payment, and each reward is subject
          to a {dash.terms.holdingPeriodDays}-day holding period and to reversal on refunds or disputes.
        </p>
      </header>

      {(inactive || paused) && (
        <Banner tone={inactive ? 'warn' : 'info'}>
          {inactive
            ? 'Your ambassador account is inactive for new referrals. Previously earned rewards are preserved and will still be paid or credited.'
            : 'Your ambassador account is paused. New referrals are not being attributed right now.'}
        </Banner>
      )}
      {dash.pilot?.endAt && (
        <Banner tone="info">
          Pilot window: {fmtDate(dash.pilot.startAt)} → {fmtDate(dash.pilot.endAt)}.
        </Banner>
      )}

      {/* Referral link */}
      <Section icon={<Link2 size={18} />} title="Your referral link">
        <div style={linkRow}>
          <input readOnly value={dash.referralLink} onFocus={(ev) => ev.currentTarget.select()} style={linkInput} />
          <button type="button" onClick={copyLink} style={{ ...primaryBtnSm, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Copy size={14} /> {copied ? 'Copied' : 'Copy link'}
          </button>
        </div>
        <p style={{ color: C.muted, fontSize: 13, marginTop: 8 }}>
          Referral code: <strong style={{ color: C.light, letterSpacing: 1 }}>{dash.referralCode}</strong>
        </p>
      </Section>

      {/* Funnel */}
      <Section icon={<TrendingUp size={18} />} title="Referral performance">
        <div style={statGrid}>
          <Stat label="Link visits" value={dash.funnel.visits} />
          <Stat label="Registrations" value={dash.funnel.registrations} />
          <Stat label="Active trials" value={dash.funnel.activeTrials} />
          <Stat label="Paying customers" value={dash.funnel.payingCustomers} />
        </div>
      </Section>

      {/* Earnings */}
      <Section icon={<Wallet size={18} />} title="Earnings">
        <p style={{ color: C.muted, fontSize: 13, margin: '0 0 12px' }}>
          Rewards are <strong>estimates</strong> until a referred payment clears its holding period. Pending
          rewards are not yet payable; payable and issued rewards have cleared the hold.
        </p>
        {dash.rewardPreference === 'cash' ? (
          <div style={statGrid}>
            <Stat label="Pending cash" value={money(e.pendingCashMinor, e.currency)} sub="in holding period" />
            <Stat label="Payable cash" value={money(e.payableCashMinor, e.currency)} sub="ready for payout" accent />
            <Stat label="Paid cash" value={money(e.paidCashMinor, e.currency)} sub="paid out" />
          </div>
        ) : (
          <div style={statGrid}>
            <Stat label="Pending credit" value={money(e.pendingCreditMinor, e.currency)} sub="in holding period" />
            <Stat label="Issued credit" value={money(e.issuedCreditMinor, e.currency)} sub="applied to billing" accent />
          </div>
        )}
        {typeof e.creditOnNextBillMinor === 'number' && e.creditOnNextBillMinor > 0 && (
          <div style={{ marginTop: 12, ...successBox }}>
            {money(e.creditOnNextBillMinor, e.currency)} of ZeroGEX credit will be applied to your next invoice.
          </div>
        )}
      </Section>

      {/* Reward preference */}
      <Section icon={<Gift size={18} />} title="Reward preference">
        <p style={{ color: C.muted, fontSize: 13, margin: '0 0 10px' }}>
          Currently: <strong style={{ color: C.light }}>{dash.rewardPreference === 'cash' ? `${dash.terms.commissionPct}% cash commission` : `${dash.terms.creditPct}% account credit`}</strong>. Changing this affects future commissions only.
        </p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <select
            value={chosenReward}
            onChange={(ev) => setChosenReward(ev.target.value as RewardPreference)}
            disabled={inactive}
            style={selectStyle}
          >
            <option value="cash">{dash.terms.commissionPct}% cash commission</option>
            <option value="account_credit">{dash.terms.creditPct}% ZeroGEX account credit</option>
          </select>
          <button
            type="button"
            disabled={busy || inactive || chosenReward === dash.rewardPreference}
            onClick={async () => {
              const ok = await post({ action: 'setReward', rewardPreference: chosenReward });
              if (ok) setFeedback({ type: 'success', message: 'Reward preference updated for future commissions.' });
            }}
            style={{ ...primaryBtnSm, opacity: busy || inactive || chosenReward === dash.rewardPreference ? 0.5 : 1 }}
          >
            Save
          </button>
        </div>
      </Section>

      {/* Recent activity */}
      <Section icon={<TrendingUp size={18} />} title="Recent referral activity">
        {dash.recentReferrals.length === 0 ? (
          <p style={{ color: C.muted, fontSize: 13 }}>No referrals yet. Share your link to get started.</p>
        ) : (
          <ActivityTable
            rows={dash.recentReferrals.map((r) => [r.label, r.status, fmtDate(r.createdAt)])}
            headers={['Referred customer', 'Status', 'Date']}
          />
        )}
      </Section>

      <Section icon={<Wallet size={18} />} title="Recent commission activity">
        {dash.recentActivity.length === 0 ? (
          <p style={{ color: C.muted, fontSize: 13 }}>No commission activity yet.</p>
        ) : (
          <ActivityTable
            rows={dash.recentActivity.map((a) => [
              a.kind === 'cash' ? 'Cash' : 'Account credit',
              money(a.amountMinor, a.currency),
              a.status,
              fmtDate(a.createdAt),
            ])}
            headers={['Type', 'Amount', 'Status', 'Date']}
          />
        )}
      </Section>

      {/* Early access + feedback */}
      {(dash.earlyAccess && payload.links?.earlyAccessUrl) || payload.links?.feedbackUrl ? (
        <Section icon={<Rocket size={18} />} title="Ambassador perks">
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {dash.earlyAccess && payload.links?.earlyAccessUrl && (
              <a href={payload.links.earlyAccessUrl} target="_blank" rel="noopener noreferrer" style={secondaryBtn}>
                <Sparkles size={14} /> Early product features
              </a>
            )}
            {payload.links?.feedbackUrl && (
              <a href={payload.links.feedbackUrl} target="_blank" rel="noopener noreferrer" style={secondaryBtn}>
                Ambassador feedback channel
              </a>
            )}
          </div>
        </Section>
      ) : null}

      {/* Resources */}
      <Section icon={<Sparkles size={18} />} title="Ambassador resources">
        <div style={{ display: 'grid', gap: 16 }}>
          <div>
            <div style={resLabel}>Approved logo</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
              <div style={{ background: '#fff', borderRadius: 10, padding: 10, border: `1px solid ${C.border}` }}>
                <Image src="/email/zerogex-header.png" alt="ZeroGEX logo" width={180} height={40} style={{ height: 40, width: 'auto' }} />
              </div>
              <a href="/email/zerogex-header.png" download style={secondaryBtn}>Download logo</a>
            </div>
          </div>

          <div>
            <div style={resLabel}>Short product descriptions</div>
            <ul style={{ margin: 0, paddingLeft: 18, color: C.muted, fontSize: 13.5, lineHeight: 1.6 }}>
              <li>ZeroGEX is a professional-grade options flow analytics platform for real-time gamma exposure (GEX), dealer positioning, and options flow.</li>
              <li>See where dealer gamma pins price, spot squeeze setups, and read intraday flow — built for active options traders.</li>
            </ul>
          </div>

          <div>
            <div style={resLabel}>Example social copy (with your link + disclosure)</div>
            <textarea readOnly value={socialCopy} rows={4} style={textareaStyle} onFocus={(ev) => ev.currentTarget.select()} />
            <p style={{ color: C.muted, fontSize: 12, marginTop: 6 }}>Don't make specific performance or profit claims. ZeroGEX is an analytics tool, not financial advice.</p>
          </div>

          <div>
            <div style={resLabel}>Required disclosure</div>
            <div style={{ ...successBox, color: C.light, background: 'var(--bg-active)', border: `1px solid ${C.border}` }}>
              &ldquo;I&rsquo;m a ZeroGEX affiliate and may earn a commission if you subscribe through my link.&rdquo;
            </div>
            <p style={{ color: C.muted, fontSize: 12.5, marginTop: 8 }}>
              You are responsible for making <strong>clear and conspicuous affiliate disclosures</strong> whenever
              you promote ZeroGEX in exchange for commissions, credits, free access, or other benefits.
            </p>
          </div>
        </div>
      </Section>

      {/* Program terms */}
      <Section icon={<ShieldCheck size={18} />} title="Program terms">
        <details style={{ border: `1px solid ${C.border}`, borderRadius: 12, padding: '12px 14px' }}>
          <summary style={{ cursor: 'pointer', fontWeight: 700, fontSize: 14 }}>View the Ambassador Program Terms</summary>
          <div style={{ marginTop: 12 }}>
            <AmbassadorTerms
              version={dash.terms.version ?? payload.currentTermsVersion}
              commissionPct={dash.terms.commissionPct}
              creditPct={dash.terms.creditPct}
              commissionDurationMonths={dash.terms.commissionDurationMonths}
              holdingPeriodDays={dash.terms.holdingPeriodDays}
              attributionWindowDays={dash.terms.attributionWindowDays}
            />
          </div>
        </details>
        <p style={{ color: C.muted, fontSize: 12.5, marginTop: 10 }}>
          Accepted terms version: <strong style={{ color: C.light }}>{dash.terms.version ?? '—'}</strong>. Full terms at{' '}
          <Link href="/ambassador-terms" style={{ color: C.amber, fontWeight: 700, textDecoration: 'none' }}>/ambassador-terms</Link>.
        </p>
      </Section>
    </Shell>
  );
}

// ---- Presentational bits ---------------------------------------------------

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main style={{ minHeight: '100vh', padding: '48px 24px', color: C.light }}>
      <div style={{ maxWidth: 760, margin: '0 auto' }}>{children}</div>
    </main>
  );
}

function EmptyState({ title, body, footer }: { title: string; body: string; footer?: React.ReactNode }) {
  return (
    <section style={cardStyle}>
      <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>{title}</h1>
      <p style={{ marginTop: 12, color: C.muted, fontSize: 14, lineHeight: 1.6 }}>{body}</p>
      {footer && <div style={{ marginTop: 14 }}>{footer}</div>}
    </section>
  );
}

function Feedback({ feedback }: { feedback: { type: 'success' | 'error'; message: string } | null }) {
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
        borderColor: feedback.type === 'success' ? 'var(--color-bull)' : 'var(--color-bear)',
        color: feedback.type === 'success' ? 'var(--color-bull)' : 'var(--color-bear)',
        background: feedback.type === 'success' ? 'var(--color-bull-soft)' : 'var(--color-bear-soft)',
      }}
    >
      {feedback.message}
    </div>
  );
}

function Banner({ tone, children }: { tone: 'warn' | 'info'; children: React.ReactNode }) {
  const color = tone === 'warn' ? 'var(--color-bear)' : 'var(--color-info)';
  const bg = tone === 'warn' ? 'var(--color-bear-soft)' : 'var(--bg-active)';
  return (
    <div style={{ margin: '0 0 16px', borderRadius: 12, padding: '12px 16px', fontSize: 13.5, fontWeight: 600, border: `1px solid ${color}`, color, background: bg }}>
      {children}
    </div>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginTop: 22 }}>
      <h2 style={{ margin: '0 0 12px', fontSize: 18, fontWeight: 800, color: C.light, display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ display: 'inline-flex', color: C.amber }}>{icon}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}

function Stat({ label, value, sub, accent }: { label: string; value: number | string; sub?: string; accent?: boolean }) {
  return (
    <div style={{ flex: '1 1 130px', minWidth: 130, padding: '14px 16px', borderRadius: 12, border: `1px solid ${accent ? `${C.amber}66` : C.border}`, background: accent ? `${C.amber}0f` : 'var(--bg-active)' }}>
      <div style={{ fontSize: 22, fontWeight: 800, color: accent ? C.amber : C.light }}>{value}</div>
      <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: C.muted, marginTop: 2, opacity: 0.85 }}>{sub}</div>}
    </div>
  );
}

function StatusBadge({ status, designation }: { status: string; designation: string | null }) {
  const map: Record<string, string> = {
    active: 'var(--color-bull)',
    invited: 'var(--color-info)',
    paused: 'var(--color-brand-primary)',
    inactive: 'var(--color-text-secondary)',
    rejected: 'var(--color-bear)',
  };
  const color = map[status] ?? C.muted;
  const label = designation && status === 'active' ? designation : status.charAt(0).toUpperCase() + status.slice(1);
  return <span style={{ ...pill, color, borderColor: `${color}66`, background: `${color}12` }}>{label}</span>;
}

function RewardOption({ selected, onSelect, title, body }: { selected: boolean; onSelect: () => void; title: string; body: string }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      style={{
        textAlign: 'left',
        padding: '14px 16px',
        borderRadius: 12,
        border: `2px solid ${selected ? C.amber : C.border}`,
        background: selected ? `${C.amber}0f` : 'var(--bg-active)',
        cursor: 'pointer',
        color: C.light,
      }}
    >
      <div style={{ fontSize: 15, fontWeight: 800 }}>{title}</div>
      <div style={{ fontSize: 13, color: C.muted, marginTop: 4, lineHeight: 1.5 }}>{body}</div>
    </button>
  );
}

function ActivityTable({ headers, rows }: { headers: string[]; rows: Array<Array<string | number>> }) {
  return (
    <div style={{ overflowX: 'auto', border: `1px solid ${C.border}`, borderRadius: 12 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr>
            {headers.map((h) => (
              <th key={h} style={{ textAlign: 'left', padding: '10px 14px', color: C.muted, fontWeight: 700, fontSize: 12, borderBottom: `1px solid ${C.border}` }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((cell, j) => (
                <td key={j} style={{ padding: '10px 14px', color: C.light, borderBottom: i === rows.length - 1 ? 'none' : `1px solid ${C.border}` }}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  background: `linear-gradient(145deg, ${C.card} 0%, var(--bg-active) 100%)`,
  border: `1px solid ${C.border}`,
  borderRadius: 18,
  padding: 28,
  boxShadow: '0 12px 40px rgba(0,0,0,0.18)',
};
const pill: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '5px 12px',
  borderRadius: 999,
  fontSize: 12.5,
  fontWeight: 800,
  border: '1px solid',
};
const statGrid: React.CSSProperties = { display: 'flex', gap: 12, flexWrap: 'wrap' };
const linkRow: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderRadius: 12, border: `1px solid ${C.border}`, background: 'var(--bg-active)' };
const linkInput: React.CSSProperties = { flex: 1, background: 'transparent', border: 'none', color: C.light, fontSize: 14, fontWeight: 600, outline: 'none', minWidth: 0 };
const primaryBtn: React.CSSProperties = { background: `linear-gradient(135deg, ${C.amber} 0%, var(--heat-mid) 100%)`, border: 'none', borderRadius: 12, padding: '12px 20px', color: 'var(--text-inverse)', fontWeight: 800, fontSize: 14, cursor: 'pointer' };
const primaryBtnSm: React.CSSProperties = { ...primaryBtn, borderRadius: 10, padding: '9px 16px', fontSize: 13, whiteSpace: 'nowrap' };
const secondaryBtn: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 8, background: 'transparent', border: `1px solid ${C.border}`, color: C.light, borderRadius: 10, padding: '9px 14px', fontWeight: 700, fontSize: 13, textDecoration: 'none', cursor: 'pointer' };
const selectStyle: React.CSSProperties = { background: 'var(--color-surface)', border: `1px solid ${C.border}`, color: C.light, borderRadius: 10, padding: '9px 12px', fontSize: 14, fontWeight: 600 };
const textareaStyle: React.CSSProperties = { width: '100%', background: 'var(--color-surface)', border: `1px solid ${C.border}`, color: C.light, borderRadius: 10, padding: '10px 12px', fontSize: 13, lineHeight: 1.5, resize: 'vertical', fontFamily: 'inherit' };
const successBox: React.CSSProperties = { padding: '12px 16px', borderRadius: 12, border: '1px solid var(--color-bull)', background: 'var(--color-bull-soft)', color: 'var(--color-bull)', fontSize: 14, fontWeight: 700 };
const resLabel: React.CSSProperties = { fontSize: 12, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: C.muted, marginBottom: 8 };
