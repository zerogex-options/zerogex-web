'use client';

import { useMemo } from 'react';
import { Activity } from 'lucide-react';
import { useTimeframe } from '@/core/TimeframeContext';
import { useGEXHistoricalContext } from '@/hooks/useApiData';
import type {
  GEXHistoricalMetric,
  GEXHistoricalRegime,
  GEXHistoricalWindow,
} from '@/core/types';
import { colors } from '@/core/colors';
import { useTheme } from '@/core/ThemeContext';
import LoadingSpinner from '@/components/LoadingSpinner';
import ErrorMessage from '@/components/ErrorMessage';
import SignalPageTitle from '@/components/SignalPageTitle';

/**
 * Gamma Pulse — historical-context dashboard for the headline dealer-gamma
 * metrics.  For each of ``net_gex_at_spot`` and ``total_net_gex`` the page
 * shows:
 *
 *   * the live current value and its regime label (RECORD / EXTREME /
 *     ELEVATED / NORMAL / LOW), against both a rolling-30-day window
 *     and the all-time distribution
 *   * a horizontal band visualization with the current marker placed
 *     between p05 and p95
 *   * mean ± 1σ / 2σ bands and the all-time min/max as orientation
 *
 * Data comes from /api/gex/historical-context, which reads pre-aggregated
 * distributions out of ``gex_historical_stats`` (refreshed nightly) and
 * compares them against the latest ``gex_summary`` row.  The endpoint
 * already supplies percentile, z-score, and regime labels, so this page
 * is purely presentational.
 */

const METRIC_DEFINITIONS: Array<{
  key: 'net_gex_at_spot' | 'total_net_gex';
  title: string;
  description: string;
}> = [
  {
    key: 'net_gex_at_spot',
    title: 'Net GEX at Spot',
    description:
      "Cumulative dealer gamma at the current spot price — the value of the same low→high cumulative curve whose zero crossing is the gamma flip. Positive = dealers net long gamma here (pinning, mean-reversion). Negative = net short gamma here (trending, vol amplification).",
  },
  {
    key: 'total_net_gex',
    title: 'Total Net GEX (chain-wide)',
    description:
      'Sum of dealer gamma across every strike in the option chain. Sign can differ from Net GEX at Spot when far-OTM strikes dominate the tail.',
  },
];

const REGIME_LABELS: Record<GEXHistoricalRegime, string> = {
  record_high: 'RECORD HIGH',
  extreme_high: 'EXTREME HIGH',
  elevated: 'ELEVATED',
  normal: 'NORMAL',
  low: 'LOW',
  extreme_low: 'EXTREME LOW',
  record_low: 'RECORD LOW',
  unknown: 'NO DATA',
};

function regimeAccent(regime: GEXHistoricalRegime): string {
  switch (regime) {
    case 'record_high':
    case 'extreme_high':
      return colors.bullish;
    case 'elevated':
    case 'low':
      return colors.neutral;
    case 'extreme_low':
    case 'record_low':
      return colors.bearish;
    default:
      return colors.muted;
  }
}

function formatGexCompact(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '--';
  const abs = Math.abs(value);
  const sign = value >= 0 ? '+' : '-';
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(0)}K`;
  return `${sign}$${abs.toFixed(0)}`;
}

interface BandProps {
  stats: GEXHistoricalWindow;
  current: number | null;
}

/** Horizontal "where does the live value land within the historical band"
 * visualization.  Maps min..max to 0..100%, draws gradient stops at the
 * stored percentile anchors, and places a marker at the current value. */
function BandVisualization({ stats, current }: BandProps) {
  const { min, max, p05, p25, p50, p75, p95 } = stats;

  if (
    min == null || max == null ||
    p05 == null || p25 == null || p50 == null || p75 == null || p95 == null ||
    max <= min
  ) {
    return null;
  }

  const toPct = (v: number) => ((v - min) / (max - min)) * 100;
  const currentPct = current != null && Number.isFinite(current)
    ? Math.max(0, Math.min(100, toPct(current)))
    : null;

  return (
    <div className="space-y-1">
      <div className="relative h-3 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--color-surface-subtle)' }}>
        {/* p25-p75 (interquartile range) — slightly darker band */}
        <div
          className="absolute inset-y-0"
          style={{
            left: `${toPct(p25)}%`,
            width: `${toPct(p75) - toPct(p25)}%`,
            backgroundColor: 'rgba(245, 158, 11, 0.18)',
          }}
        />
        {/* p05-p95 (the "normal" envelope) — light shade above the IQR */}
        <div
          className="absolute inset-y-0"
          style={{
            left: `${toPct(p05)}%`,
            width: `${toPct(p95) - toPct(p05)}%`,
            backgroundColor: 'rgba(245, 158, 11, 0.08)',
            zIndex: -1,
          }}
        />
        {/* p50 marker */}
        <div
          className="absolute inset-y-0 w-px"
          style={{ left: `${toPct(p50)}%`, backgroundColor: 'var(--color-text-secondary)' }}
        />
        {/* current marker */}
        {currentPct != null && (
          <div
            className="absolute inset-y-0 w-1 rounded-full"
            style={{
              left: `calc(${currentPct}% - 2px)`,
              backgroundColor: regimeAccent(stats.regime),
              boxShadow: '0 0 8px rgba(0,0,0,0.4)',
            }}
          />
        )}
      </div>
      <div className="flex justify-between text-[10px] font-mono" style={{ color: colors.muted }}>
        <span>{formatGexCompact(min)}</span>
        <span>{formatGexCompact(p50)}</span>
        <span>{formatGexCompact(max)}</span>
      </div>
    </div>
  );
}

interface WindowCardProps {
  metric: GEXHistoricalMetric;
  windowLabel: '30d' | 'all_time';
  windowDisplay: string;
}

function WindowCard({ metric, windowLabel, windowDisplay }: WindowCardProps) {
  const stats = metric.windows?.[windowLabel] ?? null;
  if (!stats) {
    return (
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-5">
        <div className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: colors.muted }}>
          {windowDisplay}
        </div>
        <div className="text-sm" style={{ color: colors.muted }}>
          No historical distribution available yet. The nightly refresh seeds this once
          there are enough samples in <code>gex_summary</code>.
        </div>
      </div>
    );
  }

  const accent = regimeAccent(stats.regime);
  const percentile = stats.percentile;
  const zScore = stats.z_score;

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-5 space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold uppercase tracking-wider" style={{ color: colors.muted }}>
          {windowDisplay}
        </div>
        <span
          className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold tracking-wider uppercase"
          style={{ backgroundColor: `${accent}22`, color: accent }}
        >
          {REGIME_LABELS[stats.regime]}
        </span>
      </div>

      <BandVisualization stats={stats} current={metric.current} />

      <div className="grid grid-cols-3 gap-2 text-xs">
        <div>
          <div style={{ color: colors.muted }}>Percentile</div>
          <div className="font-mono text-lg" style={{ color: accent }}>
            {percentile != null ? `P${percentile.toFixed(1)}` : '—'}
          </div>
        </div>
        <div>
          <div style={{ color: colors.muted }}>Z-score</div>
          <div className="font-mono text-lg">
            {zScore != null ? `${zScore.toFixed(2)}σ` : '—'}
          </div>
        </div>
        <div>
          <div style={{ color: colors.muted }}>Samples</div>
          <div className="font-mono text-lg">{stats.sample_size.toLocaleString()}</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-[var(--color-border)]">
        <div>
          <div style={{ color: colors.muted }}>Mean</div>
          <div className="font-mono">{formatGexCompact(stats.mean)}</div>
        </div>
        <div>
          <div style={{ color: colors.muted }}>Std dev</div>
          <div className="font-mono">{formatGexCompact(stats.std)}</div>
        </div>
        <div>
          <div style={{ color: colors.muted }}>Window min</div>
          <div className="font-mono">{formatGexCompact(stats.min)}</div>
        </div>
        <div>
          <div style={{ color: colors.muted }}>Window max</div>
          <div className="font-mono">{formatGexCompact(stats.max)}</div>
        </div>
      </div>

      {stats.tod_bucket_used === -1 && (
        <div className="text-[10px] italic" style={{ color: colors.muted }}>
          Using all-day (flat) distribution — the specific time-of-day bucket had too few samples.
        </div>
      )}
    </div>
  );
}

interface MetricSectionProps {
  title: string;
  description: string;
  metric: GEXHistoricalMetric | undefined;
}

function MetricSection({ title, description, metric }: MetricSectionProps) {
  if (!metric) return null;
  const currentLabel = formatGexCompact(metric.current);
  const trend30d = metric.windows?.['30d']?.regime ?? 'unknown';
  const accent = regimeAccent(trend30d);

  return (
    <section className="zg-feature-shell p-6 space-y-4">
      <div className="flex items-start gap-4 flex-wrap">
        <div className="flex-1 min-w-[240px]">
          <h2 className="text-xl font-semibold mb-1">{title}</h2>
          <p className="text-sm italic" style={{ color: colors.muted }}>{description}</p>
        </div>
        <div className="text-right">
          <div className="text-xs uppercase tracking-wider" style={{ color: colors.muted }}>
            Current
          </div>
          <div className="text-3xl font-bold" style={{ color: accent }}>{currentLabel}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <WindowCard metric={metric} windowLabel="30d" windowDisplay="vs Rolling 30 Days" />
        <WindowCard metric={metric} windowLabel="all_time" windowDisplay="vs All-Time" />
      </div>
    </section>
  );
}

export default function GammaPulsePage() {
  const { symbol } = useTimeframe();
  // Suppress the unused-warning if theme is not directly referenced.
  useTheme();
  const { data, loading, error, refetch } = useGEXHistoricalContext(symbol, 15000);

  const dataTimestamp = data?.timestamp;
  const tsLabel = useMemo(() => {
    if (!dataTimestamp) return null;
    try {
      return new Date(dataTimestamp).toLocaleString(undefined, {
        hour: '2-digit',
        minute: '2-digit',
        month: 'short',
        day: 'numeric',
        timeZoneName: 'short',
      });
    } catch {
      return dataTimestamp;
    }
  }, [dataTimestamp]);

  if (loading && !data) return <LoadingSpinner size="lg" />;

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      <SignalPageTitle
        title="Gamma Pulse"
        subtitle={'"Is current dealer gamma irregular?"'}
        icon={Activity}
        tooltip="Compares live Net GEX figures against historical distributions (rolling-30-day and all-time) so you can tell at a glance whether the current dealer-positioning reading is a record, an extreme, elevated, or normal for this point in the session. Time-of-day-aware so the structural end-of-day pin doesn't get mis-flagged."
        rightSlot={
          <div className="text-xs font-mono text-right" style={{ color: colors.muted }}>
            <div>{symbol}</div>
            {tsLabel && <div>{tsLabel}</div>}
            {data && !data.in_rth && (
              <div className="italic">outside RTH — flat distribution</div>
            )}
          </div>
        }
      />

      {error && <ErrorMessage message={error} onRetry={refetch} />}

      {data && METRIC_DEFINITIONS.map((def) => (
        <MetricSection
          key={def.key}
          title={def.title}
          description={def.description}
          metric={data.metrics?.[def.key]}
        />
      ))}

      {!loading && !data && !error && (
        <div className="text-sm" style={{ color: colors.muted }}>
          No historical context is available for {symbol} yet. The nightly
          refresh populates the distribution table once enough samples accumulate
          in <code>gex_summary</code>.
        </div>
      )}
    </div>
  );
}
