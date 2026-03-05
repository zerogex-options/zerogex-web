'use client';

import { Info } from 'lucide-react';
import { useMemo } from 'react';
import { useApiData } from '@/hooks/useApiData';
import { useTimeframe } from '@/core/TimeframeContext';
import { useTheme } from '@/core/ThemeContext';
import { colors } from '@/core/colors';
import LoadingSpinner from './LoadingSpinner';
import ErrorMessage from './ErrorMessage';
import TooltipWrapper from './TooltipWrapper';
import ExpandableCard from './ExpandableCard';
import { omitClosedMarketTimes } from '@/core/utils';

interface GammaDataPoint { timestamp: string; strike: number; net_gex: number; }


export default function GammaHeatmap() {
  const { theme } = useTheme();
  const { getMaxDataPoints, timeframe, symbol } = useTimeframe();
  const maxPoints = getMaxDataPoints();
  const fetchWindowUnits = maxPoints;

  const { data: gexData, loading, error } = useApiData<GammaDataPoint[]>(
    `/api/gex/heatmap?symbol=${symbol}&timeframe=${timeframe}&window_units=${fetchWindowUnits}`,
    { refreshInterval: 5000 }
  );



  const derived = useMemo(() => {
    const rows = (gexData || []).slice(-5000);
    if (rows.length === 0) return { cells: [], strikes: [] as number[], timestamps: [] as string[] };

    const sortedTimestamps = omitClosedMarketTimes(Array.from(new Set(rows.map((r) => r.timestamp))).sort(), (ts) => ts).slice(-maxPoints);
    const strikes = Array.from(new Set(rows.map((r) => Number(r.strike)))).sort((a, b) => b - a);
    const map = new Map(rows.map((r) => [`${r.timestamp}_${Number(r.strike)}`, Number(r.net_gex)]));

    const cells = sortedTimestamps.flatMap((ts, x) =>
      strikes.map((strike) => ({ x, y: strike, value: map.get(`${ts}_${strike}`) ?? 0 }))
    );

    return { cells, strikes, timestamps: sortedTimestamps };
  }, [gexData, maxPoints]);

  if (loading && derived.cells.length === 0) return <LoadingSpinner size="lg" />;
  if (error) return <ErrorMessage message={error} />;
  if (derived.cells.length === 0) return <div className="rounded-lg p-8 text-center" style={{ backgroundColor: theme === 'dark' ? colors.cardDark : colors.cardLight, border: `1px solid ${colors.muted}` }}><p style={{ color: colors.muted }}>No heatmap data available</p></div>;

  const values = derived.cells.map((d) => d.value);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);

  const getColor = (value: number) => {
    if (maxValue - minValue < 1e-9) return 'rgb(245, 247, 255)';
    const normalized = (value - minValue) / (maxValue - minValue);

    const deepBlue = { r: 29, g: 78, b: 216 };
    const white = { r: 245, g: 247, b: 255 };
    const lavender = { r: 196, g: 181, b: 253 };

    const blend = (a: { r: number; g: number; b: number }, b: { r: number; g: number; b: number }, t: number) => ({
      r: Math.round(a.r + (b.r - a.r) * t),
      g: Math.round(a.g + (b.g - a.g) * t),
      b: Math.round(a.b + (b.b - a.b) * t),
    });

    const rgb = normalized <= 0.5
      ? blend(deepBlue, white, normalized / 0.5)
      : blend(white, lavender, (normalized - 0.5) / 0.5);

    return `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
  };

  const chartWidth = 1200;
  const chartHeight = 620;
  const yAxisWidth = 64;
  const plotLeft = 64;
  const plotTop = 30;
  const plotWidth = chartWidth - yAxisWidth - 12;
  const plotHeight = chartHeight - 56;
  const cellWidth = plotWidth / Math.max(1, derived.timestamps.length);
  const cellHeight = plotHeight / Math.max(1, derived.strikes.length);


  return (
    <ExpandableCard>
      <div className="rounded-lg overflow-hidden" style={{ backgroundColor: theme === 'dark' ? colors.cardDark : colors.cardLight, border: `1px solid ${colors.muted}` }}>
        <div className="flex items-center gap-2 px-4 pt-4 pb-2">
          <h3 className="text-xl font-bold" style={{ color: theme === 'dark' ? colors.light : colors.dark }}>Gamma Exposure Heatmap</h3>
          <TooltipWrapper text="Relative heatmap scale for net GEX in the currently visible window."><Info size={14} /></TooltipWrapper>
        </div>

        <svg width="100%" height={chartHeight} viewBox={`0 0 ${chartWidth} ${chartHeight}`} preserveAspectRatio="none" className="block">
          <defs>
            <linearGradient id="gexScale" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor={getColor(minValue)} />
              <stop offset="50%" stopColor={getColor((minValue + maxValue) / 2)} />
              <stop offset="100%" stopColor={getColor(maxValue)} />
            </linearGradient>
            <filter id="heatmapSmooth" x="-8%" y="-8%" width="116%" height="116%">
              <feGaussianBlur stdDeviation="1.2" />
            </filter>
          </defs>

          <rect x={plotLeft} y={8} width="220" height="12" fill="url(#gexScale)" rx="3" />
          <text x={plotLeft} y={26} fontSize="10" fill={theme === 'dark' ? colors.light : colors.dark}>{(minValue / 1_000_000).toFixed(1)}M</text>
          <text x={plotLeft + 110} y={26} fontSize="10" textAnchor="middle" fill={theme === 'dark' ? colors.light : colors.dark}>0</text>
          <text x={plotLeft + 220} y={26} fontSize="10" textAnchor="end" fill={theme === 'dark' ? colors.light : colors.dark}>{(maxValue / 1_000_000).toFixed(1)}M</text>

          {derived.strikes.map((strike, idx) => (
            <text key={`y-${strike}`} x={70} y={idx * cellHeight + cellHeight / 2 + plotTop} textAnchor="end" dominantBaseline="middle" style={{ fontSize: '11px', fill: theme === 'dark' ? colors.light : colors.dark, fontFamily: 'monospace' }}>${strike.toFixed(0)}</text>
          ))}

          <g filter="url(#heatmapSmooth)">
            {derived.cells.map((cell, idx) => {
              const xPos = cell.x * cellWidth + plotLeft;
              const yPos = derived.strikes.indexOf(cell.y) * cellHeight + plotTop;
              return (
                <rect
                  key={idx}
                  x={xPos}
                  y={yPos}
                  width={cellWidth}
                  height={cellHeight}
                  fill={getColor(cell.value)}
                  opacity={0.98}
                />
              );
            })}
          </g>

          {derived.timestamps.map((timestamp, idx) => {
            const spacing = cellWidth < 30 ? 6 : cellWidth < 40 ? 4 : 3;
            if (idx % spacing !== 0) return null;
            const time = new Date(timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
            return <text key={`x-${timestamp}`} x={idx * cellWidth + plotLeft + cellWidth / 2} y={chartHeight - 20} textAnchor="middle" style={{ fontSize: '10px', fill: theme === 'dark' ? colors.light : colors.dark, fontFamily: 'monospace' }}>{time}</text>;
          })}
        </svg>
      </div>
    </ExpandableCard>
  );
}
