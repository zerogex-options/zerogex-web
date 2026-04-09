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
import type { TooltipProps } from 'recharts';

interface PlotPoint {
  wallType: string;
  wallKey: 'Call Wall' | 'Put Wall';
  x: number;
  price: number;
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

function formatPoints(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)} pts`;
}

function WallTooltipContent({ active, payload }: TooltipProps<number, string>) {
  if (!active || !payload || payload.length === 0) return null;
  const row = payload[0]?.payload as PlotPoint | undefined;
  if (!row) return null;

  return (
    <div
      className="rounded-lg px-3 py-2 text-xs"
      style={{
        backgroundColor: 'var(--color-chart-tooltip-bg)',
        border: '1px solid var(--color-border)',
        color: 'var(--color-chart-tooltip-text)',
      }}
    >
      <div className="font-semibold mb-1">{row.wallType} @ ${row.price.toFixed(2)}</div>
      <div style={{ color: 'var(--color-chart-tooltip-muted)' }}>Exposure: {formatExposure(row.exposure)}</div>
      <div style={{ color: 'var(--color-chart-tooltip-muted)' }}>Distance: {formatPoints(row.distance)} ({formatPct(row.pct)})</div>
    </div>
  );
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
      x: 1,
      price: Number(wallsData.call_wall.strike),
      exposure: Number(wallsData.call_wall.exposure),
      distance: Number(wallsData.call_wall.distance_from_spot),
      pct: Number(wallsData.call_wall.pct_from_spot),
    });
  }
  if (wallsData?.put_wall) {
    points.push({
      wallType: 'Put Wall',
      wallKey: 'Put Wall',
      x: 0,
      price: Number(wallsData.put_wall.strike),
      exposure: Number(wallsData.put_wall.exposure),
      distance: Number(wallsData.put_wall.distance_from_spot),
      pct: Number(wallsData.put_wall.pct_from_spot),
    });
  }

  const maxAbsExposure = points.reduce((max, p) => Math.max(max, Math.abs(p.exposure)), 1);
  const spot = Number(wallsData?.spot_price ?? 0);

  const priceCandidates = points.map((p) => p.price).concat(spot ? [spot] : []);
  const minPrice = priceCandidates.length > 0 ? Math.min(...priceCandidates) : 0;
  const maxPrice = priceCandidates.length > 0 ? Math.max(...priceCandidates) : 0;
  const rangePad = Math.max(1.5, (maxPrice - minPrice) * 0.25);
  const domainStart = minPrice - rangePad;
  const domainEnd = maxPrice + rangePad;

  const callPoint = points.find((point) => point.wallKey === 'Call Wall');
  const putPoint = points.find((point) => point.wallKey === 'Put Wall');
  const nearestWall = [...points].sort((a, b) => Math.abs(a.distance) - Math.abs(b.distance))[0];

  const positionRegime = callPoint && putPoint
    ? spot > callPoint.price
      ? 'above call wall'
      : spot < putPoint.price
        ? 'below put wall'
        : 'between walls'
    : 'insufficient wall data';

  const dominantWall = callPoint && putPoint
    ? Math.abs(callPoint.exposure) >= Math.abs(putPoint.exposure)
      ? 'call'
      : 'put'
    : null;

  const directionalBias = dominantWall === 'call'
    ? 'Upside resistance is stronger (potential pin/slowdown into call wall).'
    : dominantWall === 'put'
      ? 'Downside support is weaker than put pressure (watch for acceleration lower on breaks).'
      : 'No clear directional dominance.';

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
        Spot / underlying price
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
          <TooltipWrapper text="Price is plotted on the Y-axis so you can read wall levels like a price ladder. Bubble size = wall gamma magnitude, and the distance labels show how far each wall sits from spot in points and %.">
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
                dataKey="x"
                domain={[-0.6, 1.6]}
                ticks={[0, 1]}
                stroke={axisStroke}
                tick={{ fontSize: isMobile ? 9 : 11, fill: axisStroke }}
                tickFormatter={(value) => (Number(value) === 1 ? 'Call Side' : 'Put Side')}
              />
              <YAxis
                type="number"
                dataKey="price"
                domain={[domainStart, domainEnd]}
                stroke={axisStroke}
                width={isMobile ? 72 : 92}
                tick={{ fontSize: isMobile ? 9 : 11, fill: axisStroke }}
                tickFormatter={(value) => `$${Number(value).toFixed(0)}`}
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
                content={<WallTooltipContent />}
              />
              <Legend verticalAlign="top" align="right" content={legendContent} wrapperStyle={{ top: 0, right: 0 }} />

              <ReferenceLine
                y={spot}
                stroke={colors.primary}
                strokeDasharray="6 4"
                strokeWidth={2}
                label={{ value: `Spot $${spot.toFixed(2)}`, fill: colors.primary, fontSize: 10, position: 'insideTopLeft' }}
              />

              {points.map((point) => (
                <ReferenceLine
                  key={`${point.wallKey}-distance`}
                  segment={[
                    { x: point.x, y: spot },
                    { x: point.x, y: point.price },
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

        {points.length > 0 && (
          <div className="mt-5 rounded-xl p-4" style={{ backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-border)' }}>
            <div className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: textColor }}>
              Trader Readout
            </div>
            <ul className="space-y-1.5 text-sm" style={{ color: textColor }}>
              <li>
                <span className="font-semibold">Regime:</span> Price is currently <span className="font-semibold">{positionRegime}</span>.
              </li>
              {nearestWall && (
                <li>
                  <span className="font-semibold">Nearest wall:</span> {nearestWall.wallType} is {formatPoints(nearestWall.distance)} ({formatPct(nearestWall.pct)}) from spot.
                </li>
              )}
              <li>
                <span className="font-semibold">Bias:</span> {directionalBias}
              </li>
              <li>
                <span className="font-semibold">Actionable use:</span> Fade moves into the stronger wall when spot remains between walls; switch to breakout/continuation bias only after sustained price acceptance beyond that wall.
              </li>
            </ul>
          </div>
        )}
      </div>
    </ExpandableCard>
  );
}
