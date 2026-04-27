'use client';

import { useMemo } from 'react';
import { Info } from 'lucide-react';
import { useTheme } from '@/core/ThemeContext';
import { colors } from '@/core/colors';
import ExpandableCard from './ExpandableCard';
import TooltipWrapper from './TooltipWrapper';
import MobileScrollableChart from './MobileScrollableChart';

interface StrikeRow {
  strike: number;
  netGexB: number;
  callGexB: number;
  putGexB: number;
}

interface GexStrikeChartProps {
  strikeData: StrikeRow[];
  gammaFlip: number | null | undefined;
  spotPrice: number | null | undefined;
}

function formatExposure(valueB: number): string {
  // valueB is in $B. Render as "1.2B", "496.3M", "-9.4M".
  if (!Number.isFinite(valueB)) return '—';
  const abs = Math.abs(valueB);
  if (abs === 0) return '0';
  const sign = valueB < 0 ? '-' : '';
  if (abs >= 1) return `${sign}${abs.toFixed(2)}B`;
  if (abs >= 0.001) return `${sign}${(abs * 1000).toFixed(1)}M`;
  return `${sign}${(abs * 1000).toFixed(2)}M`;
}

function nearestStrike(strikes: number[], target: number | null | undefined): number | null {
  if (target == null || strikes.length === 0) return null;
  let closest = strikes[0];
  let bestDist = Math.abs(closest - target);
  for (const s of strikes) {
    const d = Math.abs(s - target);
    if (d < bestDist) {
      bestDist = d;
      closest = s;
    }
  }
  return closest;
}

export default function GexStrikeChart({ strikeData, gammaFlip, spotPrice }: GexStrikeChartProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const textColor = isDark ? colors.light : colors.dark;

  // Sort highest strike at the top → descending.
  const sorted = useMemo(
    () => [...strikeData].sort((a, b) => b.strike - a.strike),
    [strikeData],
  );

  const maxAbs = useMemo(
    () => sorted.reduce((m, r) => Math.max(m, Math.abs(r.netGexB)), 0) || 1,
    [sorted],
  );

  const strikes = useMemo(() => sorted.map((r) => r.strike), [sorted]);
  const flipStrike = useMemo(() => nearestStrike(strikes, gammaFlip), [strikes, gammaFlip]);
  const spotStrike = useMemo(() => nearestStrike(strikes, spotPrice), [strikes, spotPrice]);

  return (
    <ExpandableCard expandTrigger="button" expandButtonLabel="Expand chart">
      <div
        className="rounded-2xl p-6 h-full"
        style={{
          backgroundColor: isDark ? colors.cardDark : colors.cardLight,
          border: `1px solid ${colors.muted}`,
        }}
      >
        <div className="flex items-center gap-2 mb-4">
          <h3 className="text-sm font-bold tracking-wider uppercase" style={{ color: textColor }}>
            GEX BY STRIKE
          </h3>
          <TooltipWrapper text="Per-strike dealer gamma exposure. The horizontal bar shows net GEX centered at zero — green pushes right (positive / pinning), red pushes left (negative / acceleration). Highest strike is at the top.">
            <Info size={14} />
          </TooltipWrapper>
        </div>

        {sorted.length === 0 ? (
          <div className="flex items-center justify-center h-[300px] text-sm" style={{ color: colors.muted }}>
            No strike data available
          </div>
        ) : (
          <MobileScrollableChart minWidthClass="min-w-[760px]">
            <div className="overflow-y-auto" style={{ maxHeight: 520 }}>
              <table className="w-full text-xs" style={{ color: textColor, fontVariantNumeric: 'tabular-nums' }}>
                <thead className="sticky top-0 z-10" style={{ backgroundColor: isDark ? colors.cardDark : colors.cardLight }}>
                  <tr style={{ color: 'var(--color-text-secondary)' }}>
                    <th className="text-left font-semibold uppercase tracking-wider py-2 pr-3" style={{ width: 88 }}>
                      Strike
                    </th>
                    <th className="font-semibold uppercase tracking-wider py-2" />
                    <th className="text-right font-semibold uppercase tracking-wider py-2 px-3" style={{ width: 110 }}>
                      Net GEX
                    </th>
                    <th className="text-right font-semibold uppercase tracking-wider py-2 px-3" style={{ width: 110 }}>
                      Call GEX
                    </th>
                    <th className="text-right font-semibold uppercase tracking-wider py-2 px-3" style={{ width: 110 }}>
                      Put GEX
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((row) => {
                    const widthPct = (Math.abs(row.netGexB) / maxAbs) * 50;
                    const positive = row.netGexB >= 0;
                    const isSpot = spotStrike != null && row.strike === spotStrike;
                    const isFlip = flipStrike != null && row.strike === flipStrike;
                    const rowBg = isSpot
                      ? 'rgba(245, 158, 11, 0.08)'
                      : isFlip
                        ? `${colors.primary}10`
                        : 'transparent';
                    return (
                      <tr
                        key={row.strike}
                        style={{
                          backgroundColor: rowBg,
                          borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}`,
                        }}
                      >
                        <td className="py-2 pr-3 font-mono">
                          <div className="flex items-center gap-1.5">
                            <span style={{ color: textColor }}>{row.strike.toFixed(2)}</span>
                            {isSpot && (
                              <span
                                className="text-[9px] uppercase tracking-wide font-semibold px-1.5 py-0.5 rounded"
                                style={{ color: colors.warning, background: 'rgba(245, 158, 11, 0.16)' }}
                              >
                                Spot
                              </span>
                            )}
                            {isFlip && (
                              <span
                                className="text-[9px] uppercase tracking-wide font-semibold px-1.5 py-0.5 rounded"
                                style={{ color: colors.primary, background: `${colors.primary}1f` }}
                              >
                                Flip
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-1.5">
                          <div className="relative h-4 w-full">
                            <div
                              className="absolute top-0 bottom-0"
                              style={{
                                left: '50%',
                                width: 1,
                                backgroundColor: 'var(--color-text-secondary)',
                                opacity: 0.5,
                              }}
                            />
                            <div
                              className="absolute top-0 bottom-0 rounded-sm"
                              style={{
                                left: positive ? '50%' : `${50 - widthPct}%`,
                                width: `${widthPct}%`,
                                backgroundColor: positive ? colors.bullish : colors.bearish,
                                transition: 'left 250ms ease-out, width 250ms ease-out',
                              }}
                            />
                          </div>
                        </td>
                        <td
                          className="py-2 px-3 text-right font-mono font-semibold"
                          style={{ color: positive ? colors.bullish : colors.bearish }}
                        >
                          {formatExposure(row.netGexB)}
                        </td>
                        <td className="py-2 px-3 text-right font-mono" style={{ color: colors.bullish }}>
                          {formatExposure(row.callGexB)}
                        </td>
                        <td className="py-2 px-3 text-right font-mono" style={{ color: colors.bearish }}>
                          {formatExposure(row.putGexB)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </MobileScrollableChart>
        )}
      </div>
    </ExpandableCard>
  );
}
