'use client';

import { useEffect, useMemo, useState } from 'react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import LoadingSpinner from '@/components/LoadingSpinner';
import ErrorMessage from '@/components/ErrorMessage';
import MobileScrollableChart from '@/components/MobileScrollableChart';
import BackendMonitoring from './BackendMonitoring';
import { formatDayLabel, formatHourLabel, lighten, niceYScale } from './monitoringHelpers';

type SnapshotPoint = {
  bucket: string;
  apiCalls: number;
  pageAccesses: number;
  uniqueUsers: number;
  uniqueIps: number;
};

type SignupPoint = {
  day: string;
  basic: number;
  pro: number;
  public: number;
  paying: number;
  trialing: number;
  disclaimer: number;
};

// Mirrors MrrSnapshot in core/pricing.ts (kept in sync by hand — this file
// is a client component and can't import the server-only monitoring types).
type MrrBreakdownRow = {
  tier: 'basic' | 'pro';
  cadence: 'monthly' | 'annual';
  rate: 'list' | 'founding';
  state: 'active' | 'trialing';
  count: number;
  monthlyEach: number;
  monthlyTotal: number;
};

type Mrr = {
  estMrr: number;
  committedMrr: number;
  activeSubscribers: number;
  trialingSubscribers: number;
  unpricedSubscribers: number;
  arpu: number;
  targetMrr: number;
  targetGrossIncome: number;
  margin: number;
  progressPct: number;
  gapMrr: number;
  subscribersToTarget: number | null;
  breakdown: MrrBreakdownRow[];
};

type WebhookHealth = {
  errors24h: number;
  errors7d: number;
  orphans24h: number;
  orphans7d: number;
  staleSkipped24h: number;
  staleSkipped7d: number;
  paymentFailed24h: number;
  paymentFailed7d: number;
  foundingRedeemed: number;
  foundingLifetimeApplied: number;
  recentErrors: Array<{ createdAt: string; message: string }>;
  recentStaleSkipped: Array<{
    createdAt: string;
    message: string;
    subscriptionId: string | null;
    eventType: string | null;
    deltaSeconds: number | null;
    linkedPaymentFailed: {
      createdAt: string;
      email: string | null;
      message: string;
    } | null;
  }>;
};

// Δ ≤ 5s with no linked payment failure is the textbook Stripe burst
// pattern (multi-event-per-state-change at checkout / on first dunning):
// the ordering guard correctly skipped a near-simultaneous duplicate.
// Dimming these visually keeps the list scannable so the entries that
// warrant attention (linked-to-payment-failed, or large Δ) stand out.
const STALE_NOISE_DELTA_SECONDS = 5;

type Snapshot = {
  ok: boolean;
  mrr: Mrr;
  signups: SignupPoint[];
  hourly: SnapshotPoint[];
  daily: SnapshotPoint[];
  topIps: Array<{ ip: string; count: number }>;
  topUsers: Array<{ userId: string; email: string | null; count: number }>;
  webhookHealth: WebhookHealth;
  lastFlushAt: string | null;
  generatedAt: string;
};

type MetricKey = 'apiCalls' | 'pageAccesses' | 'uniqueUsers' | 'uniqueIps';

// One brand color per row on this page. Order matches the rows below:
// 1. User Signups (signups + disclaimer acceptance)
// 2. Unique Users (Logged In)
// 3. Page Accesses
// 4. API Calls
// 5. Unique Source IPs
// 6. Top Source IPs
// 7. Top Users
// 8. Stripe Webhook Health
const ROW_COLORS = {
  mrr: '#2c8c6a',
  signups: '#2c4875',
  uniqueUsers: '#ff6361',
  pageAccesses: '#bc5090',
  apiCalls: '#8a508f',
  uniqueIps: '#ff8531',
  topIps: '#ffa600',
  topUsers: '#ffd380',
  webhookHealth: '#003f5c',
} as const;

const METRICS: Array<{ key: MetricKey; title: string; color: string; description: string }> = [
  { key: 'uniqueUsers', title: 'Unique Users (Logged In)', color: ROW_COLORS.uniqueUsers, description: 'Distinct authenticated users active during the bucket.' },
  { key: 'pageAccesses', title: 'Page Accesses', color: ROW_COLORS.pageAccesses, description: 'Server-rendered page hits per bucket (excludes Next.js client-side route changes).' },
  { key: 'apiCalls', title: 'API Calls', color: ROW_COLORS.apiCalls, description: 'Total requests to /api/* per bucket.' },
  { key: 'uniqueIps', title: 'Unique Source IPs', color: ROW_COLORS.uniqueIps, description: 'Distinct client IPs observed during the bucket.' },
];

type TabId = 'frontend' | 'backend';

export default function MonitoringClient() {
  const cardBg = 'var(--color-surface)';
  const mutedText = 'var(--color-text-secondary)';
  const textColor = 'var(--color-text-primary)';
  const borderColor = 'var(--color-border)';
  const axisStroke = 'var(--color-text-primary)';

  const [tab, setTab] = useState<TabId>('frontend');
  const [data, setData] = useState<Snapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (tab !== 'frontend') return;
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch('/api/admin/monitoring', { cache: 'no-store', credentials: 'same-origin' });
        if (!res.ok) {
          if (!cancelled) {
            setError(res.status === 403 ? 'Admin access required' : `Failed to load monitoring data (HTTP ${res.status})`);
            setLoading(false);
          }
          return;
        }
        const json = (await res.json()) as Snapshot;
        if (!cancelled) {
          setData(json);
          setError(null);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load monitoring data');
          setLoading(false);
        }
      }
    };
    load();
    const interval = setInterval(load, 60_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [tab]);

  const TABS: Array<{ id: TabId; label: string }> = [
    { id: 'frontend', label: 'Frontend' },
    { id: 'backend', label: 'Backend' },
  ];

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-baseline justify-between mb-4 flex-wrap gap-2">
        <h1 className="text-2xl font-semibold">Admin Monitoring</h1>
      </div>

      <div className="flex gap-2 mb-6 border-b" style={{ borderColor: borderColor }}>
        {TABS.map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold"
              style={{
                color: active ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                borderBottom: active ? '2px solid var(--color-warning)' : '2px solid transparent',
                marginBottom: -1,
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === 'frontend' && (
        <FrontendTab
          loading={loading}
          error={error}
          data={data}
          cardBg={cardBg}
          borderColor={borderColor}
          axisStroke={axisStroke}
          mutedText={mutedText}
          textColor={textColor}
        />
      )}
      {tab === 'backend' && <BackendMonitoring />}
    </div>
  );
}

type FrontendTabProps = {
  loading: boolean;
  error: string | null;
  data: Snapshot | null;
  cardBg: string;
  borderColor: string;
  axisStroke: string;
  mutedText: string;
  textColor: string;
};

function FrontendTab({ loading, error, data, cardBg, borderColor, axisStroke, mutedText, textColor }: FrontendTabProps) {
  if (loading) return <LoadingSpinner size="lg" />;
  if (error) return <ErrorMessage message={error} />;
  if (!data) return null;

  const topIpsMax = data.topIps[0]?.count ?? 0;
  const topUsersMax = data.topUsers[0]?.count ?? 0;
  const signupYScale = niceYScale(
    data.signups.reduce((m, p) => Math.max(m, p.basic + p.pro + p.public), 0),
  );

  return (
    <div>
      <section className="mb-8">
        <div className="flex items-baseline justify-between mb-2 flex-wrap gap-2">
          <h2 className="text-lg font-semibold" style={{ color: textColor }}>Income Replacement Tracker</h2>
          <span className="text-xs" style={{ color: mutedText }}>Estimated MRR vs. the owner-earnings target needed to replace a day-job income. MRR is estimated locally from each subscriber&apos;s plan; promo-rate subs price at list, so treat it as a close estimate.</span>
        </div>
        <IncomeReplacementCard
          mrr={data.mrr}
          cardBg={cardBg}
          borderColor={borderColor}
          mutedText={mutedText}
          textColor={textColor}
          brandColor={ROW_COLORS.mrr}
        />
      </section>

      <section className="mb-8">
        <div className="flex items-baseline justify-between mb-2">
          <h2 className="text-lg font-semibold" style={{ color: textColor }}>User Signups</h2>
          <span className="text-xs" style={{ color: mutedText }}>Daily snapshot of total Basic, Pro, and Public users, full subscribers, free-trial users, and disclaimer acceptance; the latest sample overwrites today&apos;s point.</span>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <SignupChartCard
            data={data.signups}
            cardBg={cardBg}
            axisStroke={axisStroke}
            mutedText={mutedText}
            brandColor={ROW_COLORS.signups}
            yScale={signupYScale}
          />
          <DisclaimerChartCard
            data={data.signups}
            cardBg={cardBg}
            axisStroke={axisStroke}
            mutedText={mutedText}
            brandColor={ROW_COLORS.signups}
            yScale={signupYScale}
          />
        </div>
      </section>

      {METRICS.map((metric) => (
        <section key={metric.key} className="mb-8">
          <div className="flex items-baseline justify-between mb-2">
            <h2 className="text-lg font-semibold" style={{ color: textColor }}>{metric.title}</h2>
            <span className="text-xs" style={{ color: mutedText }}>{metric.description}</span>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ChartCard
              title="Hourly"
              data={data.hourly}
              metricKey={metric.key}
              color={metric.color}
              cardBg={cardBg}
              borderColor={borderColor}
              axisStroke={axisStroke}
              mutedText={mutedText}
              labelFormatter={formatHourLabel}
            />
            <ChartCard
              title="Daily"
              data={data.daily}
              metricKey={metric.key}
              color={metric.color}
              cardBg={cardBg}
              borderColor={borderColor}
              axisStroke={axisStroke}
              mutedText={mutedText}
              labelFormatter={formatDayLabel}
            />
          </div>
        </section>
      ))}

      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-2" style={{ color: textColor }}>Top Source IPs</h2>
        <div className="rounded-lg p-4" style={{ backgroundColor: cardBg }}>
          {data.topIps.length === 0 ? (
            <div className="text-sm" style={{ color: mutedText }}>No IP data captured yet.</div>
          ) : (
            <RankedBarList
              items={data.topIps.map((row) => ({ key: row.ip, label: row.ip, count: row.count }))}
              max={topIpsMax}
              color={ROW_COLORS.topIps}
              borderColor={borderColor}
              mutedText={mutedText}
              monoLabel
            />
          )}
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-2" style={{ color: textColor }}>Top Users</h2>
        <div className="rounded-lg p-4" style={{ backgroundColor: cardBg }}>
          {data.topUsers.length === 0 ? (
            <div className="text-sm" style={{ color: mutedText }}>No user data captured yet.</div>
          ) : (
            <RankedBarList
              items={data.topUsers.map((row) => ({
                key: row.userId,
                label: row.email ?? row.userId,
                count: row.count,
              }))}
              max={topUsersMax}
              color={ROW_COLORS.topUsers}
              borderColor={borderColor}
              mutedText={mutedText}
            />
          )}
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-2" style={{ color: textColor }}>Stripe Webhook Health</h2>
        <WebhookHealthCard
          health={data.webhookHealth}
          cardBg={cardBg}
          borderColor={borderColor}
          mutedText={mutedText}
          textColor={textColor}
          axisStroke={axisStroke}
        />
      </section>
    </div>
  );
}

function formatUsd(n: number, opts?: { cents?: boolean }): string {
  if (!Number.isFinite(n)) return '$0';
  return `$${n.toLocaleString('en-US', {
    minimumFractionDigits: opts?.cents ? 2 : 0,
    maximumFractionDigits: opts?.cents ? 2 : 0,
  })}`;
}

const TIER_LABEL = { basic: 'Basic', pro: 'Pro' } as const;
const CADENCE_LABEL = { monthly: 'Monthly', annual: 'Annual' } as const;
const RATE_LABEL = { list: 'List', founding: 'Founding' } as const;
const STATE_LABEL = { active: 'Active', trialing: 'Trial' } as const;

function StatTile({
  label,
  value,
  sub,
  borderColor,
  mutedText,
  textColor,
}: {
  label: string;
  value: string;
  sub?: string;
  borderColor: string;
  mutedText: string;
  textColor: string;
}) {
  return (
    <div className="rounded-lg p-3" style={{ border: `1px solid ${borderColor}55` }}>
      <div className="text-xs uppercase tracking-wide mb-1" style={{ color: mutedText }}>{label}</div>
      <div className="text-xl font-semibold tabular-nums" style={{ color: textColor }}>{value}</div>
      {sub && <div className="text-xs mt-0.5" style={{ color: mutedText }}>{sub}</div>}
    </div>
  );
}

function IncomeReplacementCard({
  mrr,
  cardBg,
  borderColor,
  mutedText,
  textColor,
  brandColor,
}: {
  mrr: Mrr;
  cardBg: string;
  borderColor: string;
  mutedText: string;
  textColor: string;
  brandColor: string;
}) {
  const estArr = mrr.estMrr * 12;
  const subsLabel =
    mrr.subscribersToTarget === null
      ? '—'
      : `+${mrr.subscribersToTarget.toLocaleString()}`;
  const marginPct = Math.round(mrr.margin * 100);

  return (
    <div className="rounded-lg p-4" style={{ backgroundColor: cardBg }}>
      <div className="flex items-end justify-between flex-wrap gap-3 mb-3">
        <div>
          <div className="text-xs uppercase tracking-wide" style={{ color: mutedText }}>Estimated MRR</div>
          <div className="text-3xl font-bold tabular-nums" style={{ color: brandColor }}>
            {formatUsd(mrr.estMrr)}
            <span className="text-sm font-normal ml-2" style={{ color: mutedText }}>/mo</span>
          </div>
          <div className="text-xs mt-0.5" style={{ color: mutedText }}>
            ≈ {formatUsd(estArr)} ARR · {formatUsd(mrr.committedMrr)}/mo committed (incl. trials)
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs uppercase tracking-wide" style={{ color: mutedText }}>Target MRR</div>
          <div className="text-2xl font-semibold tabular-nums" style={{ color: textColor }}>
            {formatUsd(mrr.targetMrr)}<span className="text-sm font-normal" style={{ color: mutedText }}>/mo</span>
          </div>
          <div className="text-xs mt-0.5" style={{ color: mutedText }}>
            {formatUsd(mrr.targetGrossIncome)}/yr owner earnings @ {marginPct}% margin
          </div>
        </div>
      </div>

      {/* Progress toward replacement target */}
      <div className="mb-1 flex items-baseline justify-between text-xs" style={{ color: mutedText }}>
        <span>Progress to income replacement</span>
        <span className="tabular-nums font-semibold" style={{ color: textColor }}>
          {mrr.progressPct.toFixed(1)}%
        </span>
      </div>
      <div
        className="h-3 rounded-full overflow-hidden mb-1"
        style={{ backgroundColor: `${borderColor}55` }}
        role="progressbar"
        aria-valuenow={Math.round(mrr.progressPct)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className="h-full rounded-full" style={{ width: `${mrr.progressPct}%`, backgroundColor: brandColor }} />
      </div>
      <div className="text-xs mb-4" style={{ color: mutedText }}>
        {formatUsd(mrr.gapMrr)}/mo to go · {subsLabel} subscribers at current ARPU
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <StatTile
          label="ARPU"
          value={formatUsd(mrr.arpu, { cents: true })}
          sub="per active subscriber / mo"
          borderColor={borderColor}
          mutedText={mutedText}
          textColor={textColor}
        />
        <StatTile
          label="Active subs"
          value={mrr.activeSubscribers.toLocaleString()}
          sub={mrr.unpricedSubscribers > 0 ? `${mrr.unpricedSubscribers} unpriced` : 'all priced'}
          borderColor={borderColor}
          mutedText={mutedText}
          textColor={textColor}
        />
        <StatTile
          label="Trials"
          value={mrr.trialingSubscribers.toLocaleString()}
          sub="card on file, not yet charged"
          borderColor={borderColor}
          mutedText={mutedText}
          textColor={textColor}
        />
        <StatTile
          label="Subs to target"
          value={subsLabel}
          sub="at current ARPU"
          borderColor={borderColor}
          mutedText={mutedText}
          textColor={textColor}
        />
      </div>

      {/* Per-plan breakdown so the estimate is auditable */}
      {mrr.breakdown.length > 0 ? (
        <div className="rounded-lg overflow-hidden" style={{ border: `1px solid ${borderColor}55` }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ color: mutedText }} className="text-xs uppercase tracking-wide">
                <th className="text-left font-medium px-3 py-2">Plan</th>
                <th className="text-right font-medium px-3 py-2">Subs</th>
                <th className="text-right font-medium px-3 py-2">Each/mo</th>
                <th className="text-right font-medium px-3 py-2">MRR</th>
              </tr>
            </thead>
            <tbody>
              {mrr.breakdown.map((row) => (
                <tr
                  key={`${row.tier}-${row.cadence}-${row.rate}-${row.state}`}
                  style={{ borderTop: `1px solid ${borderColor}33`, color: textColor, opacity: row.state === 'trialing' ? 0.7 : 1 }}
                >
                  <td className="px-3 py-1.5">
                    {TIER_LABEL[row.tier]} · {CADENCE_LABEL[row.cadence]} · {RATE_LABEL[row.rate]}
                    {row.state === 'trialing' && (
                      <span className="ml-2 text-xs" style={{ color: mutedText }}>({STATE_LABEL[row.state]})</span>
                    )}
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{row.count.toLocaleString()}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{formatUsd(row.monthlyEach, { cents: true })}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">
                    {row.state === 'active' ? formatUsd(row.monthlyTotal) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-sm py-6 text-center" style={{ color: mutedText }}>
          No active or trialing subscribers to price yet.
        </div>
      )}
    </div>
  );
}

type StatusTone = 'ok' | 'warn' | 'alert';

function StatusPill({ tone, label }: { tone: StatusTone; label: string }) {
  const palette = {
    ok: { bg: 'var(--color-bull-soft)', fg: 'var(--color-bull)' },
    warn: { bg: 'var(--color-brand-primary-soft, rgba(255, 165, 0, 0.12))', fg: 'var(--color-brand-primary, #ffa600)' },
    alert: { bg: 'var(--color-bear-soft)', fg: 'var(--color-bear)' },
  }[tone];
  return (
    <span
      className="text-xs font-semibold px-2 py-0.5 rounded-full"
      style={{ background: palette.bg, color: palette.fg }}
    >
      {label}
    </span>
  );
}

function WebhookHealthCard({
  health,
  cardBg,
  borderColor,
  mutedText,
  textColor,
  axisStroke,
}: {
  health: WebhookHealth;
  cardBg: string;
  borderColor: string;
  mutedText: string;
  textColor: string;
  axisStroke: string;
}) {
  const eventChart = useMemo(
    () => [
      { name: 'Errors', '24h': health.errors24h, '7d': health.errors7d },
      { name: 'Orphans', '24h': health.orphans24h, '7d': health.orphans7d },
      { name: 'Stale Skipped', '24h': health.staleSkipped24h, '7d': health.staleSkipped7d },
      { name: 'Payment Failed', '24h': health.paymentFailed24h, '7d': health.paymentFailed7d },
    ],
    [health],
  );

  const totalsPeak = useMemo(
    () => eventChart.reduce((m, p) => Math.max(m, p['24h'], p['7d']), 0),
    [eventChart],
  );
  const yScale = niceYScale(totalsPeak);

  const status: { tone: StatusTone; label: string } = useMemo(() => {
    if (health.errors24h > 0 || health.paymentFailed24h > 0) {
      const bits: string[] = [];
      if (health.errors24h > 0) bits.push(`${health.errors24h} error${health.errors24h === 1 ? '' : 's'}`);
      if (health.paymentFailed24h > 0) bits.push(`${health.paymentFailed24h} payment failure${health.paymentFailed24h === 1 ? '' : 's'}`);
      return { tone: 'alert', label: `${bits.join(' + ')} in last 24h` };
    }
    if (health.errors7d > 0 || health.paymentFailed7d > 0) {
      return { tone: 'warn', label: 'Recent activity in 7d window' };
    }
    return { tone: 'ok', label: 'All clear — last 7 days' };
  }, [health]);

  const founding = useMemo(
    () => [
      { name: 'Redemptions', count: health.foundingRedeemed },
      { name: 'Lifetime applied', count: health.foundingLifetimeApplied },
    ],
    [health],
  );
  const foundingPeak = useMemo(
    () => Math.max(1, ...founding.map((f) => f.count)),
    [founding],
  );
  const foundingScale = niceYScale(foundingPeak);

  return (
    <div className="rounded-lg p-4" style={{ backgroundColor: cardBg }}>
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="text-sm" style={{ color: mutedText }}>
          Webhook events (24h vs 7d) and all-time founding cohort counters.
        </div>
        <StatusPill tone={status.tone} label={status.label} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 rounded-lg p-3" style={{ border: `1px solid ${borderColor}55` }}>
          <div className="text-xs uppercase tracking-wide mb-2" style={{ color: mutedText }}>
            Webhook events
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={eventChart} margin={{ top: 4, right: 12, left: -8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={`${borderColor}55`} vertical={false} />
              <XAxis
                dataKey="name"
                stroke={axisStroke}
                tick={{ fill: mutedText, fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: `${borderColor}77` }}
              />
              <YAxis
                stroke={axisStroke}
                tick={{ fill: mutedText, fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: `${borderColor}77` }}
                allowDecimals={false}
                domain={[0, yScale.max]}
                ticks={yScale.ticks}
              />
              <Tooltip
                cursor={{ fill: `${borderColor}22` }}
                contentStyle={{
                  backgroundColor: cardBg,
                  border: `1px solid ${borderColor}`,
                  borderRadius: 8,
                  color: textColor,
                  fontSize: 12,
                }}
                labelStyle={{ color: textColor, fontWeight: 600 }}
              />
              <Legend
                wrapperStyle={{ fontSize: 12, color: mutedText, paddingTop: 4 }}
                iconType="circle"
                iconSize={8}
              />
              <Bar dataKey="24h" fill={ROW_COLORS.uniqueUsers} radius={[4, 4, 0, 0]} maxBarSize={36} />
              <Bar dataKey="7d" fill={lighten(ROW_COLORS.uniqueUsers, 0.55)} radius={[4, 4, 0, 0]} maxBarSize={36} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-lg p-3" style={{ border: `1px solid ${borderColor}55` }}>
          <div className="text-xs uppercase tracking-wide mb-2" style={{ color: mutedText }}>
            Founding cohort (all-time)
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart
              data={founding}
              layout="vertical"
              margin={{ top: 4, right: 12, left: 8, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke={`${borderColor}55`} horizontal={false} />
              <XAxis
                type="number"
                stroke={axisStroke}
                tick={{ fill: mutedText, fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: `${borderColor}77` }}
                allowDecimals={false}
                domain={[0, foundingScale.max]}
                ticks={foundingScale.ticks}
              />
              <YAxis
                type="category"
                dataKey="name"
                stroke={axisStroke}
                tick={{ fill: mutedText, fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: `${borderColor}77` }}
                width={110}
              />
              <Tooltip
                cursor={{ fill: `${borderColor}22` }}
                contentStyle={{
                  backgroundColor: cardBg,
                  border: `1px solid ${borderColor}`,
                  borderRadius: 8,
                  color: textColor,
                  fontSize: 12,
                }}
              />
              <Bar dataKey="count" fill={ROW_COLORS.webhookHealth} radius={[0, 4, 4, 0]} maxBarSize={28} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {health.recentErrors.length > 0 && (
        <div className="mt-4">
          <h3 className="text-sm font-semibold mb-2" style={{ color: textColor }}>
            Recent errors (last 7 days)
          </h3>
          <ul className="space-y-2">
            {health.recentErrors.map((err, idx) => (
              <li
                key={`${err.createdAt}-${idx}`}
                className="rounded p-2 text-xs"
                style={{
                  border: `1px solid ${borderColor}55`,
                  fontFamily: 'var(--font-mono, ui-monospace, SFMono-Regular, monospace)',
                }}
              >
                <div style={{ color: mutedText }}>{err.createdAt}</div>
                <div className="mt-1 whitespace-pre-wrap break-words" style={{ color: textColor }}>
                  {err.message}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {health.recentStaleSkipped.length > 0 && (
        <div className="mt-4">
          <h3 className="text-sm font-semibold mb-2" style={{ color: textColor }}>
            Recent stale-skipped events (last 7 days)
          </h3>
          <ul className="space-y-2">
            {health.recentStaleSkipped.map((row, idx) => {
              const isLinked = row.linkedPaymentFailed !== null;
              const isNoise =
                !isLinked &&
                row.deltaSeconds !== null &&
                row.deltaSeconds <= STALE_NOISE_DELTA_SECONDS;
              const deltaLabel =
                row.deltaSeconds === null
                  ? null
                  : `Δ ${row.deltaSeconds}s`;
              return (
                <li
                  key={`${row.createdAt}-${idx}`}
                  className="rounded p-2 text-xs"
                  style={{
                    border: `1px solid ${borderColor}55`,
                    fontFamily: 'var(--font-mono, ui-monospace, SFMono-Regular, monospace)',
                    opacity: isNoise ? 0.55 : 1,
                  }}
                >
                  <div className="flex items-center gap-2 flex-wrap" style={{ color: mutedText }}>
                    <span>{row.createdAt}</span>
                    {deltaLabel && (
                      <span
                        className="px-1.5 py-0.5 rounded"
                        style={{
                          background: `${borderColor}33`,
                          color: textColor,
                        }}
                      >
                        {deltaLabel}
                      </span>
                    )}
                    {isLinked ? (
                      <StatusPill tone="alert" label="linked to payment failure" />
                    ) : isNoise ? (
                      <StatusPill tone="ok" label="routine burst" />
                    ) : null}
                  </div>
                  <div className="mt-1 whitespace-pre-wrap break-words" style={{ color: textColor }}>
                    {row.message}
                  </div>
                  {row.linkedPaymentFailed && (
                    <div
                      className="mt-1 pl-2 border-l-2 whitespace-pre-wrap break-words"
                      style={{ borderColor: 'var(--color-bear)', color: mutedText }}
                    >
                      ↳ {row.linkedPaymentFailed.createdAt}
                      {row.linkedPaymentFailed.email ? ` · ${row.linkedPaymentFailed.email}` : ''}
                      {' — '}
                      {row.linkedPaymentFailed.message}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

type RankedBarListProps = {
  items: Array<{ key: string; label: string; count: number }>;
  max: number;
  color: string;
  borderColor: string;
  mutedText: string;
  monoLabel?: boolean;
};

function RankedBarList({ items, max, color, borderColor, mutedText, monoLabel }: RankedBarListProps) {
  return (
    <ol className="space-y-1.5">
      {items.map((row, idx) => {
        const pct = max > 0 ? Math.max(2, (row.count / max) * 100) : 0;
        return (
          <li
            key={row.key}
            className="grid items-center gap-3 text-sm py-1"
            style={{
              gridTemplateColumns: '2rem minmax(0, 1fr) minmax(0, 2fr) auto',
              borderBottom: `1px solid ${borderColor}33`,
            }}
          >
            <span className="text-xs tabular-nums" style={{ color: mutedText }}>{idx + 1}</span>
            <span className={`truncate ${monoLabel ? 'font-mono' : ''}`} title={row.label}>{row.label}</span>
            <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: `${borderColor}55` }}>
              <div
                className="h-full rounded-full"
                style={{ width: `${pct}%`, backgroundColor: color }}
              />
            </div>
            <span className="tabular-nums text-right">{row.count.toLocaleString()}</span>
          </li>
        );
      })}
    </ol>
  );
}

type ChartCardProps = {
  title: string;
  data: SnapshotPoint[];
  metricKey: MetricKey;
  color: string;
  cardBg: string;
  borderColor: string;
  axisStroke: string;
  mutedText: string;
  labelFormatter: (bucket: string) => string;
};

function ChartCard({ title, data, metricKey, color, cardBg, axisStroke, mutedText, labelFormatter }: ChartCardProps) {
  const total = useMemo(() => data.reduce((sum, point) => sum + (point[metricKey] ?? 0), 0), [data, metricKey]);
  const peak = useMemo(() => data.reduce((max, point) => Math.max(max, point[metricKey] ?? 0), 0), [data, metricKey]);
  return (
    <div className="rounded-lg p-4" style={{ backgroundColor: cardBg }}>
      <div className="flex items-baseline justify-between mb-2">
        <h3 className="text-sm font-bold tracking-wider uppercase" style={{ color: axisStroke }}>{title}</h3>
        <div className="text-xs" style={{ color: mutedText }}>
          Total: {total.toLocaleString()} · Peak: {peak.toLocaleString()}
        </div>
      </div>
      <MobileScrollableChart>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
            <CartesianGrid strokeOpacity={0.1} vertical={false} />
            <XAxis
              dataKey="bucket"
              stroke={axisStroke}
              tick={{ fill: axisStroke, fontSize: 10 }}
              tickLine={false}
              minTickGap={40}
              tickFormatter={labelFormatter}
            />
            <YAxis
              stroke={axisStroke}
              tick={{ fill: axisStroke, fontSize: 10 }}
              tickLine={false}
              allowDecimals={false}
              tickFormatter={(v) => {
                const n = Number(v);
                if (!Number.isFinite(n)) return '--';
                if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
                if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
                return String(n);
              }}
            />
            <Tooltip
              cursor={{ fill: 'var(--color-text-primary)', fillOpacity: 0.08 }}
              content={({ active, label, payload }) => {
                if (!active || !payload?.length) return null;
                const value = Number(payload[0]?.value ?? 0);
                return (
                  <div
                    className="rounded-lg border px-3 py-2 text-xs"
                    style={{ backgroundColor: 'var(--color-chart-tooltip-bg)', borderColor: 'var(--color-border)', color: 'var(--color-chart-tooltip-text)' }}
                  >
                    <div className="font-semibold">{labelFormatter(String(label))}</div>
                    <div>{value.toLocaleString()}</div>
                  </div>
                );
              }}
            />
            <Bar dataKey={metricKey} fill={color} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </MobileScrollableChart>
    </div>
  );
}

type SignupChartCardProps = {
  data: SignupPoint[];
  cardBg: string;
  axisStroke: string;
  mutedText: string;
  brandColor: string;
  yScale: { max: number; ticks: number[] };
};

function SignupChartCard({ data, cardBg, axisStroke, mutedText, brandColor, yScale }: SignupChartCardProps) {
  const proColor = brandColor;
  const basicColor = lighten(brandColor, 0.45);
  const publicColor = lighten(brandColor, 0.7);
  const payingColor = '#ff8531';
  const trialingColor = '#ffa600';
  const latest =
    data.length > 0
      ? data[data.length - 1]
      : { basic: 0, pro: 0, public: 0, paying: 0, trialing: 0 };
  const total = latest.basic + latest.pro + latest.public;
  return (
    <div className="rounded-lg p-4" style={{ backgroundColor: cardBg }}>
      <div className="flex items-baseline justify-between mb-2 flex-wrap gap-2">
        <h3 className="text-sm font-bold tracking-wider uppercase" style={{ color: axisStroke }}>Daily Total</h3>
        <div className="flex items-center gap-4 text-xs" style={{ color: mutedText }}>
          <span><span style={{ color: proColor }}>●</span> Pro: {latest.pro.toLocaleString()}</span>
          <span><span style={{ color: basicColor }}>●</span> Basic: {latest.basic.toLocaleString()}</span>
          <span><span style={{ color: publicColor }}>●</span> Public: {latest.public.toLocaleString()}</span>
          <span><span style={{ color: payingColor }}>●</span> Full Subscriber: {latest.paying.toLocaleString()}</span>
          <span><span style={{ color: trialingColor }}>●</span> Free Trial: {latest.trialing.toLocaleString()}</span>
          <span>Total: {total.toLocaleString()}</span>
        </div>
      </div>
      {data.length === 0 ? (
        <div className="text-sm py-12 text-center" style={{ color: mutedText }}>No signup data captured yet.</div>
      ) : (
        <MobileScrollableChart>
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
              <CartesianGrid strokeOpacity={0.1} vertical={false} />
              <XAxis
                dataKey="day"
                stroke={axisStroke}
                tick={{ fill: axisStroke, fontSize: 10 }}
                tickLine={false}
                minTickGap={40}
                tickFormatter={formatDayLabel}
              />
              <YAxis
                stroke={axisStroke}
                tick={{ fill: axisStroke, fontSize: 10 }}
                tickLine={false}
                allowDecimals={false}
                domain={[0, yScale.max]}
                ticks={yScale.ticks}
                interval={0}
              />
              <Tooltip
                cursor={{ stroke: 'var(--color-text-primary)', strokeOpacity: 0.2 }}
                content={({ active, label, payload }) => {
                  if (!active || !payload?.length) return null;
                  const basic = Number(payload.find((p) => p.dataKey === 'basic')?.value ?? 0);
                  const pro = Number(payload.find((p) => p.dataKey === 'pro')?.value ?? 0);
                  const pub = Number(payload.find((p) => p.dataKey === 'public')?.value ?? 0);
                  const paying = Number(payload.find((p) => p.dataKey === 'paying')?.value ?? 0);
                  const trialing = Number(payload.find((p) => p.dataKey === 'trialing')?.value ?? 0);
                  return (
                    <div
                      className="rounded-lg border px-3 py-2 text-xs"
                      style={{ backgroundColor: 'var(--color-chart-tooltip-bg)', borderColor: 'var(--color-border)', color: 'var(--color-chart-tooltip-text)' }}
                    >
                      <div className="font-semibold mb-1">{formatDayLabel(String(label))}</div>
                      <div>Pro: {pro.toLocaleString()}</div>
                      <div>Basic: {basic.toLocaleString()}</div>
                      <div>Public: {pub.toLocaleString()}</div>
                      <div>Full Subscriber: {paying.toLocaleString()}</div>
                      <div>Free Trial: {trialing.toLocaleString()}</div>
                      <div className="mt-1">Total: {(basic + pro + pub).toLocaleString()}</div>
                    </div>
                  );
                }}
              />
              <Area
                type="monotone"
                dataKey="public"
                name="Public"
                stackId="signups"
                stroke={publicColor}
                fill={publicColor}
                fillOpacity={0.5}
                isAnimationActive={false}
              />
              <Area
                type="monotone"
                dataKey="basic"
                name="Basic"
                stackId="signups"
                stroke={basicColor}
                fill={basicColor}
                fillOpacity={0.5}
                isAnimationActive={false}
              />
              <Area
                type="monotone"
                dataKey="pro"
                name="Pro"
                stackId="signups"
                stroke={proColor}
                fill={proColor}
                fillOpacity={0.5}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="paying"
                name="Full Subscriber"
                stroke={payingColor}
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="trialing"
                name="Free Trial"
                stroke={trialingColor}
                strokeWidth={2}
                strokeDasharray="4 3"
                dot={false}
                isAnimationActive={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </MobileScrollableChart>
      )}
    </div>
  );
}

type DisclaimerChartCardProps = {
  data: SignupPoint[];
  cardBg: string;
  axisStroke: string;
  mutedText: string;
  brandColor: string;
  yScale: { max: number; ticks: number[] };
};

function DisclaimerChartCard({ data, cardBg, axisStroke, mutedText, brandColor, yScale }: DisclaimerChartCardProps) {
  const latest = data.length > 0 ? data[data.length - 1] : { disclaimer: 0 };
  return (
    <div className="rounded-lg p-4" style={{ backgroundColor: cardBg }}>
      <div className="flex items-baseline justify-between mb-2 flex-wrap gap-2">
        <h3 className="text-sm font-bold tracking-wider uppercase" style={{ color: axisStroke }}>Disclaimer Acceptance</h3>
        <div className="flex items-center gap-4 text-xs" style={{ color: mutedText }}>
          <span><span style={{ color: brandColor }}>●</span> Accepted: {latest.disclaimer.toLocaleString()}</span>
        </div>
      </div>
      {data.length === 0 ? (
        <div className="text-sm py-12 text-center" style={{ color: mutedText }}>No disclaimer data captured yet.</div>
      ) : (
        <MobileScrollableChart>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
              <CartesianGrid strokeOpacity={0.1} vertical={false} />
              <XAxis
                dataKey="day"
                stroke={axisStroke}
                tick={{ fill: axisStroke, fontSize: 10 }}
                tickLine={false}
                minTickGap={40}
                tickFormatter={formatDayLabel}
              />
              <YAxis
                stroke={axisStroke}
                tick={{ fill: axisStroke, fontSize: 10 }}
                tickLine={false}
                allowDecimals={false}
                domain={[0, yScale.max]}
                ticks={yScale.ticks}
                interval={0}
              />
              <Tooltip
                cursor={{ stroke: 'var(--color-text-primary)', strokeOpacity: 0.2 }}
                content={({ active, label, payload }) => {
                  if (!active || !payload?.length) return null;
                  const disclaimer = Number(payload.find((p) => p.dataKey === 'disclaimer')?.value ?? 0);
                  return (
                    <div
                      className="rounded-lg border px-3 py-2 text-xs"
                      style={{ backgroundColor: 'var(--color-chart-tooltip-bg)', borderColor: 'var(--color-border)', color: 'var(--color-chart-tooltip-text)' }}
                    >
                      <div className="font-semibold mb-1">{formatDayLabel(String(label))}</div>
                      <div>Accepted: {disclaimer.toLocaleString()}</div>
                    </div>
                  );
                }}
              />
              <Area
                type="monotone"
                dataKey="disclaimer"
                name="Accepted"
                stroke={brandColor}
                fill={brandColor}
                fillOpacity={0.5}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </MobileScrollableChart>
      )}
    </div>
  );
}
