'use client';

import PageShell from '@/components/layout/PageShell';
import { useEffect, useMemo, useState } from 'react';
import { Area, Bar, BarChart, CartesianGrid, ComposedChart, Legend, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import LoadingSpinner from '@/components/LoadingSpinner';
import ErrorMessage from '@/components/ErrorMessage';
import MobileScrollableChart from '@/components/MobileScrollableChart';
import BackendMonitoring from './BackendMonitoring';
import { formatDayLabel, formatHourLabel, lighten, makeDayLabelFormatter, niceYScale } from './monitoringHelpers';
import {
  buildSignupImpliedMrrProjection,
  blendedListMonthlyPrice,
  projectionMonthsToTarget,
  buildGrowthProjection,
  MRR_PROJECTION_HORIZONS,
} from '@/core/pricing';
import { accumulateFlowByWeekday } from '@/core/subscriptionFlow';
import {
  beltProgress,
  countdownParts,
  formatCountdown,
  type ConveyorOutcomes,
  type ConveyorRider,
  type ConveyorState,
  type ConveyorTotals,
} from '@/core/trialConveyor';
import { ledgerKindLabel, type LedgerEventKind, type LedgerRow } from '@/core/subscriberBucket';
import type { SubscriberProjectionPoint } from '@/core/trialConveyor';

type SnapshotPoint = {
  bucket: string;
  apiCalls: number;
  pageAccesses: number;
  uniqueUsers: number;
  uniqueIps: number;
};

// Mirrors SignupPoint in core/monitoring.ts. `graceTrial` is the trial-conversion
// grace cohort: the free trial lapsed, the first real charge was declined, and
// the member is inside the bounded payment-recovery window (still a subscriber
// with access, but never yet charged successfully).
type SignupPoint = {
  day: string;
  basic: number;
  pro: number;
  public: number;
  paying: number;
  trialing: number;
  graceTrial: number;
  disclaimer: number;
};

// Mirrors SignupFlowPoint in core/monitoring.ts. Paid adds and reactivations are
// positive; paid cancellations and payment-failure downgrades are negative
// (pre-negated server-side); registrations is the daily count of new self-serve
// accounts (any tier). Adds are first-time conversions; reactivations are subs
// that recovered out of dunning (payment fixed) — split out so a brand-new
// customer is distinguishable from a returning one.
type SignupFlowPoint = {
  day: string;
  basicAdd: number;
  proAdd: number;
  basicReactivate: number;
  proReactivate: number;
  basicCancel: number;
  proCancel: number;
  basicPaymentFail: number;
  proPaymentFail: number;
  registrations: number;
};

type GrowthRatePoint = {
  days: 1 | 7 | 14 | 30;
  signups: number;
  cancellations: number;
  paymentFailures: number;
  net: number;
  dailyRate: number;
};

// Mirrors ConversionSourceRow / ConversionBySourceSnapshot in
// core/pageAnalytics.ts (hand-synced — this client component can't import the
// server-only module). Registrations-by-source over landing-visits-by-source.
type ConversionSourceRow = {
  source: string;
  visits: number;
  signups: number;
  subscribers: number;
  signupConversion: number;
};

type ConversionBySourceSnapshot = {
  windowDays: number;
  generatedAt: string;
  totals: { visits: number; signups: number; subscribers: number };
  sources: ConversionSourceRow[];
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

// Mirrors CancellationReasonsSummary in core/monitoring.ts. The "why" behind
// recent cancellations, parsed from the Stripe cancellation survey: a per-reason
// tally (with a `none` bucket for silent cancels) and the free-text verbatims.
type CancellationReasonsSummary = {
  windowDays: number;
  total: number;
  captured: number;
  byFeedback: Array<{ feedback: string; label: string; count: number }>;
  recentComments: Array<{
    createdAt: string;
    email: string | null;
    feedback: string | null;
    comment: string;
  }>;
};

// Mirrors TrialConveyorSnapshot in core/monitoring.ts (hand-synced — that module
// is server-only). The nested rider/totals/outcomes shapes are imported from
// core/trialConveyor, which is pure and shared with the server.
type TrialConveyor = {
  riders: ConveyorRider[];
  truncated: number;
  departures: ConveyorRider[];
  departingValue: number;
  totals: ConveyorTotals;
  outcomes: ConveyorOutcomes;
  trialDays: number;
  graceDays: number;
  generatedAt: string;
};

// Mirrors SubscriberLedgerSnapshot in core/monitoring.ts (hand-synced — that
// module is server-only). LedgerRow comes from the pure core/subscriberBucket.
type SubscriberLedger = {
  windowDays: number;
  rows: LedgerRow[];
  truncated: number;
  net: { fullSubscriber: number; freeTrial: number; trialGrace: number };
  generatedAt: string;
};

// Mirrors SubscriberProjection in core/monitoring.ts (hand-synced — that module
// is server-only). The point shape comes from the pure core/trialConveyor.
type SubscriberProjection = {
  horizonDays: number;
  anchorDay: string | null;
  anchorPaying: number;
  points: SubscriberProjectionPoint[];
  undecidedStalled: number;
};

type Snapshot = {
  ok: boolean;
  mrr: Mrr;
  mrrSeries: MrrPoint[];
  mrrTrend: MrrTrend | null;
  signups: SignupPoint[];
  signupFlow: SignupFlowPoint[];
  growthRates: GrowthRatePoint[];
  cancellationReasons: CancellationReasonsSummary;
  trialConveyor: TrialConveyor;
  subscriberLedger: SubscriberLedger;
  subscriberProjection: SubscriberProjection;
  conversionBySource: ConversionBySourceSnapshot;
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

type TabId = 'frontend' | 'backend' | 'stripe' | 'revenue' | 'conveyor';

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
    if (tab === 'backend') return;
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
    { id: 'stripe', label: 'Stripe' },
    { id: 'revenue', label: 'Revenue Tracking' },
    { id: 'conveyor', label: 'Conversion Conveyor' },
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
      {tab === 'stripe' && data && !loading && !error && (
        <StripeTab data={data} cardBg={cardBg} borderColor={borderColor} axisStroke={axisStroke} mutedText={mutedText} textColor={textColor} />
      )}
      {tab === 'revenue' && data && !loading && !error && (
        <RevenueTab data={data} cardBg={cardBg} borderColor={borderColor} axisStroke={axisStroke} mutedText={mutedText} textColor={textColor} />
      )}
      {tab === 'conveyor' && data && !loading && !error && (
        <ConveyorTab data={data} cardBg={cardBg} borderColor={borderColor} axisStroke={axisStroke} mutedText={mutedText} textColor={textColor} />
      )}
      {tab !== 'backend' && loading && tab !== 'frontend' && <LoadingSpinner size="lg" />}
      {tab !== 'backend' && error && tab !== 'frontend' && <ErrorMessage message={error} />}
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
  const tierYScale = niceYScale(data.signups.reduce((m, p) => Math.max(m, p.basic + p.pro + p.public), 0));
  const subscriberYScale = niceYScale(
    Math.max(
      data.signups.reduce((m, p) => Math.max(m, p.paying + p.trialing + p.graceTrial), 0),
      // The dashed projection extends past today's stack, so it has to be in
      // the scale or a growing forecast would run off the top of the chart.
      data.subscriberProjection.points.reduce((m, p) => Math.max(m, p.projected), 0),
    ),
  );

  return (
    <div>
      <section className="mb-8">
        <div className="mb-2">
          <h2 className="text-lg font-semibold" style={{ color: textColor }}>User Signups</h2>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <GrowthRateCard rates={data.growthRates} cardBg={cardBg} borderColor={borderColor} mutedText={mutedText} textColor={textColor} />
          <SubscriptionFlowByWeekdayCard data={data.signupFlow} cardBg={cardBg} axisStroke={axisStroke} mutedText={mutedText} brandColor={ROW_COLORS.signups} />
          <TotalSubscribersChartCard data={data.signups} projection={data.subscriberProjection} cardBg={cardBg} axisStroke={axisStroke} mutedText={mutedText} yScale={subscriberYScale} />
          <TierBreakdownChartCard data={data.signups} cardBg={cardBg} axisStroke={axisStroke} mutedText={mutedText} brandColor={ROW_COLORS.signups} yScale={tierYScale} />
          <SubscriptionFlowChartCard data={data.signupFlow} cardBg={cardBg} axisStroke={axisStroke} mutedText={mutedText} brandColor={ROW_COLORS.signups} />
          <DailyRegistrationsChartCard
            data={data.signups}
            flow={data.signupFlow}
            cardBg={cardBg}
            axisStroke={axisStroke}
            mutedText={mutedText}
            brandColor={ROW_COLORS.signups}
            yScale={tierYScale}
          />
        </div>
      </section>

      <ConversionBySourceSection
        data={data.conversionBySource}
        cardBg={cardBg}
        borderColor={borderColor}
        mutedText={mutedText}
        textColor={textColor}
      />

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

    </div>
  );
}

// Friendly labels for the raw, sanitized utm_source keys (see
// core/utils.ts sanitizeUtmSource — lowercased, [a-z0-9._-]). Sources that map
// to the SAME label are merged into one row: `twitter` and `x` both fold into
// "Twitter/X" since they're the same channel. `(direct / none)` is the
// DIRECT_SOURCE_LABEL bucket from core/pageAnalytics.ts. Any source not listed
// here falls through to its raw key so nothing is silently dropped.
const CONVERSION_SOURCE_LABELS: Record<string, string> = {
  '(direct / none)': 'Direct/none',
  twitter: 'Twitter/X',
  x: 'Twitter/X',
  reddit: 'Reddit',
  chatgpt: 'ChatGPT',
  copilot: 'Copilot',
};

function conversionSourceLabel(source: string): string {
  return CONVERSION_SOURCE_LABELS[source] ?? source;
}

// A display source is FLAGGED (warning color) when it pulls meaningful traffic
// but isn't converting — either outright zero signups at low volume, or a very
// low rate at higher volume (the Reddit case: hundreds of visits, ~0 signups,
// which the old "exactly zero" rule missed).
const CONV_FLAG_ZERO_MIN_VISITS = 10; // ≥ this many visits with exactly 0 signups
const CONV_FLAG_LOW_MIN_VISITS = 100; // ≥ this many visits …
const CONV_FLAG_LOW_RATE = 0.003; //      … while converting below 0.3%

function isUnderperformingSource(row: ConversionSourceRow): boolean {
  if (row.visits >= CONV_FLAG_LOW_MIN_VISITS && row.signupConversion < CONV_FLAG_LOW_RATE) return true;
  return row.visits >= CONV_FLAG_ZERO_MIN_VISITS && row.signups === 0;
}

// A display row, plus the raw sanitized sources it folded together — kept only
// when >1 so the Source column can show the split (e.g. paid `x` vs organic
// `twitter` under one "Twitter/X" headline).
type DisplaySourceRow = ConversionSourceRow & { components?: ConversionSourceRow[] };

// Re-label each source and merge rows that share a display label (twitter + x →
// Twitter/X), summing their visits/signups/subscribers and remembering the
// per-tag components. Conversion is recomputed on the merged totals, then rows
// are re-sorted the way the server sorts (visits desc, then signups desc, then
// label) so a combined row lands in the right place.
function displayConversionSources(sources: ConversionSourceRow[]): DisplaySourceRow[] {
  const merged = new Map<string, DisplaySourceRow & { components: ConversionSourceRow[] }>();
  for (const row of sources) {
    const label = conversionSourceLabel(row.source);
    const existing = merged.get(label);
    if (existing) {
      existing.visits += row.visits;
      existing.signups += row.signups;
      existing.subscribers += row.subscribers;
      existing.components.push(row);
    } else {
      merged.set(label, { ...row, source: label, components: [row] });
    }
  }
  return Array.from(merged.values())
    .map((r) => ({
      ...r,
      signupConversion: r.visits > 0 ? r.signups / r.visits : 0,
      // Only surface a breakdown when the label actually combined ≥2 tags.
      components: r.components.length > 1 ? [...r.components].sort((a, b) => b.visits - a.visits) : undefined,
    }))
    .sort((a, b) => b.visits - a.visits || b.signups - a.signups || a.source.localeCompare(b.source));
}

function ConversionBySourceSection({
  data,
  cardBg,
  borderColor,
  mutedText,
  textColor,
}: {
  data: ConversionBySourceSnapshot;
  cardBg: string;
  borderColor: string;
  mutedText: string;
  textColor: string;
}) {
  const totalConv = data.totals.visits > 0 ? (data.totals.signups / data.totals.visits) * 100 : null;
  const displaySources = displayConversionSources(data.sources);
  return (
    <section className="mb-8">
      <div className="flex items-baseline justify-between mb-2">
        <h2 className="text-lg font-semibold" style={{ color: textColor }}>Conversion by Source</h2>
        <span className="text-xs" style={{ color: mutedText }}>
          Landing visits → registrations by first-touch utm_source, last {data.windowDays}d
        </span>
      </div>
      <div className="rounded-lg p-4" style={{ backgroundColor: cardBg }}>
        {displaySources.length === 0 ? (
          <div className="text-sm" style={{ color: mutedText }}>
            No source data captured yet — utm_source is recorded on landing pages going forward.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" style={{ color: textColor }}>
              <thead>
                <tr className="text-left" style={{ color: mutedText }}>
                  <th className="py-1 pr-4 font-medium">Source</th>
                  <th className="py-1 px-3 font-medium text-right">Visits</th>
                  <th className="py-1 px-3 font-medium text-right">Signups</th>
                  <th className="py-1 px-3 font-medium text-right">Conv.</th>
                  <th className="py-1 pl-3 font-medium text-right">Subs</th>
                </tr>
              </thead>
              <tbody>
                {displaySources.map((row) => {
                  const flagged = isUnderperformingSource(row);
                  return (
                    <tr key={row.source} style={{ borderTop: `1px solid ${borderColor}` }}>
                      <td className="py-1.5 pr-4 text-xs align-top">
                        <div>{row.source}</div>
                        {row.components && (
                          <div className="mt-0.5 space-y-0.5 font-mono" style={{ color: mutedText }}>
                            {row.components.map((c) => (
                              <div key={c.source}>
                                {c.source}: {c.visits.toLocaleString()} visits · {c.signups.toLocaleString()} signups
                                {c.subscribers > 0 ? ` · ${c.subscribers.toLocaleString()} subs` : ''}
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="py-1.5 px-3 text-right tabular-nums align-top">{row.visits.toLocaleString()}</td>
                      <td className="py-1.5 px-3 text-right tabular-nums align-top">{row.signups.toLocaleString()}</td>
                      <td
                        className="py-1.5 px-3 text-right tabular-nums font-semibold align-top"
                        style={{ color: flagged ? 'var(--color-warning)' : textColor }}
                        title={flagged ? 'Meaningful traffic but little or no conversion — check the landing/CTA or ad targeting' : undefined}
                      >
                        {row.visits > 0 ? `${(row.signupConversion * 100).toFixed(1)}%` : '—'}
                      </td>
                      <td className="py-1.5 pl-3 text-right tabular-nums align-top" style={{ color: mutedText }}>{row.subscribers.toLocaleString()}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: `2px solid ${borderColor}`, color: mutedText }}>
                  <td className="py-1.5 pr-4 text-xs uppercase tracking-wide">Total</td>
                  <td className="py-1.5 px-3 text-right tabular-nums">{data.totals.visits.toLocaleString()}</td>
                  <td className="py-1.5 px-3 text-right tabular-nums">{data.totals.signups.toLocaleString()}</td>
                  <td className="py-1.5 px-3 text-right tabular-nums">{totalConv != null ? `${totalConv.toFixed(1)}%` : '—'}</td>
                  <td className="py-1.5 pl-3 text-right tabular-nums">{data.totals.subscribers.toLocaleString()}</td>
                </tr>
              </tfoot>
            </table>
            <p className="mt-3 text-xs" style={{ color: mutedText }}>
              Visits and signups are both counted in the window; a signup can trace to an earlier visit, so read the rate as directional. A source with many visits but little or no conversion (highlighted) is the pattern to watch — clicks that aren&apos;t converting. Combined rows (e.g. Twitter/X) show their per-tag split beneath the label, so paid and organic are separable.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

type DataTabProps = Omit<FrontendTabProps, 'loading' | 'error'> & { data: Snapshot };

function StripeTab({ data, cardBg, borderColor, axisStroke, mutedText, textColor }: DataTabProps) {
  return <div>
    <section className="mb-8">
      <h2 className="text-lg font-semibold mb-2" style={{ color: textColor }}>Stripe Webhook Health</h2>
      <WebhookHealthCard health={data.webhookHealth} cardBg={cardBg} borderColor={borderColor} mutedText={mutedText} textColor={textColor} axisStroke={axisStroke} />
    </section>
    <section className="mb-8">
      <h2 className="text-lg font-semibold mb-2" style={{ color: textColor }}>Why Members Cancel</h2>
      <CancellationReasonsCard reasons={data.cancellationReasons} cardBg={cardBg} borderColor={borderColor} mutedText={mutedText} textColor={textColor} />
    </section>
  </div>;
}

function RevenueTab({ data, cardBg, borderColor, axisStroke, mutedText, textColor }: DataTabProps) {
  // Pace for the MRR projection: the 30-day net daily rate off the
  // Forward-Looking Growth Rate table, valued at the blended full (list) price
  // of today's plan mix. See buildSignupImpliedMrrProjection.
  const signupsPerDay = data.growthRates.find((r) => r.days === 30)?.dailyRate ?? 0;
  const blendedListPrice = blendedListMonthlyPrice(data.mrr.breakdown);
  return <div>
    <section className="mb-8">
      <div className="flex items-baseline justify-between mb-2 flex-wrap gap-2">
        <h2 className="text-lg font-semibold" style={{ color: textColor }}>Income Replacement Tracker</h2>
        <span className="text-xs" style={{ color: mutedText }}>Estimated MRR vs. the owner-earnings target needed to replace a day-job income. MRR is estimated locally from each subscriber&apos;s plan; promo-rate subs price at list, so treat it as a close estimate.</span>
      </div>
      <div className="grid grid-cols-1 gap-4">
        <IncomeReplacementCard mrr={data.mrr} cardBg={cardBg} borderColor={borderColor} mutedText={mutedText} textColor={textColor} brandColor={ROW_COLORS.mrr} />
        <MrrTrendCard series={data.mrrSeries} signupsPerDay={signupsPerDay} blendedListPrice={blendedListPrice} targetMrr={data.mrr.targetMrr} cardBg={cardBg} axisStroke={axisStroke} mutedText={mutedText} textColor={textColor} brandColor={ROW_COLORS.mrr} />
      </div>
    </section>
    <section className="mb-8">
      <div className="flex items-baseline justify-between mb-2 flex-wrap gap-2">
        <h2 className="text-lg font-semibold" style={{ color: textColor }}>Growth Projections</h2>
        <span className="text-xs" style={{ color: mutedText }}>A what-if model, not a forecast: start from today&apos;s paying subs and tune acquisition, growth shape, churn, plan mix, and prices to see where subs, MRR, and ARR could land.</span>
      </div>
      <GrowthProjectionsCard startingSubs={data.mrr.activeSubscribers} targetMrr={data.mrr.targetMrr} cardBg={cardBg} borderColor={borderColor} axisStroke={axisStroke} mutedText={mutedText} textColor={textColor} brandColor={ROW_COLORS.signups} />
    </section>
  </div>;
}

// ── Conversion Conveyor ────────────────────────────────────────────────────
// The trial→paying pipeline as an assembly line: every free trial in flight is
// a package riding a belt toward its first charge, counting down live. Cancels
// fall off the belt; a declined first charge jams at the end of it.

const CONVEYOR_COLORS = {
  running: ROW_COLORS.mrr, //      heading for the charge — money on its way
  rollingOff: '#c1435b', //        canceled mid-trial — off the belt
  stalled: ROW_COLORS.topIps, //   first charge declined — recoverable, not lost
  belt: ROW_COLORS.webhookHealth,
} as const;

const CONVEYOR_STATE_LABEL: Record<ConveyorState, string> = {
  running: 'On the belt',
  rollingOff: 'Rolling off',
  stalled: 'Charge declined',
};

// What each lane's countdown is actually counting down TO. A running trial is
// counting to money; a rolling-off one to a departure; a stalled one to the
// last retry Stripe will attempt before access is revoked.
const CONVEYOR_DEADLINE_LABEL: Record<ConveyorState, string> = {
  running: 'until first charge',
  rollingOff: 'until they leave',
  stalled: 'until last retry',
};

function conveyorPlanLabel(rider: ConveyorRider): string {
  if (!rider.tier) return 'Plan unknown';
  const parts: string[] = [TIER_LABEL[rider.tier]];
  if (rider.cadence) parts.push(CADENCE_LABEL[rider.cadence]);
  if (rider.founding) parts.push('Founding');
  return parts.join(' · ');
}

// Live d:hh:mm:ss ticker. Every countdown on the page reads from ONE `nowMs`
// owned by the tab, so all the lanes tick in lockstep on a single interval
// instead of each row running its own timer.
function CountdownTicker({
  deadline,
  nowMs,
  color,
  className,
}: {
  deadline: string | null;
  nowMs: number;
  color: string;
  className?: string;
}) {
  const target = deadline ? Date.parse(deadline) : NaN;
  if (!Number.isFinite(target)) {
    return <span className={className} style={{ color, opacity: 0.5 }}>—</span>;
  }
  const remaining = target - nowMs;
  const parts = countdownParts(remaining);
  return (
    <span
      className={`tabular-nums ${className ?? ''}`}
      style={{ color, opacity: parts.expired ? 0.6 : 1 }}
      title={new Date(target).toLocaleString()}
    >
      {parts.expired ? 'due now' : formatCountdown(remaining)}
    </span>
  );
}

// One trial's strip of belt. The track is progress-normalized — every lane's
// right edge is that rider's OWN charge moment — so a 30-day reactivation trial
// and a 7-day standard trial are directly comparable at a glance.
function ConveyorLane({
  rider,
  nowMs,
  borderColor,
  mutedText,
  textColor,
}: {
  rider: ConveyorRider;
  nowMs: number;
  borderColor: string;
  mutedText: string;
  textColor: string;
}) {
  const color = CONVEYOR_COLORS[rider.state];
  const progress = beltProgress({
    boardedAtMs: rider.boardedAt ? Date.parse(rider.boardedAt) : null,
    convertsAtMs: rider.convertsAt ? Date.parse(rider.convertsAt) : null,
    nowMs,
  });
  // A stalled rider has already reached the end of the belt — pin it there
  // rather than letting the grace-window clock re-scale it back to the middle.
  const pct = rider.state === 'stalled' ? 100 : progress * 100;
  // Keep the package inside the track at both ends instead of half-hanging off.
  const clampedPct = Math.min(96, Math.max(4, pct));
  const dropped = rider.state === 'rollingOff';

  return (
    <li
      className="grid items-center gap-3 py-2"
      style={{
        gridTemplateColumns: 'minmax(0, 13rem) minmax(0, 1fr) auto',
        borderTop: `1px solid ${borderColor}33`,
      }}
    >
      <div className="min-w-0">
        <div className="text-xs truncate" style={{ color: textColor }} title={rider.email ?? rider.userId}>
          {rider.email ?? rider.userId}
        </div>
        <div className="text-[11px] truncate" style={{ color: mutedText }}>
          {conveyorPlanLabel(rider)}
          {rider.monthlyValue > 0 ? ` · ${formatUsd(rider.monthlyValue)}/mo` : ''}
        </div>
      </div>

      {/* The belt itself: slatted track, a filled run showing distance already
          traveled, and the package sitting at this rider's position. */}
      <div className="relative h-7" title={`${Math.round(pct)}% of the way to the charge`}>
        <div
          className="absolute inset-x-0 top-1/2 h-3 rounded-sm -translate-y-1/2 overflow-hidden"
          style={{
            background: `${borderColor}33`,
            backgroundImage: `repeating-linear-gradient(115deg, ${borderColor}44 0 6px, transparent 6px 12px)`,
            opacity: dropped ? 0.4 : 1,
          }}
        >
          <span
            className="block h-full"
            style={{ width: `${pct}%`, background: `${color}55` }}
          />
        </div>
        {/* The charge gate at the end of the line. */}
        <span
          className="absolute right-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded"
          style={{ background: color, opacity: dropped ? 0.35 : 0.9 }}
        />
        <span
          className="absolute top-1/2 h-4 w-4 rounded-sm"
          style={{
            left: `${clampedPct}%`,
            transform: dropped
              ? 'translate(-50%, 30%) rotate(28deg)' // tipped off the belt
              : 'translate(-50%, -50%)',
            background: dropped ? 'transparent' : color,
            border: `2px solid ${color}`,
            opacity: dropped ? 0.6 : 1,
            boxShadow: rider.state === 'running' ? `0 0 0 3px ${color}22` : undefined,
          }}
        />
      </div>

      <div className="text-right">
        <CountdownTicker deadline={rider.convertsAt} nowMs={nowMs} color={color} className="text-sm font-semibold" />
        <div className="text-[11px]" style={{ color: mutedText }}>
          {CONVEYOR_DEADLINE_LABEL[rider.state]}
        </div>
      </div>
    </li>
  );
}

// The machine itself, drawn once so the belt below is self-explaining: what the
// stages are, how many are sitting in each, and where a trial can leave the
// line. Counts are live (the belt) except the last stage, which is the trailing
// window's completed conversions — the output the line has actually produced.
function ConveyorPipelineDiagram({
  conveyor,
  registrations,
  borderColor,
  mutedText,
}: {
  conveyor: TrialConveyor;
  registrations: number;
  borderColor: string;
  mutedText: string;
}) {
  const windowDays = conveyor.outcomes.windowDays;
  // Accounts created but never loaded onto the belt — the leak between "made an
  // account" and "started a trial". Floored at 0: the two counts come from
  // different sources (the users table vs. the audit stream), so a trial that
  // started just outside the registration window must not render as negative.
  const neverBoarded = Math.max(0, registrations - conveyor.outcomes.boarded);
  const stages: Array<{ label: string; value: string; caption: string; color: string; drop?: string }> = [
    {
      label: 'Signs up',
      value: String(registrations),
      caption: `accounts created · ${windowDays}d`,
      color: ROW_COLORS.uniqueUsers,
      drop: neverBoarded > 0 ? `${neverBoarded} never started a trial` : undefined,
    },
    {
      label: 'Boards belt',
      value: String(conveyor.outcomes.boarded),
      caption: `trials started · ${windowDays}d`,
      color: ROW_COLORS.signups,
    },
    {
      label: 'Free trial',
      value: String(conveyor.totals.running),
      caption: 'riding the belt now',
      color: CONVEYOR_COLORS.running,
      drop: conveyor.totals.rollingOff > 0 ? `${conveyor.totals.rollingOff} canceled — rolling off` : undefined,
    },
    {
      label: 'First charge',
      value: String(conveyor.totals.stalled),
      caption: `declined, retrying (${conveyor.graceDays}d)`,
      color: CONVEYOR_COLORS.stalled,
      drop: conveyor.outcomes.rolledOff > 0 ? `${conveyor.outcomes.rolledOff} left without paying · ${windowDays}d` : undefined,
    },
    {
      label: 'Paying',
      value: String(conveyor.outcomes.converted),
      caption: `converted · ${windowDays}d`,
      color: ROW_COLORS.mrr,
    },
  ];
  return (
    <div className="flex items-stretch gap-2 overflow-x-auto pb-1">
      {stages.map((stage, idx) => (
        <div key={stage.label} className="flex items-stretch gap-2 shrink-0">
          <div className="rounded-lg px-3 py-2 min-w-[9.5rem]" style={{ border: `1px solid ${stage.color}66` }}>
            <div className="text-[11px] uppercase tracking-wide" style={{ color: mutedText }}>
              {stage.label}
            </div>
            <div className="text-xl font-semibold tabular-nums" style={{ color: stage.color }}>
              {stage.value}
            </div>
            <div className="text-[11px]" style={{ color: mutedText }}>
              {stage.caption}
            </div>
            {stage.drop && (
              <div className="text-[11px] mt-1" style={{ color: CONVEYOR_COLORS.rollingOff }}>
                ↳ {stage.drop}
              </div>
            )}
          </div>
          {idx < stages.length - 1 && (
            <div className="flex items-center text-lg self-center" style={{ color: borderColor }} aria-hidden>
              ▸
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// Trailing-window scoreboard for trials that already reached a decision. The
// rate's denominator is converted + rolled off ONLY: a trial still retrying is
// undecided, and counting it as a loss would understate the line's real yield.
function TrialOutcomesCard({
  outcomes,
  cardBg,
  borderColor,
  mutedText,
  textColor,
}: {
  outcomes: TrialConveyor['outcomes'];
  cardBg: string;
  borderColor: string;
  mutedText: string;
  textColor: string;
}) {
  const decided = outcomes.converted + outcomes.rolledOff;
  const ratePct = outcomes.conversionRate == null ? null : outcomes.conversionRate * 100;
  const convertedWidth = decided > 0 ? (outcomes.converted / decided) * 100 : 0;
  return (
    <div className="rounded-lg p-4" style={{ background: cardBg, border: `1px solid ${borderColor}` }}>
      <div className="flex items-baseline justify-between flex-wrap gap-2">
        <h3 className="zg-h3" style={{ color: textColor }}>Conveyor Yield</h3>
        <span className="text-xs" style={{ color: mutedText }}>
          last {outcomes.windowDays} days
        </span>
      </div>
      <p className="text-xs mt-1" style={{ color: mutedText }}>
        Of the trials that reached the end of the belt, how many actually paid. Trials still retrying a declined charge
        are left out of the rate — they haven&apos;t been decided yet.
      </p>

      <div className="mt-3 flex items-baseline gap-2">
        <span className="text-3xl font-bold tabular-nums" style={{ color: CONVEYOR_COLORS.running }}>
          {ratePct == null ? '—' : `${ratePct.toFixed(0)}%`}
        </span>
        <span className="text-xs" style={{ color: mutedText }}>
          {decided > 0
            ? `${outcomes.converted} of ${decided} decided trials converted`
            : 'no trials have reached a decision yet'}
        </span>
      </div>

      {decided > 0 && (
        <div className="mt-2 h-3 rounded overflow-hidden flex" style={{ background: `${borderColor}33` }}>
          <span style={{ width: `${convertedWidth}%`, background: CONVEYOR_COLORS.running }} />
          <span style={{ width: `${100 - convertedWidth}%`, background: CONVEYOR_COLORS.rollingOff }} />
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
        {[
          { label: 'Started', value: outcomes.boarded, color: ROW_COLORS.signups },
          { label: 'Converted', value: outcomes.converted, color: CONVEYOR_COLORS.running },
          { label: 'Rolled off', value: outcomes.rolledOff, color: CONVEYOR_COLORS.rollingOff },
          { label: 'Charge declined', value: outcomes.stalled, color: CONVEYOR_COLORS.stalled },
        ].map((cell) => (
          <div key={cell.label} className="rounded-lg p-2" style={{ border: `1px solid ${borderColor}55` }}>
            <div className="text-[11px] uppercase tracking-wide" style={{ color: mutedText }}>{cell.label}</div>
            <div className="text-xl font-semibold tabular-nums" style={{ color: cell.color }}>{cell.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Color + sign convention for the ledger: anything that grows the subscriber
// base reads green, anything that shrinks it reads red, and the two warnings
// that move no counts YET (a scheduled cancel, a renewal in dunning) read amber
// — those are the ones worth acting on before they become a departure.
const LEDGER_TONE: Record<LedgerEventKind, string> = {
  trialStarted: ROW_COLORS.signups,
  converted: CONVEYOR_COLORS.running,
  recovered: CONVEYOR_COLORS.running,
  trialChargeDeclined: CONVEYOR_COLORS.stalled,
  renewalFailed: CONVEYOR_COLORS.stalled,
  cancelScheduled: CONVEYOR_COLORS.stalled,
  cancelReverted: CONVEYOR_COLORS.running,
  accessEnded: CONVEYOR_COLORS.rollingOff,
};

function formatLedgerTime(iso: string, nowMs: number): string {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return '—';
  const ageMinutes = Math.floor((nowMs - ms) / 60_000);
  if (ageMinutes < 1) return 'just now';
  if (ageMinutes < 60) return `${ageMinutes}m ago`;
  if (ageMinutes < 60 * 24) return `${Math.floor(ageMinutes / 60)}h ago`;
  return new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// A signed count chip. Rendered only for a line this row actually moved, so a
// row that moves nothing reads as the warning it is rather than a wall of zeros.
function DeltaChip({ label, delta }: { label: string; delta: number }) {
  if (delta === 0) return null;
  const up = delta > 0;
  return (
    <span
      className="text-[11px] font-semibold px-1.5 py-0.5 rounded tabular-nums whitespace-nowrap"
      style={{
        background: up ? `${CONVEYOR_COLORS.running}22` : `${CONVEYOR_COLORS.rollingOff}22`,
        color: up ? CONVEYOR_COLORS.running : CONVEYOR_COLORS.rollingOff,
      }}
    >
      {up ? '+' : ''}{delta} {label}
    </span>
  );
}

// The answer to "the number moved and I don't know why". Every row states what
// happened, to whom, and what it did to each line of the Total Subscribers
// chart — so a headcount change is always traceable to a named member.
function SubscriberLedgerCard({
  ledger,
  nowMs,
  cardBg,
  borderColor,
  mutedText,
  textColor,
}: {
  ledger: SubscriberLedger;
  nowMs: number;
  cardBg: string;
  borderColor: string;
  mutedText: string;
  textColor: string;
}) {
  const [onlyMoves, setOnlyMoves] = useState(false);
  const moved = (r: LedgerRow) =>
    r.fullSubscriberDelta !== 0 || r.freeTrialDelta !== 0 || r.trialGraceDelta !== 0;
  const rows = onlyMoves ? ledger.rows.filter(moved) : ledger.rows;
  const net = ledger.net.fullSubscriber;

  return (
    <div className="rounded-lg p-4" style={{ background: cardBg, border: `1px solid ${borderColor}` }}>
      <div className="flex items-baseline justify-between flex-wrap gap-2 mb-3">
        <span className="text-sm" style={{ color: textColor }}>
          Full Subscribers moved{' '}
          <span
            className="font-semibold tabular-nums"
            style={{ color: net >= 0 ? CONVEYOR_COLORS.running : CONVEYOR_COLORS.rollingOff }}
          >
            {net >= 0 ? '+' : ''}{net}
          </span>{' '}
          over the last {ledger.windowDays} days — every row below accounts for part of it.
        </span>
        <button
          type="button"
          onClick={() => setOnlyMoves((v) => !v)}
          className="text-xs px-2 py-1 rounded"
          style={{
            border: `1px solid ${borderColor}`,
            color: onlyMoves ? 'var(--color-text-primary)' : mutedText,
            background: onlyMoves ? `${borderColor}33` : 'transparent',
          }}
        >
          {onlyMoves ? 'Showing count changes only' : 'Show count changes only'}
        </button>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm py-6 text-center" style={{ color: mutedText }}>
          Nothing has changed in the last {ledger.windowDays} days.
        </p>
      ) : (
        <ul>
          {rows.map((r, idx) => (
            <li
              key={`${r.at}-${r.userId ?? idx}-${r.kind}`}
              className="grid gap-3 py-2 items-start"
              style={{
                gridTemplateColumns: 'minmax(0, 5rem) minmax(0, 1fr) auto',
                borderTop: idx === 0 ? undefined : `1px solid ${borderColor}33`,
              }}
            >
              <span className="text-xs tabular-nums pt-0.5" style={{ color: mutedText }} title={r.at}>
                {formatLedgerTime(r.at, nowMs)}
              </span>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className="text-xs font-semibold px-1.5 py-0.5 rounded"
                    style={{ background: `${LEDGER_TONE[r.kind]}22`, color: LEDGER_TONE[r.kind] }}
                  >
                    {ledgerKindLabel(r.kind)}
                  </span>
                  <span className="text-xs truncate" style={{ color: textColor }} title={r.email ?? undefined}>
                    {r.email ?? r.userId ?? 'unknown member'}
                  </span>
                </div>
                <div className="text-[11px] mt-0.5" style={{ color: mutedText }}>
                  {r.detail}
                </div>
              </div>
              <div className="flex gap-1.5 flex-wrap justify-end">
                <DeltaChip label="paying" delta={r.fullSubscriberDelta} />
                <DeltaChip label="trial" delta={r.freeTrialDelta} />
                <DeltaChip label="grace" delta={r.trialGraceDelta} />
                {!moved(r) && (
                  <span className="text-[11px] px-1.5 py-0.5 rounded" style={{ color: mutedText }}>
                    no count change
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {ledger.truncated > 0 && (
        <p className="text-xs mt-3" style={{ color: mutedText }}>
          + {ledger.truncated} older change{ledger.truncated === 1 ? '' : 's'} not shown. The net above counts them all.
        </p>
      )}
    </div>
  );
}

// Paying subscribers who have already clicked Cancel. They still count as Full
// Subscribers right up to the day their access ends, so this is the one place
// that departure is visible BEFORE it lands on the chart.
function ScheduledDeparturesCard({
  departures,
  departingValue,
  nowMs,
  cardBg,
  borderColor,
  mutedText,
  textColor,
}: {
  departures: ConveyorRider[];
  departingValue: number;
  nowMs: number;
  cardBg: string;
  borderColor: string;
  mutedText: string;
  textColor: string;
}) {
  return (
    <div className="rounded-lg p-4" style={{ background: cardBg, border: `1px solid ${borderColor}` }}>
      <div className="flex items-baseline justify-between flex-wrap gap-2">
        <span className="text-sm" style={{ color: textColor }}>
          {departures.length === 0 ? (
            'No paying subscriber has a cancellation scheduled.'
          ) : (
            <>
              <span className="font-semibold tabular-nums">{departures.length}</span> paying subscriber
              {departures.length === 1 ? '' : 's'} will drop off when their period ends
            </>
          )}
        </span>
        {departures.length > 0 && (
          <span className="text-xs" style={{ color: mutedText }}>
            {formatUsd(departingValue)}/mo leaving
          </span>
        )}
      </div>

      {departures.length > 0 && (
        <ul className="mt-3">
          {departures.map((d, idx) => (
            <li
              key={d.userId}
              className="grid gap-3 py-2 items-center"
              style={{
                gridTemplateColumns: 'minmax(0, 1fr) auto',
                borderTop: idx === 0 ? undefined : `1px solid ${borderColor}33`,
              }}
            >
              <div className="min-w-0">
                <div className="text-xs truncate" style={{ color: textColor }} title={d.email ?? undefined}>
                  {d.email ?? d.userId}
                </div>
                <div className="text-[11px]" style={{ color: mutedText }}>
                  {conveyorPlanLabel(d)}
                  {d.monthlyValue > 0 ? ` · ${formatUsd(d.monthlyValue)}/mo` : ''}
                </div>
              </div>
              <div className="text-right">
                <CountdownTicker
                  deadline={d.convertsAt}
                  nowMs={nowMs}
                  color={CONVEYOR_COLORS.rollingOff}
                  className="text-sm font-semibold"
                />
                <div className="text-[11px]" style={{ color: mutedText }}>
                  until access ends
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ConveyorTab({ data, cardBg, borderColor, mutedText, textColor }: DataTabProps) {
  const conveyor = data.trialConveyor;

  // One clock for the whole tab. The snapshot itself refreshes on the page's
  // 60s poll; this interval only re-renders the countdowns in between, so the
  // timers tick every second without re-fetching anything.
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const onBelt = conveyor.totals.running + conveyor.totals.rollingOff + conveyor.totals.stalled;
  // New accounts over the same trailing window the outcomes use, so the first
  // two stages of the diagram are directly comparable. signupFlow is the
  // authoritative one-row-per-account registration count (see core/monitoring).
  const registrations = useMemo(
    () =>
      data.signupFlow
        .slice(-conveyor.outcomes.windowDays)
        .reduce((sum, point) => sum + point.registrations, 0),
    [data.signupFlow, conveyor.outcomes.windowDays],
  );
  const nextRider = useMemo(
    () => conveyor.riders.find((r) => r.state === 'running' && r.convertsAt === conveyor.totals.nextConversionAt),
    [conveyor.riders, conveyor.totals.nextConversionAt],
  );

  return <div>
    <section className="mb-8">
      <div className="flex items-baseline justify-between mb-2 flex-wrap gap-2">
        <h2 className="text-lg font-semibold" style={{ color: textColor }}>The Conveyor</h2>
        <span className="text-xs" style={{ color: mutedText }}>
          Every free trial is a package on a belt. It boards at signup, rides for the trial length, and comes off the
          end as a paying subscriber — unless the member cancels (falls off) or the first charge is declined (jams at
          the gate). Timers are live.
        </span>
      </div>

      <div className="rounded-lg p-4" style={{ background: cardBg, border: `1px solid ${borderColor}` }}>
        <ConveyorPipelineDiagram conveyor={conveyor} registrations={registrations} borderColor={borderColor} mutedText={mutedText} />
      </div>
    </section>

    <section className="mb-8">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-lg p-4" style={{ background: cardBg, border: `1px solid ${borderColor}` }}>
          <div className="text-xs uppercase tracking-wide" style={{ color: mutedText }}>On the belt</div>
          <div className="text-3xl font-bold tabular-nums" style={{ color: CONVEYOR_COLORS.running }}>
            {conveyor.totals.running}
          </div>
          <div className="text-xs mt-1" style={{ color: mutedText }}>
            trials still heading for a charge
          </div>
        </div>

        <div className="rounded-lg p-4" style={{ background: cardBg, border: `1px solid ${borderColor}` }}>
          <div className="text-xs uppercase tracking-wide" style={{ color: mutedText }}>Next conversion in</div>
          <CountdownTicker
            deadline={conveyor.totals.nextConversionAt}
            nowMs={nowMs}
            color={CONVEYOR_COLORS.running}
            className="block text-3xl font-bold"
          />
          <div className="text-xs mt-1 truncate" style={{ color: mutedText }} title={nextRider?.email ?? undefined}>
            {nextRider
              ? `${nextRider.email ?? nextRider.userId} · ${conveyorPlanLabel(nextRider)}`
              : conveyor.totals.nextConversionAt
                ? 'next trial due'
                : 'nothing due'}
          </div>
        </div>

        <div className="rounded-lg p-4" style={{ background: cardBg, border: `1px solid ${borderColor}` }}>
          <div className="text-xs uppercase tracking-wide" style={{ color: mutedText }}>Coming off the belt</div>
          <div className="text-3xl font-bold tabular-nums" style={{ color: ROW_COLORS.mrr }}>
            {formatUsd(conveyor.totals.beltValue)}
          </div>
          <div className="text-xs mt-1" style={{ color: mutedText }}>
            new MRR if every running trial converts
          </div>
        </div>

        <div className="rounded-lg p-4" style={{ background: cardBg, border: `1px solid ${borderColor}` }}>
          <div className="text-xs uppercase tracking-wide" style={{ color: mutedText }}>Falling off / jammed</div>
          <div className="text-3xl font-bold tabular-nums" style={{ color: CONVEYOR_COLORS.rollingOff }}>
            {conveyor.totals.rollingOff + conveyor.totals.stalled}
          </div>
          <div className="text-xs mt-1" style={{ color: mutedText }}>
            {conveyor.totals.rollingOff} canceled · {conveyor.totals.stalled} declined ·{' '}
            {formatUsd(conveyor.totals.atRiskValue)}/mo at risk
          </div>
        </div>
      </div>
    </section>

    <section className="mb-8">
      <div className="flex items-baseline justify-between mb-2 flex-wrap gap-2">
        <h2 className="text-lg font-semibold" style={{ color: textColor }}>Trials In Flight</h2>
        <span className="text-xs" style={{ color: mutedText }}>
          Soonest charge first. Each lane is one trial&apos;s own run — left edge is the day it started, right edge is
          its first charge — so a {conveyor.trialDays}-day trial and a longer reactivation trial compare directly.
        </span>
      </div>

      <div className="rounded-lg p-4" style={{ background: cardBg, border: `1px solid ${borderColor}` }}>
        <div className="flex items-center gap-4 flex-wrap text-xs mb-1" style={{ color: mutedText }}>
          {(['running', 'rollingOff', 'stalled'] as const).map((state) => (
            <span key={state} className="inline-flex items-center gap-1.5">
              <span
                className="h-3 w-3 rounded-sm"
                style={{
                  background: state === 'rollingOff' ? 'transparent' : CONVEYOR_COLORS[state],
                  border: `2px solid ${CONVEYOR_COLORS[state]}`,
                }}
              />
              {CONVEYOR_STATE_LABEL[state]}
            </span>
          ))}
        </div>

        {conveyor.riders.length === 0 ? (
          <p className="text-sm py-6 text-center" style={{ color: mutedText }}>
            The belt is empty — no free trials in flight right now.
          </p>
        ) : (
          <>
            <div
              className="grid gap-3 text-[11px] uppercase tracking-wide pt-2"
              style={{ gridTemplateColumns: 'minmax(0, 13rem) minmax(0, 1fr) auto', color: mutedText }}
            >
              <span>Member</span>
              <span className="flex justify-between">
                <span>Trial starts</span>
                <span>First charge</span>
              </span>
              <span className="text-right">d:hh:mm:ss</span>
            </div>
            <ul>
              {conveyor.riders.map((r) => (
                <ConveyorLane
                  key={r.userId}
                  rider={r}
                  nowMs={nowMs}
                  borderColor={borderColor}
                  mutedText={mutedText}
                  textColor={textColor}
                />
              ))}
            </ul>
            {conveyor.truncated > 0 && (
              <p className="text-xs mt-3" style={{ color: mutedText }}>
                + {conveyor.truncated} more trial{conveyor.truncated === 1 ? '' : 's'} on the belt, not shown. The
                counts above include all {onBelt}.
              </p>
            )}
          </>
        )}
      </div>
    </section>

    <section className="mb-8">
      <div className="flex items-baseline justify-between mb-2 flex-wrap gap-2">
        <h2 className="text-lg font-semibold" style={{ color: textColor }}>Leaving Next</h2>
        <span className="text-xs" style={{ color: mutedText }}>
          Paying members who already clicked Cancel. They still count as Full Subscribers until their period ends —
          this is where that drop is visible before it lands.
        </span>
      </div>
      <ScheduledDeparturesCard
        departures={conveyor.departures}
        departingValue={conveyor.departingValue}
        nowMs={nowMs}
        cardBg={cardBg}
        borderColor={borderColor}
        mutedText={mutedText}
        textColor={textColor}
      />
    </section>

    <section className="mb-8">
      <div className="flex items-baseline justify-between mb-2 flex-wrap gap-2">
        <h2 className="text-lg font-semibold" style={{ color: textColor }}>Subscriber Ledger</h2>
        <span className="text-xs" style={{ color: mutedText }}>
          Every change to the subscriber counts, newest first — who it was, what happened, and exactly what it did to
          each line of the Total Subscribers chart.
        </span>
      </div>
      <SubscriberLedgerCard
        ledger={data.subscriberLedger}
        nowMs={nowMs}
        cardBg={cardBg}
        borderColor={borderColor}
        mutedText={mutedText}
        textColor={textColor}
      />
    </section>

    <section className="mb-8">
      <TrialOutcomesCard
        outcomes={conveyor.outcomes}
        cardBg={cardBg}
        borderColor={borderColor}
        mutedText={mutedText}
        textColor={textColor}
      />
    </section>
  </div>;
}

function GrowthRateCard({ rates, cardBg, borderColor, mutedText, textColor }: { rates: GrowthRatePoint[]; cardBg: string; borderColor: string; mutedText: string; textColor: string }) {
  return (
    <div className="rounded-lg p-4 lg:col-span-2" style={{ backgroundColor: cardBg }}>
      <div className="mb-3">
        <h3 className="zg-h3" style={{ color: textColor }}>Forward-Looking Growth Rate</h3>
        <p className="text-xs" style={{ color: mutedText }}>Trial starts minus cancellation clicks (net of win-backs) and first payment failures. Rate is net growth per day over each trailing window.</p>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {rates.map((rate) => (
          <div key={rate.days} className="rounded-lg p-3" style={{ border: `1px solid ${borderColor}55` }}>
            <div className="text-xs uppercase tracking-wide" style={{ color: mutedText }}>{rate.days}-day</div>
            <div className="text-2xl font-semibold tabular-nums" style={{ color: rate.net >= 0 ? '#2c8c6a' : '#c1435b' }}>{rate.dailyRate >= 0 ? '+' : ''}{rate.dailyRate.toFixed(2)}/day</div>
            <div className="text-xs mt-1 tabular-nums" style={{ color: mutedText }}>{rate.signups} signups − {rate.cancellations} cancels − {rate.paymentFailures} failures = {rate.net >= 0 ? '+' : ''}{rate.net}</div>
          </div>
        ))}
      </div>
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
  signupsPerDay,
  blendedListPrice,
  targetMrr,
  cardBg,
  axisStroke,
  mutedText,
  textColor,
  brandColor,
}: {
  series: MrrPoint[];
  signupsPerDay: number;
  blendedListPrice: number;
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

  // Straight-line extrapolation off today's real MRR, grown at the 30-day net
  // signup rate valued at the blended full (list) price of today's plan mix —
  // not off the recent MRR slope, which reads steep early on while launch
  // discounts still dominate. Recomputed only when its inputs change.
  const projection = useMemo(
    () =>
      buildSignupImpliedMrrProjection({
        series,
        signupsPerDay,
        blendedMonthlyPrice: blendedListPrice,
        horizonMonths,
      }),
    [series, signupsPerDay, blendedListPrice, horizonMonths],
  );
  const monthsToTarget = useMemo(
    () => projectionMonthsToTarget(projection, targetMrr),
    [projection, targetMrr],
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
          Projected pace:{' '}
          <span className="font-semibold tabular-nums" style={{ color: textColor }}>
            {slopeLabel}
          </span>{' '}
          <span style={{ color: mutedText }}>(30-day signup rate × blended list price)</span>
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
            {projection ? formatMonths(monthsToTarget) : '—'}
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

// The "why" behind recent cancellations. A per-reason tally with proportional
// bars plus the free-text verbatims — the qualitative companion to the growth-
// rate "how many". Silent cancels (no survey answer) sink to a muted row, and a
// zero-capture state points at the enablement command so the panel is
// self-explaining when reason collection hasn't been turned on yet.
function CancellationReasonsCard({
  reasons,
  cardBg,
  borderColor,
  mutedText,
  textColor,
}: {
  reasons: CancellationReasonsSummary;
  cardBg: string;
  borderColor: string;
  mutedText: string;
  textColor: string;
}) {
  const maxCount = reasons.byFeedback.reduce((m, r) => Math.max(m, r.count), 0);
  const coverage = reasons.total > 0 ? Math.round((reasons.captured / reasons.total) * 100) : 0;
  return (
    <div className="rounded-lg p-4" style={{ background: cardBg, border: `1px solid ${borderColor}` }}>
      <div className="flex items-baseline justify-between flex-wrap gap-2">
        <span className="text-sm" style={{ color: textColor }}>
          {reasons.total > 0 ? (
            <>
              <span className="font-semibold tabular-nums">{reasons.captured}</span> of{' '}
              <span className="font-semibold tabular-nums">{reasons.total}</span> cancellations gave a reason
            </>
          ) : (
            'No cancellations in the window'
          )}
        </span>
        <span className="text-xs" style={{ color: mutedText }}>
          last {reasons.windowDays} days · {coverage}% coverage
        </span>
      </div>

      {reasons.total > 0 && reasons.captured === 0 && (
        <p className="mt-3 text-xs" style={{ color: mutedText }}>
          No reasons captured yet — the Stripe billing-portal cancellation survey is likely off. Enable it with{' '}
          <code style={{ color: textColor }}>make enable-portal-cancel-reasons</code> so future cancels record a why.
        </p>
      )}

      {reasons.byFeedback.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {reasons.byFeedback.map((row) => {
            const isNone = row.feedback === 'none';
            const width = maxCount > 0 ? Math.max(2, Math.round((row.count / maxCount) * 100)) : 0;
            return (
              <li key={row.feedback} className="flex items-center gap-3" style={{ opacity: isNone ? 0.55 : 1 }}>
                <span className="text-xs w-40 shrink-0 truncate" style={{ color: textColor }} title={row.label}>
                  {row.label}
                </span>
                <span className="flex-1 h-3 rounded" style={{ background: `${borderColor}33` }}>
                  <span
                    className="block h-3 rounded"
                    style={{ width: `${width}%`, background: isNone ? `${borderColor}88` : ROW_COLORS.webhookHealth }}
                  />
                </span>
                <span className="text-xs tabular-nums w-8 text-right" style={{ color: mutedText }}>
                  {row.count}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {reasons.recentComments.length > 0 && (
        <div className="mt-4">
          <h3 className="text-sm font-semibold mb-2" style={{ color: textColor }}>
            Recent comments
          </h3>
          <ul className="space-y-2">
            {reasons.recentComments.map((c, idx) => (
              <li
                key={`${c.createdAt}-${idx}`}
                className="rounded p-2 text-xs"
                style={{
                  border: `1px solid ${borderColor}55`,
                  fontFamily: 'var(--font-mono, ui-monospace, SFMono-Regular, monospace)',
                }}
              >
                <div style={{ color: mutedText }}>
                  {c.createdAt.slice(0, 10)}
                  {c.feedback ? ` · ${c.feedback}` : ''}
                  {c.email ? ` · ${c.email}` : ''}
                </div>
                <div className="mt-1 whitespace-pre-wrap break-words" style={{ color: textColor }}>
                  {c.comment}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
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
  const dayLabel = useMemo(() => makeDayLabelFormatter(data.map((p) => p.day)), [data]);
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
                tickFormatter={dayLabel}
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
                      <div className="font-semibold mb-1">{dayLabel(String(label))}</div>
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

// What the dashed projection is and, just as importantly, what it leaves out.
function projectionTitle(projection: SubscriberProjection): string {
  const base =
    `Committed projection: today's ${projection.anchorPaying} full subscribers, plus trials already scheduled ` +
    `to be charged over the next ${projection.horizonDays} days, minus members whose cancellation takes effect ` +
    `in that window. No new signups are assumed.`;
  return projection.undecidedStalled > 0
    ? `${base} ${projection.undecidedStalled} trial${projection.undecidedStalled === 1 ? '' : 's'} retrying a declined charge are excluded as undecided.`
    : base;
}

type TotalSubscribersChartCardProps = {
  projection: SubscriberProjection;
  data: SignupPoint[];
  cardBg: string;
  axisStroke: string;
  mutedText: string;
  yScale: { max: number; ticks: number[] };
};

// Subscribers with access, split into Full Subscriber (active, plus established
// payers riding out a renewal-failure grace window), Free Trial (trialing), and
// Trial Grace — a lapsed trial whose first conversion charge was declined and
// which is inside the bounded payment-recovery window while Stripe retries.
// Trial Grace stacks on top: it's the at-risk band, subscribers today who have
// never completed a payment. One total — Total Subscribers — in the header.
function TotalSubscribersChartCard({ data, projection, cardBg, axisStroke, mutedText, yScale }: TotalSubscribersChartCardProps) {
  const payingColor = '#ff8531';
  const trialingColor = '#ffa600';
  const graceTrialColor = '#ffd380';
  const graceTrialTitle =
    'Free trial ended, the first subscription charge failed, and access is retained during the bounded payment-recovery grace window while Stripe retries the card.';
  const projectedColor = '#2c8c6a';
  const latest = data.length > 0 ? data[data.length - 1] : { paying: 0, trialing: 0, graceTrial: 0 };
  const totalSubscribers = latest.paying + latest.trialing + latest.graceTrial;

  // Actual days, then the projected ones appended. The anchor day carries BOTH
  // its real `paying` value and the same value as `projectedPaying`, which is
  // what makes the dashed line start ON the solid line instead of a day away
  // from it. Projected rows leave the stacked areas undefined so those simply
  // stop at today rather than collapsing to zero.
  const chartData = useMemo(() => {
    const rows: Array<Record<string, number | string | undefined>> = data.map((p) => ({ ...p }));
    if (rows.length > 0 && projection.points.length > 0) {
      rows[rows.length - 1] = { ...rows[rows.length - 1], projectedPaying: projection.anchorPaying };
    }
    for (const p of projection.points) rows.push({ day: p.day, projectedPaying: p.projected });
    return rows;
  }, [data, projection]);

  const projectionByDay = useMemo(
    () => new Map(projection.points.map((p) => [p.day, p])),
    [projection.points],
  );
  const projectedEnd = projection.points.length > 0 ? projection.points[projection.points.length - 1] : null;
  const projectedNet = projectedEnd ? projectedEnd.projected - projection.anchorPaying : 0;
  const dayLabel = useMemo(() => makeDayLabelFormatter(chartData.map((p) => String(p.day))), [chartData]);
  return (
    <div className="rounded-lg p-4" style={{ backgroundColor: cardBg }}>
      <div className="flex items-baseline justify-between mb-2 flex-wrap gap-2">
        <h3 className="zg-h3" style={{ color: axisStroke }}>Total Subscribers</h3>
        <div className="flex items-center gap-4 text-xs" style={{ color: mutedText }}>
          <span><span style={{ color: payingColor }}>●</span> Full Subscriber: {latest.paying.toLocaleString()}</span>
          <span><span style={{ color: trialingColor }}>●</span> Free Trial: {latest.trialing.toLocaleString()}</span>
          <span title={graceTrialTitle}><span style={{ color: graceTrialColor }}>●</span> Trial Grace: {latest.graceTrial.toLocaleString()}</span>
          <span>Total Subscribers: {totalSubscribers.toLocaleString()}</span>
          {projectedEnd && (
            <span title={projectionTitle(projection)}>
              <span style={{ color: projectedColor }}>⇢</span> {projection.horizonDays}d projection:{' '}
              {projectedEnd.projected.toLocaleString()} ({projectedNet >= 0 ? '+' : ''}{projectedNet})
            </span>
          )}
        </div>
      </div>
      {data.length === 0 ? (
        <div className="text-sm py-12 text-center" style={{ color: mutedText }}>No subscriber data captured yet.</div>
      ) : (
        <MobileScrollableChart>
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
              <CartesianGrid strokeOpacity={0.1} vertical={false} />
              <XAxis
                dataKey="day"
                stroke={axisStroke}
                tick={{ fill: axisStroke, fontSize: 10 }}
                tickLine={false}
                minTickGap={40}
                tickFormatter={dayLabel}
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
                  // A projected day has no observed values — show what the
                  // projection is made of instead of three misleading zeros.
                  const proj = projectionByDay.get(String(label));
                  if (proj) {
                    return (
                      <div
                        className="rounded-lg border px-3 py-2 text-xs"
                        style={{ backgroundColor: 'var(--color-chart-tooltip-bg)', borderColor: 'var(--color-border)', color: 'var(--color-chart-tooltip-text)' }}
                      >
                        <div className="font-semibold mb-1">{dayLabel(String(label))} · projected</div>
                        <div>Full Subscriber: {proj.projected.toLocaleString()}</div>
                        <div style={{ opacity: 0.8 }}>
                          {proj.conversions > 0 ? `+${proj.conversions} trial${proj.conversions === 1 ? '' : 's'} converting` : 'no conversions due'}
                        </div>
                        <div style={{ opacity: 0.8 }}>
                          {proj.departures > 0 ? `−${proj.departures} cancellation${proj.departures === 1 ? '' : 's'} taking effect` : 'no cancellations due'}
                        </div>
                      </div>
                    );
                  }
                  const paying = Number(payload.find((p) => p.dataKey === 'paying')?.value ?? 0);
                  const trialing = Number(payload.find((p) => p.dataKey === 'trialing')?.value ?? 0);
                  const graceTrial = Number(payload.find((p) => p.dataKey === 'graceTrial')?.value ?? 0);
                  return (
                    <div
                      className="rounded-lg border px-3 py-2 text-xs"
                      style={{ backgroundColor: 'var(--color-chart-tooltip-bg)', borderColor: 'var(--color-border)', color: 'var(--color-chart-tooltip-text)' }}
                    >
                      <div className="font-semibold mb-1">{dayLabel(String(label))}</div>
                      <div>Full Subscriber: {paying.toLocaleString()}</div>
                      <div>Free Trial: {trialing.toLocaleString()}</div>
                      <div>Trial Grace: {graceTrial.toLocaleString()}</div>
                      <div className="mt-1">Total Subscribers: {(paying + trialing + graceTrial).toLocaleString()}</div>
                    </div>
                  );
                }}
              />
              <Line
                type="monotone"
                dataKey="projectedPaying"
                name={`Full Subscriber (${projection.horizonDays}d projection)`}
                stroke={projectedColor}
                strokeWidth={2}
                strokeDasharray="5 4"
                dot={false}
                // The anchor day is the only point on both lines; without this
                // the dashed run would break at the seam.
                connectNulls
                isAnimationActive={false}
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
              <Area
                type="monotone"
                dataKey="graceTrial"
                name="Trial Grace"
                stackId="subscribers"
                stroke={graceTrialColor}
                fill={graceTrialColor}
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

type SubscriptionFlowChartCardProps = {
  data: SignupFlowPoint[];
  cardBg: string;
  axisStroke: string;
  mutedText: string;
  brandColor: string;
};

// Per-day paid-subscription flow with a net-onboards line overlaid. Basic/Pro
// new conversions and reactivations stack above the x-axis; below it sit the two
// net-negative churn causes — voluntary cancellations and involuntary
// payment-failure downgrades (each user's own Stripe sub — no public tier). New
// adds are the signups brand (blue) family, reactivations (subs recovered out of
// dunning) a green family, cancels a bear-red family, payment-failure downgrades
// a purple family, tier the shade within. The net line (adds + reactivations −
// cancels − payment fails for the day) rides the same primary axis as the bars,
// sharing their zero baseline so it reads directly against the columns it
// summarizes.
function SubscriptionFlowChartCard({ data, cardBg, axisStroke, mutedText, brandColor }: SubscriptionFlowChartCardProps) {
  const proAddColor = brandColor;
  const basicAddColor = lighten(brandColor, 0.45);
  // Reactivations (payment recovered — a sub climbing back out of dunning) are
  // net-positive like adds but a distinct source, so they get their own (green)
  // family stacked above the new-add columns.
  const reactivateBase = '#2a9d8f';
  const proReactivateColor = reactivateBase;
  const basicReactivateColor = lighten(reactivateBase, 0.4);
  const cancelBase = '#c1435b';
  const proCancelColor = cancelBase;
  const basicCancelColor = lighten(cancelBase, 0.35);
  // Payment-failure downgrades are also net-negative but a distinct cause, so
  // they get their own (purple) family below the red cancellation columns.
  const paymentFailBase = '#7a5195';
  const proPaymentFailColor = paymentFailBase;
  const basicPaymentFailColor = lighten(paymentFailBase, 0.4);
  // Bright accent so the net line reads clearly in front of the add / cancel /
  // payment-failure columns.
  const netColor = '#ffa600';

  const totals = useMemo(() => {
    let proAdd = 0;
    let basicAdd = 0;
    let proReactivate = 0;
    let basicReactivate = 0;
    let proCancel = 0;
    let basicCancel = 0;
    let proPaymentFail = 0;
    let basicPaymentFail = 0;
    for (const p of data) {
      proAdd += p.proAdd;
      basicAdd += p.basicAdd;
      proReactivate += p.proReactivate;
      basicReactivate += p.basicReactivate;
      proCancel += p.proCancel;
      basicCancel += p.basicCancel;
      proPaymentFail += p.proPaymentFail;
      basicPaymentFail += p.basicPaymentFail;
    }
    // Cancels and payment-fails are stored negative, so net onboards is the
    // straight algebraic sum of all eight flows (adds + reactivations are
    // positive, cancels + payment-fails negative).
    return {
      proAdd,
      basicAdd,
      proReactivate,
      basicReactivate,
      proCancel,
      basicCancel,
      proPaymentFail,
      basicPaymentFail,
      net:
        proAdd + basicAdd + proReactivate + basicReactivate +
        proCancel + basicCancel + proPaymentFail + basicPaymentFail,
    };
  }, [data]);

  // Net onboards per day: adds + reactivations minus cancels minus
  // payment-failure downgrades. Cancels and payment-fails are stored negative, so
  // it's the plain sum of the eight flow fields, and it always lands within the
  // bars' own domain (a day's net ≤ its combined positives and ≥ its combined
  // negatives), so it shares the primary axis instead of needing one of its own.
  const chartData = useMemo(
    () =>
      data.map((p) => ({
        ...p,
        net:
          p.proAdd + p.basicAdd + p.proReactivate + p.basicReactivate +
          p.proCancel + p.basicCancel + p.proPaymentFail + p.basicPaymentFail,
      })),
    [data],
  );

  // One axis for both the diverging bars and the net line, scaled just to the
  // paid add stack (above the zero baseline) and the combined cancel +
  // payment-failure stack (below it) so the columns stay legible.
  const barScale = useMemo(() => {
    const barPosBound = data.reduce(
      (m, p) => Math.max(m, p.proAdd + p.basicAdd + p.proReactivate + p.basicReactivate),
      0,
    );
    const barNegBound = data.reduce(
      (m, p) => Math.max(m, -(p.proCancel + p.basicCancel + p.proPaymentFail + p.basicPaymentFail)),
      0,
    );
    // Both halves of the diverging axis share ONE tick interval so the negative
    // labels step by the same amount as the positive ones (e.g. both by 5). The
    // larger side sets the "nice" step (and keeps niceYScale's own padded max);
    // the smaller side just rounds its bound up to that same step. Scaling each
    // side independently used to let niceYScale pick a finer step for the
    // smaller bound — a big positive bound got step 5 while a small negative
    // bound got step 1, so the two halves stepped by different amounts.
    const posDominant = barPosBound >= barNegBound;
    const nice = niceYScale(Math.max(barPosBound, barNegBound));
    const step = nice.ticks.length > 1 ? nice.ticks[1] - nice.ticks[0] : nice.max || 1;
    const roundToStep = (bound: number) => {
      const max = Math.ceil(bound / step) * step;
      const ticks: number[] = [];
      for (let v = step; v <= max + 1e-9; v += step) ticks.push(Math.round(v));
      return { max, ticks };
    };
    const niceSide = { max: nice.max, ticks: nice.ticks.filter((t) => t > 0) };
    const pos = posDominant ? niceSide : roundToStep(barPosBound);
    const neg = barNegBound > 0 ? (posDominant ? roundToStep(barNegBound) : niceSide) : { max: 0, ticks: [] as number[] };
    const barTicks = [...neg.ticks.map((t) => -t).reverse(), 0, ...pos.ticks];
    return { min: -neg.max, max: pos.max, ticks: barTicks };
  }, [data]);

  const hasData = useMemo(
    () =>
      data.some(
        (p) =>
          p.proAdd !== 0 ||
          p.basicAdd !== 0 ||
          p.proReactivate !== 0 ||
          p.basicReactivate !== 0 ||
          p.proCancel !== 0 ||
          p.basicCancel !== 0 ||
          p.proPaymentFail !== 0 ||
          p.basicPaymentFail !== 0,
      ),
    [data],
  );
  const signed = (n: number) => `${n > 0 ? '+' : ''}${n.toLocaleString()}`;
  const dayLabel = useMemo(() => makeDayLabelFormatter(data.map((p) => p.day)), [data]);

  return (
    <div className="rounded-lg p-4" style={{ backgroundColor: cardBg }}>
      <div className="flex items-baseline justify-between mb-2 flex-wrap gap-2">
        <h3 className="zg-h3" style={{ color: axisStroke }}>Subscription Flow</h3>
        <div className="flex items-center gap-x-4 gap-y-1 text-xs flex-wrap" style={{ color: mutedText }}>
          <span><span style={{ color: netColor }}>▬</span> Net onboards: {signed(totals.net)}</span>
          <span><span style={{ color: proAddColor }}>●</span> Pro adds: {totals.proAdd.toLocaleString()}</span>
          <span><span style={{ color: basicAddColor }}>●</span> Basic adds: {totals.basicAdd.toLocaleString()}</span>
          <span><span style={{ color: proReactivateColor }}>●</span> Pro reactivations: {totals.proReactivate.toLocaleString()}</span>
          <span><span style={{ color: basicReactivateColor }}>●</span> Basic reactivations: {totals.basicReactivate.toLocaleString()}</span>
          <span><span style={{ color: proCancelColor }}>●</span> Pro cancels: {Math.abs(totals.proCancel).toLocaleString()}</span>
          <span><span style={{ color: basicCancelColor }}>●</span> Basic cancels: {Math.abs(totals.basicCancel).toLocaleString()}</span>
          <span><span style={{ color: proPaymentFailColor }}>●</span> Pro payment fails: {Math.abs(totals.proPaymentFail).toLocaleString()}</span>
          <span><span style={{ color: basicPaymentFailColor }}>●</span> Basic payment fails: {Math.abs(totals.basicPaymentFail).toLocaleString()}</span>
        </div>
      </div>
      {!hasData ? (
        <div className="text-sm py-12 text-center" style={{ color: mutedText }}>No subscription activity captured yet.</div>
      ) : (
        <MobileScrollableChart>
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 8 }} stackOffset="sign">
              <CartesianGrid strokeOpacity={0.1} vertical={false} />
              <XAxis
                dataKey="day"
                stroke={axisStroke}
                tick={{ fill: axisStroke, fontSize: 10 }}
                tickLine={false}
                minTickGap={40}
                tickFormatter={dayLabel}
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
              <ReferenceLine yAxisId="flow" y={0} stroke={axisStroke} strokeOpacity={0.35} />
              <Tooltip
                cursor={{ fill: 'var(--color-text-primary)', fillOpacity: 0.08 }}
                content={({ active, label, payload }) => {
                  if (!active || !payload?.length) return null;
                  const num = (key: string) => Number(payload.find((p) => p.dataKey === key)?.value ?? 0);
                  const proAdd = num('proAdd');
                  const basicAdd = num('basicAdd');
                  const proReactivate = num('proReactivate');
                  const basicReactivate = num('basicReactivate');
                  const proCancel = num('proCancel');
                  const basicCancel = num('basicCancel');
                  const proPaymentFail = num('proPaymentFail');
                  const basicPaymentFail = num('basicPaymentFail');
                  const net =
                    proAdd + basicAdd + proReactivate + basicReactivate +
                    proCancel + basicCancel + proPaymentFail + basicPaymentFail;
                  return (
                    <div
                      className="rounded-lg border px-3 py-2 text-xs"
                      style={{ backgroundColor: 'var(--color-chart-tooltip-bg)', borderColor: 'var(--color-border)', color: 'var(--color-chart-tooltip-text)' }}
                    >
                      <div className="font-semibold mb-1">{dayLabel(String(label))}</div>
                      <div style={{ color: netColor }}>Net onboards: {signed(net)}</div>
                      <div className="mt-1" style={{ color: proAddColor }}>New signups: {signed(proAdd + basicAdd)}</div>
                      <div className="pl-2">Pro: {signed(proAdd)}</div>
                      <div className="pl-2">Basic: {signed(basicAdd)}</div>
                      <div className="mt-1" style={{ color: reactivateBase }}>Reactivations (payment recovered): {signed(proReactivate + basicReactivate)}</div>
                      <div className="pl-2">Pro: {signed(proReactivate)}</div>
                      <div className="pl-2">Basic: {signed(basicReactivate)}</div>
                      <div className="mt-1" style={{ color: cancelBase }}>Cancellations: {signed(proCancel + basicCancel)}</div>
                      <div className="pl-2">Pro: {signed(proCancel)}</div>
                      <div className="pl-2">Basic: {signed(basicCancel)}</div>
                      <div className="mt-1" style={{ color: paymentFailBase }}>Payment-failure downgrades: {signed(proPaymentFail + basicPaymentFail)}</div>
                      <div className="pl-2">Pro: {signed(proPaymentFail)}</div>
                      <div className="pl-2">Basic: {signed(basicPaymentFail)}</div>
                    </div>
                  );
                }}
              />
              <Bar yAxisId="flow" dataKey="basicAdd" name="Basic adds" stackId="flow" fill={basicAddColor} maxBarSize={28} isAnimationActive={false} />
              <Bar yAxisId="flow" dataKey="proAdd" name="Pro adds" stackId="flow" fill={proAddColor} maxBarSize={28} isAnimationActive={false} />
              <Bar yAxisId="flow" dataKey="basicReactivate" name="Basic reactivations" stackId="flow" fill={basicReactivateColor} maxBarSize={28} isAnimationActive={false} />
              <Bar yAxisId="flow" dataKey="proReactivate" name="Pro reactivations" stackId="flow" fill={proReactivateColor} maxBarSize={28} isAnimationActive={false} />
              <Bar yAxisId="flow" dataKey="basicCancel" name="Basic cancellations" stackId="flow" fill={basicCancelColor} maxBarSize={28} isAnimationActive={false} />
              <Bar yAxisId="flow" dataKey="proCancel" name="Pro cancellations" stackId="flow" fill={proCancelColor} maxBarSize={28} isAnimationActive={false} />
              <Bar yAxisId="flow" dataKey="basicPaymentFail" name="Basic payment-failure downgrades" stackId="flow" fill={basicPaymentFailColor} maxBarSize={28} isAnimationActive={false} />
              <Bar yAxisId="flow" dataKey="proPaymentFail" name="Pro payment-failure downgrades" stackId="flow" fill={proPaymentFailColor} maxBarSize={28} isAnimationActive={false} />
              <Line
                yAxisId="flow"
                type="monotone"
                dataKey="net"
                name="Net onboards"
                stroke={netColor}
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

type SubscriptionFlowByWeekdayCardProps = {
  data: SignupFlowPoint[];
  cardBg: string;
  axisStroke: string;
  mutedText: string;
  brandColor: string;
};

// The per-day Subscription Flow folded onto the seven weekdays, to surface a
// weekly rhythm the daily columns bury — e.g. a Monday signup peak that fades
// across the week. Same eight flow families, colors, and net line as the daily
// chart, but one column per weekday (Mon→Sun). The Avg/Total toggle switches
// between the mean per occurrence of that weekday — the fair comparison, since a
// window doesn't hold each weekday an equal number of times — and the raw sums.
function SubscriptionFlowByWeekdayCard({ data, cardBg, axisStroke, mutedText, brandColor }: SubscriptionFlowByWeekdayCardProps) {
  // Colors identical to SubscriptionFlowChartCard so the two read as one system.
  const proAddColor = brandColor;
  const basicAddColor = lighten(brandColor, 0.45);
  const reactivateBase = '#2a9d8f';
  const proReactivateColor = reactivateBase;
  const basicReactivateColor = lighten(reactivateBase, 0.4);
  const cancelBase = '#c1435b';
  const proCancelColor = cancelBase;
  const basicCancelColor = lighten(cancelBase, 0.35);
  const paymentFailBase = '#7a5195';
  const proPaymentFailColor = paymentFailBase;
  const basicPaymentFailColor = lighten(paymentFailBase, 0.4);
  const netColor = '#ffa600';

  const [mode, setMode] = useState<'avg' | 'total'>('avg');

  const buckets = useMemo(() => accumulateFlowByWeekday(data), [data]);
  const totalDays = useMemo(() => buckets.reduce((m, b) => m + b.days, 0), [buckets]);
  const hasData = useMemo(
    () =>
      buckets.some(
        (b) =>
          b.proAdd !== 0 ||
          b.basicAdd !== 0 ||
          b.proReactivate !== 0 ||
          b.basicReactivate !== 0 ||
          b.proCancel !== 0 ||
          b.basicCancel !== 0 ||
          b.proPaymentFail !== 0 ||
          b.basicPaymentFail !== 0,
      ),
    [buckets],
  );

  // In avg mode every count is divided by how many of that weekday the window
  // holds (b.days); totals mode plots the raw sums. Cancels and payment-fails are
  // stored negative, so they keep stacking below the zero baseline either way.
  const chartData = useMemo(
    () =>
      buckets.map((b) => {
        const denom = mode === 'avg' ? b.days || 1 : 1;
        const v = (n: number) => n / denom;
        const proAdd = v(b.proAdd);
        const basicAdd = v(b.basicAdd);
        const proReactivate = v(b.proReactivate);
        const basicReactivate = v(b.basicReactivate);
        const proCancel = v(b.proCancel);
        const basicCancel = v(b.basicCancel);
        const proPaymentFail = v(b.proPaymentFail);
        const basicPaymentFail = v(b.basicPaymentFail);
        return {
          label: b.label,
          days: b.days,
          proAdd,
          basicAdd,
          proReactivate,
          basicReactivate,
          proCancel,
          basicCancel,
          proPaymentFail,
          basicPaymentFail,
          net:
            proAdd + basicAdd + proReactivate + basicReactivate +
            proCancel + basicCancel + proPaymentFail + basicPaymentFail,
        };
      }),
    [buckets, mode],
  );

  // One diverging axis for both the stacked bars and the net line: the positive
  // half spans the add + reactivation stack, the negative half the cancel +
  // payment-fail stack, sharing a single tick step so both sides step evenly.
  const barScale = useMemo(() => {
    const posBound = chartData.reduce(
      (m, p) => Math.max(m, p.proAdd + p.basicAdd + p.proReactivate + p.basicReactivate),
      0,
    );
    const negBound = chartData.reduce(
      (m, p) => Math.max(m, -(p.proCancel + p.basicCancel + p.proPaymentFail + p.basicPaymentFail)),
      0,
    );
    const nice = niceYScale(Math.max(posBound, negBound, 1));
    const step = nice.ticks.length > 1 ? nice.ticks[1] - nice.ticks[0] : nice.max || 1;
    const posTicks = nice.ticks.filter((t) => t > 0);
    const negMax = negBound > 0 ? Math.ceil(negBound / step) * step : 0;
    const negTicks: number[] = [];
    for (let t = step; t <= negMax + 1e-9; t += step) negTicks.push(t);
    const ticks = [...negTicks.map((t) => -t).reverse(), 0, ...posTicks];
    return { min: -negMax, max: nice.max, ticks };
  }, [chartData]);

  // Number formatting: averages read to one decimal (a weekday can average 2.4
  // signups/day); totals are whole counts.
  const fmt = (n: number) => (mode === 'avg' ? n.toFixed(1) : Math.round(n).toLocaleString());
  const fmtSigned = (n: number) => `${n > 0 ? '+' : ''}${fmt(n)}`;

  // Per-weekday breakdown rows for the table: adds/reactivations positive, churn
  // shown as its positive magnitude in its own column, net carrying the sign.
  const tableRows = useMemo(
    () =>
      buckets.map((b) => {
        const denom = mode === 'avg' ? b.days || 1 : 1;
        const v = (n: number) => n / denom;
        const newAdds = v(b.proAdd + b.basicAdd);
        const reactivations = v(b.proReactivate + b.basicReactivate);
        const cancels = v(-(b.proCancel + b.basicCancel));
        const paymentFails = v(-(b.proPaymentFail + b.basicPaymentFail));
        const net = v(
          b.proAdd + b.basicAdd + b.proReactivate + b.basicReactivate +
            b.proCancel + b.basicCancel + b.proPaymentFail + b.basicPaymentFail,
        );
        return { label: b.label, weekday: b.weekday, days: b.days, newAdds, reactivations, cancels, paymentFails, net };
      }),
    [buckets, mode],
  );

  // Data-driven read on the user's hypothesis (Monday peak, easing across the
  // week), ranked on average NEW paid signups/day so weekdays compare fairly.
  const insight = useMemo(() => {
    const avgAdds = (b: (typeof buckets)[number]) => (b.days ? (b.proAdd + b.basicAdd) / b.days : 0);
    const active = buckets.filter((b) => b.days > 0);
    if (active.length === 0) return null;
    const ranked = [...active].sort((a, b) => avgAdds(b) - avgAdds(a));
    const top = ranked[0];
    const bottom = ranked[ranked.length - 1];
    const workweek = [0, 1, 2, 3, 4].map((i) => buckets[i]);
    const haveWorkweek = workweek.every((b) => b.days > 0);
    let steps = 0;
    let downSteps = 0;
    for (let i = 1; i < workweek.length; i++) {
      if (workweek[i - 1].days > 0 && workweek[i].days > 0) {
        steps += 1;
        if (avgAdds(workweek[i]) <= avgAdds(workweek[i - 1]) + 1e-9) downSteps += 1;
      }
    }
    let trend: string;
    if (haveWorkweek && steps === 4 && downSteps === 4) {
      trend = 'New paid signups ease off at every step from Monday to Friday — the weekly slowdown you spotted.';
    } else if (steps > 0 && downSteps / steps >= 0.75) {
      trend = 'New paid signups broadly taper from Monday toward Friday, with the odd bump.';
    } else if (steps > 0) {
      trend = 'New paid signups don’t show a clean Monday→Friday decline in this window.';
    } else {
      trend = 'Not enough weekday coverage yet to read a Monday→Friday trend.';
    }
    return { top, bottom, topAvg: avgAdds(top), bottomAvg: avgAdds(bottom), trend };
  }, [buckets]);
  const topWeekday = insight?.top.weekday ?? -1;

  const WEEKDAY_FULL: Record<string, string> = {
    Mon: 'Monday',
    Tue: 'Tuesday',
    Wed: 'Wednesday',
    Thu: 'Thursday',
    Fri: 'Friday',
    Sat: 'Saturday',
    Sun: 'Sunday',
  };

  return (
    <div className="rounded-lg p-4 lg:col-span-2" style={{ backgroundColor: cardBg }}>
      <div className="flex items-baseline justify-between mb-1 flex-wrap gap-2">
        <h3 className="zg-h3" style={{ color: axisStroke }}>Subscription Flow by Weekday</h3>
        <div className="flex items-center gap-2">
          <span className="text-xs" style={{ color: mutedText }}>
            {mode === 'avg' ? 'Average per day-of-week' : 'Total over window'}
            {totalDays > 0 ? ` · ${totalDays.toLocaleString()} days` : ''}
          </span>
          <div className="inline-flex rounded-md overflow-hidden border" style={{ borderColor: 'var(--color-border)' }}>
            {(['avg', 'total'] as const).map((m) => {
              const active = mode === m;
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className="px-2 py-1 text-xs font-semibold"
                  style={{
                    backgroundColor: active ? brandColor : 'transparent',
                    color: active ? '#fff' : 'var(--color-text-secondary)',
                  }}
                >
                  {m === 'avg' ? 'Avg/day' : 'Total'}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {!hasData ? (
        <div className="text-sm py-12 text-center" style={{ color: mutedText }}>No subscription activity captured yet.</div>
      ) : (
        <>
          {insight && (
            <p className="text-xs mb-3" style={{ color: mutedText }}>
              Busiest for new paid signups:{' '}
              <span style={{ color: axisStroke, fontWeight: 600 }}>{WEEKDAY_FULL[insight.top.label]}</span>{' '}
              (avg {insight.topAvg.toFixed(1)}/day) · Quietest:{' '}
              <span style={{ color: axisStroke, fontWeight: 600 }}>{WEEKDAY_FULL[insight.bottom.label]}</span>{' '}
              (avg {insight.bottomAvg.toFixed(1)}/day). {insight.trend}
            </p>
          )}
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1 min-w-0">
              <MobileScrollableChart>
                <ResponsiveContainer width="100%" height={280}>
                  <ComposedChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 8 }} stackOffset="sign">
                    <CartesianGrid strokeOpacity={0.1} vertical={false} />
                    <XAxis
                      dataKey="label"
                      stroke={axisStroke}
                      tick={{ fill: axisStroke, fontSize: 11 }}
                      tickLine={false}
                      interval={0}
                    />
                    <YAxis
                      yAxisId="flow"
                      stroke={axisStroke}
                      tick={{ fill: axisStroke, fontSize: 10 }}
                      tickLine={false}
                      allowDecimals={mode === 'avg'}
                      domain={[barScale.min, barScale.max]}
                      ticks={barScale.ticks}
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
                        const proReactivate = num('proReactivate');
                        const basicReactivate = num('basicReactivate');
                        const proCancel = num('proCancel');
                        const basicCancel = num('basicCancel');
                        const proPaymentFail = num('proPaymentFail');
                        const basicPaymentFail = num('basicPaymentFail');
                        const net =
                          proAdd + basicAdd + proReactivate + basicReactivate +
                          proCancel + basicCancel + proPaymentFail + basicPaymentFail;
                        const row = chartData.find((r) => r.label === label);
                        return (
                          <div
                            className="rounded-lg border px-3 py-2 text-xs"
                            style={{ backgroundColor: 'var(--color-chart-tooltip-bg)', borderColor: 'var(--color-border)', color: 'var(--color-chart-tooltip-text)' }}
                          >
                            <div className="font-semibold mb-1">
                              {WEEKDAY_FULL[String(label)] ?? label}
                              <span style={{ color: mutedText, fontWeight: 400 }}>
                                {' '}· {mode === 'avg' ? `avg/day over ${row?.days ?? 0}` : `total over ${row?.days ?? 0}`} {(row?.days ?? 0) === 1 ? 'day' : 'days'}
                              </span>
                            </div>
                            <div style={{ color: netColor }}>Net onboards: {fmtSigned(net)}</div>
                            <div className="mt-1" style={{ color: proAddColor }}>New signups: {fmtSigned(proAdd + basicAdd)}</div>
                            <div className="pl-2">Pro: {fmtSigned(proAdd)}</div>
                            <div className="pl-2">Basic: {fmtSigned(basicAdd)}</div>
                            <div className="mt-1" style={{ color: reactivateBase }}>Reactivations: {fmtSigned(proReactivate + basicReactivate)}</div>
                            <div className="mt-1" style={{ color: cancelBase }}>Cancellations: {fmtSigned(proCancel + basicCancel)}</div>
                            <div className="mt-1" style={{ color: paymentFailBase }}>Payment-failure downgrades: {fmtSigned(proPaymentFail + basicPaymentFail)}</div>
                          </div>
                        );
                      }}
                    />
                    <Bar yAxisId="flow" dataKey="basicAdd" name="Basic adds" stackId="flow" fill={basicAddColor} maxBarSize={44} isAnimationActive={false} />
                    <Bar yAxisId="flow" dataKey="proAdd" name="Pro adds" stackId="flow" fill={proAddColor} maxBarSize={44} isAnimationActive={false} />
                    <Bar yAxisId="flow" dataKey="basicReactivate" name="Basic reactivations" stackId="flow" fill={basicReactivateColor} maxBarSize={44} isAnimationActive={false} />
                    <Bar yAxisId="flow" dataKey="proReactivate" name="Pro reactivations" stackId="flow" fill={proReactivateColor} maxBarSize={44} isAnimationActive={false} />
                    <Bar yAxisId="flow" dataKey="basicCancel" name="Basic cancellations" stackId="flow" fill={basicCancelColor} maxBarSize={44} isAnimationActive={false} />
                    <Bar yAxisId="flow" dataKey="proCancel" name="Pro cancellations" stackId="flow" fill={proCancelColor} maxBarSize={44} isAnimationActive={false} />
                    <Bar yAxisId="flow" dataKey="basicPaymentFail" name="Basic payment-failure downgrades" stackId="flow" fill={basicPaymentFailColor} maxBarSize={44} isAnimationActive={false} />
                    <Bar yAxisId="flow" dataKey="proPaymentFail" name="Pro payment-failure downgrades" stackId="flow" fill={proPaymentFailColor} maxBarSize={44} isAnimationActive={false} />
                    <Line
                      yAxisId="flow"
                      type="monotone"
                      dataKey="net"
                      name="Net onboards"
                      stroke={netColor}
                      strokeWidth={2.5}
                      dot={{ r: 3, fill: netColor }}
                      isAnimationActive={false}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </MobileScrollableChart>
            </div>

            <div className="lg:w-[22rem] lg:shrink-0 overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr style={{ color: mutedText }}>
                    <th className="text-left font-semibold py-1 pr-2">Day</th>
                    <th className="text-right font-semibold py-1 px-1" style={{ color: proAddColor }}>Adds</th>
                    <th className="text-right font-semibold py-1 px-1" style={{ color: reactivateBase }}>React.</th>
                    <th className="text-right font-semibold py-1 px-1" style={{ color: cancelBase }}>Cancel</th>
                    <th className="text-right font-semibold py-1 px-1" style={{ color: paymentFailBase }}>Pay-fail</th>
                    <th className="text-right font-semibold py-1 px-1" style={{ color: netColor }}>Net</th>
                    <th className="text-right font-semibold py-1 pl-1">n</th>
                  </tr>
                </thead>
                <tbody>
                  {tableRows.map((r) => {
                    const isTop = r.weekday === topWeekday;
                    return (
                      <tr key={r.label} style={{ borderTop: '1px solid var(--color-border)', color: axisStroke }}>
                        <td className="text-left py-1 pr-2" style={{ fontWeight: isTop ? 700 : 400 }}>
                          {r.label}
                        </td>
                        <td className="text-right py-1 px-1" style={{ fontWeight: isTop ? 700 : 400 }}>{r.newAdds > 0 ? fmt(r.newAdds) : '—'}</td>
                        <td className="text-right py-1 px-1">{r.reactivations > 0 ? fmt(r.reactivations) : '—'}</td>
                        <td className="text-right py-1 px-1">{r.cancels > 0 ? fmt(r.cancels) : '—'}</td>
                        <td className="text-right py-1 px-1">{r.paymentFails > 0 ? fmt(r.paymentFails) : '—'}</td>
                        <td className="text-right py-1 px-1" style={{ color: netColor }}>{fmtSigned(r.net)}</td>
                        <td className="text-right py-1 pl-1" style={{ color: mutedText }}>{r.days.toLocaleString()}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <p className="text-[11px] mt-2" style={{ color: mutedText }}>
                {mode === 'avg' ? 'Per-day average of each weekday. ' : 'Total over the window. '}
                “n” is how many of that weekday the window covers. Cancels and pay-fails shown as positive magnitudes; Net carries the sign.
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

type DailyRegistrationsChartCardProps = {
  data: SignupPoint[];
  flow: SignupFlowPoint[];
  cardBg: string;
  axisStroke: string;
  mutedText: string;
  brandColor: string;
  yScale: { max: number; ticks: number[] };
};

// Registered-user growth. Two cumulative areas share the primary (left) axis:
// total registered users (all tiers — the outer envelope) with the disclaimer-
// accepted subset filled in front of it (always ≤ total, so it reads as the
// portion of the base that has acknowledged). The daily new-account
// registration columns ride a secondary (right) axis — those per-day counts are
// far smaller than the running totals and would otherwise flatten against the
// shared left axis. `data` (snapshots) and `flow` (per-day) share the same day
// axis, so they merge by day key.
function DailyRegistrationsChartCard({ data, flow, cardBg, axisStroke, mutedText, brandColor, yScale }: DailyRegistrationsChartCardProps) {
  const totalUsersColor = lighten(brandColor, 0.55);
  const disclaimerColor = brandColor;
  // Bright accent so the daily registration columns read clearly in front of the
  // two cumulative areas.
  const registrationsColor = '#ffa600';

  const chartData = useMemo(() => {
    const regByDay = new Map(flow.map((p) => [p.day, p.registrations]));
    return data.map((p) => ({
      day: p.day,
      disclaimer: p.disclaimer,
      totalUsers: p.basic + p.pro + p.public,
      registrations: regByDay.get(p.day) ?? 0,
    }));
  }, [data, flow]);

  // Secondary axis for the per-day registration columns, scaled to their own
  // (much smaller) values so they aren't flattened by the cumulative-total left
  // axis.
  const regScale = useMemo(
    () => niceYScale(chartData.reduce((m, p) => Math.max(m, p.registrations), 0)),
    [chartData],
  );

  const latest = chartData.length > 0 ? chartData[chartData.length - 1] : { disclaimer: 0, totalUsers: 0 };
  const dayLabel = useMemo(() => makeDayLabelFormatter(chartData.map((p) => p.day)), [chartData]);

  return (
    <div className="rounded-lg p-4" style={{ backgroundColor: cardBg }}>
      <div className="flex items-baseline justify-between mb-2 flex-wrap gap-2">
        <h3 className="zg-h3" style={{ color: axisStroke }}>Daily Registrations</h3>
        <div className="flex items-center gap-x-4 gap-y-1 text-xs flex-wrap" style={{ color: mutedText }}>
          <span><span style={{ color: totalUsersColor }}>●</span> Total Users: {latest.totalUsers.toLocaleString()}</span>
          <span><span style={{ color: disclaimerColor }}>●</span> Accepted Disclosure: {latest.disclaimer.toLocaleString()}</span>
        </div>
      </div>
      {data.length === 0 ? (
        <div className="text-sm py-12 text-center" style={{ color: mutedText }}>No registration data captured yet.</div>
      ) : (
        <MobileScrollableChart>
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
              <CartesianGrid strokeOpacity={0.1} vertical={false} />
              <XAxis
                dataKey="day"
                stroke={axisStroke}
                tick={{ fill: axisStroke, fontSize: 10 }}
                tickLine={false}
                minTickGap={40}
                tickFormatter={dayLabel}
              />
              <YAxis
                yAxisId="users"
                stroke={axisStroke}
                tick={{ fill: axisStroke, fontSize: 10 }}
                tickLine={false}
                allowDecimals={false}
                domain={[0, yScale.max]}
                ticks={yScale.ticks}
                interval={0}
              />
              <YAxis
                yAxisId="reg"
                orientation="right"
                stroke={registrationsColor}
                tick={{ fill: registrationsColor, fontSize: 10 }}
                tickLine={false}
                allowDecimals={false}
                domain={[0, regScale.max]}
                ticks={regScale.ticks}
                interval={0}
              />
              <Tooltip
                cursor={{ stroke: 'var(--color-text-primary)', strokeOpacity: 0.2 }}
                content={({ active, label, payload }) => {
                  if (!active || !payload?.length) return null;
                  const num = (key: string) => Number(payload.find((p) => p.dataKey === key)?.value ?? 0);
                  const totalUsers = num('totalUsers');
                  const disclaimer = num('disclaimer');
                  const registrations = num('registrations');
                  return (
                    <div
                      className="rounded-lg border px-3 py-2 text-xs"
                      style={{ backgroundColor: 'var(--color-chart-tooltip-bg)', borderColor: 'var(--color-border)', color: 'var(--color-chart-tooltip-text)' }}
                    >
                      <div className="font-semibold mb-1">{dayLabel(String(label))}</div>
                      <div style={{ color: registrationsColor }}>Registrations added: {registrations.toLocaleString()}</div>
                      <div className="mt-1" style={{ color: totalUsersColor }}>Total Users: {totalUsers.toLocaleString()}</div>
                      <div style={{ color: disclaimerColor }}>Accepted Disclosure: {disclaimer.toLocaleString()}</div>
                    </div>
                  );
                }}
              />
              <Area
                yAxisId="users"
                type="monotone"
                dataKey="totalUsers"
                name="Total Users"
                stroke={totalUsersColor}
                fill={totalUsersColor}
                fillOpacity={0.4}
                isAnimationActive={false}
              />
              <Area
                yAxisId="users"
                type="monotone"
                dataKey="disclaimer"
                name="Accepted Disclosure"
                stroke={disclaimerColor}
                fill={disclaimerColor}
                fillOpacity={0.5}
                isAnimationActive={false}
              />
              <Bar
                yAxisId="reg"
                dataKey="registrations"
                name="Registrations added"
                fill={registrationsColor}
                maxBarSize={18}
                isAnimationActive={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </MobileScrollableChart>
      )}
    </div>
  );
}
