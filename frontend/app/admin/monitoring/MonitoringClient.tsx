'use client';

import PageShell from '@/components/layout/PageShell';
import { useEffect, useMemo, useState } from 'react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ComposedChart, Legend, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import LoadingSpinner from '@/components/LoadingSpinner';
import ErrorMessage from '@/components/ErrorMessage';
import MobileScrollableChart from '@/components/MobileScrollableChart';
import BackendMonitoring from './BackendMonitoring';
import { formatDayLabel, formatHourLabel, lighten, niceYScale } from './monitoringHelpers';
import { buildMrrProjection, buildGrowthProjection, MRR_PROJECTION_HORIZONS } from '@/core/pricing';

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

// Mirrors SignupFlowPoint in core/monitoring.ts. Paid adds are positive, paid
// cancellations negative (pre-negated server-side); registrations is the daily
// count of new self-serve accounts (any tier).
type SignupFlowPoint = {
  day: string;
  basicAdd: number;
  proAdd: number;
  basicCancel: number;
  proCancel: number;
  registrations: number;
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

type MrrPoint = {
  day: string;
  estMrr: number;
  committedMrr: number;
};

type MrrTrend = {
  windowDays: number;
  startMrr: number;
  endMrr: number;
  changeMrr: number;
  monthlyGrowthRate: number | null;
  monthsToTarget: number | null;
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
  mrrSeries: MrrPoint[];
  mrrTrend: MrrTrend | null;
  signups: SignupPoint[];
  signupFlow: SignupFlowPoint[];
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
    <PageShell>
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
    </PageShell>
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
  const tierYScale = niceYScale(
    data.signups.reduce((m, p) => Math.max(m, p.basic + p.pro + p.public), 0),
  );
  const subscriberYScale = niceYScale(
    data.signups.reduce((m, p) => Math.max(m, p.paying + p.trialing), 0),
  );

  return (
    <div>
      <section className="mb-8">
        <div className="flex items-baseline justify-between mb-2">
          <h2 className="text-lg font-semibold" style={{ color: textColor }}>User Signups</h2>
          <span className="text-xs" style={{ color: mutedText }}>Subscriber and tier-headcount snapshots (latest sample overwrites today&apos;s point) plus disclaimer acceptance; Registrations &amp; Subscriptions charts each user&apos;s own Basic/Pro Stripe conversions (up) and cancellations (down) per day, with a daily new-account registrations line on a secondary axis sharing the same zero baseline.</span>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <TotalSubscribersChartCard
            data={data.signups}
            cardBg={cardBg}
            axisStroke={axisStroke}
            mutedText={mutedText}
            yScale={subscriberYScale}
          />
          <TierBreakdownChartCard
            data={data.signups}
            cardBg={cardBg}
            axisStroke={axisStroke}
            mutedText={mutedText}
            brandColor={ROW_COLORS.signups}
            yScale={tierYScale}
          />
          <SignupFlowChartCard
            data={data.signupFlow}
            cardBg={cardBg}
            axisStroke={axisStroke}
            mutedText={mutedText}
            brandColor={ROW_COLORS.signups}
          />
          <DisclaimerChartCard
            data={data.signups}
            cardBg={cardBg}
            axisStroke={axisStroke}
            mutedText={mutedText}
            brandColor={ROW_COLORS.signups}
            yScale={tierYScale}
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

      <section className="mb-8">
        <div className="flex items-baseline justify-between mb-2 flex-wrap gap-2">
          <h2 className="text-lg font-semibold" style={{ color: textColor }}>Income Replacement Tracker</h2>
          <span className="text-xs" style={{ color: mutedText }}>Estimated MRR vs. the owner-earnings target needed to replace a day-job income. MRR is estimated locally from each subscriber&apos;s plan; promo-rate subs price at list, so treat it as a close estimate.</span>
        </div>
        <div className="grid grid-cols-1 gap-4">
          <IncomeReplacementCard
            mrr={data.mrr}
            cardBg={cardBg}
            borderColor={borderColor}
            mutedText={mutedText}
            textColor={textColor}
            brandColor={ROW_COLORS.mrr}
          />
          <MrrTrendCard
            series={data.mrrSeries}
            trend={data.mrrTrend}
            targetMrr={data.mrr.targetMrr}
            cardBg={cardBg}
            axisStroke={axisStroke}
            mutedText={mutedText}
            textColor={textColor}
            brandColor={ROW_COLORS.mrr}
          />
        </div>
      </section>

      <section className="mb-8">
        <div className="flex items-baseline justify-between mb-2 flex-wrap gap-2">
          <h2 className="text-lg font-semibold" style={{ color: textColor }}>Growth Projections</h2>
          <span className="text-xs" style={{ color: mutedText }}>A what-if model, not a forecast: start from today&apos;s paying subs and tune acquisition, growth shape, churn, plan mix, and prices to see where subs, MRR, and ARR could land.</span>
        </div>
        <div className="grid grid-cols-1 gap-4">
          <GrowthProjectionsCard
            startingSubs={data.mrr.activeSubscribers}
            targetMrr={data.mrr.targetMrr}
            cardBg={cardBg}
            borderColor={borderColor}
            axisStroke={axisStroke}
            mutedText={mutedText}
            textColor={textColor}
            brandColor={ROW_COLORS.signups}
          />
        </div>
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

function formatMonths(months: number | null): string {
  if (months === null) return '—';
  if (months <= 0) return 'reached';
  if (months < 1) return '< 1 mo';
  if (months < 12) return `~${Math.round(months)} mo`;
  const years = months / 12;
  return `~${months >= 24 ? Math.round(years) : years.toFixed(1)} yr`;
}

function formatGrowthPct(rate: number | null): string {
  if (rate === null) return '—';
  const pct = rate * 100;
  const sign = pct > 0 ? '+' : '';
  return `${sign}${pct.toFixed(1)}%`;
}

// One point on the combined historical + projected MRR line. Historical
// points carry est/committed; projected points carry projMrr. The latest
// historical point carries both (projMrr seeds the forward line so it
// visually connects to the actuals).
type MrrChartPoint = {
  day: string;
  estMrr?: number;
  committedMrr?: number;
  projMrr?: number;
};

// Month/two-digit-year axis label (e.g. "1/'27"), since the projected span
// runs across months and years where a bare M/D would be ambiguous.
function formatProjAxisLabel(day: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(day);
  if (!m) return day;
  return `${Number(m[2])}/'${m[1].slice(2)}`;
}

// Full M/D/'YY label for the tooltip so a projected day years out is exact.
function formatProjTooltipLabel(day: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(day);
  if (!m) return day;
  return `${Number(m[2])}/${Number(m[3])}/'${m[1].slice(2)}`;
}

function MrrTrendCard({
  series,
  trend,
  targetMrr,
  cardBg,
  axisStroke,
  mutedText,
  textColor,
  brandColor,
}: {
  series: MrrPoint[];
  trend: MrrTrend | null;
  targetMrr: number;
  cardBg: string;
  axisStroke: string;
  mutedText: string;
  textColor: string;
  brandColor: string;
}) {
  const committedColor = lighten(brandColor, 0.45);
  const targetColor = lighten(brandColor, 0.2);

  const [horizonMonths, setHorizonMonths] = useState<number>(MRR_PROJECTION_HORIZONS[0].months);
  const horizonLabel =
    MRR_PROJECTION_HORIZONS.find((h) => h.months === horizonMonths)?.label ?? `${horizonMonths} mo`;

  // Straight-line extrapolation off today's MRR and the last week's pace,
  // extended to the selected horizon. Recomputed only when the series or the
  // chosen horizon changes.
  const projection = useMemo(
    () => buildMrrProjection(series, horizonMonths),
    [series, horizonMonths],
  );

  // History plus the forward projection, plotted on one continuous daily axis.
  const chartData = useMemo<MrrChartPoint[]>(() => {
    const rows: MrrChartPoint[] = series.map((p) => ({
      day: p.day,
      estMrr: p.estMrr,
      committedMrr: p.committedMrr,
    }));
    if (projection && rows.length > 0) {
      // Seed the projection at the last actual so the dashed line joins the area.
      rows[rows.length - 1] = { ...rows[rows.length - 1], projMrr: projection.originMrr };
      for (const pt of projection.points) {
        rows.push({ day: pt.day, projMrr: pt.projMrr });
      }
    }
    return rows;
  }, [series, projection]);

  const dataMax = useMemo(
    () => chartData.reduce((m, p) => Math.max(m, p.committedMrr ?? 0, p.estMrr ?? 0, p.projMrr ?? 0), 0),
    [chartData],
  );
  const hasData = dataMax > 0;
  // The replacement target is ~40x current MRR early on; forcing it onto the
  // axis would flatten the growth curve to an invisible sliver. Only draw the
  // target line once the plotted data (now including the projection) is within
  // ~2x of it — that way a long-horizon projection that crosses the target
  // shows where it lands, but a zoomed-in near-term view stays on the data.
  const showTarget = hasData && targetMrr <= dataMax * 2;
  const yBasis = showTarget ? Math.max(dataMax, targetMrr) : dataMax;
  const yScale = useMemo(() => niceYScale(Math.max(1, yBasis)), [yBasis]);

  const slopeSign = projection && projection.slopePerDay < 0 ? '-' : '+';
  const slopeLabel = projection
    ? `${slopeSign}${formatUsd(Math.abs(projection.slopePerDay), { cents: true })}/day`
    : '—';

  return (
    <div className="rounded-lg p-4" style={{ backgroundColor: cardBg }}>
      <div className="flex items-baseline justify-between mb-2 flex-wrap gap-2">
        <h3 className="zg-h3" style={{ color: axisStroke }}>MRR Trend</h3>
        <div className="flex items-center gap-3 text-xs flex-wrap" style={{ color: mutedText }}>
          <span><span style={{ color: brandColor }}>●</span> Est. MRR</span>
          <span><span style={{ color: committedColor }}>●</span> Committed</span>
          <span><span style={{ color: brandColor }}>▬</span> Projected</span>
          {showTarget && <span><span style={{ color: targetColor }}>▬</span> Target</span>}
          <label className="flex items-center gap-1">
            <span className="sr-only">Projection horizon</span>
            <select
              value={horizonMonths}
              onChange={(e) => setHorizonMonths(Number(e.target.value))}
              className="rounded border px-2 py-1 text-xs"
              style={{ backgroundColor: cardBg, borderColor: `${axisStroke}55`, color: textColor }}
              aria-label="Projection horizon"
            >
              {MRR_PROJECTION_HORIZONS.map((h) => (
                <option key={h.months} value={h.months}>{h.label}</option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="flex flex-wrap gap-x-6 gap-y-1 mb-3 text-xs" style={{ color: mutedText }}>
        <span>
          Growth:{' '}
          <span className="font-semibold tabular-nums" style={{ color: textColor }}>
            {trend ? formatGrowthPct(trend.monthlyGrowthRate) : '—'}/mo
          </span>{' '}
          <span style={{ color: mutedText }}>(compounded, full window)</span>
        </span>
        <span>
          Last week&apos;s pace:{' '}
          <span className="font-semibold tabular-nums" style={{ color: textColor }}>
            {slopeLabel}
          </span>{' '}
          {projection && projection.windowDays < 7 && (
            <span style={{ color: mutedText }}>(over {projection.windowDays}d)</span>
          )}
        </span>
        <span>
          Projected in {horizonLabel}:{' '}
          <span className="font-semibold tabular-nums" style={{ color: textColor }}>
            {projection ? formatUsd(projection.horizonMrr) : '—'}
          </span>
        </span>
        <span>
          At this rate, target in:{' '}
          <span className="font-semibold tabular-nums" style={{ color: textColor }}>
            {trend ? formatMonths(trend.monthsToTarget) : '—'}
          </span>
        </span>
      </div>

      {!hasData ? (
        <div className="text-sm py-12 text-center" style={{ color: mutedText }}>
          No MRR history captured yet — the line fills in as daily samples accrue.
        </div>
      ) : (
        <MobileScrollableChart>
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
              <CartesianGrid strokeOpacity={0.1} vertical={false} />
              <XAxis
                dataKey="day"
                stroke={axisStroke}
                tick={{ fill: axisStroke, fontSize: 10 }}
                tickLine={false}
                minTickGap={48}
                tickFormatter={formatProjAxisLabel}
              />
              <YAxis
                stroke={axisStroke}
                tick={{ fill: axisStroke, fontSize: 10 }}
                tickLine={false}
                allowDecimals={false}
                domain={[0, yScale.max]}
                ticks={yScale.ticks}
                tickFormatter={(v) => {
                  const n = Number(v);
                  if (!Number.isFinite(n)) return '--';
                  if (n >= 1_000) return `$${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}k`;
                  return `$${n}`;
                }}
              />
              <Tooltip
                cursor={{ stroke: 'var(--color-text-primary)', strokeOpacity: 0.2 }}
                content={({ active, label, payload }) => {
                  if (!active || !payload?.length) return null;
                  const estRaw = payload.find((p) => p.dataKey === 'estMrr')?.value;
                  const committedRaw = payload.find((p) => p.dataKey === 'committedMrr')?.value;
                  const projRaw = payload.find((p) => p.dataKey === 'projMrr')?.value;
                  const isHistorical = estRaw != null;
                  return (
                    <div
                      className="rounded-lg border px-3 py-2 text-xs"
                      style={{ backgroundColor: 'var(--color-chart-tooltip-bg)', borderColor: 'var(--color-border)', color: 'var(--color-chart-tooltip-text)' }}
                    >
                      <div className="font-semibold mb-1">{formatProjTooltipLabel(String(label))}</div>
                      {isHistorical ? (
                        <>
                          <div>Est. MRR: {formatUsd(Number(estRaw))}</div>
                          <div>Committed: {formatUsd(Number(committedRaw ?? 0))}</div>
                        </>
                      ) : (
                        projRaw != null && <div>Projected: {formatUsd(Number(projRaw))}</div>
                      )}
                    </div>
                  );
                }}
              />
              <Area
                type="monotone"
                dataKey="estMrr"
                name="Est. MRR"
                stroke={brandColor}
                fill={brandColor}
                fillOpacity={0.4}
                strokeWidth={2}
                connectNulls={false}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="committedMrr"
                name="Committed"
                stroke={committedColor}
                strokeWidth={2}
                strokeDasharray="4 3"
                dot={false}
                connectNulls={false}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="projMrr"
                name="Projected"
                stroke={brandColor}
                strokeWidth={2}
                strokeDasharray="5 4"
                strokeOpacity={0.85}
                dot={false}
                connectNulls={false}
                isAnimationActive={false}
              />
              {showTarget && (
                <ReferenceLine
                  y={targetMrr}
                  stroke={targetColor}
                  strokeDasharray="6 4"
                  label={{ value: 'Target', position: 'insideTopRight', fill: mutedText, fontSize: 10 }}
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </MobileScrollableChart>
      )}
    </div>
  );
}

// --- Growth Projections controls (UI presets; the math lives in core/pricing) ---
const ACQUISITION_COUNTS = [1, 2, 3, 5, 10, 15, 20, 25, 50, 100] as const;
const ACQUISITION_PERIODS = [
  { key: 'day', label: 'per day', perMonth: 365 / 12 },
  { key: 'week', label: 'per week', perMonth: 52 / 12 },
  { key: 'month', label: 'per month', perMonth: 1 },
] as const;
type AcquisitionPeriodKey = (typeof ACQUISITION_PERIODS)[number]['key'];

// Exponentiality of the acquisition rate, month over month. Linear keeps the
// add count flat; the rest compound it — spanning what an early SaaS of this
// size might realistically sustain up to an aggressive best case.
const GROWTH_SHAPES = [
  { label: 'Linear — steady adds', accel: 0 },
  { label: 'Gentle — +1%/mo', accel: 0.01 },
  { label: 'Moderate — +2.5%/mo', accel: 0.025 },
  { label: 'Strong — +5%/mo', accel: 0.05 },
  { label: 'Aggressive — +8%/mo', accel: 0.08 },
] as const;

const CHURN_OPTIONS = [0.02, 0.03, 0.05, 0.07, 0.1, 0.15] as const;

const GROWTH_HORIZONS = [
  { months: 12, label: '1 year' },
  { months: 24, label: '2 years' },
  { months: 36, label: '3 years' },
  { months: 60, label: '5 years' },
] as const;

const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

// Compact axis/count formatter: 1.2k / 34M / 2.1B for big numbers so an
// aggressive exponential scenario doesn't blow out the axis, plain otherwise.
function formatCompact(n: number, prefix = ''): string {
  if (!Number.isFinite(n)) return '--';
  const abs = Math.abs(n);
  if (abs >= 1e12) return `${prefix}${(n / 1e12).toFixed(abs >= 1e13 ? 0 : 1)}T`;
  if (abs >= 1e9) return `${prefix}${(n / 1e9).toFixed(abs >= 1e10 ? 0 : 1)}B`;
  if (abs >= 1e6) return `${prefix}${(n / 1e6).toFixed(abs >= 1e7 ? 0 : 1)}M`;
  if (abs >= 1e3) return `${prefix}${(n / 1e3).toFixed(abs >= 1e4 ? 0 : 1)}k`;
  return `${prefix}${Math.round(n)}`;
}

function GrowthProjectionsCard({
  startingSubs,
  targetMrr,
  cardBg,
  borderColor,
  axisStroke,
  mutedText,
  textColor,
  brandColor,
}: {
  startingSubs: number;
  targetMrr: number;
  cardBg: string;
  borderColor: string;
  axisStroke: string;
  mutedText: string;
  textColor: string;
  brandColor: string;
}) {
  const mrrColor = ROW_COLORS.mrr;
  const targetColor = lighten(mrrColor, 0.2);

  const [acqCount, setAcqCount] = useState<number>(3);
  const [acqPeriod, setAcqPeriod] = useState<AcquisitionPeriodKey>('day');
  const [accel, setAccel] = useState<number>(0);
  const [churn, setChurn] = useState<number>(0.05);
  const [proShare, setProShare] = useState<number>(0.5);
  const [proPrice, setProPrice] = useState<number>(40);
  const [basicPrice, setBasicPrice] = useState<number>(20);
  const [horizonMonths, setHorizonMonths] = useState<number>(36);

  const period = ACQUISITION_PERIODS.find((p) => p.key === acqPeriod) ?? ACQUISITION_PERIODS[0];
  const monthlyAdds = acqCount * period.perMonth;
  const horizonLabel = GROWTH_HORIZONS.find((h) => h.months === horizonMonths)?.label ?? `${horizonMonths} mo`;

  const projection = useMemo(
    () =>
      buildGrowthProjection({
        startingSubs,
        monthlyAdds,
        monthlyAccel: accel,
        monthlyChurn: churn,
        proShare,
        proPrice,
        basicPrice,
        horizonMonths,
      }),
    [startingSubs, monthlyAdds, accel, churn, proShare, proPrice, basicPrice, horizonMonths],
  );

  // Anchor month labels to the current calendar month, computed once.
  const now = useMemo(() => new Date(), []);
  const chartData = useMemo(
    () =>
      projection.points.map((p) => {
        const d = new Date(now.getFullYear(), now.getMonth() + p.month, 1);
        return {
          month: p.month,
          label: `${MONTH_ABBR[d.getMonth()]} '${String(d.getFullYear()).slice(2)}`,
          subs: Math.round(p.subs),
          mrr: p.mrr,
          arr: p.arr,
          proSubs: Math.round(p.proSubs),
          basicSubs: Math.round(p.basicSubs),
        };
      }),
    [projection, now],
  );

  // Only pull the target onto the MRR axis when the projection lands within
  // ~1.5x of it, so a modest scenario isn't flattened by a far-off target.
  const showTarget = targetMrr > 0 && targetMrr <= projection.end.mrr * 1.5;
  const mrrScale = niceYScale(Math.max(1, showTarget ? Math.max(projection.end.mrr, targetMrr) : projection.end.mrr));

  // First month the projected MRR reaches the income-replacement target.
  const targetMonth = targetMrr > 0 ? (projection.points.find((p) => p.mrr >= targetMrr)?.month ?? null) : null;

  const proPct = Math.round(proShare * 100);
  const selectCls = 'rounded border px-2 py-1 text-xs';
  const selectStyle = { backgroundColor: cardBg, borderColor, color: textColor };

  return (
    <div className="rounded-lg p-4" style={{ backgroundColor: cardBg }}>
      <div className="flex items-baseline justify-between mb-3 flex-wrap gap-2">
        <h3 className="zg-h3" style={{ color: axisStroke }}>Growth Projections</h3>
        <div className="flex items-center gap-4 text-xs" style={{ color: mutedText }}>
          <span><span style={{ color: mrrColor }}>▬</span> MRR</span>
          {showTarget && <span><span style={{ color: targetColor }}>▬</span> Target</span>}
          <span style={{ color: mutedText }}>· subs in tooltip</span>
        </div>
      </div>

      {/* Tunable inputs */}
      <div className="flex flex-wrap gap-x-5 gap-y-3 mb-4">
        <div className="flex flex-col gap-1">
          <span className="text-xs" style={{ color: mutedText }}>New signups</span>
          <div className="flex items-center gap-1">
            <select
              aria-label="New signups per period — count"
              value={acqCount}
              onChange={(e) => setAcqCount(Number(e.target.value))}
              className={selectCls}
              style={selectStyle}
            >
              {ACQUISITION_COUNTS.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <select
              aria-label="New signups per period — cadence"
              value={acqPeriod}
              onChange={(e) => setAcqPeriod(e.target.value as AcquisitionPeriodKey)}
              className={selectCls}
              style={selectStyle}
            >
              {ACQUISITION_PERIODS.map((p) => (
                <option key={p.key} value={p.key}>{p.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-xs" style={{ color: mutedText }}>Growth shape</span>
          <select
            aria-label="Growth shape"
            value={accel}
            onChange={(e) => setAccel(Number(e.target.value))}
            className={selectCls}
            style={selectStyle}
          >
            {GROWTH_SHAPES.map((g) => (
              <option key={g.accel} value={g.accel}>{g.label}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-xs" style={{ color: mutedText }}>Monthly churn</span>
          <select
            aria-label="Monthly churn rate"
            value={churn}
            onChange={(e) => setChurn(Number(e.target.value))}
            className={selectCls}
            style={selectStyle}
          >
            {CHURN_OPTIONS.map((c) => (
              <option key={c} value={c}>{(c * 100).toFixed(0)}% / mo</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-xs" style={{ color: mutedText }}>Horizon</span>
          <select
            aria-label="Projection horizon"
            value={horizonMonths}
            onChange={(e) => setHorizonMonths(Number(e.target.value))}
            className={selectCls}
            style={selectStyle}
          >
            {GROWTH_HORIZONS.map((h) => (
              <option key={h.months} value={h.months}>{h.label}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1 min-w-[180px]">
          <span className="text-xs" style={{ color: mutedText }}>
            Plan mix — <span style={{ color: textColor }}>Pro {proPct}%</span> / Basic {100 - proPct}%
          </span>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={proPct}
            onChange={(e) => setProShare(Number(e.target.value) / 100)}
            aria-label="Pro vs Basic split (percent Pro)"
            className="w-full"
            style={{ accentColor: brandColor }}
          />
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-xs" style={{ color: mutedText }}>Prices ($/mo)</span>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1 text-xs" style={{ color: mutedText }}>
              Pro
              <input
                type="number"
                min={0}
                step={1}
                value={proPrice}
                onChange={(e) => setProPrice(Math.max(0, Number(e.target.value)))}
                aria-label="Pro price per month"
                className="rounded border px-2 py-1 text-xs w-16"
                style={selectStyle}
              />
            </label>
            <label className="flex items-center gap-1 text-xs" style={{ color: mutedText }}>
              Basic
              <input
                type="number"
                min={0}
                step={1}
                value={basicPrice}
                onChange={(e) => setBasicPrice(Math.max(0, Number(e.target.value)))}
                aria-label="Basic price per month"
                className="rounded border px-2 py-1 text-xs w-16"
                style={selectStyle}
              />
            </label>
          </div>
        </div>
      </div>

      {/* Scenario readout */}
      <div className="flex flex-wrap gap-x-6 gap-y-1 mb-3 text-xs" style={{ color: mutedText }}>
        <span>
          In {horizonLabel}:{' '}
          <span className="font-semibold tabular-nums" style={{ color: textColor }}>
            {Math.round(projection.end.subs).toLocaleString()} subs
          </span>{' '}·{' '}
          <span className="font-semibold tabular-nums" style={{ color: textColor }}>
            {formatUsd(projection.end.mrr)} MRR
          </span>{' '}·{' '}
          <span className="font-semibold tabular-nums" style={{ color: textColor }}>
            {formatUsd(projection.end.arr)} ARR
          </span>
        </span>
        <span>
          Blended ARPU:{' '}
          <span className="font-semibold tabular-nums" style={{ color: textColor }}>
            {formatUsd(projection.blendedArpu, { cents: true })}
          </span>{' '}
          <span style={{ color: mutedText }}>· ~{Math.round(monthlyAdds).toLocaleString()} adds/mo start</span>
        </span>
        {targetMrr > 0 && (
          <span>
            Income target:{' '}
            <span className="font-semibold tabular-nums" style={{ color: textColor }}>
              {targetMonth === null ? `not reached in ${horizonLabel}` : targetMonth === 0 ? 'already met' : `~${targetMonth} mo`}
            </span>
          </span>
        )}
      </div>

      <MobileScrollableChart>
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
            <CartesianGrid strokeOpacity={0.1} vertical={false} />
            <XAxis
              dataKey="label"
              stroke={axisStroke}
              tick={{ fill: axisStroke, fontSize: 10 }}
              tickLine={false}
              minTickGap={48}
            />
            <YAxis
              stroke={axisStroke}
              tick={{ fill: axisStroke, fontSize: 10 }}
              tickLine={false}
              allowDecimals={false}
              domain={[0, mrrScale.max]}
              ticks={mrrScale.ticks}
              tickFormatter={(v) => formatCompact(Number(v), '$')}
            />
            <Tooltip
              cursor={{ stroke: 'var(--color-text-primary)', strokeOpacity: 0.2 }}
              content={({ active, label, payload }) => {
                if (!active || !payload?.length) return null;
                const row = payload[0]?.payload as
                  | { subs: number; mrr: number; arr: number; proSubs: number; basicSubs: number }
                  | undefined;
                if (!row) return null;
                return (
                  <div
                    className="rounded-lg border px-3 py-2 text-xs"
                    style={{ backgroundColor: 'var(--color-chart-tooltip-bg)', borderColor: 'var(--color-border)', color: 'var(--color-chart-tooltip-text)' }}
                  >
                    <div className="font-semibold mb-1">{String(label)}</div>
                    <div>MRR: {formatUsd(row.mrr)}</div>
                    <div>ARR: {formatUsd(row.arr)}</div>
                    <div>Paying subs: {row.subs.toLocaleString()}</div>
                    <div style={{ color: mutedText }}>Pro {row.proSubs.toLocaleString()} · Basic {row.basicSubs.toLocaleString()}</div>
                  </div>
                );
              }}
            />
            <Line
              type="monotone"
              dataKey="mrr"
              name="MRR"
              stroke={mrrColor}
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
            {showTarget && (
              <ReferenceLine
                y={targetMrr}
                stroke={targetColor}
                strokeDasharray="6 4"
                label={{ value: 'Target', position: 'insideTopRight', fill: mutedText, fontSize: 10 }}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </MobileScrollableChart>
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
        <h3 className="zg-h3" style={{ color: axisStroke }}>{title}</h3>
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

type TierBreakdownChartCardProps = {
  data: SignupPoint[];
  cardBg: string;
  axisStroke: string;
  mutedText: string;
  brandColor: string;
  yScale: { max: number; ticks: number[] };
};

// Tier headcount (Pro / Basic / Public) as a stacked area. One total —
// Total Users — is surfaced in the header.
function TierBreakdownChartCard({ data, cardBg, axisStroke, mutedText, brandColor, yScale }: TierBreakdownChartCardProps) {
  const proColor = brandColor;
  const basicColor = lighten(brandColor, 0.45);
  const publicColor = lighten(brandColor, 0.7);
  const latest = data.length > 0 ? data[data.length - 1] : { basic: 0, pro: 0, public: 0 };
  const totalUsers = latest.basic + latest.pro + latest.public;
  return (
    <div className="rounded-lg p-4" style={{ backgroundColor: cardBg }}>
      <div className="flex items-baseline justify-between mb-2 flex-wrap gap-2">
        <h3 className="zg-h3" style={{ color: axisStroke }}>Tier Breakdown</h3>
        <div className="flex items-center gap-4 text-xs" style={{ color: mutedText }}>
          <span><span style={{ color: proColor }}>●</span> Pro: {latest.pro.toLocaleString()}</span>
          <span><span style={{ color: basicColor }}>●</span> Basic: {latest.basic.toLocaleString()}</span>
          <span><span style={{ color: publicColor }}>●</span> Public: {latest.public.toLocaleString()}</span>
          <span>Total Users: {totalUsers.toLocaleString()}</span>
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
                  return (
                    <div
                      className="rounded-lg border px-3 py-2 text-xs"
                      style={{ backgroundColor: 'var(--color-chart-tooltip-bg)', borderColor: 'var(--color-border)', color: 'var(--color-chart-tooltip-text)' }}
                    >
                      <div className="font-semibold mb-1">{formatDayLabel(String(label))}</div>
                      <div>Pro: {pro.toLocaleString()}</div>
                      <div>Basic: {basic.toLocaleString()}</div>
                      <div>Public: {pub.toLocaleString()}</div>
                      <div className="mt-1">Total Users: {(basic + pro + pub).toLocaleString()}</div>
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
            </ComposedChart>
          </ResponsiveContainer>
        </MobileScrollableChart>
      )}
    </div>
  );
}

type TotalSubscribersChartCardProps = {
  data: SignupPoint[];
  cardBg: string;
  axisStroke: string;
  mutedText: string;
  yScale: { max: number; ticks: number[] };
};

// Paying subscribers split into Full Subscriber (active) and Free Trial
// (trialing) as a stacked area. One total — Total Subscribers — in the header.
function TotalSubscribersChartCard({ data, cardBg, axisStroke, mutedText, yScale }: TotalSubscribersChartCardProps) {
  const payingColor = '#ff8531';
  const trialingColor = '#ffa600';
  const latest = data.length > 0 ? data[data.length - 1] : { paying: 0, trialing: 0 };
  const totalSubscribers = latest.paying + latest.trialing;
  return (
    <div className="rounded-lg p-4" style={{ backgroundColor: cardBg }}>
      <div className="flex items-baseline justify-between mb-2 flex-wrap gap-2">
        <h3 className="zg-h3" style={{ color: axisStroke }}>Total Subscribers</h3>
        <div className="flex items-center gap-4 text-xs" style={{ color: mutedText }}>
          <span><span style={{ color: payingColor }}>●</span> Full Subscriber: {latest.paying.toLocaleString()}</span>
          <span><span style={{ color: trialingColor }}>●</span> Free Trial: {latest.trialing.toLocaleString()}</span>
          <span>Total Subscribers: {totalSubscribers.toLocaleString()}</span>
        </div>
      </div>
      {data.length === 0 ? (
        <div className="text-sm py-12 text-center" style={{ color: mutedText }}>No subscriber data captured yet.</div>
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
                  const paying = Number(payload.find((p) => p.dataKey === 'paying')?.value ?? 0);
                  const trialing = Number(payload.find((p) => p.dataKey === 'trialing')?.value ?? 0);
                  return (
                    <div
                      className="rounded-lg border px-3 py-2 text-xs"
                      style={{ backgroundColor: 'var(--color-chart-tooltip-bg)', borderColor: 'var(--color-border)', color: 'var(--color-chart-tooltip-text)' }}
                    >
                      <div className="font-semibold mb-1">{formatDayLabel(String(label))}</div>
                      <div>Full Subscriber: {paying.toLocaleString()}</div>
                      <div>Free Trial: {trialing.toLocaleString()}</div>
                      <div className="mt-1">Total Subscribers: {(paying + trialing).toLocaleString()}</div>
                    </div>
                  );
                }}
              />
              <Area
                type="monotone"
                dataKey="paying"
                name="Full Subscriber"
                stackId="subscribers"
                stroke={payingColor}
                fill={payingColor}
                fillOpacity={0.5}
                isAnimationActive={false}
              />
              <Area
                type="monotone"
                dataKey="trialing"
                name="Free Trial"
                stackId="subscribers"
                stroke={trialingColor}
                fill={trialingColor}
                fillOpacity={0.5}
                isAnimationActive={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </MobileScrollableChart>
      )}
    </div>
  );
}

type SignupFlowChartCardProps = {
  data: SignupFlowPoint[];
  cardBg: string;
  axisStroke: string;
  mutedText: string;
  brandColor: string;
};

// Per-day paid-subscription flow with account registrations overlaid. Basic/Pro
// conversions stack above the x-axis, cancellations below it (each user's own
// Stripe signup/cancel — no public tier); adds are the signups brand (blue)
// family, cancels a bear-red family, tier the shade within. The registrations
// line (new self-serve accounts/day) rides a secondary right-hand axis, since
// top-of-funnel signups dwarf paid conversions and would otherwise flatten the
// bars.
function SignupFlowChartCard({ data, cardBg, axisStroke, mutedText, brandColor }: SignupFlowChartCardProps) {
  const proAddColor = brandColor;
  const basicAddColor = lighten(brandColor, 0.45);
  const cancelBase = '#c1435b';
  const proCancelColor = cancelBase;
  const basicCancelColor = lighten(cancelBase, 0.35);
  // Bright accent so the registrations line reads clearly in front of the blue
  // add / red cancel columns.
  const registrationsColor = '#ffa600';

  const totals = useMemo(() => {
    let proAdd = 0;
    let basicAdd = 0;
    let proCancel = 0;
    let basicCancel = 0;
    let registrations = 0;
    for (const p of data) {
      proAdd += p.proAdd;
      basicAdd += p.basicAdd;
      proCancel += p.proCancel;
      basicCancel += p.basicCancel;
      registrations += p.registrations;
    }
    return { proAdd, basicAdd, proCancel, basicCancel, registrations };
  }, [data]);

  // Two axes sharing one zero baseline. The diverging bars own the primary
  // (left) axis, scaled just to the paid add/cancel stacks so the columns stay
  // legible. The registrations line owns the secondary (right) axis, scaled to
  // its own (much larger) values. To land value 0 at the same pixel on both, the
  // registrations axis is given a proportional negative pad: r = the bars' own
  // negative:positive ratio, so both axes put zero at the same fraction of the
  // height.
  const { barScale, regScale } = useMemo(() => {
    const barPosBound = data.reduce((m, p) => Math.max(m, p.proAdd + p.basicAdd), 0);
    const barNegBound = data.reduce((m, p) => Math.max(m, -(p.proCancel + p.basicCancel)), 0);
    const barPos = niceYScale(barPosBound);
    const barNegMax = barNegBound > 0 ? niceYScale(barNegBound).max : 0;
    const barNegTicks = barNegBound > 0 ? niceYScale(barNegBound).ticks.filter((t) => t > 0) : [];
    const barTicks = [...barNegTicks.map((t) => -t).reverse(), 0, ...barPos.ticks.filter((t) => t > 0)];
    const r = barPos.max > 0 ? barNegMax / barPos.max : 0;

    const reg = niceYScale(data.reduce((m, p) => Math.max(m, p.registrations), 0));

    return {
      barScale: { min: -barNegMax, max: barPos.max, ticks: barTicks },
      // Only positive ticks for registrations; the negative pad is empty space
      // that exists solely to align zero with the bar axis.
      regScale: { min: -r * reg.max, max: reg.max, ticks: reg.ticks.filter((t) => t >= 0) },
    };
  }, [data]);

  const hasData = useMemo(
    () =>
      data.some(
        (p) => p.proAdd !== 0 || p.basicAdd !== 0 || p.proCancel !== 0 || p.basicCancel !== 0 || p.registrations !== 0,
      ),
    [data],
  );
  const signed = (n: number) => `${n > 0 ? '+' : ''}${n.toLocaleString()}`;

  return (
    <div className="rounded-lg p-4" style={{ backgroundColor: cardBg }}>
      <div className="flex items-baseline justify-between mb-2 flex-wrap gap-2">
        <h3 className="zg-h3" style={{ color: axisStroke }}>Registrations &amp; Subscriptions</h3>
        <div className="flex items-center gap-x-4 gap-y-1 text-xs flex-wrap" style={{ color: mutedText }}>
          <span><span style={{ color: registrationsColor }}>▬</span> Registrations: {totals.registrations.toLocaleString()}</span>
          <span><span style={{ color: proAddColor }}>●</span> Pro adds: {totals.proAdd.toLocaleString()}</span>
          <span><span style={{ color: basicAddColor }}>●</span> Basic adds: {totals.basicAdd.toLocaleString()}</span>
          <span><span style={{ color: proCancelColor }}>●</span> Pro cancels: {Math.abs(totals.proCancel).toLocaleString()}</span>
          <span><span style={{ color: basicCancelColor }}>●</span> Basic cancels: {Math.abs(totals.basicCancel).toLocaleString()}</span>
        </div>
      </div>
      {!hasData ? (
        <div className="text-sm py-12 text-center" style={{ color: mutedText }}>No registration or subscription activity captured yet.</div>
      ) : (
        <MobileScrollableChart>
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 8 }} stackOffset="sign">
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
                yAxisId="flow"
                stroke={axisStroke}
                tick={{ fill: axisStroke, fontSize: 10 }}
                tickLine={false}
                allowDecimals={false}
                domain={[barScale.min, barScale.max]}
                ticks={barScale.ticks}
                interval={0}
              />
              <YAxis
                yAxisId="reg"
                orientation="right"
                stroke={registrationsColor}
                tick={{ fill: registrationsColor, fontSize: 10 }}
                tickLine={false}
                allowDecimals={false}
                domain={[regScale.min, regScale.max]}
                ticks={regScale.ticks}
                interval={0}
              />
              <ReferenceLine yAxisId="flow" y={0} stroke={axisStroke} strokeOpacity={0.35} />
              <Tooltip
                cursor={{ fill: 'var(--color-text-primary)', fillOpacity: 0.08 }}
                content={({ active, label, payload }) => {
                  if (!active || !payload?.length) return null;
                  const num = (key: string) => Number(payload.find((p) => p.dataKey === key)?.value ?? 0);
                  const proAdd = num('proAdd');
                  const basicAdd = num('basicAdd');
                  const proCancel = num('proCancel');
                  const basicCancel = num('basicCancel');
                  const registrations = num('registrations');
                  return (
                    <div
                      className="rounded-lg border px-3 py-2 text-xs"
                      style={{ backgroundColor: 'var(--color-chart-tooltip-bg)', borderColor: 'var(--color-border)', color: 'var(--color-chart-tooltip-text)' }}
                    >
                      <div className="font-semibold mb-1">{formatDayLabel(String(label))}</div>
                      <div style={{ color: registrationsColor }}>Registrations: {registrations.toLocaleString()}</div>
                      <div className="mt-1" style={{ color: proAddColor }}>Signups: {signed(proAdd + basicAdd)}</div>
                      <div className="pl-2">Pro: {signed(proAdd)}</div>
                      <div className="pl-2">Basic: {signed(basicAdd)}</div>
                      <div className="mt-1" style={{ color: cancelBase }}>Cancellations: {signed(proCancel + basicCancel)}</div>
                      <div className="pl-2">Pro: {signed(proCancel)}</div>
                      <div className="pl-2">Basic: {signed(basicCancel)}</div>
                    </div>
                  );
                }}
              />
              <Bar yAxisId="flow" dataKey="basicAdd" name="Basic adds" stackId="flow" fill={basicAddColor} maxBarSize={28} isAnimationActive={false} />
              <Bar yAxisId="flow" dataKey="proAdd" name="Pro adds" stackId="flow" fill={proAddColor} maxBarSize={28} isAnimationActive={false} />
              <Bar yAxisId="flow" dataKey="basicCancel" name="Basic cancellations" stackId="flow" fill={basicCancelColor} maxBarSize={28} isAnimationActive={false} />
              <Bar yAxisId="flow" dataKey="proCancel" name="Pro cancellations" stackId="flow" fill={proCancelColor} maxBarSize={28} isAnimationActive={false} />
              <Line
                yAxisId="reg"
                type="monotone"
                dataKey="registrations"
                name="Registrations"
                stroke={registrationsColor}
                strokeWidth={2.5}
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
        <h3 className="zg-h3" style={{ color: axisStroke }}>Disclaimer Acceptance</h3>
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
