'use client';

import { Trophy } from 'lucide-react';
import { useGEXHistoricalContext } from '@/hooks/useApiData';
import type {
  GEXHistoricalMetric,
  GEXHistoricalRegime,
  GEXHistoricalWindow,
} from '@/core/types';
import { colors } from '@/core/colors';
import LoadingSpinner from '@/components/LoadingSpinner';
import ErrorMessage from '@/components/ErrorMessage';

/**
 * Gamma Pulse panel — historical-context view for the headline
 * dealer-gamma metrics.  Drops into any page that wants to surface
 * "is current dealer gamma irregular?" inline.
 *
 * For each of ``net_gex_at_spot`` and ``total_net_gex`` the panel shows:
 *   * live current value and regime label (EXTREME HIGH / ELEVATED /
 *     NORMAL / LOW / EXTREME LOW), against both rolling-30-day and
 *     all-time distributions
 *   * a trophy icon when the value sets a record for that window, with
 *     a legend line citing "30-day record" or "All-time record (since
 *     YYYY-MM-DD)"
 *   * a horizontal band visualization with the current marker placed
 *     between p05 and p95
 *
 * Data comes from /api/gex/historical-context (pre-aggregated distributions
 * refreshed nightly out of ``gex_historical_stats``).  The endpoint
 * supplies percentile, z-score, regime label, and record flags directly
 * so this component is purely presentational.
 */

interface MetricDefinition {
  key: 'net_gex_at_spot' | 'total_net_gex';
  title: string;
  description: string;
}

const METRIC_DEFINITIONS: MetricDefinition[] = [
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
  extreme_high: 'EXTREME HIGH',
  elevated: 'ELEVATED',
  normal: 'NORMAL',
  low: 'LOW',
  extreme_low: 'EXTREME LOW',
  unknown: 'NO DATA',
};

function regimeAccent(regime: GEXHistoricalRegime): string {
  switch (regime) {
    case 'extreme_high':
      return 'var(--color-bull)';
    case 'elevated':
    case 'low':
      return 'var(--color-warning)';
    case 'extreme_low':
      return 'var(--color-bear)';
    default:
      return 'var(--text-secondary)';
  }
}

function formatTrackingDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return iso;
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
      <div className="flex justify-between text-[10px] font-mono" style={{ color: 'var(--text-secondary)' }}>
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
  trackingStartedAt: string | null;
}

function WindowCard({ metric, windowLabel, windowDisplay, trackingStartedAt }: WindowCardProps) {
  const stats = metric.windows?.[windowLabel] ?? null;
  if (!stats) {
    return (
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-5">
        <div className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-secondary)' }}>
          {windowDisplay}
        </div>
        <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          No historical distribution available yet. The nightly refresh seeds this once
          there are enough samples in <code>gex_summary</code>.
        </div>
      </div>
    );
  }

  const accent = regimeAccent(stats.regime);
  const percentile = stats.percentile;
  const zScore = stats.z_score;
  const isRecord = stats.is_record_high || stats.is_record_low;
  const recordDirection: 'high' | 'low' | null =
    stats.is_record_high ? 'high' : stats.is_record_low ? 'low' : null;
  const trackingSince = formatTrackingDate(trackingStartedAt);
  const trophyLegend = isRecord
    ? windowLabel === 'all_time'
      ? trackingSince
        ? `All-time record ${recordDirection} since ${trackingSince}`
        : `All-time record ${recordDirection}`
      : `30-day record ${recordDirection}`
    : null;

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-5 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
          {windowDisplay}
        </div>
        <span
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold tracking-wider uppercase"
          style={{ backgroundColor: `${accent}22`, color: accent }}
        >
          {isRecord && (
            <Trophy size={11} strokeWidth={2.5} aria-label={trophyLegend ?? 'record'} />
          )}
          {REGIME_LABELS[stats.regime]}
        </span>
      </div>

      {trophyLegend && (
        <div
          className="flex items-center gap-1.5 text-[11px] font-semibold"
          style={{ color: accent }}
        >
          <Trophy size={12} strokeWidth={2.5} />
          <span>{trophyLegend}</span>
        </div>
      )}

      <BandVisualization stats={stats} current={metric.current} />

      <div className="grid grid-cols-3 gap-2 text-xs">
        <div>
          <div style={{ color: 'var(--text-secondary)' }}>Percentile</div>
          <div className="font-mono text-lg" style={{ color: accent }}>
            {percentile != null ? `P${percentile.toFixed(1)}` : '—'}
          </div>
        </div>
        <div>
          <div style={{ color: 'var(--text-secondary)' }}>Z-score</div>
          <div className="font-mono text-lg">
            {zScore != null ? `${zScore.toFixed(2)}σ` : '—'}
          </div>
        </div>
        <div>
          <div style={{ color: 'var(--text-secondary)' }}>Samples</div>
          <div className="font-mono text-lg">{stats.sample_size.toLocaleString()}</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-[var(--color-border)]">
        <div>
          <div style={{ color: 'var(--text-secondary)' }}>Mean</div>
          <div className="font-mono">{formatGexCompact(stats.mean)}</div>
        </div>
        <div>
          <div style={{ color: 'var(--text-secondary)' }}>Std dev</div>
          <div className="font-mono">{formatGexCompact(stats.std)}</div>
        </div>
        <div>
          <div style={{ color: 'var(--text-secondary)' }}>Window min</div>
          <div className="font-mono">{formatGexCompact(stats.min)}</div>
        </div>
        <div>
          <div style={{ color: 'var(--text-secondary)' }}>Window max</div>
          <div className="font-mono">{formatGexCompact(stats.max)}</div>
        </div>
      </div>

      {stats.tod_bucket_used === -1 && (
        <div className="text-[10px] italic" style={{ color: 'var(--text-secondary)' }}>
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
  trackingStartedAt: string | null;
}

function MetricSection({ title, description, metric, trackingStartedAt }: MetricSectionProps) {
  if (!metric) return null;
  const currentLabel = formatGexCompact(metric.current);
  const trend30d = metric.windows?.['30d']?.regime ?? 'unknown';
  const accent = regimeAccent(trend30d);

  return (
    <section className="zg-feature-shell p-6 space-y-4">
      <div className="flex items-start gap-4 flex-wrap">
        <div className="flex-1 min-w-[240px]">
          <h3 className="text-xl font-semibold mb-1">{title}</h3>
          <p className="text-sm italic" style={{ color: 'var(--text-secondary)' }}>{description}</p>
        </div>
        <div className="text-right">
          <div className="text-xs uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
            Current
          </div>
          <div className="text-3xl font-bold" style={{ color: accent }}>{currentLabel}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <WindowCard
          metric={metric}
          windowLabel="30d"
          windowDisplay="vs Rolling 30 Days"
          trackingStartedAt={trackingStartedAt}
        />
        <WindowCard
          metric={metric}
          windowLabel="all_time"
          windowDisplay="vs All-Time"
          trackingStartedAt={trackingStartedAt}
        />
      </div>
    </section>
  );
}

interface GammaPulsePanelProps {
  symbol: string;
  refreshInterval?: number;
}

export default function GammaPulsePanel({ symbol, refreshInterval = 15000 }: GammaPulsePanelProps) {
  const { data, loading, error, refetch } = useGEXHistoricalContext(symbol, refreshInterval);

  if (loading && !data) return <LoadingSpinner size="lg" />;

  return (
    <div className="space-y-4">
      <div className="flex items-baseline gap-3 flex-wrap">
        <h2 className="text-2xl font-semibold">Gamma Pulse</h2>
        <span className="text-sm italic" style={{ color: 'var(--text-secondary)' }}>
          &ldquo;Is current dealer gamma irregular?&rdquo;
        </span>
        {data && !data.in_rth && (
          <span className="text-xs italic" style={{ color: 'var(--text-secondary)' }}>
            · outside RTH — flat distribution
          </span>
        )}
      </div>
      <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
        Compares the live headline GEX figures against historical distributions
        (rolling-30-day and all-time) so you can tell at a glance whether the
        current dealer-positioning reading is a record, an extreme, elevated,
        or normal for this point in the session. Time-of-day-aware so the
        structural end-of-day pin doesn&apos;t get mis-flagged.
      </p>

      {error && <ErrorMessage message={error} onRetry={refetch} />}

      {data && METRIC_DEFINITIONS.map((def) => (
        <MetricSection
          key={def.key}
          title={def.title}
          description={def.description}
          metric={data.metrics?.[def.key]}
          trackingStartedAt={data.tracking_started_at}
        />
      ))}

      {!loading && !data && !error && (
        <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          No historical context is available for {symbol} yet. The nightly
          refresh populates the distribution table once enough samples accumulate
          in <code>gex_summary</code>.
        </div>
      )}
    </div>
  );
}
