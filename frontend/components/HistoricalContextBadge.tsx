'use client';

import { useMemo } from 'react';
import { Trophy } from 'lucide-react';
import { colors } from '@/core/colors';
import TooltipWrapper from './TooltipWrapper';
import type { GEXHistoricalMetric, GEXHistoricalRegime } from '@/core/types';

/**
 * Compact "vs historical" chip rendered next to the headline value on
 * MetricCards.  Reads a single (metric × window) block out of the
 * /api/gex/historical-context response and renders:
 *
 *   * the regime label (EXTREME HIGH / ELEVATED / NORMAL / LOW / EXTREME LOW)
 *   * a trophy icon when the value is a record for this window
 *   * the interpolated percentile against the window
 *   * a hover tooltip with mean / range / z-score / sample count / TOD
 *     bucket and a footer line explaining what the trophy means (record
 *     for the 30-day period or since the all-time tracking-start date).
 *
 * Defaults to the rolling-30-day window because that's what the user
 * cares about for "is this irregularly high right now"; pass
 * ``window="all_time"`` for the "is this a record since we started
 * tracking" view.
 *
 * Renders nothing while the data is loading, the window has no stats
 * row, or the regime is unknown — the parent MetricCard stays visually
 * stable instead of flickering placeholders.
 */
interface Props {
  metric: GEXHistoricalMetric | undefined | null;
  window?: '30d' | 'all_time';
  label?: string;
  /** Tracking-start date (ISO) carried at the top level of the response.
   * Used only for the all-time trophy tooltip's "since YYYY-MM-DD" copy. */
  trackingStartedAt?: string | null;
}

const REGIME_LABELS: Record<GEXHistoricalRegime, string> = {
  extreme_high: 'EXTREME HIGH',
  elevated: 'ELEVATED',
  normal: 'NORMAL',
  low: 'LOW',
  extreme_low: 'EXTREME LOW',
  unknown: '',
};

function regimeColor(regime: GEXHistoricalRegime): { bg: string; fg: string } {
  switch (regime) {
    case 'extreme_high':
      return { bg: 'rgba(27, 196, 125, 0.18)', fg: colors.bullish };
    case 'elevated':
      return { bg: 'rgba(245, 158, 11, 0.18)', fg: colors.neutral };
    case 'low':
      return { bg: 'rgba(245, 158, 11, 0.18)', fg: colors.neutral };
    case 'extreme_low':
      return { bg: 'rgba(255, 77, 90, 0.18)', fg: colors.bearish };
    case 'normal':
      return { bg: 'rgba(255, 211, 128, 0.10)', fg: colors.muted };
    default:
      return { bg: 'transparent', fg: colors.muted };
  }
}

function formatGexCompact(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '--';
  const abs = Math.abs(value);
  const sign = value >= 0 ? '+' : '-';
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(0)}K`;
  return `${sign}$${abs.toFixed(0)}`;
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

export default function HistoricalContextBadge({
  metric,
  window: windowLabel = '30d',
  label,
  trackingStartedAt,
}: Props) {
  const stats = metric?.windows?.[windowLabel] ?? null;

  const content = useMemo(() => {
    if (!stats || stats.regime === 'unknown') return null;
    const labelText = REGIME_LABELS[stats.regime];
    const pct = stats.percentile;
    const pctText = pct != null ? `P${Math.round(pct)}` : null;
    const windowText = label ?? (windowLabel === 'all_time' ? 'all-time' : '30d');
    return { labelText, pctText, windowText };
  }, [stats, label, windowLabel]);

  if (!content || !stats) return null;

  const isRecord = stats.is_record_high || stats.is_record_low;
  const recordDirection: 'high' | 'low' | null =
    stats.is_record_high ? 'high' : stats.is_record_low ? 'low' : null;

  const { bg, fg } = regimeColor(stats.regime);

  // Trophy-legend line is the lead of the tooltip when it's there — it's
  // the thing the user needs explained.  For 30d records we say "30-day
  // record"; for all-time records we cite the tracking-start date when
  // we have one ("Record since Mar 15, 2026").
  const trophyLegend: string | null = isRecord
    ? (() => {
        const dir = recordDirection === 'high' ? 'high' : 'low';
        if (windowLabel === 'all_time') {
          const since = formatTrackingDate(trackingStartedAt);
          return since
            ? `🏆 All-time record ${dir} (since ${since})`
            : `🏆 All-time record ${dir}`;
        }
        return `🏆 30-day record ${dir}`;
      })()
    : null;

  const tooltipLines: string[] = [];
  if (trophyLegend) tooltipLines.push(trophyLegend);
  tooltipLines.push(`${content.labelText} vs ${content.windowText}`);
  if (stats.percentile != null) {
    tooltipLines.push(`Percentile: ${stats.percentile.toFixed(1)}`);
  }
  if (stats.z_score != null) {
    tooltipLines.push(`Z-score: ${stats.z_score.toFixed(2)}σ`);
  }
  if (stats.mean != null) {
    tooltipLines.push(`Window mean: ${formatGexCompact(stats.mean)}`);
  }
  if (stats.min != null && stats.max != null) {
    tooltipLines.push(
      `Window range: ${formatGexCompact(stats.min)} → ${formatGexCompact(stats.max)}`,
    );
  }
  if (stats.sample_size != null) {
    tooltipLines.push(`Samples: ${stats.sample_size.toLocaleString()}`);
  }
  if (stats.tod_bucket_used != null && stats.tod_bucket_used >= 0) {
    const minutesFromOpen = stats.tod_bucket_used * 5;
    const h = 9 + Math.floor((30 + minutesFromOpen) / 60);
    const m = (30 + minutesFromOpen) % 60;
    tooltipLines.push(`TOD bucket: ${h}:${String(m).padStart(2, '0')} ET`);
  } else if (stats.tod_bucket_used === -1) {
    tooltipLines.push('TOD bucket: all-day (flat fallback)');
  }

  return (
    <TooltipWrapper text={tooltipLines.join('\n')}>
      <span
        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold tracking-wider uppercase whitespace-nowrap"
        style={{ backgroundColor: bg, color: fg }}
      >
        {isRecord && (
          <Trophy
            size={11}
            strokeWidth={2.5}
            aria-label={`Record ${recordDirection} for the ${content.windowText} window`}
          />
        )}
        <span>{content.labelText}</span>
        {content.pctText && (
          <span style={{ opacity: 0.8 }}>· {content.pctText}</span>
        )}
        <span style={{ opacity: 0.6 }}>· {content.windowText}</span>
      </span>
    </TooltipWrapper>
  );
}
