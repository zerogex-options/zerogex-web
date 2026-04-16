'use client';

import { useMemo, useState } from 'react';
import { Bar, CartesianGrid, ComposedChart, Legend, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Info } from 'lucide-react';
import { useTheme } from '@/core/ThemeContext';
import { colors } from '@/core/colors';
import ExpandableCard from './ExpandableCard';
import TooltipWrapper from './TooltipWrapper';
import MobileScrollableChart from './MobileScrollableChart';
import { useIsMobile } from '@/hooks/useIsMobile';

interface OpenInterestRow {
  strike?: number | string;
  expiration?: string;
  option_type?: string | null;
  open_interest?: number | string | null;
  exposure?: number | string | null;
  call_oi?: number | string | null;
  put_oi?: number | string | null;
  call_exposure?: number | string | null;
  put_exposure?: number | string | null;
}

interface GexWallsChartProps {
  openInterestData?: OpenInterestRow[] | null;
  spotPrice?: number | string | null;
  byStrikeFallback?: Array<{ strike?: number | string; call_oi?: number | string | null; put_oi?: number | string | null }> | null;
}

type DisplayMode = 'oi' | 'exposure';

type ChartRow = {
  strike: number;
  strikeLabel: string;
  callValue: number;
  putValue: number;
};

function asNum(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatAxisValue(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1e9) return `${(value / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${(value / 1e3).toFixed(0)}k`;
  return `${value.toFixed(0)}`;
}

function WallMapTooltip({
  active,
  payload,
  label,
  mode,
}: {
  active?: boolean;
  payload?: Array<{ dataKey?: string; value?: number }>;
  label?: string;
  mode: DisplayMode;
}) {
  if (!active || !payload?.length) return null;
  const unitLabel = mode === 'oi' ? 'OI' : 'Exposure';
  return (
    <div style={{ background: 'var(--color-chart-tooltip-bg)', border: '1px solid var(--color-border)', borderRadius: 8, padding: '8px 12px', color: 'var(--color-chart-tooltip-text)' }}>
      <div style={{ fontWeight: 600, marginBottom: 4 }}>Strike {label}</div>
      {payload.map((entry, i) => {
        if (entry.dataKey === 'callValue') {
          return <div key={i} style={{ color: colors.bullish }}>Call {unitLabel}: {Number(entry.value).toLocaleString()}</div>;
        }
        if (entry.dataKey === 'putValue') {
          return <div key={i} style={{ color: colors.bearish }}>Put {unitLabel}: {Number(entry.value).toLocaleString()}</div>;
        }
        return null;
      })}
    </div>
  );
}

export default function GexWallsChart({ openInterestData, spotPrice, byStrikeFallback }: GexWallsChartProps) {
  const { theme } = useTheme();
  const isMobile = useIsMobile();
  const isDark = theme === 'dark';
  const textColor = isDark ? colors.light : colors.dark;
  const axisStroke = 'var(--color-text-primary)';
  const gridStroke = isDark ? 'var(--color-text-secondary)' : 'var(--color-border)';
  const inputBg = 'var(--color-surface-subtle)';
  const inputBorder = 'var(--color-border)';
  const inputColor = 'var(--color-text-primary)';

  const expirationOptions = useMemo(() => {
    const source = openInterestData || [];
    return Array.from(new Set(source.map((row) => String(row.expiration || '')).filter(Boolean))).sort((a, b) => a.localeCompare(b));
  }, [openInterestData]);

  const [selectedExpiration, setSelectedExpiration] = useState<string>('all');
  const [displayMode, setDisplayMode] = useState<DisplayMode>('oi');

  const chartData = useMemo<ChartRow[]>(() => {
    const source = openInterestData || [];
    const filtered = selectedExpiration === 'all' ? source : source.filter((row) => String(row.expiration || '') === selectedExpiration);
    const grouped = new Map<number, ChartRow>();

    filtered.forEach((row) => {
      const strike = asNum(row.strike);
      if (!Number.isFinite(strike) || strike <= 0) return;
      const existing = grouped.get(strike) ?? { strike, strikeLabel: strike.toFixed(0), callValue: 0, putValue: 0 };
      const optionType = String(row.option_type || '').toUpperCase();
      const value = displayMode === 'oi' ? asNum(row.open_interest) : asNum(row.exposure);

      if (optionType.startsWith('C')) {
        existing.callValue += value;
      } else if (optionType.startsWith('P')) {
        existing.putValue += value;
      } else {
        if (displayMode === 'oi') {
          existing.callValue += asNum(row.call_oi);
          existing.putValue += asNum(row.put_oi);
        } else {
          existing.callValue += asNum(row.call_exposure);
          existing.putValue += asNum(row.put_exposure);
        }
      }
      grouped.set(strike, existing);
    });

    let rows = Array.from(grouped.values());

    if (rows.length === 0 && displayMode === 'oi' && byStrikeFallback?.length) {
      byStrikeFallback.forEach((row) => {
        const strike = asNum(row.strike);
        if (!Number.isFinite(strike) || strike <= 0) return;
        const existing = grouped.get(strike) ?? { strike, strikeLabel: strike.toFixed(0), callValue: 0, putValue: 0 };
        existing.callValue += asNum(row.call_oi);
        existing.putValue += asNum(row.put_oi);
        grouped.set(strike, existing);
      });
      rows = Array.from(grouped.values());
    }

    return rows.sort((a, b) => a.strike - b.strike);
  }, [openInterestData, selectedExpiration, displayMode, byStrikeFallback]);

  const spot = asNum(spotPrice);

  const closestStrikeLabel = useMemo(() => {
    if (spot <= 0 || !chartData.length) return null;
    const closest = chartData.reduce((best, row) =>
      Math.abs(row.strike - spot) < Math.abs(best.strike - spot) ? row : best,
    );
    return closest.strikeLabel;
  }, [spot, chartData]);

  const renderLegend = () => (
    <div className="w-full flex flex-wrap justify-end items-center gap-4 text-xs" style={{ color: textColor }}>
      <div className="flex items-center gap-1.5">
        <span className="inline-block h-3 w-3 rounded-sm" style={{ backgroundColor: colors.bullish }} />
        Call {displayMode === 'oi' ? 'OI' : 'Exposure'}
      </div>
      <div className="flex items-center gap-1.5">
        <span className="inline-block h-3 w-3 rounded-sm" style={{ backgroundColor: colors.bearish }} />
        Put {displayMode === 'oi' ? 'OI' : 'Exposure'}
      </div>
      <div className="flex items-center gap-1.5">
        <span className="inline-block h-0.5 w-4" style={{ backgroundColor: '#FFD700' }} />
        Spot (nearest strike)
      </div>
    </div>
  );

  return (
    <ExpandableCard expandTrigger="button" expandButtonLabel="Expand chart">
      <div
        className="rounded-2xl p-6"
        style={{
          backgroundColor: isDark ? colors.cardDark : colors.cardLight,
          border: `1px solid ${colors.muted}`,
        }}
      >
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold tracking-wider uppercase" style={{ color: textColor }}>
              OPEN INTEREST &amp; EXPOSURE BY STRIKE
            </h3>
            <TooltipWrapper text="Strike-level view by call/put. Toggle between Open Interest and Exposure. The yellow dotted line marks spot at the nearest strike.">
              <Info size={14} />
            </TooltipWrapper>
          </div>
          <div className="flex items-center gap-3 mr-8">
            <label className="text-xs" style={{ color: textColor }}>
              Expiration
              <select
                className="ml-2 rounded px-2 py-1"
                style={{ backgroundColor: inputBg, borderColor: inputBorder, color: inputColor, border: `1px solid ${inputBorder}` }}
                value={selectedExpiration}
                onChange={(e) => setSelectedExpiration(e.target.value)}
              >
                <option value="all">All</option>
                {expirationOptions.map((exp) => <option key={exp} value={exp}>{exp}</option>)}
              </select>
            </label>
            <div className="inline-flex rounded border" style={{ borderColor: inputBorder, backgroundColor: inputBg }}>
              <button
                type="button"
                className="px-2.5 py-1 text-xs font-semibold"
                style={{
                  color: displayMode === 'exposure' ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                  backgroundColor: displayMode === 'exposure' ? 'var(--color-info-soft)' : 'transparent',
                }}
                onClick={() => setDisplayMode('exposure')}
              >
                Exposure
              </button>
              <button
                type="button"
                className="px-2.5 py-1 text-xs font-semibold"
                style={{
                  color: displayMode === 'oi' ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                  backgroundColor: displayMode === 'oi' ? 'var(--color-info-soft)' : 'transparent',
                }}
                onClick={() => setDisplayMode('oi')}
              >
                OI
              </button>
            </div>
          </div>
        </div>

        {!chartData.length ? (
          <div className="flex items-center justify-center h-[280px] text-sm" style={{ color: colors.muted }}>
            No open-interest data available for the selected expiration.
          </div>
        ) : (
          <MobileScrollableChart>
            <ResponsiveContainer width="100%" height={isMobile ? 290 : 340}>
              <ComposedChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} opacity={0.3} />
                <XAxis dataKey="strikeLabel" type="category" stroke={axisStroke} tick={{ fontSize: 11, fill: axisStroke }} interval="preserveStartEnd" minTickGap={22} />
                <YAxis yAxisId="value" stroke={axisStroke} tick={{ fontSize: 11, fill: axisStroke }} tickFormatter={(v) => formatAxisValue(Number(v))} />
                <Tooltip content={<WallMapTooltip mode={displayMode} />} />
                <Legend verticalAlign="top" align="right" content={renderLegend} wrapperStyle={{ top: 0, right: 0 }} />
                <Bar yAxisId="value" dataKey="callValue" name={displayMode === 'oi' ? 'Call OI' : 'Call Exposure'} fill={colors.bullish} opacity={1} barSize={14} />
                <Bar yAxisId="value" dataKey="putValue" name={displayMode === 'oi' ? 'Put OI' : 'Put Exposure'} fill={colors.bearish} opacity={1} barSize={14} />

                {closestStrikeLabel && (
                  <ReferenceLine yAxisId="value" x={closestStrikeLabel} stroke="#FFD700" strokeDasharray="4 4" label={{ value: `Spot ${spot.toFixed(2)}`, fill: '#FFD700', position: 'top', fontSize: 11 }} />
                )}
              </ComposedChart>
            </ResponsiveContainer>
          </MobileScrollableChart>
        )}
      </div>
    </ExpandableCard>
  );
}
