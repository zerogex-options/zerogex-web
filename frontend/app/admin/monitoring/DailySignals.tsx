'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  ErrorBar,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import LoadingSpinner from '@/components/LoadingSpinner';
import ErrorMessage from '@/components/ErrorMessage';
import MobileScrollableChart from '@/components/MobileScrollableChart';
import { getCsrfToken } from '@/core/csrfClient';
import { rollingMean, type CorrelationStrength, type LagPoint } from '@/core/dailyMetricsMath';
import { makeDayLabelFormatter } from './monitoringHelpers';

// Admin → Monitoring → "Daily Signals". One row per ET calendar day joining
// product events (trial starts, cancels, payment failures, registrations,
// traffic) to acquisition inputs (X impressions / profile visits, Google
// clicks), plus the four relationship tests those columns exist to answer.
//
// The panel deliberately leads with n and p rather than with a big r. On thirty
// days of bursty counts almost any pair of series will show |r| ≈ 0.3, and a
// dashboard that renders that as a trend line is a machine for manufacturing
// confidence. Every number here is labeled with how much data stands behind it.

// ---------------------------------------------------------------------------
// Wire types (mirror core/dailyMetrics.ts)
// ---------------------------------------------------------------------------

type MetricKey =
  | 'trialStarts'
  | 'paidStarts'
  | 'cancels'
  | 'paymentFailures'
  | 'registrations'
  | 'uniqueUsers'
  | 'pageviews'
  | 'xImpressions'
  | 'xProfileVisits'
  | 'googleClicks'
  | 'googleImpressions';

type DailyMetricRow = {
  day: string;
  trialStarts: number;
  paidStarts: number;
  cancels: number;
  paymentFailures: number;
  registrations: number;
  uniqueUsers: number | null;
  pageviews: number | null;
  xImpressions: number | null;
  xProfileVisits: number | null;
  googleClicks: number | null;
  googleImpressions: number | null;
};

type ScoredLag = LagPoint & { strength: CorrelationStrength };

type RelationshipTest = {
  id: string;
  title: string;
  hypothesis: string;
  driverLabel: string;
  outcomeLabel: string;
  driverPhrase: string;
  outcomePhrase: string;
  highlightLags: number[];
  lags: LagPoint[];
  highlights: ScoredLag[];
  best: ScoredLag | null;
  driverDays: number;
};

type WeekdayBucket = {
  weekday: number;
  label: string;
  days: number;
  total: number;
  mean: number;
  sd: number;
  stderr: number;
};

type WeekdayMetric = {
  key: MetricKey;
  label: string;
  analysis: {
    buckets: WeekdayBucket[];
    anova: { f: number | null; dfBetween: number; dfWithin: number; p: number | null };
    peak: WeekdayBucket | null;
    trough: WeekdayBucket | null;
  };
};

type CoverageRow = {
  key: MetricKey;
  label: string;
  days: number;
  firstDay: string | null;
  lastDay: string | null;
  total: number | null;
};

type VolatilityRow = {
  key: MetricKey;
  label: string;
  raw: number | null;
  smoothed: number | null;
  mean: number | null;
};

type Snapshot = {
  generatedAt: string;
  windowDays: number;
  rows: DailyMetricRow[];
  coverage: CoverageRow[];
  relationships: RelationshipTest[];
  weekday: WeekdayMetric[];
  volatility: VolatilityRow[];
  pageViewRetentionDays: number;
  externalMetricsEmpty: boolean;
  googleSyncConfigured: boolean;
};

// ---------------------------------------------------------------------------
// Presentation constants
// ---------------------------------------------------------------------------

const WINDOWS = [30, 90, 180, 365, 730] as const;

const STRENGTH_LABEL: Record<CorrelationStrength, string> = {
  insufficient: 'Not enough data',
  none: 'No detectable link',
  weak: 'Weak link',
  moderate: 'Moderate link',
  strong: 'Strong link',
};

const STRENGTH_TONE: Record<CorrelationStrength, string> = {
  insufficient: 'var(--color-text-secondary)',
  none: 'var(--color-text-secondary)',
  weak: '#58508d',
  moderate: '#bc5090',
  strong: '#ffa600',
};

const TRIAL_COLOR = '#ffa600';
const REGISTRATION_COLOR = '#bc5090';
const X_COLOR = '#58508d';
const GOOGLE_COLOR = '#4CAF93';
const FAILURE_COLOR = '#ff6361';
// Distinct from FAILURE_COLOR: these two now stack, and same-hue-different-alpha
// is unreadable once the segments sit on top of each other.
const CANCEL_COLOR = '#58508d';
const SMOOTH_COLOR = '#ffffff';

const CSV_COLUMNS: Array<{ key: 'day' | MetricKey; header: string }> = [
  { key: 'day', header: 'date' },
  { key: 'trialStarts', header: 'trial_starts' },
  { key: 'paidStarts', header: 'paid_starts' },
  { key: 'cancels', header: 'cancels' },
  { key: 'paymentFailures', header: 'payment_failures' },
  { key: 'registrations', header: 'registrations' },
  { key: 'uniqueUsers', header: 'unique_users' },
  { key: 'pageviews', header: 'pageviews' },
  { key: 'xImpressions', header: 'x_impressions' },
  { key: 'xProfileVisits', header: 'x_profile_visits' },
  { key: 'googleClicks', header: 'google_clicks' },
  { key: 'googleImpressions', header: 'google_impressions' },
];

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

function fmtInt(n: number | null | undefined): string {
  if (typeof n !== 'number' || !Number.isFinite(n)) return '—';
  return Math.round(n).toLocaleString();
}

function fmtR(r: number | null): string {
  if (r === null || !Number.isFinite(r)) return '—';
  return (r >= 0 ? '+' : '') + r.toFixed(2);
}

function fmtP(p: number | null): string {
  if (p === null || !Number.isFinite(p)) return '—';
  if (p < 0.001) return 'p < 0.001';
  return `p = ${p.toFixed(3)}`;
}

function fmtRatio(v: number | null): string {
  if (v === null || !Number.isFinite(v)) return '—';
  return v.toFixed(2);
}

/** Heading form, for the card that reports one lag. */
function lagLabel(lag: number): string {
  if (lag === 0) return 'Same day';
  if (lag === 1) return 'Next day';
  return `+${lag} days`;
}

/** Sentence form of the same lag. */
function lagPhrase(lag: number): string {
  if (lag === 0) return 'on the same day';
  if (lag === 1) return 'one day later';
  return `${lag} days later`;
}

/**
 * The sentence under each correlation. Written to be readable as a conclusion,
 * because the alternative — leaving the reader to interpret an r — is how a
 * coincidence becomes a strategy.
 */
function verdictText(point: ScoredLag, driver: string, outcome: string): string {
  const when = lagPhrase(point.lag);
  if (point.strength === 'insufficient') {
    return `Only ${point.n} paired day${point.n === 1 ? '' : 's'} — too few to say anything about ${driver} and ${outcome} ${when}.`;
  }
  if (point.strength === 'none') {
    return `Across ${point.n} days, no link between ${driver} and ${outcome} ${when} survives chance.`;
  }
  const shareOfVariance = point.r === null ? null : Math.round(point.r * point.r * 100);
  const direction = (point.r ?? 0) >= 0 ? 'moves with' : 'moves against';
  const rankNote =
    point.r !== null && point.rho !== null && Math.abs(point.r - point.rho) > 0.25
      ? ' Pearson and rank correlation disagree, so a few outlier days are carrying this — read the rank figure.'
      : '';
  return `Across ${point.n} days, ${driver} ${direction} ${outcome} ${when}, accounting for about ${shareOfVariance}% of its day-to-day variation.${rankNote}`;
}

function downloadCsv(rows: DailyMetricRow[]): void {
  const header = CSV_COLUMNS.map((c) => c.header).join(',');
  const body = rows
    .map((row) =>
      CSV_COLUMNS.map((c) => {
        const value = row[c.key as keyof DailyMetricRow];
        return value === null || value === undefined ? '' : String(value);
      }).join(','),
    )
    .join('\n');
  const blob = new Blob([`${header}\n${body}\n`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `zerogex-daily-metrics-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Panel
// ---------------------------------------------------------------------------

type PanelProps = {
  cardBg: string;
  borderColor: string;
  axisStroke: string;
  mutedText: string;
  textColor: string;
};

export default function DailySignals({ cardBg, borderColor, axisStroke, mutedText, textColor }: PanelProps) {
  const [days, setDays] = useState<number>(90);
  const [data, setData] = useState<Snapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rebuilding, setRebuilding] = useState(false);
  // Bumping this re-runs the fetch below without changing the window — how the
  // Rebuild button and a finished CSV import ask for fresh data.
  const [reload, setReload] = useState({ seq: 0, rebuild: false });

  useEffect(() => {
    // `cancelled` is what keeps a slow 730-day response from overwriting the
    // fast 30-day one the user switched to while it was still in flight.
    let cancelled = false;
    const run = async () => {
      try {
        const res = await fetch(
          `/api/admin/monitoring/daily?days=${days}${reload.rebuild ? '&rebuild=1' : ''}`,
          { cache: 'no-store', credentials: 'same-origin' },
        );
        if (cancelled) return;
        if (!res.ok) {
          setError(res.status === 403 ? 'Admin access required' : `Failed to load daily metrics (HTTP ${res.status})`);
          return;
        }
        const json = (await res.json()) as Snapshot;
        if (cancelled) return;
        setData(json);
        setError(null);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load daily metrics');
      } finally {
        if (!cancelled) setRebuilding(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [days, reload]);

  const refresh = (rebuild: boolean) => setReload((prev) => ({ seq: prev.seq + 1, rebuild }));

  const onRebuild = () => {
    setRebuilding(true);
    refresh(true);
  };

  // Derived rather than a `loading` state flag: what makes the view stale is
  // simply that the loaded snapshot is not the window now selected, and holding
  // that in state would mean setting it synchronously from the effect above.
  const stale = data !== null && data.windowDays !== days;

  if (!data) return error ? <ErrorMessage message={error} /> : <LoadingSpinner size="lg" />;

  return (
    <div className="space-y-6">
      <div className="rounded-lg p-4" style={{ backgroundColor: cardBg }}>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="max-w-3xl">
            <h2 className="zg-h3 mb-1" style={{ color: textColor }}>Daily Signals</h2>
            <p className="text-sm" style={{ color: mutedText }}>
              One row per calendar day (America/New_York), joining what the product did to what brought
              people to it. Product columns are derived from the audit log and can be rebuilt from
              scratch at any time; the X and Google columns are imported from those consoles&rsquo; own
              CSV exports below.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {WINDOWS.map((w) => (
              <button
                key={w}
                type="button"
                onClick={() => setDays(w)}
                className="px-2.5 py-1 text-xs font-semibold rounded"
                style={{
                  color: days === w ? 'var(--color-text-primary)' : mutedText,
                  border: `1px solid ${days === w ? 'var(--color-warning)' : borderColor}`,
                }}
              >
                {w}d
              </button>
            ))}
            <button
              type="button"
              onClick={onRebuild}
              disabled={rebuilding}
              className="px-2.5 py-1 text-xs font-semibold rounded"
              style={{ color: mutedText, border: `1px solid ${borderColor}`, opacity: rebuilding ? 0.5 : 1 }}
            >
              {rebuilding ? 'Rebuilding…' : 'Rebuild'}
            </button>
            <button
              type="button"
              onClick={() => downloadCsv(data.rows)}
              className="px-2.5 py-1 text-xs font-semibold rounded"
              style={{ color: mutedText, border: `1px solid ${borderColor}` }}
            >
              Download CSV
            </button>
          </div>
        </div>
        {(stale || error) && (
          <p className="mt-2 text-xs" style={{ color: error ? FAILURE_COLOR : mutedText }}>
            {error ?? `Loading ${days} days…`}
          </p>
        )}
        <CoverageStrip coverage={data.coverage} borderColor={borderColor} mutedText={mutedText} textColor={textColor} />
      </div>

      {data.externalMetricsEmpty && (
        <div
          className="rounded-lg p-4 text-sm"
          style={{ backgroundColor: cardBg, border: `1px solid ${borderColor}`, color: mutedText }}
        >
          No X or Google numbers have been imported yet, so the first three relationships below have
          nothing to test. Import them from the panel at the bottom of this page — both consoles
          export the per-day CSV this table wants, so a single import backfills the whole history.
        </div>
      )}

      <AcquisitionChart rows={data.rows} cardBg={cardBg} axisStroke={axisStroke} mutedText={mutedText} textColor={textColor} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {data.relationships.map((relationship) => (
          <RelationshipCard
            key={relationship.id}
            test={relationship}
            cardBg={cardBg}
            borderColor={borderColor}
            axisStroke={axisStroke}
            mutedText={mutedText}
            textColor={textColor}
          />
        ))}
      </div>

      <TrialEchoChart rows={data.rows} cardBg={cardBg} axisStroke={axisStroke} mutedText={mutedText} textColor={textColor} />

      <WeekdayCard weekday={data.weekday} cardBg={cardBg} borderColor={borderColor} axisStroke={axisStroke} mutedText={mutedText} textColor={textColor} />

      <VolatilityCard volatility={data.volatility} cardBg={cardBg} borderColor={borderColor} mutedText={mutedText} textColor={textColor} />

      <DailyTable rows={data.rows} cardBg={cardBg} borderColor={borderColor} mutedText={mutedText} textColor={textColor} />

      <ImportCard
        coverage={data.coverage}
        latestDay={data.rows[data.rows.length - 1]?.day ?? null}
        googleSyncConfigured={data.googleSyncConfigured}
        cardBg={cardBg}
        borderColor={borderColor}
        mutedText={mutedText}
        textColor={textColor}
        onImported={() => refresh(true)}
      />

      <p className="text-xs" style={{ color: mutedText }}>
        Snapshot generated {new Date(data.generatedAt).toLocaleString()}. Pageviews and unique users
        are retained for {data.pageViewRetentionDays} days in their raw form; this table keeps the
        daily totals permanently once captured.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Coverage
// ---------------------------------------------------------------------------

function CoverageStrip({
  coverage,
  borderColor,
  mutedText,
  textColor,
}: {
  coverage: CoverageRow[];
  borderColor: string;
  mutedText: string;
  textColor: string;
}) {
  return (
    <div className="mt-4 flex flex-wrap gap-2">
      {coverage.map((row) => (
        <div
          key={row.key}
          className="px-2.5 py-1.5 rounded text-xs"
          style={{ border: `1px solid ${borderColor}`, color: row.days === 0 ? mutedText : textColor }}
          title={row.days === 0 ? 'No data for this column yet' : `${row.firstDay} → ${row.lastDay}`}
        >
          <span style={{ color: mutedText }}>{row.label}: </span>
          {row.days === 0 ? 'no data' : `${fmtInt(row.total)} over ${row.days}d`}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Relationship card
// ---------------------------------------------------------------------------

function RelationshipCard({
  test,
  cardBg,
  borderColor,
  axisStroke,
  mutedText,
  textColor,
}: {
  test: RelationshipTest;
  cardBg: string;
  borderColor: string;
  axisStroke: string;
  mutedText: string;
  textColor: string;
}) {
  const profile = useMemo(
    () => test.lags.map((l) => ({ lag: l.lag, r: l.r ?? 0, defined: l.r !== null, n: l.n })),
    [test.lags],
  );
  const highlighted = new Set(test.highlightLags);

  return (
    <div className="rounded-lg p-4" style={{ backgroundColor: cardBg }}>
      <h3 className="zg-h3 mb-1" style={{ color: textColor }}>{test.title}</h3>
      <p className="text-xs mb-3" style={{ color: mutedText }}>{test.hypothesis}</p>

      {test.driverDays === 0 ? (
        <div className="text-sm py-6 text-center" style={{ color: mutedText }}>
          No {test.driverPhrase} data imported yet.
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {test.highlights.map((point) => (
              <div key={point.lag} className="rounded p-3" style={{ border: `1px solid ${borderColor}` }}>
                <div className="flex items-baseline justify-between gap-2 flex-wrap mb-1">
                  <span className="text-sm font-semibold" style={{ color: textColor }}>{lagLabel(point.lag)}</span>
                  <span className="text-xs font-semibold" style={{ color: STRENGTH_TONE[point.strength] }}>
                    {STRENGTH_LABEL[point.strength]}
                  </span>
                </div>
                <div className="flex items-baseline gap-x-4 gap-y-1 flex-wrap text-xs" style={{ color: mutedText }}>
                  <span>r = <strong style={{ color: textColor }}>{fmtR(point.r)}</strong></span>
                  <span>rank r = <strong style={{ color: textColor }}>{fmtR(point.rho)}</strong></span>
                  <span>n = {point.n}</span>
                  <span>{fmtP(point.p)}</span>
                </div>
                <p className="text-xs mt-1.5" style={{ color: mutedText }}>
                  {verdictText(point, test.driverPhrase, test.outcomePhrase)}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-4">
            <div className="flex items-baseline justify-between mb-1">
              <span className="text-xs font-semibold" style={{ color: mutedText }}>Lag profile (0–14 days)</span>
              {test.best && (
                <span className="text-xs" style={{ color: mutedText }}>
                  strongest at {lagLabel(test.best.lag).toLowerCase()} ({fmtR(test.best.r)})
                </span>
              )}
            </div>
            <ResponsiveContainer width="100%" height={110}>
              <BarChart data={profile} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                <CartesianGrid strokeOpacity={0.1} vertical={false} />
                <XAxis dataKey="lag" stroke={axisStroke} tick={{ fill: axisStroke, fontSize: 9 }} tickLine={false} interval={0} />
                <YAxis
                  stroke={axisStroke}
                  tick={{ fill: axisStroke, fontSize: 9 }}
                  tickLine={false}
                  domain={[-1, 1]}
                  ticks={[-1, 0, 1]}
                />
                <ReferenceLine y={0} stroke={axisStroke} strokeOpacity={0.4} />
                <Tooltip
                  cursor={{ fill: 'var(--color-text-primary)', fillOpacity: 0.06 }}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const point = payload[0].payload as { lag: number; r: number; defined: boolean; n: number };
                    return (
                      <div
                        className="rounded-lg border px-3 py-2 text-xs"
                        style={{ backgroundColor: 'var(--color-chart-tooltip-bg)', borderColor: 'var(--color-border)', color: 'var(--color-chart-tooltip-text)' }}
                      >
                        <div className="font-semibold">{lagLabel(point.lag)}</div>
                        <div>r = {point.defined ? fmtR(point.r) : '—'} (n = {point.n})</div>
                      </div>
                    );
                  }}
                />
                <Bar dataKey="r" isAnimationActive={false} maxBarSize={14}>
                  {profile.map((point) => (
                    <Cell
                      key={point.lag}
                      fill={highlighted.has(point.lag) ? STRENGTH_TONE.strong : X_COLOR}
                      fillOpacity={point.defined ? 1 : 0.15}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <p className="text-xs mt-1" style={{ color: mutedText }}>
              Highlighted bars are the lags stated in advance. The rest are exploratory — with fifteen
              lags on the chart, the largest one is expected to look notable even when nothing is there.
            </p>
          </div>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Acquisition chart
// ---------------------------------------------------------------------------

function AcquisitionChart({
  rows,
  cardBg,
  axisStroke,
  mutedText,
  textColor,
}: {
  rows: DailyMetricRow[];
  cardBg: string;
  axisStroke: string;
  mutedText: string;
  textColor: string;
}) {
  const chartData = useMemo(() => {
    const trialSmooth = rollingMean(rows.map((r) => r.trialStarts), 7);
    const registrationSmooth = rollingMean(rows.map((r) => r.registrations), 7);
    return rows.map((row, i) => ({
      day: row.day,
      trialStarts: row.trialStarts,
      registrations: row.registrations,
      trialSmooth: trialSmooth[i],
      registrationSmooth: registrationSmooth[i],
      xImpressions: row.xImpressions,
      googleClicks: row.googleClicks,
    }));
  }, [rows]);

  const dayLabel = useMemo(() => makeDayLabelFormatter(rows.map((r) => r.day)), [rows]);
  const hasX = chartData.some((p) => p.xImpressions !== null);
  const hasGoogle = chartData.some((p) => p.googleClicks !== null);

  // Which axis each reach series belongs on. X impressions run three orders of
  // magnitude above a daily signup count, so they need their own scale — but
  // Google clicks usually do NOT, and parking both on that scale draws the
  // clicks line flat along the x-axis where it says nothing. Decide per series
  // by magnitude rather than hardcoding, so this still reads correctly for a
  // site whose search traffic eventually dwarfs its signups.
  const axisOf = useMemo(() => {
    const peak = (pick: (p: (typeof chartData)[number]) => number | null) =>
      chartData.reduce((max, p) => Math.max(max, pick(p) ?? 0), 0);
    const counts = Math.max(peak((p) => p.registrations), peak((p) => p.trialStarts), 1);
    const fits = (value: number) => value <= counts * 3;
    return {
      xImpressions: fits(peak((p) => p.xImpressions)) ? 'counts' : 'reach',
      googleClicks: fits(peak((p) => p.googleClicks)) ? 'counts' : 'reach',
    } as const;
  }, [chartData]);
  const axisNote = (axis: 'counts' | 'reach') => (axis === 'counts' ? 'left' : 'right');

  return (
    <div className="rounded-lg p-4" style={{ backgroundColor: cardBg }}>
      <div className="flex items-baseline justify-between mb-2 flex-wrap gap-2">
        <h3 className="zg-h3" style={{ color: textColor }}>Acquisition vs. reach</h3>
        <div className="flex items-center gap-x-4 gap-y-1 text-xs flex-wrap" style={{ color: mutedText }}>
          <span><span style={{ color: TRIAL_COLOR }}>●</span> Trial starts</span>
          <span><span style={{ color: REGISTRATION_COLOR }}>●</span> Registrations</span>
          {hasX && <span><span style={{ color: X_COLOR }}>●</span> X impressions ({axisNote(axisOf.xImpressions)})</span>}
          {hasGoogle && <span><span style={{ color: GOOGLE_COLOR }}>●</span> Google clicks ({axisNote(axisOf.googleClicks)})</span>}
        </div>
      </div>
      <p className="text-xs mb-3" style={{ color: mutedText }}>
        Stacked bars are the raw daily counts — acquisition <em>events</em>, not distinct people:
        someone who registers and starts a trial the same day appears in both segments. The pale
        lines are their 7-day trailing means; if the bars jump around while the lines stay flat, the
        swing is measurement noise, not a change in the business.
      </p>
      <MobileScrollableChart>
        <ResponsiveContainer width="100%" height={300}>
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
            <YAxis yAxisId="counts" stroke={axisStroke} tick={{ fill: axisStroke, fontSize: 10 }} tickLine={false} allowDecimals={false} />
            <YAxis yAxisId="reach" orientation="right" stroke={X_COLOR} tick={{ fill: X_COLOR, fontSize: 10 }} tickLine={false} allowDecimals={false} />
            <Tooltip
              cursor={{ stroke: 'var(--color-text-primary)', strokeOpacity: 0.2 }}
              content={({ active, label, payload }) => {
                if (!active || !payload?.length) return null;
                const point = payload[0].payload as (typeof chartData)[number];
                return (
                  <div
                    className="rounded-lg border px-3 py-2 text-xs"
                    style={{ backgroundColor: 'var(--color-chart-tooltip-bg)', borderColor: 'var(--color-border)', color: 'var(--color-chart-tooltip-text)' }}
                  >
                    <div className="font-semibold mb-1">{dayLabel(String(label))}</div>
                    <div style={{ color: TRIAL_COLOR }}>Trial starts: {fmtInt(point.trialStarts)}</div>
                    <div style={{ color: REGISTRATION_COLOR }}>Registrations: {fmtInt(point.registrations)}</div>
                    <div style={{ color: X_COLOR }}>X impressions: {fmtInt(point.xImpressions)}</div>
                    <div style={{ color: GOOGLE_COLOR }}>Google clicks: {fmtInt(point.googleClicks)}</div>
                    <div className="mt-1" style={{ color: mutedText }}>
                      7-day mean — trials {fmtRatio(point.trialSmooth)}, registrations {fmtRatio(point.registrationSmooth)}
                    </div>
                  </div>
                );
              }}
            />
            <Bar yAxisId="counts" stackId="acquisition" dataKey="registrations" name="Registrations" fill={REGISTRATION_COLOR} maxBarSize={18} isAnimationActive={false} />
            <Bar yAxisId="counts" stackId="acquisition" dataKey="trialStarts" name="Trial starts" fill={TRIAL_COLOR} maxBarSize={18} isAnimationActive={false} />
            <Line yAxisId="counts" type="monotone" dataKey="trialSmooth" name="Trial starts (7d mean)" stroke={SMOOTH_COLOR} strokeOpacity={0.75} strokeWidth={2} dot={false} connectNulls isAnimationActive={false} />
            <Line yAxisId="counts" type="monotone" dataKey="registrationSmooth" name="Registrations (7d mean)" stroke={SMOOTH_COLOR} strokeOpacity={0.4} strokeWidth={2} strokeDasharray="4 3" dot={false} connectNulls isAnimationActive={false} />
            {hasX && (
              <Line yAxisId={axisOf.xImpressions} type="monotone" dataKey="xImpressions" name="X impressions" stroke={X_COLOR} strokeWidth={2} dot={false} connectNulls isAnimationActive={false} />
            )}
            {hasGoogle && (
              <Line yAxisId={axisOf.googleClicks} type="monotone" dataKey="googleClicks" name="Google clicks" stroke={GOOGLE_COLOR} strokeWidth={2} dot={false} connectNulls isAnimationActive={false} />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </MobileScrollableChart>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Trial → payment-failure echo
// ---------------------------------------------------------------------------

function TrialEchoChart({
  rows,
  cardBg,
  axisStroke,
  mutedText,
  textColor,
}: {
  rows: DailyMetricRow[];
  cardBg: string;
  axisStroke: string;
  mutedText: string;
  textColor: string;
}) {
  // Trial starts are drawn on the day their 7-day cohort comes due, so a
  // mechanical lag-7 echo lines up vertically instead of having to be counted
  // off the axis by eye.
  const chartData = useMemo(
    () =>
      rows.map((row, i) => ({
        day: row.day,
        paymentFailures: row.paymentFailures,
        cancels: row.cancels,
        trialsDueToday: i >= 7 ? rows[i - 7].trialStarts : null,
      })),
    [rows],
  );
  const dayLabel = useMemo(() => makeDayLabelFormatter(rows.map((r) => r.day)), [rows]);

  return (
    <div className="rounded-lg p-4" style={{ backgroundColor: cardBg }}>
      <div className="flex items-baseline justify-between mb-2 flex-wrap gap-2">
        <h3 className="zg-h3" style={{ color: textColor }}>Seven-day cohort echo</h3>
        <div className="flex items-center gap-x-4 gap-y-1 text-xs flex-wrap" style={{ color: mutedText }}>
          <span><span style={{ color: TRIAL_COLOR }}>●</span> Trials coming due today (started 7d ago)</span>
          <span><span style={{ color: FAILURE_COLOR }}>●</span> Payment failures</span>
          <span><span style={{ color: CANCEL_COLOR }}>●</span> Cancels</span>
        </div>
      </div>
      <p className="text-xs mb-3" style={{ color: mutedText }}>
        Trial starts are plotted on the day that cohort&rsquo;s first charge lands, not the day it
        signed up. Where the orange line rises and the stacked bars follow underneath it, a burst of
        signups is arriving as a burst of losses a week later. The two loss types are disjoint — a
        member is counted once — so the stack height is that day&rsquo;s total churn events.
      </p>
      <MobileScrollableChart>
        <ResponsiveContainer width="100%" height={260}>
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
            <YAxis stroke={axisStroke} tick={{ fill: axisStroke, fontSize: 10 }} tickLine={false} allowDecimals={false} />
            <Tooltip
              cursor={{ stroke: 'var(--color-text-primary)', strokeOpacity: 0.2 }}
              content={({ active, label, payload }) => {
                if (!active || !payload?.length) return null;
                const point = payload[0].payload as (typeof chartData)[number];
                return (
                  <div
                    className="rounded-lg border px-3 py-2 text-xs"
                    style={{ backgroundColor: 'var(--color-chart-tooltip-bg)', borderColor: 'var(--color-border)', color: 'var(--color-chart-tooltip-text)' }}
                  >
                    <div className="font-semibold mb-1">{dayLabel(String(label))}</div>
                    <div style={{ color: TRIAL_COLOR }}>Trials due today: {fmtInt(point.trialsDueToday)}</div>
                    <div style={{ color: FAILURE_COLOR }}>Payment failures: {fmtInt(point.paymentFailures)}</div>
                    <div style={{ color: CANCEL_COLOR }}>Cancels: {fmtInt(point.cancels)}</div>
                  </div>
                );
              }}
            />
            <Bar dataKey="paymentFailures" stackId="churn" name="Payment failures" fill={FAILURE_COLOR} maxBarSize={18} isAnimationActive={false} />
            <Bar dataKey="cancels" stackId="churn" name="Cancels" fill={CANCEL_COLOR} maxBarSize={18} isAnimationActive={false} />
            <Line type="monotone" dataKey="trialsDueToday" name="Trials due today" stroke={TRIAL_COLOR} strokeWidth={2} dot={false} connectNulls isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </MobileScrollableChart>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Weekday seasonality
// ---------------------------------------------------------------------------

type WeekdaySelection = MetricKey | 'combined';

function WeekdaySelector({
  options,
  selected,
  onSelect,
  borderColor,
  mutedText,
}: {
  options: Array<{ key: WeekdaySelection; label: string }>;
  selected: WeekdaySelection;
  onSelect: (key: WeekdaySelection) => void;
  borderColor: string;
  mutedText: string;
}) {
  return (
    <div className="flex gap-2 flex-wrap">
      {options.map((option) => (
        <button
          key={option.key}
          type="button"
          onClick={() => onSelect(option.key)}
          className="px-2.5 py-1 text-xs font-semibold rounded"
          style={{
            color: selected === option.key ? 'var(--color-text-primary)' : mutedText,
            border: `1px solid ${selected === option.key ? 'var(--color-warning)' : borderColor}`,
          }}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

/** Which side of the axis each metric sits on, and what colour it draws in. */
const COMBINED_SERIES: Array<{ key: MetricKey; label: string; color: string; sign: 1 | -1 }> = [
  { key: 'registrations', label: 'Registrations', color: REGISTRATION_COLOR, sign: 1 },
  { key: 'trialStarts', label: 'Trial starts', color: TRIAL_COLOR, sign: 1 },
  { key: 'cancels', label: 'Cancels', color: CANCEL_COLOR, sign: -1 },
  { key: 'paymentFailures', label: 'Payment failures', color: FAILURE_COLOR, sign: -1 },
];

/**
 * All four weekday breakdowns on one axis: what the week brings in above the
 * line, what it loses below it. Recharts stacks same-signed values together
 * within a stackId, so negating the churn means is all it takes to get two
 * stacks growing away from zero.
 *
 * Note the asymmetry of scale — acquisition is an order of magnitude larger
 * than churn on a healthy week, so the lower half is deliberately a sliver.
 * The per-metric views next to this one are where a churn weekday effect is
 * actually legible, and where its significance test lives.
 */
function CombinedWeekdayCard({
  weekday,
  options,
  selected,
  onSelect,
  cardBg,
  borderColor,
  axisStroke,
  mutedText,
  textColor,
}: {
  weekday: WeekdayMetric[];
  options: Array<{ key: WeekdaySelection; label: string }>;
  selected: WeekdaySelection;
  onSelect: (key: WeekdaySelection) => void;
  cardBg: string;
  borderColor: string;
  axisStroke: string;
  mutedText: string;
  textColor: string;
}) {
  const byKey = new Map(weekday.map((w) => [w.key, w]));
  const series = COMBINED_SERIES.filter((spec) => byKey.has(spec.key));

  // Seven rows by four metrics — not worth memoizing, and hand-memoizing it
  // would only re-derive on the same input anyway.
  const labels = byKey.get(series[0]?.key)?.analysis.buckets.map((b) => b.label) ?? [];
  const chartData = labels.map((label, i) => {
    const row: Record<string, string | number> = { label };
    for (const spec of series) {
      const bucket = byKey.get(spec.key)!.analysis.buckets[i];
      // Negating the churn means is the whole trick: Recharts stacks same-signed
      // values together, so these grow downward from zero on their own.
      row[spec.key] = (bucket?.mean ?? 0) * spec.sign;
      row[`${spec.key}Raw`] = bucket?.mean ?? 0;
      row[`${spec.key}Days`] = bucket?.days ?? 0;
    }
    return row;
  });

  return (
    <div className="rounded-lg p-4" style={{ backgroundColor: cardBg }}>
      <div className="flex items-baseline justify-between mb-2 flex-wrap gap-2">
        <h3 className="zg-h3" style={{ color: textColor }}>Day of week</h3>
        <WeekdaySelector options={options} selected={selected} onSelect={onSelect} borderColor={borderColor} mutedText={mutedText} />
      </div>

      <div className="flex items-center gap-x-4 gap-y-1 text-xs flex-wrap mb-3" style={{ color: mutedText }}>
        {series.map((spec) => (
          <span key={spec.key}>
            <span style={{ color: spec.color }}>●</span> {spec.label} {spec.sign > 0 ? '(above)' : '(below)'}
          </span>
        ))}
      </div>

      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={chartData} margin={{ top: 8, right: 12, left: -16, bottom: 8 }} stackOffset="sign">
          <CartesianGrid strokeOpacity={0.1} vertical={false} />
          <XAxis dataKey="label" stroke={axisStroke} tick={{ fill: axisStroke, fontSize: 11 }} tickLine={false} />
          <YAxis
            stroke={axisStroke}
            tick={{ fill: axisStroke, fontSize: 10 }}
            tickLine={false}
            tickFormatter={(v: number) => String(Math.abs(v))}
          />
          <ReferenceLine y={0} stroke={axisStroke} strokeOpacity={0.5} />
          <Tooltip
            cursor={{ fill: 'var(--color-text-primary)', fillOpacity: 0.06 }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const row = payload[0].payload as Record<string, string | number>;
              return (
                <div
                  className="rounded-lg border px-3 py-2 text-xs"
                  style={{ backgroundColor: 'var(--color-chart-tooltip-bg)', borderColor: 'var(--color-border)', color: 'var(--color-chart-tooltip-text)' }}
                >
                  <div className="font-semibold mb-1">Average {String(row.label)}</div>
                  {series.map((spec) => (
                    <div key={spec.key} style={{ color: spec.color }}>
                      {spec.label}: {fmtRatio(Number(row[`${spec.key}Raw`]))}/day
                    </div>
                  ))}
                  <div className="mt-1" style={{ color: mutedText }}>
                    across {String(row[`${series[0]?.key}Days`] ?? 0)} of them
                  </div>
                </div>
              );
            }}
          />
          {series.map((spec) => (
            <Bar
              key={spec.key}
              dataKey={spec.key}
              name={spec.label}
              stackId="weekday"
              fill={spec.color}
              maxBarSize={52}
              isAnimationActive={false}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>

      <div className="mt-3 space-y-1">
        {series.map((spec) => {
          const { anova, peak, trough } = byKey.get(spec.key)!.analysis;
          if (!peak || peak.days === 0) return null;
          const significant = anova.p !== null && anova.p < 0.05;
          return (
            <p key={spec.key} className="text-xs" style={{ color: mutedText }}>
              <span style={{ color: spec.color }}>●</span>{' '}
              <strong style={{ color: textColor }}>{spec.label}</strong> peak {fmtRatio(peak.mean)} on{' '}
              {peak.label}, low {fmtRatio(trough?.mean ?? null)} on {trough?.label} —{' '}
              {anova.p === null
                ? 'not enough variation yet to test.'
                : significant
                  ? `a real weekday effect (${fmtP(anova.p)}).`
                  : `within what chance produces (${fmtP(anova.p)}), so unproven.`}
            </p>
          );
        })}
      </div>

      <p className="text-xs mt-2" style={{ color: mutedText }}>
        Bars are the mean per occurrence of that weekday (a window rarely holds seven of each).
        Acquisition normally dwarfs churn, so the lower half is a sliver by design — open a single
        metric above to see its own scale, error bars and significance test.
      </p>
    </div>
  );
}

function WeekdayCard({
  weekday,
  cardBg,
  borderColor,
  axisStroke,
  mutedText,
  textColor,
}: {
  weekday: WeekdayMetric[];
  cardBg: string;
  borderColor: string;
  axisStroke: string;
  mutedText: string;
  textColor: string;
}) {
  // 'combined' is the default: the one view that answers "does the week have a
  // shape" for acquisition and churn at once. The per-metric views stay, because
  // they are where the error bars and the ANOVA verdict live.
  const [selected, setSelected] = useState<MetricKey | 'combined'>('combined');
  const byKey = new Map(weekday.map((w) => [w.key, w]));
  const options: Array<{ key: MetricKey | 'combined'; label: string }> = [
    { key: 'combined', label: 'Combined' },
    ...weekday.map((w) => ({ key: w.key as MetricKey | 'combined', label: w.label })),
  ];

  if (selected === 'combined') {
    return (
      <CombinedWeekdayCard
        weekday={weekday}
        options={options}
        selected={selected}
        onSelect={setSelected}
        cardBg={cardBg}
        borderColor={borderColor}
        axisStroke={axisStroke}
        mutedText={mutedText}
        textColor={textColor}
      />
    );
  }

  const active = byKey.get(selected) ?? weekday[0];
  if (!active) return null;

  const chartData = active.analysis.buckets.map((b) => ({
    label: b.label,
    mean: b.mean,
    stderr: b.stderr,
    days: b.days,
    total: b.total,
  }));

  const { anova, peak, trough } = active.analysis;
  const significant = anova.p !== null && anova.p < 0.05;
  const spread = peak && trough && trough.mean > 0 ? peak.mean / trough.mean : null;

  return (
    <div className="rounded-lg p-4" style={{ backgroundColor: cardBg }}>
      <div className="flex items-baseline justify-between mb-2 flex-wrap gap-2">
        <h3 className="zg-h3" style={{ color: textColor }}>Day of week</h3>
        <WeekdaySelector options={options} selected={selected} onSelect={setSelected} borderColor={borderColor} mutedText={mutedText} />
      </div>

      <p className="text-sm mb-3" style={{ color: mutedText }}>
        {peak && trough && peak.days > 0 ? (
          <>
            <strong style={{ color: textColor }}>{active.label}</strong> average{' '}
            {fmtRatio(peak.mean)} on {peak.label} against {fmtRatio(trough.mean)} on {trough.label}
            {spread !== null && spread > 1 ? ` (${spread.toFixed(1)}×)` : ''}.{' '}
            {significant
              ? `The weekday means genuinely differ (F = ${fmtRatio(anova.f)} on ${anova.dfBetween} and ${anova.dfWithin} df, ${fmtP(anova.p)}) — this is real seasonality, not noise.`
              : anova.p === null
                ? 'Not enough variation yet to test whether the weekdays really differ.'
                : `That gap is within what chance produces (F = ${fmtRatio(anova.f)}, ${fmtP(anova.p)}), so treat the weekday pattern as unproven for now.`}
          </>
        ) : (
          'No data in this window.'
        )}
      </p>

      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={chartData} margin={{ top: 8, right: 12, left: -16, bottom: 8 }}>
          <CartesianGrid strokeOpacity={0.1} vertical={false} />
          <XAxis dataKey="label" stroke={axisStroke} tick={{ fill: axisStroke, fontSize: 11 }} tickLine={false} />
          <YAxis stroke={axisStroke} tick={{ fill: axisStroke, fontSize: 10 }} tickLine={false} />
          <Tooltip
            cursor={{ fill: 'var(--color-text-primary)', fillOpacity: 0.06 }}
            content={({ active: isActive, payload }) => {
              if (!isActive || !payload?.length) return null;
              const point = payload[0].payload as (typeof chartData)[number];
              return (
                <div
                  className="rounded-lg border px-3 py-2 text-xs"
                  style={{ backgroundColor: 'var(--color-chart-tooltip-bg)', borderColor: 'var(--color-border)', color: 'var(--color-chart-tooltip-text)' }}
                >
                  <div className="font-semibold mb-1">{point.label}</div>
                  <div>Mean per {point.label}: {fmtRatio(point.mean)}</div>
                  <div style={{ color: mutedText }}>{fmtInt(point.total)} across {point.days} {point.label}s</div>
                </div>
              );
            }}
          />
          <Bar dataKey="mean" name="Mean per day" fill={TRIAL_COLOR} maxBarSize={44} isAnimationActive={false}>
            <ErrorBar dataKey="stderr" width={4} strokeWidth={1.5} stroke={axisStroke} direction="y" />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <p className="text-xs mt-1" style={{ color: mutedText }}>
        Bars are the mean per occurrence of that weekday (a window rarely holds seven of each);
        whiskers are one standard error.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Volatility
// ---------------------------------------------------------------------------

function VolatilityCard({
  volatility,
  cardBg,
  borderColor,
  mutedText,
  textColor,
}: {
  volatility: VolatilityRow[];
  cardBg: string;
  borderColor: string;
  mutedText: string;
  textColor: string;
}) {
  return (
    <div className="rounded-lg p-4" style={{ backgroundColor: cardBg }}>
      <h3 className="zg-h3 mb-1" style={{ color: textColor }}>How much of the swing is measurement</h3>
      <p className="text-xs mb-3" style={{ color: mutedText }}>
        Coefficient of variation — the spread relative to the average. A raw daily series far noisier
        than its 7-day mean is telling you that a single day&rsquo;s number carries very little
        information on its own.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm" style={{ color: textColor }}>
          <thead>
            <tr style={{ color: mutedText }}>
              <th className="text-left font-semibold py-1.5 pr-4">Metric</th>
              <th className="text-right font-semibold py-1.5 pr-4">Mean / day</th>
              <th className="text-right font-semibold py-1.5 pr-4">Raw CV</th>
              <th className="text-right font-semibold py-1.5 pr-4">7-day mean CV</th>
              <th className="text-right font-semibold py-1.5">Noise removed</th>
            </tr>
          </thead>
          <tbody>
            {volatility.map((row) => {
              const reduction =
                row.raw !== null && row.smoothed !== null && row.raw > 0
                  ? 1 - row.smoothed / row.raw
                  : null;
              return (
                <tr key={row.key} style={{ borderTop: `1px solid ${borderColor}` }}>
                  <td className="py-1.5 pr-4">{row.label}</td>
                  <td className="py-1.5 pr-4 text-right tabular-nums">{fmtRatio(row.mean)}</td>
                  <td className="py-1.5 pr-4 text-right tabular-nums">{fmtRatio(row.raw)}</td>
                  <td className="py-1.5 pr-4 text-right tabular-nums">{fmtRatio(row.smoothed)}</td>
                  <td className="py-1.5 text-right tabular-nums" style={{ color: mutedText }}>
                    {reduction === null ? '—' : `${Math.round(reduction * 100)}%`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// The table itself
// ---------------------------------------------------------------------------

function DailyTable({
  rows,
  cardBg,
  borderColor,
  mutedText,
  textColor,
}: {
  rows: DailyMetricRow[];
  cardBg: string;
  borderColor: string;
  mutedText: string;
  textColor: string;
}) {
  const [expanded, setExpanded] = useState(false);
  // Newest first — the question asked of a table like this is almost always
  // "what happened lately", and scrolling to the bottom for it is a tax.
  const ordered = useMemo(() => [...rows].reverse(), [rows]);
  const visible = expanded ? ordered : ordered.slice(0, 30);

  return (
    <div className="rounded-lg p-4" style={{ backgroundColor: cardBg }}>
      <div className="flex items-baseline justify-between mb-3 flex-wrap gap-2">
        <h3 className="zg-h3" style={{ color: textColor }}>Daily table</h3>
        <span className="text-xs" style={{ color: mutedText }}>
          {rows.length.toLocaleString()} days · blank means not measured, 0 means measured zero
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs tabular-nums" style={{ color: textColor }}>
          <thead>
            <tr style={{ color: mutedText }}>
              <th className="text-left font-semibold py-1.5 pr-3">Date</th>
              <th className="text-right font-semibold py-1.5 pr-3">Trials</th>
              <th className="text-right font-semibold py-1.5 pr-3">Paid</th>
              <th className="text-right font-semibold py-1.5 pr-3">Cancels</th>
              <th className="text-right font-semibold py-1.5 pr-3">Pay fails</th>
              <th className="text-right font-semibold py-1.5 pr-3">Regs</th>
              <th className="text-right font-semibold py-1.5 pr-3">Users</th>
              <th className="text-right font-semibold py-1.5 pr-3">Pageviews</th>
              <th className="text-right font-semibold py-1.5 pr-3">X impr.</th>
              <th className="text-right font-semibold py-1.5 pr-3">X visits</th>
              <th className="text-right font-semibold py-1.5">Google clicks</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => (
              <tr key={row.day} style={{ borderTop: `1px solid ${borderColor}` }}>
                <td className="py-1.5 pr-3 whitespace-nowrap">{row.day}</td>
                <td className="py-1.5 pr-3 text-right">{row.trialStarts}</td>
                <td className="py-1.5 pr-3 text-right">{row.paidStarts}</td>
                <td className="py-1.5 pr-3 text-right">{row.cancels}</td>
                <td className="py-1.5 pr-3 text-right">{row.paymentFailures}</td>
                <td className="py-1.5 pr-3 text-right">{row.registrations}</td>
                <td className="py-1.5 pr-3 text-right">{row.uniqueUsers === null ? '' : row.uniqueUsers}</td>
                <td className="py-1.5 pr-3 text-right">{row.pageviews === null ? '' : row.pageviews.toLocaleString()}</td>
                <td className="py-1.5 pr-3 text-right">{row.xImpressions === null ? '' : row.xImpressions.toLocaleString()}</td>
                <td className="py-1.5 pr-3 text-right">{row.xProfileVisits === null ? '' : row.xProfileVisits.toLocaleString()}</td>
                <td className="py-1.5 text-right">{row.googleClicks === null ? '' : row.googleClicks.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {ordered.length > 30 && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-3 px-2.5 py-1 text-xs font-semibold rounded"
          style={{ color: mutedText, border: `1px solid ${borderColor}` }}
        >
          {expanded ? 'Show latest 30' : `Show all ${ordered.length}`}
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Import
// ---------------------------------------------------------------------------

type ImportOutcome = {
  ok: boolean;
  message: string;
  details: string[];
};

/** Whole days between two 'YYYY-MM-DD' keys, or null if either is unusable. */
function daysBetween(from: string | null, to: string | null): number | null {
  if (!from || !to) return null;
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.round((b - a) / 86_400_000);
}

/**
 * How current each imported feed is. These two columns are the only ones on the
 * page that do NOT keep themselves up to date — everything else is derived from
 * the audit log on every load — so the page has to say so out loud, or they go
 * quietly stale and every correlation above starts silently shrinking its n.
 */
function FeedFreshness({
  coverage,
  latestDay,
  mutedText,
  textColor,
}: {
  coverage: CoverageRow[];
  latestDay: string | null;
  mutedText: string;
  textColor: string;
}) {
  const feeds: Array<{ key: MetricKey; label: string }> = [
    { key: 'xImpressions', label: 'X' },
    { key: 'googleClicks', label: 'Google' },
  ];
  return (
    <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs mb-3">
      {feeds.map(({ key, label }) => {
        const row = coverage.find((c) => c.key === key);
        const behind = daysBetween(row?.lastDay ?? null, latestDay);
        const stale = behind === null || behind > 3;
        return (
          <span key={key} style={{ color: stale ? 'var(--color-warning)' : mutedText }}>
            <strong style={{ color: textColor }}>{label}:</strong>{' '}
            {row && row.days > 0 && row.lastDay
              ? behind !== null && behind > 0
                ? `current through ${row.lastDay} — ${behind} day${behind === 1 ? '' : 's'} behind`
                : `current through ${row.lastDay}`
              : 'never imported'}
          </span>
        );
      })}
    </div>
  );
}

function ImportCard({
  coverage,
  latestDay,
  googleSyncConfigured,
  cardBg,
  borderColor,
  mutedText,
  textColor,
  onImported,
}: {
  coverage: CoverageRow[];
  latestDay: string | null;
  googleSyncConfigured: boolean;
  cardBg: string;
  borderColor: string;
  mutedText: string;
  textColor: string;
  onImported: () => void;
}) {
  const [source, setSource] = useState<'x' | 'google' | 'combined'>('x');
  const [csv, setCsv] = useState('');
  const [pending, setPending] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<ImportOutcome | null>(null);

  // Multiple files at once, because X only lets you export a bounded date range:
  // a year of history arrives as a stack of monthly CSVs, and importing them one
  // at a time is a chore with no upside. They are imported in filename order,
  // and since a re-import overwrites only the days it carries, overlapping
  // exports are harmless.
  const onFiles = async (list: FileList | null) => {
    if (!list || list.length === 0) return;
    const files = [...list].sort((a, b) => a.name.localeCompare(b.name));
    setPending(files);
    setOutcome(null);
    if (files.length === 1) setCsv(await files[0].text());
    else setCsv('');
  };

  /** Import one CSV body; returns the parsed result or throws with a message. */
  const importOne = async (body: string, token: string | null) => {
    const res = await fetch('/api/admin/monitoring/daily', {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'x-csrf-token': token } : {}),
      },
      body: JSON.stringify({ source, csv: body }),
    });
    const json = (await res.json().catch(() => ({}))) as {
      error?: string;
      errors?: string[];
      daysWritten?: number;
      firstDay?: string | null;
      lastDay?: string | null;
      ignoredColumns?: string[];
    };
    if (!res.ok) throw new Error(json.error ?? `Import failed (HTTP ${res.status})`);
    return json;
  };

  const syncGoogle = async () => {
    if (busy) return;
    setBusy(true);
    setOutcome(null);
    try {
      const token = await getCsrfToken();
      const res = await fetch('/api/admin/monitoring/daily', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'x-csrf-token': token } : {}),
        },
        body: JSON.stringify({ action: 'sync-google' }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        daysWritten?: number;
        firstDay?: string | null;
        lastDay?: string | null;
        reportedThrough?: string | null;
        zeroFilled?: number;
      };
      if (!res.ok) {
        setOutcome({ ok: false, message: json.error ?? `Sync failed (HTTP ${res.status})`, details: [] });
        return;
      }
      setOutcome({
        ok: true,
        message:
          (json.daysWritten ?? 0) > 0
            ? `Synced ${json.daysWritten} day${json.daysWritten === 1 ? '' : 's'} from Search Console (${json.firstDay} → ${json.lastDay}).`
            : 'Search Console had nothing new to report for this window.',
        details: json.reportedThrough
          ? [
              `Google has reported through ${json.reportedThrough}; it runs a couple of days behind and revises recent days, which is why each sync re-fetches a trailing window.`,
              ...((json.zeroFilled ?? 0) > 0
                ? [`${json.zeroFilled} day(s) inside that span had no search traffic and were written as real zeros.`]
                : []),
            ]
          : [],
      });
      onImported();
    } catch (err) {
      setOutcome({ ok: false, message: err instanceof Error ? err.message : 'Sync failed', details: [] });
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    const batch = pending.length > 0 ? pending : null;
    if (!batch && !csv.trim()) return;
    if (busy) return;
    setBusy(true);
    setOutcome(null);
    try {
      const token = await getCsrfToken();
      const bodies = batch
        ? await Promise.all(batch.map(async (f) => ({ name: f.name, text: await f.text() })))
        : [{ name: 'pasted text', text: csv }];

      let totalDays = 0;
      let firstDay: string | null = null;
      let lastDay: string | null = null;
      const details: string[] = [];
      const failures: string[] = [];

      // Sequential rather than parallel: each import is a write to the same
      // SQLite file, and a partial failure should stop at a known point rather
      // than interleave.
      for (const { name, text } of bodies) {
        try {
          const json = await importOne(text, token);
          totalDays += json.daysWritten ?? 0;
          if (json.firstDay && (firstDay === null || json.firstDay < firstDay)) firstDay = json.firstDay;
          if (json.lastDay && (lastDay === null || json.lastDay > lastDay)) lastDay = json.lastDay;
          for (const problem of json.errors ?? []) details.push(`${name}: ${problem}`);
          if (json.ignoredColumns?.length) {
            details.push(`${name}: columns ignored — ${json.ignoredColumns.join(', ')}`);
          }
        } catch (err) {
          failures.push(`${name}: ${err instanceof Error ? err.message : 'failed'}`);
        }
      }

      if (totalDays === 0 && failures.length > 0) {
        setOutcome({ ok: false, message: failures[0], details: failures.slice(1) });
        return;
      }
      setOutcome({
        ok: true,
        message:
          `Imported ${totalDays} day${totalDays === 1 ? '' : 's'}` +
          (firstDay ? ` (${firstDay} → ${lastDay})` : '') +
          (bodies.length > 1 ? ` from ${bodies.length} files` : '') +
          (failures.length > 0 ? `, ${failures.length} file(s) failed` : '') +
          '.',
        details: [...failures, ...details],
      });
      setCsv('');
      setPending([]);
      onImported();
    } catch (err) {
      setOutcome({ ok: false, message: err instanceof Error ? err.message : 'Import failed', details: [] });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-lg p-4" style={{ backgroundColor: cardBg }}>
      <h3 className="zg-h3 mb-1" style={{ color: textColor }}>Import X / Google numbers</h3>
      <p className="text-xs mb-3" style={{ color: mutedText }}>
        Paste or upload each console&rsquo;s per-day export. <strong>X:</strong> Analytics → Account
        overview → export by day (Impressions, Profile visits). <strong>Google:</strong> Search
        Console → Performance → Export → the &ldquo;Dates&rdquo; sheet (Clicks, Impressions) — only
        needed as a one-off, since the sync below fetches the same numbers from the API.
        Re-importing a corrected export overwrites only the days and columns it contains, so it is
        safe to run repeatedly — and the file picker takes several exports at once, which is how you
        load a year of X history that only exports a month at a time.
      </p>
      <p className="text-xs mb-3" style={{ color: mutedText }}>
        {googleSyncConfigured
          ? 'Google syncs itself daily from Search Console (and on demand with the button below); X has no equivalent — its account-level profile visits are not exposed by any API, so that one stays a paste.'
          : 'Neither feed updates on its own yet. Google can: add a service account to the Search Console property and set GSC_SITE_URL + GSC_SERVICE_ACCOUNT_KEY_FILE (see docs/daily-metrics.md), then a daily timer keeps it current. X has no equivalent — its account-level profile visits are not exposed by any API, so that one stays a paste.'}
      </p>

      <FeedFreshness coverage={coverage} latestDay={latestDay} mutedText={mutedText} textColor={textColor} />

      <div className="flex gap-2 mb-3 flex-wrap">
        {([
          { id: 'x' as const, label: 'X analytics' },
          { id: 'google' as const, label: 'Google Search Console' },
          { id: 'combined' as const, label: 'Combined (this page’s CSV)' },
        ]).map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => setSource(option.id)}
            className="px-2.5 py-1 text-xs font-semibold rounded"
            style={{
              color: source === option.id ? 'var(--color-text-primary)' : mutedText,
              border: `1px solid ${source === option.id ? 'var(--color-warning)' : borderColor}`,
            }}
          >
            {option.label}
          </button>
        ))}
      </div>

      <input
        type="file"
        multiple
        accept=".csv,.tsv,text/csv,text/tab-separated-values,text/plain"
        onChange={(e) => onFiles(e.target.files)}
        className="text-xs mb-2 block"
        style={{ color: mutedText }}
      />
      {pending.length > 1 && (
        <p className="text-xs mb-2" style={{ color: mutedText }}>
          {pending.length} files queued, imported oldest-name first:{' '}
          {pending.map((f) => f.name).join(', ')}
        </p>
      )}
      <textarea
        value={csv}
        disabled={pending.length > 1}
        onChange={(e) => {
          setCsv(e.target.value);
          setOutcome(null);
        }}
        rows={6}
        spellCheck={false}
        placeholder={'Date,Impressions,Profile visits\n2026-08-01,12430,188'}
        className="w-full rounded p-2 text-xs font-mono"
        style={{ backgroundColor: 'var(--color-surface-alt, transparent)', border: `1px solid ${borderColor}`, color: textColor }}
      />

      <div className="flex items-center gap-3 mt-2 flex-wrap">
        <button
          type="button"
          onClick={submit}
          disabled={busy || (!csv.trim() && pending.length === 0)}
          className="px-3 py-1.5 text-xs font-semibold rounded"
          style={{
            color: 'var(--color-text-primary)',
            border: `1px solid ${csv.trim() || pending.length > 0 ? 'var(--color-warning)' : borderColor}`,
            opacity: busy || (!csv.trim() && pending.length === 0) ? 0.5 : 1,
          }}
        >
          {busy ? 'Importing…' : pending.length > 1 ? `Import ${pending.length} files` : 'Import'}
        </button>
        <button
          type="button"
          onClick={syncGoogle}
          disabled={busy}
          className="px-3 py-1.5 text-xs font-semibold rounded"
          style={{ color: mutedText, border: `1px solid ${borderColor}`, opacity: busy ? 0.5 : 1 }}
          title={
            googleSyncConfigured
              ? 'Pull the last two weeks straight from Search Console'
              : 'Search Console credentials are not configured on this server yet'
          }
        >
          {busy ? 'Working…' : 'Sync Google now'}
        </button>
        {outcome && (
          <span className="text-xs" style={{ color: outcome.ok ? 'var(--color-warning)' : FAILURE_COLOR }}>
            {outcome.message}
          </span>
        )}
      </div>

      {outcome && outcome.details.length > 0 && (
        <ul className="mt-2 text-xs list-disc pl-5 space-y-0.5" style={{ color: mutedText }}>
          {outcome.details.slice(0, 10).map((detail) => (
            <li key={detail}>{detail}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
