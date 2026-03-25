'use client';

import { Info } from 'lucide-react';
import { useMemo } from 'react';
import { useTheme } from '@/core/ThemeContext';
import { colors } from '@/core/colors';
import TooltipWrapper from './TooltipWrapper';

interface ByStrikeRow {
  strike: number;
  expiration: string;
  net_gex: number;
  distance_from_spot?: number;
}

interface GexStrikeDteHeatmapProps {
  byStrikeData: ByStrikeRow[] | null | undefined;
}

const DTE_BUCKETS = [
  { label: '0DTE', min: 0, max: 0 },
  { label: '1DTE', min: 1, max: 1 },
  { label: '3DTE', min: 2, max: 3 },
  { label: '7DTE', min: 4, max: 7 },
] as const;

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
      backgroundColor: isDark ? 'rgba(150, 143, 146, 0.1)' : 'rgba(0, 0, 0, 0.04)',
      color: isDark ? colors.muted : '#9ca3af',
    };
  }

  const intensity = Math.min(1, Math.abs(value) / maxAbs);

  if (value > 0) {
    // Green scale: high intensity = darker green
    const alpha = 0.15 + intensity * 0.55;
    return {
      backgroundColor: `rgba(16, 185, 129, ${alpha})`,
      color: intensity > 0.5 ? '#ffffff' : (isDark ? colors.light : colors.dark),
    };
  }

  // Red scale
  const alpha = 0.15 + intensity * 0.55;
  return {
    backgroundColor: `rgba(244, 88, 84, ${alpha})`,
    color: intensity > 0.5 ? '#ffffff' : (isDark ? colors.light : colors.dark),
  };
}

export default function GexStrikeDteHeatmap({ byStrikeData }: GexStrikeDteHeatmapProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const textColor = isDark ? colors.light : colors.dark;

  const { strikes, grid, maxAbs } = useMemo(() => {
    const rows = byStrikeData || [];
    if (rows.length === 0) return { strikes: [] as number[], grid: new Map<string, number>(), maxAbs: 0 };

    // Aggregate by (strike, DTE bucket)
    const agg = new Map<string, number>();
    const strikeTotal = new Map<number, number>();

    rows.forEach((row) => {
      const dte = getDte(row.expiration);
      const bucket = DTE_BUCKETS.find((b) => dte >= b.min && dte <= b.max);
      if (!bucket) return;

      const strike = Number(row.strike);
      const key = `${strike}_${bucket.label}`;
      agg.set(key, (agg.get(key) || 0) + Number(row.net_gex || 0));
      strikeTotal.set(strike, (strikeTotal.get(strike) || 0) + Math.abs(Number(row.net_gex || 0)));
    });

    // Select top strikes by total absolute GEX
    const sortedStrikes = Array.from(strikeTotal.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 14)
      .map(([s]) => s)
      .sort((a, b) => a - b);

    // Find max absolute for color scaling
    let maxAbsVal = 0;
    agg.forEach((v) => { maxAbsVal = Math.max(maxAbsVal, Math.abs(v)); });

    return { strikes: sortedStrikes, grid: agg, maxAbs: maxAbsVal };
  }, [byStrikeData]);

  if (strikes.length === 0) {
    return (
      <div
        className="rounded-2xl p-6 h-full flex items-center justify-center"
        style={{ backgroundColor: isDark ? colors.cardDark : colors.cardLight, border: `1px solid ${colors.muted}` }}
      >
        <span className="text-sm" style={{ color: colors.muted }}>No heatmap data available</span>
      </div>
    );
  }

  return (
    <div
      className="rounded-2xl p-6 h-full"
      style={{
        backgroundColor: isDark ? colors.cardDark : colors.cardLight,
        border: `1px solid ${colors.muted}`,
      }}
    >
      <div className="flex items-center gap-2 mb-4">
        <h3
          className="text-sm font-bold tracking-wider uppercase"
          style={{ color: textColor }}
        >
          GEX HEATMAP (STRIKE &times; DTE)
        </h3>
        <TooltipWrapper text="Matrix view of aggregated net GEX by strike (rows) and time-to-expiration buckets (columns). Color intensity reflects magnitude; green is positive GEX and red is negative GEX.">
          <Info size={14} />
        </TooltipWrapper>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr>
              <th className="text-left py-2 px-2 font-semibold" style={{ color: colors.muted }}>Strike</th>
              {DTE_BUCKETS.map((b) => (
                <th key={b.label} className="text-center py-2 px-2 font-semibold" style={{ color: colors.muted }}>
                  {b.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {strikes.map((strike) => (
              <tr key={strike}>
                <td className="py-1.5 px-2 font-mono font-semibold" style={{ color: textColor }}>
                  {strike.toFixed(0)}
                </td>
                {DTE_BUCKETS.map((bucket) => {
                  const value = grid.get(`${strike}_${bucket.label}`) || 0;
                  const cellStyle = getCellStyle(value, maxAbs, isDark);
                  return (
                    <td key={bucket.label} className="py-1.5 px-2 text-center">
                      {Math.abs(value) > maxAbs * 0.02 ? (
                        <div
                          className="rounded px-2 py-1 text-xs font-semibold inline-block min-w-[48px]"
                          style={cellStyle}
                        >
                          {formatGex(value)}
                        </div>
                      ) : (
                        <div className="min-w-[48px]" />
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 mt-4 text-xs" style={{ color: colors.muted }}>
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-5 rounded" style={{ backgroundColor: 'rgba(16, 185, 129, 0.6)' }} />
          High + GEX
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-5 rounded" style={{ backgroundColor: 'rgba(16, 185, 129, 0.25)' }} />
          Mod + GEX
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-5 rounded" style={{ backgroundColor: 'rgba(244, 88, 84, 0.5)' }} />
          High &ndash; GEX
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-5 rounded" style={{ backgroundColor: isDark ? 'rgba(150, 143, 146, 0.15)' : 'rgba(0, 0, 0, 0.06)' }} />
          Neutral
        </div>
      </div>
    </div>
  );
}
