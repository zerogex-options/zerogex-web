'use client';

import { Info } from 'lucide-react';
import {
  CartesianGrid,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from 'recharts';
import { useTheme } from '@/core/ThemeContext';
import { colors } from '@/core/colors';
import type { GEXWallsRow } from '@/hooks/useApiData';
import ExpandableCard from './ExpandableCard';
import TooltipWrapper from './TooltipWrapper';
import { useIsMobile } from '@/hooks/useIsMobile';

interface PlotPoint {
  wallType: string;
  wallKey: 'Call Wall' | 'Put Wall';
  y: number;
  strike: number;
  exposure: number;
  distance: number;
  pct: number;
}

interface GexWallsChartProps {
  wallsData: GEXWallsRow | null | undefined;
}

function formatExposure(value: number): string {
  const abs = Math.abs(value);
  const sign = value >= 0 ? '+' : '-';
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(0)}K`;
  return `${sign}$${abs.toFixed(0)}`;
}

function formatPct(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
}

export default function GexWallsChart({ wallsData }: GexWallsChartProps) {
  const { theme } = useTheme();
  const isMobile = useIsMobile();
  const isDark = theme === 'dark';
  const textColor = isDark ? colors.light : colors.dark;
  const axisStroke = 'var(--color-text-primary)';
  const gridStroke = isDark ? 'var(--color-text-secondary)' : 'var(--color-border)';

  const points: PlotPoint[] = [];
  if (wallsData?.call_wall) {
    points.push({
      wallType: 'Call Wall',
      wallKey: 'Call Wall',
      y: 1,
      strike: Number(wallsData.call_wall.strike),
      exposure: Number(wallsData.call_wall.exposure),
      distance: Number(wallsData.call_wall.distance_from_spot),
      pct: Number(wallsData.call_wall.pct_from_spot),
    });
  }
  if (wallsData?.put_wall) {
    points.push({
      wallType: 'Put Wall',
      wallKey: 'Put Wall',
      y: 0,
      strike: Number(wallsData.put_wall.strike),
      exposure: Number(wallsData.put_wall.exposure),
      distance: Number(wallsData.put_wall.distance_from_spot),
      pct: Number(wallsData.put_wall.pct_from_spot),
    });
  }

  const maxAbsExposure = points.reduce((max, p) => Math.max(max, Math.abs(p.exposure)), 1);
  const spot = Number(wallsData?.spot_price ?? 0);

  const priceCandidates = points.map((p) => p.strike).concat(spot ? [spot] : []);
  const minPrice = priceCandidates.length > 0 ? Math.min(...priceCandidates) : 0;
  const maxPrice = priceCandidates.length > 0 ? Math.max(...priceCandidates) : 0;
  const rangePad = Math.max(1, (maxPrice - minPrice) * 0.18);
  const domainStart = minPrice - rangePad;
  const domainEnd = maxPrice + rangePad;

  const legendContent = () => (
    <div className="w-full flex flex-wrap justify-end items-center gap-4 text-xs" style={{ color: textColor }}>
      <div className="flex items-center gap-1.5">
        <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: colors.bullish }} />
        Call wall (size = exposure)
      </div>
      <div className="flex items-center gap-1.5">
        <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: colors.bearish }} />
        Put wall (size = exposure)
      </div>
      <div className="flex items-center gap-1.5">
        <span className="inline-block h-0.5 w-4" style={{ backgroundColor: colors.primary }} />
        Spot / underlying
      </div>
    </div>
  );

  return (
    <ExpandableCard expandTrigger="button" expandButtonLabel="Expand chart" className="h-full">
      <div
        className="rounded-2xl p-6 h-full"
        style={{
          backgroundColor: isDark ? colors.cardDark : colors.cardLight,
          border: `1px solid ${colors.muted}`,
        }}
      >
        <div className="flex items-center gap-2 mb-4">
          <h3 className="text-sm font-bold tracking-wider uppercase" style={{ color: textColor }}>
            CALL &amp; PUT WALL MAP
          </h3>
          <TooltipWrapper text="Shows where the dominant call/put gamma walls sit relative to spot. Bubble size scales with wall exposure magnitude and horizontal distance shows how far each wall is from the underlying price.">
            <Info size={14} />
          </TooltipWrapper>
        </div>

        {!wallsData || points.length === 0 || !Number.isFinite(spot) ? (
          <div className="flex items-center justify-center h-[260px] text-sm" style={{ color: colors.muted }}>
            No wall data available
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={isMobile ? 300 : 340}>
            <ScatterChart margin={{ top: 8, right: isMobile ? 4 : 16, left: isMobile ? -14 : 0, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} opacity={0.3} />
              <XAxis
                type="number"
                dataKey="strike"
                domain={[domainStart, domainEnd]}
                stroke={axisStroke}
                tick={{ fontSize: isMobile ? 9 : 11, fill: axisStroke }}
                tickFormatter={(value) => `$${Number(value).toFixed(0)}`}
              />
              <YAxis
                type="number"
                dataKey="y"
                domain={[-0.5, 1.5]}
                ticks={[0, 1]}
                stroke={axisStroke}
                width={isMobile ? 72 : 92}
                tick={{ fontSize: isMobile ? 9 : 11, fill: axisStroke }}
                tickFormatter={(value) => (Number(value) === 1 ? 'Call Wall' : 'Put Wall')}
              />
              <ZAxis
                type="number"
                dataKey="exposure"
                range={isMobile ? [120, 560] : [180, 860]}
                domain={[0, maxAbsExposure]}
                scale="sqrt"
              />
              <Tooltip
                cursor={{ strokeDasharray: '4 4' }}
                contentStyle={{
                  backgroundColor: 'var(--color-chart-tooltip-bg)',
                  borderColor: 'var(--color-border)',
                  borderRadius: 8,
                  color: 'var(--color-chart-tooltip-text)',
                }}
                labelStyle={{ color: 'var(--color-chart-tooltip-text)' }}
                itemStyle={{ color: 'var(--color-chart-tooltip-muted)' }}
                formatter={(_value, _name, item) => {
                  const payload = item?.payload as PlotPoint | undefined;
                  if (!payload) return [];
                  return [
                    `${formatExposure(payload.exposure)} • ${formatPct(payload.pct)} • ${payload.distance >= 0 ? '+' : ''}${payload.distance.toFixed(2)}pts`,
                    payload.wallType,
                  ];
                }}
                labelFormatter={(_label, payload) => {
                  const row = payload?.[0]?.payload as PlotPoint | undefined;
                  return row ? `${row.wallType} @ $${row.strike.toFixed(2)}` : '';
                }}
              />
              <Legend verticalAlign="top" align="right" content={legendContent} wrapperStyle={{ top: 0, right: 0 }} />

              <ReferenceLine
                x={spot}
                stroke={colors.primary}
                strokeDasharray="6 4"
                strokeWidth={2}
                label={{ value: `Spot $${spot.toFixed(2)}`, fill: colors.primary, fontSize: 10, position: 'insideTopLeft' }}
              />

              {points.map((point) => (
                <ReferenceLine
                  key={`${point.wallKey}-distance`}
                  segment={[
                    { x: spot, y: point.y },
                    { x: point.strike, y: point.y },
                  ]}
                  stroke={point.wallKey === 'Call Wall' ? colors.bullish : colors.bearish}
                  strokeDasharray="4 3"
                  strokeWidth={2}
                />
              ))}

              <Scatter
                name="Call Wall"
                data={points.filter((p) => p.wallKey === 'Call Wall')}
                fill={colors.bullish}
              />
              <Scatter
                name="Put Wall"
                data={points.filter((p) => p.wallKey === 'Put Wall')}
                fill={colors.bearish}
              />
            </ScatterChart>
          </ResponsiveContainer>
        )}
      </div>
    </ExpandableCard>
  );
}
