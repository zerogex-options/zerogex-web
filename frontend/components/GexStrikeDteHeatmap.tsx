'use client';

import { Crown, Info } from 'lucide-react';
import { useMemo } from 'react';
import { useTheme } from '@/core/ThemeContext';
import { GEX_UNIT_LABEL, gexScaleFactor, useGexUnit } from '@/core/GexUnitContext';
import TooltipWrapper from './TooltipWrapper';
import ExpandableCard from './ExpandableCard';

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

function getDte(expiration: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const exp = new Date(expiration + 'T00:00:00');
  return Math.max(0, Math.round((exp.getTime() - today.getTime()) / 86400000));
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

  const { strikes, grid, maxAbs, dteColumns, kingStrike } = useMemo(() => {
    const rows = byStrikeData || [];
    if (rows.length === 0) return { strikes: [] as number[], grid: new Map<string, number>(), maxAbs: 0, dteColumns: [] as number[], kingStrike: null as number | null };

    // Aggregate by (strike, DTE exact)
    const agg = new Map<string, number>();
    const strikeTotal = new Map<number, number>();
    const seenDtes = new Set<number>();

    rows.forEach((row) => {
      const dte = getDte(row.expiration);
      if (dte < 0 || dte > 7) return;
      seenDtes.add(dte);

      const strike = Number(row.strike);
      const key = `${strike}_${dte}`;
      agg.set(key, (agg.get(key) || 0) + Number(row.net_gex || 0));
      strikeTotal.set(strike, (strikeTotal.get(strike) || 0) + Math.abs(Number(row.net_gex || 0)));
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

    // GEX King — the strike carrying the largest total |GEX| across the DTE
    // window (the same "heaviest dealer gamma" notion as the Pair Comparison
    // crown, aggregated to the strike level). It is always one of the shown
    // strikes, since those are the top strikes by this very total.
    let kingStrike: number | null = null;
    let kingTotal = -1;
    strikeTotal.forEach((total, strike) => {
      if (total > kingTotal) {
        kingTotal = total;
        kingStrike = strike;
      }
    });
    if (kingTotal <= 0) kingStrike = null;

    return { strikes: sortedStrikes, grid: agg, maxAbs: maxAbsVal, dteColumns: nonEmptyDtes, kingStrike };
  }, [byStrikeData]);

  if (strikes.length === 0 || dteColumns.length === 0) {
    return (
      <ExpandableCard expandTrigger="button" expandButtonLabel="Expand chart" className="h-full">
        <div
          className="rounded-2xl p-6 h-full flex items-center justify-center"
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
        className="rounded-2xl p-6 h-full"
        style={{
          backgroundColor: 'var(--bg-card)',
          border: `1px solid var(--border-default)`,
        }}
      >
      <div className="flex items-center gap-2 mb-4">
        <h3
          className="zg-h3"
          style={{ color: textColor }}
        >
          GEX Heatmap · Strike &times; DTE
        </h3>
        <TooltipWrapper text="Matrix view of aggregated net GEX by strike (rows) and time-to-expiration buckets (columns). Color intensity reflects magnitude; green is positive GEX and red is negative GEX. The crowned strike is the GEX King — the one carrying the largest total dealer gamma across expirations. Cell values follow the GEX unit toggle; colors are unaffected.">
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
              <th className="text-left py-2 px-2 font-semibold" style={{ color: 'var(--text-secondary)' }}>Strike</th>
              {dteColumns.map((dte) => (
                <th key={dte} className="text-center py-2 px-2 font-semibold" style={{ color: 'var(--text-secondary)' }}>
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
                  className="py-1.5 px-2 font-mono font-semibold"
                  style={{
                    color: isKing ? 'var(--color-king)' : textColor,
                    background: isKing ? 'var(--color-king-soft)' : undefined,
                    boxShadow: isKing ? 'inset 3px 0 0 var(--color-king)' : undefined,
                  }}
                >
                  <span className="inline-flex items-center gap-1">
                    {isKing && (
                      <TooltipWrapper text="GEX King — the strike carrying the largest total dealer gamma across expirations, the dominant node price tends to gravitate toward.">
                        <Crown
                          size={13}
                          strokeWidth={2.25}
                          aria-label="GEX King — dominant gamma node"
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
                    <td key={dte} className="py-1.5 px-2 text-center">
                      {Math.abs(value) > maxAbs * 0.02 ? (
                        <div
                          className="rounded px-2 py-1 text-xs font-semibold inline-block min-w-[48px]"
                          style={cellStyle}
                        >
                          {formatGex(value * gexFactor)}
                        </div>
                      ) : (
                        <div className="min-w-[48px]" />
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
          High &ndash; GEX
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-5 rounded" style={{ backgroundColor: isDark ? 'var(--border-subtle)' : 'var(--border-subtle)' }} />
          Neutral
        </div>
        <div className="flex items-center gap-1.5">
          <Crown size={13} strokeWidth={2.25} style={{ color: 'var(--color-king)' }} />
          GEX King
        </div>
      </div>
      </div>
    </ExpandableCard>
  );
}
