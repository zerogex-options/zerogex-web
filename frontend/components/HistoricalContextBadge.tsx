'use client';

import { useMemo } from 'react';
import { colors } from '@/core/colors';
import TooltipWrapper from './TooltipWrapper';
import type { GEXHistoricalMetric, GEXHistoricalRegime } from '@/core/types';

/**
 * Compact "vs historical" chip rendered next to the headline value on
 * MetricCards.  Reads a single (metric × window) block out of the
 * /api/gex/historical-context response and renders:
 *
 *   * a regime label (RECORD, EXTREME, ELEVATED, NORMAL, LOW, ...)
 *   * the interpolated percentile against the requested window
 *   * a hover tooltip with mean/min/max, z-score, and the TOD bucket used
 *
 * Defaults to the rolling-30-day window because that's what the user
 * cares about for "is this irregularly high right now"; pass
 * ``window="all_time"`` for the "is this a record" view.
 *
 * Renders nothing while the data is loading, the window has no stats
 * row, or the regime is unknown — the parent MetricCard stays visually
 * stable instead of flickering placeholders.
 */
interface Props {
  metric: GEXHistoricalMetric | undefined | null;
  window?: '30d' | 'all_time';
  label?: string;
}

const REGIME_LABELS: Record<GEXHistoricalRegime, string> = {
  record_high: 'RECORD HIGH',
  extreme_high: 'EXTREME HIGH',
  elevated: 'ELEVATED',
  normal: 'NORMAL',
  low: 'LOW',
  extreme_low: 'EXTREME LOW',
  record_low: 'RECORD LOW',
  unknown: '',
};

function regimeColor(regime: GEXHistoricalRegime): { bg: string; fg: string } {
  switch (regime) {
    case 'record_high':
      return { bg: 'rgba(27, 196, 125, 0.22)', fg: colors.bullish };
    case 'extreme_high':
      return { bg: 'rgba(27, 196, 125, 0.16)', fg: colors.bullish };
    case 'elevated':
      return { bg: 'rgba(245, 158, 11, 0.18)', fg: colors.neutral };
    case 'low':
      return { bg: 'rgba(245, 158, 11, 0.18)', fg: colors.neutral };
    case 'extreme_low':
      return { bg: 'rgba(255, 77, 90, 0.16)', fg: colors.bearish };
    case 'record_low':
      return { bg: 'rgba(255, 77, 90, 0.22)', fg: colors.bearish };
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

export default function HistoricalContextBadge({
  metric,
  window: windowLabel = '30d',
  label,
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

  if (!content) return null;
  if (!stats) return null;

  const { bg, fg } = regimeColor(stats.regime);

  const tooltipLines: string[] = [];
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
        <span>{content.labelText}</span>
        {content.pctText && (
          <span style={{ opacity: 0.8 }}>· {content.pctText}</span>
        )}
        <span style={{ opacity: 0.6 }}>· {content.windowText}</span>
      </span>
    </TooltipWrapper>
  );
}
