'use client';

import { useMemo, useState } from 'react';
import { Bar, CartesianGrid, ComposedChart, Legend, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Info } from 'lucide-react';
import { useTheme } from '@/core/ThemeContext';
import { colors } from '@/core/colors';
import type { GEXWallsRow } from '@/hooks/useApiData';
import ExpandableCard from './ExpandableCard';
import TooltipWrapper from './TooltipWrapper';
import MobileScrollableChart from './MobileScrollableChart';

interface OpenInterestRow {
  strike?: number | string;
  expiration?: string;
  call_oi?: number | string | null;
  put_oi?: number | string | null;
  call_open_interest?: number | string | null;
  put_open_interest?: number | string | null;
  total_call_oi?: number | string | null;
  total_put_oi?: number | string | null;
  option_type?: string | null;
  open_interest?: number | string | null;
}

interface GexWallsChartProps {
  wallsData: GEXWallsRow | null | undefined;
  openInterestData?: OpenInterestRow[] | null;
  byStrikeFallback?: Array<{ strike?: number | string; call_oi?: number | string | null; put_oi?: number | string | null }> | null;
}

type ChartRow = {
  strike: number;
  strikeLabel: string;
  callOi: number;
  putOi: number;
};

function asNum(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function WallMapTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ dataKey?: string; value?: number; name?: string }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: 'var(--color-chart-tooltip-bg)', border: '1px solid var(--color-border)', borderRadius: 8, padding: '8px 12px', color: 'var(--color-chart-tooltip-text)' }}>
      <div style={{ fontWeight: 600, marginBottom: 4 }}>Strike {label}</div>
      {payload.map((entry, i) => {
        if (entry.dataKey === 'callOi') {
          return <div key={i} style={{ color: colors.bullish }}>Call OI: {Number(entry.value).toLocaleString()}</div>;
        }
        if (entry.dataKey === 'putOi') {
          return <div key={i} style={{ color: colors.bearish }}>Put OI: {Number(entry.value).toLocaleString()}</div>;
        }
        return null;
      })}
    </div>
  );
}

export default function GexWallsChart({ wallsData, openInterestData, byStrikeFallback }: GexWallsChartProps) {
  const { theme } = useTheme();
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

  const chartData = useMemo<ChartRow[]>(() => {
    const source = openInterestData || [];
    const filtered = selectedExpiration === 'all' ? source : source.filter((row) => String(row.expiration || '') === selectedExpiration);
    const grouped = new Map<number, ChartRow>();

    filtered.forEach((row) => {
      const strike = asNum(row.strike);
      if (!Number.isFinite(strike) || strike <= 0) return;
      const existing = grouped.get(strike) ?? { strike, strikeLabel: strike.toFixed(0), callOi: 0, putOi: 0 };
      const optionType = String(row.option_type || '').toUpperCase();
      const rowOi = asNum(row.open_interest);
      if (optionType.startsWith('C')) {
        existing.callOi += rowOi;
      } else if (optionType.startsWith('P')) {
        existing.putOi += rowOi;
      } else {
        existing.callOi += asNum(row.call_oi ?? row.call_open_interest ?? row.total_call_oi);
        existing.putOi += asNum(row.put_oi ?? row.put_open_interest ?? row.total_put_oi);
      }
      grouped.set(strike, existing);
    });

    let rows = Array.from(grouped.values());

    if (rows.length === 0 && byStrikeFallback?.length) {
      byStrikeFallback.forEach((row) => {
        const strike = asNum(row.strike);
        if (!Number.isFinite(strike) || strike <= 0) return;
        const existing = grouped.get(strike) ?? { strike, strikeLabel: strike.toFixed(0), callOi: 0, putOi: 0 };
        existing.callOi += asNum(row.call_oi);
        existing.putOi += asNum(row.put_oi);
        grouped.set(strike, existing);
      });
      rows = Array.from(grouped.values());
    }

    return rows.sort((a, b) => a.strike - b.strike);
  }, [openInterestData, selectedExpiration, byStrikeFallback]);

  const spot = asNum(wallsData?.spot_price);

  const closestStrikeLabel = useMemo(() => {
    if (spot <= 0 || !chartData.length) return null;
    const closest = chartData.reduce((best, row) =>
      Math.abs(row.strike - spot) < Math.abs(best.strike - spot) ? row : best,
    );
    return closest.strikeLabel;
  }, [spot, chartData]);

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
              CALL &amp; PUT WALL MAP
            </h3>
            <TooltipWrapper text="Strike-level open interest map. Each strike is ordered ascending left-to-right, with separate bars for call and put OI. The yellow dotted line marks the nearest strike to spot.">
              <Info size={14} />
            </TooltipWrapper>
          </div>
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
        </div>

        {!chartData.length ? (
          <div className="flex items-center justify-center h-[280px] text-sm" style={{ color: colors.muted }}>
            No open-interest data available for the selected expiration.
          </div>
        ) : (
          <MobileScrollableChart minWidthClass="min-w-[900px]">
            <ResponsiveContainer width="100%" height={560}>
              <ComposedChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} opacity={0.3} />
                <XAxis dataKey="strikeLabel" type="category" stroke={axisStroke} tick={{ fontSize: 11, fill: axisStroke }} interval="preserveStartEnd" minTickGap={22} />
                <YAxis yAxisId="oi" stroke={axisStroke} tick={{ fontSize: 11, fill: axisStroke }} tickFormatter={(v) => `${(Number(v) / 1000).toFixed(0)}k`} />
                <Tooltip content={<WallMapTooltip />} />
                <Legend />
                <Bar yAxisId="oi" dataKey="callOi" name="Call OI" fill={colors.bullish} opacity={0.55} />
                <Bar yAxisId="oi" dataKey="putOi" name="Put OI" fill={colors.bearish} opacity={0.55} />

                {closestStrikeLabel && (
                  <ReferenceLine yAxisId="oi" x={closestStrikeLabel} stroke="#FFD700" strokeDasharray="4 4" label={{ value: `Spot ${spot.toFixed(2)}`, fill: '#FFD700', position: 'top', fontSize: 11 }} />
                )}
              </ComposedChart>
            </ResponsiveContainer>
          </MobileScrollableChart>
        )}
      </div>
    </ExpandableCard>
  );
}
