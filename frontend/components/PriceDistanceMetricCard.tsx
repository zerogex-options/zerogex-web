'use client';

import { HelpCircle, TrendingDown, TrendingUp } from 'lucide-react';
import { Theme } from '@/core/types';
import MetricCard from './MetricCard';
import {
  keyLevelDistance,
  levelSourceChain,
  unresolvedLevelTooltip,
  LEVEL_UNRESOLVED_NOTE,
  type UnresolvedLevelKind,
} from '@/core/keyLevels';

interface PriceDistanceMetricCardProps {
  title: string;
  level: number | null | undefined;
  spotPrice: number | null | undefined;
  tooltip: string;
  theme?: Theme;
  /**
   * The symbol the level belongs to. Only used for the empty state, which has
   * to name the backing chain for ES / NQ — their levels are the SPX / NDX
   * levels on the futures axis, so an unresolved one is not an NQ fault and
   * the card should not let a trader conclude that it is.
   */
  symbol?: string | null;
  /**
   * Localized override for the "why is this empty" tooltip. Omit and the card
   * uses core/keyLevels' shared English explainer, which is also what the Key
   * Levels strip shows for the same state.
   */
  unresolvedTooltip?: string;
  /**
   * Which "why is this empty" story fits this level — a zero crossing that did
   * not qualify ('flip') or a strike ranking with nothing to rank ('strike').
   * Only consulted when `unresolvedTooltip` is not supplied.
   */
  unresolvedKind?: UnresolvedLevelKind;
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
  symbol,
  unresolvedTooltip,
  unresolvedKind = 'flip',
}: PriceDistanceMetricCardProps) {
  const distanceMeta = getDistanceMeta(level, spotPrice);
  // Distinguish the two reasons distanceMeta can be missing so the
  // subtitle stops claiming "Awaiting underlying price context" when
  // the underlying price is in fact present and it's the level itself
  // that the backend could not resolve this snapshot (e.g., the SPX
  // gamma-flip-unresolved case where the latest gex_summary row has
  // gamma_flip_point = NULL).
  const hasSpot = spotPrice != null && spotPrice !== 0;
  const unresolved = hasSpot && level == null;
  // "Gamma Flip unresolved this snapshot" — the strip's note, prefixed with the
  // level's own name because the card has no column header to lean on.
  const fallbackLabel = !hasSpot
    ? 'Awaiting underlying price context'
    : `${title} ${LEVEL_UNRESOLVED_NOTE.toLowerCase()}`;

  // An unresolved level is a DECLINED publish, not a broken one, and the
  // difference is invisible on a card reading "N/A" — which is what prompts
  // "why is there no data for /NQ" support mail. So the empty state trades the
  // metric's own definition for an explanation of the emptiness, and marks
  // itself with a question mark so there is something to hover in the first
  // place.
  const emptyTooltip =
    unresolvedTooltip ?? unresolvedLevelTooltip(title, symbol, unresolvedKind);
  const chain = unresolved ? levelSourceChain(symbol) : null;

  return (
    <MetricCard
      title={title}
      value={level != null ? `$${level.toFixed(2)}` : 'N/A'}
      subtitle={distanceMeta ? (
        <span className="inline-flex items-center gap-1" style={{ color: distanceMeta.color }}>
          {distanceMeta.isAbove ? <TrendingUp size={14} strokeWidth={2.5} /> : <TrendingDown size={14} strokeWidth={2.5} />}
          <span>{`${distanceMeta.deltaLabel} / ${distanceMeta.pctLabel} ${distanceMeta.spotRelationLabel}`}</span>
        </span>
      ) : (
        <span>
          {fallbackLabel}
          {chain && (
            <>
              {' · '}
              <span style={{ opacity: 0.85 }}>{`from the ${chain} chain`}</span>
            </>
          )}
        </span>
      )}
      tooltip={unresolved ? emptyTooltip : tooltip}
      // Amber question mark in place of the usual info dot: the same mark the
      // Key Levels strip puts beside an em-dash, so an unexplained-looking
      // blank always carries the same affordance in the same color.
      tooltipIcon={
        unresolved ? (
          <HelpCircle size={14} strokeWidth={2.5} style={{ color: 'var(--color-warning)' }} />
        ) : undefined
      }
      theme={theme}
      trend="neutral"
    />
  );
}
