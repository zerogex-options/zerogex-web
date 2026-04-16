'use client';

import { useMemo, useState } from 'react';
import { Bar, CartesianGrid, ComposedChart, Legend, ReferenceLine, ResponsiveContainer, Scatter, Tooltip, XAxis, YAxis } from 'recharts';
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
}

interface GexWallsChartProps {
  wallsData: GEXWallsRow | null | undefined;
  openInterestData?: OpenInterestRow[] | null;
}

type ChartRow = {
  strike: number;
  callOi: number;
  putOi: number;
};

function asNum(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export default function GexWallsChart({ wallsData, openInterestData }: GexWallsChartProps) {
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
      const existing = grouped.get(strike) ?? { strike, callOi: 0, putOi: 0 };
      existing.callOi += asNum(row.call_oi ?? row.call_open_interest ?? row.total_call_oi);
      existing.putOi += asNum(row.put_oi ?? row.put_open_interest ?? row.total_put_oi);
      grouped.set(strike, existing);
    });

    return Array.from(grouped.values()).sort((a, b) => a.strike - b.strike);
  }, [openInterestData, selectedExpiration]);

  const callWallStrike = asNum(wallsData?.call_wall?.strike);
  const putWallStrike = asNum(wallsData?.put_wall?.strike);
  const callWallExposure = Math.abs(asNum(wallsData?.call_wall?.exposure));
  const putWallExposure = Math.abs(asNum(wallsData?.put_wall?.exposure));
  const spot = asNum(wallsData?.spot_price);

  const maxOi = Math.max(
    1,
    ...chartData.map((row) => Math.max(row.callOi, row.putOi)),
  );
  const maxWallExposure = Math.max(callWallExposure, putWallExposure, 1);
  const bubbleRows = [
    ...(callWallStrike > 0 ? [{ x: callWallStrike, y: maxOi * 0.92, z: (callWallExposure / maxWallExposure) * 100 + 20, label: 'Call Wall' }] : []),
    ...(putWallStrike > 0 ? [{ x: putWallStrike, y: maxOi * 0.85, z: (putWallExposure / maxWallExposure) * 100 + 20, label: 'Put Wall' }] : []),
  ];

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
            <TooltipWrapper text="Composite view: bars show strike-level call/put open interest. Wall bubbles and spot line are overlaid on top for immediate context.">
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
            <ResponsiveContainer width="100%" height={360}>
              <ComposedChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} opacity={0.3} />
                <XAxis dataKey="strike" type="number" stroke={axisStroke} tick={{ fontSize: 11, fill: axisStroke }} domain={['dataMin', 'dataMax']} tickFormatter={(v) => `${Number(v).toFixed(0)}`} />
                <YAxis yAxisId="oi" stroke={axisStroke} tick={{ fontSize: 11, fill: axisStroke }} tickFormatter={(v) => `${(Number(v) / 1000).toFixed(0)}k`} />
                <Tooltip
                  contentStyle={{ background: 'var(--color-chart-tooltip-bg)', border: '1px solid var(--color-border)', borderRadius: 8, color: 'var(--color-chart-tooltip-text)' }}
                  formatter={(value, name) => [Number(value).toLocaleString(), name === 'callOi' ? 'Call OI' : name === 'putOi' ? 'Put OI' : String(name)]}
                  labelFormatter={(label) => `Strike ${Number(label).toFixed(2)}`}
                />
                <Legend />
                <Bar yAxisId="oi" dataKey="callOi" name="Call OI" fill={colors.bullish} opacity={0.55} />
                <Bar yAxisId="oi" dataKey="putOi" name="Put OI" fill={colors.bearish} opacity={0.55} />

                {spot > 0 && (
                  <ReferenceLine x={spot} stroke={colors.primary} strokeDasharray="5 4" label={{ value: `Spot ${spot.toFixed(2)}`, fill: colors.primary, position: 'top' }} />
                )}
                {callWallStrike > 0 && <ReferenceLine x={callWallStrike} stroke={colors.bullish} strokeDasharray="3 3" label={{ value: 'Call Wall', fill: colors.bullish, position: 'insideTopRight' }} />}
                {putWallStrike > 0 && <ReferenceLine x={putWallStrike} stroke={colors.bearish} strokeDasharray="3 3" label={{ value: 'Put Wall', fill: colors.bearish, position: 'insideTopLeft' }} />}

                <Scatter yAxisId="oi" name="Wall Bubble" data={bubbleRows} fill={colors.warning} />
              </ComposedChart>
            </ResponsiveContainer>
          </MobileScrollableChart>
        )}
      </div>
    </ExpandableCard>
  );
}
