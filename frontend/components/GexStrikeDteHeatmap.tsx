'use client';

import { Crown, Info } from 'lucide-react';
import { useMemo } from 'react';
import { useTheme } from '@/core/ThemeContext';
import { GEX_UNIT_LABEL, gexScaleFactor, useGexUnit } from '@/core/GexUnitContext';
import { daysToExpiry, etTodayDateKey } from '@/core/utils';
import TooltipWrapper from './TooltipWrapper';
import ExpandableCard from './ExpandableCard';
import ChartCaption from "./ChartCaption";

interface ByStrikeRow {
  strike: number;
  expiration: string;
  net_gex: number;
  distance_from_spot?: number;
}

interface GexStrikeDteHeatmapProps {
  byStrikeData: ByStrikeRow[] | null | undefined;
  // Current spot, used only to reinterpret the displayed cell labels when
  // the GEX unit toggle is set to per-1-point. Colors are scale-invariant
  // (normalized to maxAbs) so the surface is unaffected.
  spotPrice?: number | null;
}

function formatGex(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1e9) return `${value >= 0 ? '+' : ''}${(value / 1e9).toFixed(0)}B`;
  if (abs >= 1e8) return `${value >= 0 ? '+' : ''}${(value / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `${value >= 0 ? '+' : ''}${(value / 1e6).toFixed(0)}M`;
  if (abs >= 1e5) return `${value >= 0 ? '+' : ''}${(value / 1e6).toFixed(1)}M`;
  return `${value >= 0 ? '+' : ''}${(value / 1e3).toFixed(0)}K`;
}

function getCellStyle(value: number, maxAbs: number, isDark: boolean): { backgroundColor: string; color: string } {
  if (maxAbs < 1 || Math.abs(value) < maxAbs * 0.02) {
    return {
      backgroundColor: isDark ? 'var(--border-subtle)' : 'var(--border-subtle)',
      color: isDark ? 'var(--text-secondary)' : 'var(--color-text-secondary)',
    };
  }

  const intensity = Math.min(1, Math.abs(value) / maxAbs);

  if (value > 0) {
    // Green scale: high intensity = darker green
    const alpha = 0.15 + intensity * 0.55;
    return {
      backgroundColor: `rgba(27, 196, 125, ${alpha})`,
      color: intensity > 0.5 ? 'var(--color-surface)' : ('var(--text-primary)'),
    };
  }

  // Red scale
  const alpha = 0.15 + intensity * 0.55;
  return {
    backgroundColor: `rgba(255, 77, 90, ${alpha})`,
    color: intensity > 0.5 ? 'var(--color-surface)' : ('var(--text-primary)'),
  };
}

export default function GexStrikeDteHeatmap({ byStrikeData, spotPrice }: GexStrikeDteHeatmapProps) {
  const { theme } = useTheme();
  const { gexUnit } = useGexUnit();
  const isDark = theme === 'dark';
  const textColor = 'var(--text-primary)';
  // Per-1% (stored) → active unit. Applied only to displayed labels.
  const gexFactor = gexScaleFactor(gexUnit, spotPrice);
  // DTE counts from New York's date, not the viewer's (see daysToExpiry).
  const todayKey = etTodayDateKey();

  const { strikes, grid, maxAbs, dteColumns, kingStrike, kingLong } = useMemo(() => {
    const rows = byStrikeData || [];
    if (rows.length === 0) return { strikes: [] as number[], grid: new Map<string, number>(), maxAbs: 0, dteColumns: [] as number[], kingStrike: null as number | null, kingLong: false };

    // Aggregate by (strike, DTE exact)
    const agg = new Map<string, number>();
    const strikeTotal = new Map<number, number>();
    const strikeNet = new Map<number, number>();
    const seenDtes = new Set<number>();

    rows.forEach((row) => {
      const dte = daysToExpiry(row.expiration, todayKey);
      if (dte == null || dte < 0 || dte > 7) return;
      seenDtes.add(dte);

      const strike = Number(row.strike);
      const key = `${strike}_${dte}`;
      agg.set(key, (agg.get(key) || 0) + Number(row.net_gex || 0));
      strikeTotal.set(strike, (strikeTotal.get(strike) || 0) + Math.abs(Number(row.net_gex || 0)));
      strikeNet.set(strike, (strikeNet.get(strike) || 0) + Number(row.net_gex || 0));
    });

    // Select top strikes by total absolute GEX, then display highest → lowest
    // strike top-to-bottom to match the rest of the page.
    const sortedStrikes = Array.from(strikeTotal.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 14)
      .map(([s]) => s)
      .sort((a, b) => b - a);

    // Find max absolute for color scaling
    let maxAbsVal = 0;
    agg.forEach((v) => { maxAbsVal = Math.max(maxAbsVal, Math.abs(v)); });
    const visibilityThreshold = maxAbsVal > 0 ? maxAbsVal * 0.02 : 0;
    const nonEmptyDtes = Array.from(seenDtes)
      .filter((dte) => sortedStrikes.some((strike) => Math.abs(agg.get(`${strike}_${dte}`) || 0) > visibilityThreshold))
      .sort((a, b) => a - b);

    // Near-term King — the shown strike with the largest NET dealer gamma
    // summed across the near-term (0–7 DTE) expirations on this heatmap.
    //
    // Deliberately NOT called "GEX King". That name belongs to the Gamma
    // Terminal chart's level (max_gamma_strike): the heaviest |net GEX| strike
    // across the WHOLE chain, which ignores the Expiry filter because narrowing
    // it would make it "a different metric wearing the same name" (see the
    // gexKing note in GammaTerminalChart). This crown is exactly that
    // different metric: a 0DTE-heavy node can outrank the whole-chain
    // structural one, so the two can mark different strikes, and sharing the
    // name led readers to take them for one level. Keep the names apart here
    // (legend, tooltips, aria-label) and in the help pages that describe this
    // heatmap (dealer-positioning, reading-charts, and their translations).
    //
    // Signed net (then its magnitude), not a sum of absolute values, the same
    // way the GEX King is measured. Restricted to sortedStrikes so the crown
    // always lands on a visible row.
    let kingStrike: number | null = null;
    let kingMag = -1;
    for (const s of sortedStrikes) {
      const mag = Math.abs(strikeNet.get(s) || 0);
      if (mag > kingMag) {
        kingMag = mag;
        kingStrike = s;
      }
    }
    if (kingMag <= 0) kingStrike = null;
    // The crown is picked on |net|, so it can sit on a short-gamma strike, and
    // the sign decides what hedging there does (see kingTooltip below).
    const kingLong = kingStrike != null && (strikeNet.get(kingStrike) || 0) > 0;

    return { strikes: sortedStrikes, grid: agg, maxAbs: maxAbsVal, dteColumns: nonEmptyDtes, kingStrike, kingLong };
  }, [byStrikeData, todayKey]);

  // Says which way the crowned strike leans instead of claiming price is drawn
  // to every crown: long gamma leans against moves, short gamma chases them
  // (the same read the Gamma Terminal guide gives for the regime). Only shown
  // with a crown, so kingLong is always that strike's own sign.
  const kingTooltip =
    'Near-term King\u00a0- the strike with the largest net dealer gamma, long or short, across the 0-7 DTE expirations shown here. ' +
    (kingLong
      ? 'It is net long gamma, so modeled dealer hedging there leans against moves and tends to slow price near this strike.'
      : 'It is net short gamma, so modeled dealer hedging there chases moves and tends to speed price up near this strike rather than hold it.') +
    " Not the Gamma Terminal's GEX King, which covers the whole chain.";

  if (strikes.length === 0 || dteColumns.length === 0) {
    return (
      <ExpandableCard expandTrigger="button" expandButtonLabel="Expand chart" className="h-full">
        <div
          className="rounded-2xl p-4 sm:p-6 h-full flex items-center justify-center"
          style={{ backgroundColor: 'var(--bg-card)', border: `1px solid var(--border-default)` }}
        >
          <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>No heatmap data available</span>
        </div>
      </ExpandableCard>
    );
  }

  return (
    <ExpandableCard expandTrigger="button" expandButtonLabel="Expand chart" className="h-full">
      <div
        className="rounded-2xl p-4 sm:p-6 h-full"
        style={{
          backgroundColor: 'var(--bg-card)',
          border: `1px solid var(--border-default)`,
        }}
      >
      {/* pr-12 on a phone keeps the unit badge clear of the Expand button. */}
      <div className="flex flex-wrap items-center gap-2 mb-4 pr-12 sm:pr-0">
        <h3
          className="zg-h3"
          style={{ color: textColor }}
        >
          GEX Heatmap · Strike &times; DTE
        </h3>
        <TooltipWrapper inlineInExpanded={false} text="Matrix view of aggregated net GEX by strike (rows) and time-to-expiration buckets (columns). Color intensity reflects magnitude; green is positive GEX and red is negative GEX. The crowned strike is the Near-term King&nbsp;- the strike with the largest net dealer gamma across the 0-7 DTE expirations shown here. It is not the Gamma Terminal's GEX King, which covers the whole chain, so the two can point to different strikes. Cell values follow the GEX unit toggle; colors are unaffected.">
          <Info size={14} />
        </TooltipWrapper>
        <span
          className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded"
          style={{ color: 'var(--text-muted)', backgroundColor: 'var(--color-info-soft)' }}
        >
          {GEX_UNIT_LABEL[gexUnit]}
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr>
              {/* The Strike column stays pinned (on an opaque cell) when the
                  DTE columns scroll sideways on a phone; nothing scrolls on a
                  desktop, where the pinned cell looks as it always did. */}
              <th className="text-left py-2 px-1 sm:px-2 font-semibold sticky left-0 z-[1]" style={{ color: 'var(--text-secondary)', backgroundColor: 'var(--bg-card)' }}>Strike</th>
              {dteColumns.map((dte) => (
                <th key={dte} className="text-center py-2 px-1 sm:px-2 font-semibold" style={{ color: 'var(--text-secondary)' }}>
                  {dte}DTE
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {strikes.map((strike) => {
              const isKing = kingStrike != null && strike === kingStrike;
              return (
              <tr key={strike}>
                <td
                  className="py-1.5 px-1 sm:px-2 font-mono font-semibold sticky left-0 z-[1]"
                  style={{
                    color: isKing ? 'var(--color-king)' : textColor,
                    backgroundColor: 'var(--bg-card)',
                    backgroundImage: isKing ? 'linear-gradient(var(--color-king-soft), var(--color-king-soft))' : undefined,
                    boxShadow: isKing ? 'inset 3px 0 0 var(--color-king)' : undefined,
                  }}
                >
                  <span className="inline-flex items-center gap-1">
                    {isKing && (
                      <TooltipWrapper inlineInExpanded={false} text={kingTooltip}>
                        <Crown
                          size={13}
                          strokeWidth={2.25}
                          aria-label="Near-term King (0-7 DTE)&nbsp;- dominant gamma node"
                          style={{ color: 'var(--color-king)', flex: '0 0 auto' }}
                        />
                      </TooltipWrapper>
                    )}
                    {strike.toFixed(0)}
                  </span>
                </td>
                {dteColumns.map((dte) => {
                  const value = grid.get(`${strike}_${dte}`) || 0;
                  const cellStyle = getCellStyle(value, maxAbs, isDark);
                  return (
                    <td key={dte} className="py-1.5 px-1 sm:px-2 text-center">
                      {Math.abs(value) > maxAbs * 0.02 ? (
                        <div
                          className="rounded px-1.5 sm:px-2 py-1 text-xs font-semibold inline-block min-w-[44px] sm:min-w-[48px]"
                          style={cellStyle}
                        >
                          {formatGex(value * gexFactor)}
                        </div>
                      ) : (
                        <div className="min-w-[44px] sm:min-w-[48px]" />
                      )}
                    </td>
                  );
                })}
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 mt-4 text-xs" style={{ color: 'var(--text-secondary)' }}>
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-5 rounded" style={{ backgroundColor: 'rgba(27, 196, 125, 0.6)' }} />
          High + GEX
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-5 rounded" style={{ backgroundColor: 'rgba(27, 196, 125, 0.25)' }} />
          Mod + GEX
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-5 rounded" style={{ backgroundColor: 'rgba(255, 77, 90, 0.5)' }} />
          High&nbsp;- GEX
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-5 rounded" style={{ backgroundColor: isDark ? 'var(--border-subtle)' : 'var(--border-subtle)' }} />
          Neutral
        </div>
        <div className="flex items-center gap-1.5">
          <Crown size={13} strokeWidth={2.25} style={{ color: 'var(--color-king)' }} />
          Near-term King (0-7 DTE)
        </div>
      </div>
      <ChartCaption />
      </div>
    </ExpandableCard>
  );
}
