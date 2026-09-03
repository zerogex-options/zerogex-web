'use client';

import { TrendingDown, TrendingUp } from 'lucide-react';
import { Theme } from '@/core/types';
import MetricCard from './MetricCard';
import { keyLevelDistance } from '@/core/keyLevels';
import { colors } from '@/core/colors';

interface PriceDistanceMetricCardProps {
  title: string;
  level: number | null | undefined;
  spotPrice: number | null | undefined;
  tooltip: string;
  theme?: Theme;
}

// The distance format (signed dollars / signed percent / above-or-below spot)
// is shared with the Key Levels strip and widget via core/keyLevels, so a level
// reads identically wherever it is rendered. Only the color + icon are local.
function getDistanceMeta(level: number | null | undefined, spotPrice: number | null | undefined) {
  const distance = keyLevelDistance(level, spotPrice);
  if (!distance) return null;
  return {
    ...distance,
    color: distance.isAbove ? 'var(--color-bull)' : 'var(--color-bear)',
    spotRelationLabel: distance.relationLabel,
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
  // Distinguish the two reasons distanceMeta can be missing so the
  // subtitle stops claiming "Awaiting underlying price context" when
  // the underlying price is in fact present and it's the level itself
  // that the backend could not resolve this snapshot (e.g., the SPX
  // gamma-flip-unresolved case where the latest gex_summary row has
  // gamma_flip_point = NULL).
  const fallbackLabel = spotPrice == null || spotPrice === 0
    ? 'Awaiting underlying price context'
    : `${title} unresolved this snapshot`;

  return (
    <MetricCard
      title={title}
      value={level != null ? `$${level.toFixed(2)}` : 'N/A'}
      subtitle={distanceMeta ? (
        <span className="inline-flex items-center gap-1" style={{ color: distanceMeta.color }}>
          {distanceMeta.isAbove ? <TrendingUp size={14} strokeWidth={2.5} /> : <TrendingDown size={14} strokeWidth={2.5} />}
          <span>{`${distanceMeta.deltaLabel} / ${distanceMeta.pctLabel} ${distanceMeta.spotRelationLabel}`}</span>
        </span>
      ) : fallbackLabel}
      tooltip={tooltip}
      theme={theme}
      trend="neutral"
    />
  );
}
