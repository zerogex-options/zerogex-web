'use client';

import { TrendingDown, TrendingUp } from 'lucide-react';
import { Theme } from '@/core/types';
import MetricCard from './MetricCard';
import { colors } from '@/core/colors';

interface PriceDistanceMetricCardProps {
  title: string;
  level: number | null | undefined;
  spotPrice: number | null | undefined;
  tooltip: string;
  theme?: Theme;
}

function getDistanceMeta(level: number | null | undefined, spotPrice: number | null | undefined) {
  if (level == null || spotPrice == null || spotPrice === 0) return null;

  const delta = level - spotPrice;
  const pct = (delta / spotPrice) * 100;
  const isAbove = delta >= 0;

  return {
    isAbove,
    color: isAbove ? colors.bullish : colors.bearish,
    deltaLabel: `${isAbove ? '+' : '-'}$${Math.abs(delta).toFixed(2)}`,
    pctLabel: `${isAbove ? '+' : '-'}${Math.abs(pct).toFixed(2)}%`,
  };
}

export default function PriceDistanceMetricCard({
  title,
  level,
  spotPrice,
  tooltip,
  theme,
}: PriceDistanceMetricCardProps) {
  const distanceMeta = getDistanceMeta(level, spotPrice);

  return (
    <MetricCard
      title={title}
      value={level != null ? `$${level.toFixed(2)}` : 'N/A'}
      subtitle={distanceMeta ? (
        <span className="inline-flex items-center gap-1" style={{ color: distanceMeta.color }}>
          {distanceMeta.isAbove ? <TrendingUp size={14} strokeWidth={2.5} /> : <TrendingDown size={14} strokeWidth={2.5} />}
          <span>{`${distanceMeta.deltaLabel} / ${distanceMeta.pctLabel}`}</span>
        </span>
      ) : 'Awaiting underlying price context'}
      tooltip={tooltip}
      theme={theme}
      trend="neutral"
    />
  );
}
