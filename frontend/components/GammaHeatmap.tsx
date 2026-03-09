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
interface PriceDataPoint { timestamp: string; open?: number; high?: number; low?: number; close?: number; }


export default function GammaHeatmap() {
  const { theme } = useTheme();
  const { getMaxDataPoints, timeframe, symbol } = useTimeframe();
  const maxPoints = getMaxDataPoints();
  const fetchWindowUnits = maxPoints;

  const { data: gexData, loading, error } = useApiData<GammaDataPoint[]>(
    `/api/gex/heatmap?symbol=${symbol}&timeframe=${timeframe}&window_units=${fetchWindowUnits}`,
    { refreshInterval: 5000 }
  );

  const { data: priceData } = useApiData<PriceDataPoint[]>(
    `/api/market/historical?symbol=${symbol}&timeframe=${timeframe}&window_units=${fetchWindowUnits}`,
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

  const getColor = (value: number, maxAbsValue: number) => {
    if (maxAbsValue < 1e-9) return 'rgb(245, 247, 255)';
    const normalized = (value + maxAbsValue) / (2 * maxAbsValue);

    const deepBlue = { r: 29, g: 78, b: 216 };
    const white = { r: 245, g: 247, b: 255 };
    const orange = { r: 251, g: 146, b: 60 };

    const blend = (a: { r: number; g: number; b: number }, b: { r: number; g: number; b: number }, t: number) => ({
      r: Math.round(a.r + (b.r - a.r) * t),
      g: Math.round(a.g + (b.g - a.g) * t),
      b: Math.round(a.b + (b.b - a.b) * t),
    });

    const rgb = normalized <= 0.5
      ? blend(deepBlue, white, normalized / 0.5)
      : blend(white, orange, (normalized - 0.5) / 0.5);

    return `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
  };

  const chartWidth = 1200;
  const chartHeight = 620;
  const yAxisWidth = 64;
  const plotLeft = 64;
  const plotTop = 42;
  const plotWidth = chartWidth - yAxisWidth - 12;
  const plotHeight = chartHeight - 76;
  const cellWidth = plotWidth / Math.max(1, derived.timestamps.length);

  const priceRows = omitClosedMarketTimes(priceData || [], (p) => p.timestamp);
  const priceByTs = new Map(priceRows.map((p) => [p.timestamp, p]));
  const minStrike = Math.min(...derived.strikes);
  const maxStrike = Math.max(...derived.strikes);
  const priceLow = Math.min(...priceRows.map((p) => Number(p.low ?? p.close ?? p.open ?? Infinity)));
  const priceHigh = Math.max(...priceRows.map((p) => Number(p.high ?? p.close ?? p.open ?? -Infinity)));
  const hasPriceRange = Number.isFinite(priceLow) && Number.isFinite(priceHigh);
  const combinedMinRaw = Math.min(minStrike, hasPriceRange ? priceLow : minStrike);
  const combinedMaxRaw = Math.max(maxStrike, hasPriceRange ? priceHigh : maxStrike);
  const combinedSpan = Math.max(1e-9, combinedMaxRaw - combinedMinRaw);
  const combinedPadding = combinedSpan * 0.03;
  const combinedMin = combinedMinRaw - combinedPadding;
  const combinedMax = combinedMaxRaw + combinedPadding;
  const topLevel = Math.ceil(combinedMax);
  const bottomLevel = Math.floor(combinedMin);
  const yLevels = Array.from({ length: Math.max(1, topLevel - bottomLevel + 1) }, (_, i) => topLevel - i);
  const yLabelStep = Math.max(1, Math.ceil(yLevels.length / 16));

  const cellValueMap = new Map<string, number>();
  derived.cells.forEach((cell) => {
    const ts = derived.timestamps[cell.x];
    if (!ts) return;
    cellValueMap.set(`${ts}_${Number(cell.y).toFixed(2)}`, Number(cell.value || 0));
  });

  const filledCells = derived.timestamps.flatMap((ts, x) =>
    yLevels.map((level) => ({
      x,
      y: level,
      value: cellValueMap.get(`${ts}_${Number(level).toFixed(2)}`) ?? 0,
    })),
  );

  const cellHeight = plotHeight / Math.max(1, yLevels.length);
  const values = filledCells.map((d) => Number(d.value || 0));
  const maxAbsValue = Math.max(1, ...values.map((v) => Math.abs(v)));
  const minValue = -maxAbsValue;
  const maxValue = maxAbsValue;

  const yForValue = (v: number) => {
  const raw = plotTop + plotHeight * (1 - (v - combinedMin) / Math.max(1e-9, combinedMax - combinedMin));
  return Math.max(plotTop, Math.min(plotTop + plotHeight, raw));
};

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
              <stop offset="0%" stopColor={getColor(minValue, maxAbsValue)} />
              <stop offset="50%" stopColor={getColor((minValue + maxValue) / 2, maxAbsValue)} />
              <stop offset="100%" stopColor={getColor(maxValue, maxAbsValue)} />
            </linearGradient>
            <clipPath id="heatmapClip">
              <rect x={plotLeft} y={plotTop} width={Math.max(0, plotWidth)} height={Math.max(0, plotHeight)} />
            </clipPath>
          </defs>

          <rect x={plotLeft} y={8} width="220" height="12" fill="url(#gexScale)" rx="3" />
          <text x={plotLeft} y={32} fontSize="10" fill={theme === 'dark' ? colors.light : colors.dark}>{(minValue / 1_000_000).toFixed(1)}M</text>
          <text x={plotLeft + 110} y={32} fontSize="10" textAnchor="middle" fill={theme === 'dark' ? colors.light : colors.dark}>0</text>
          <text x={plotLeft + 220} y={32} fontSize="10" textAnchor="end" fill={theme === 'dark' ? colors.light : colors.dark}>{(maxValue / 1_000_000).toFixed(1)}M</text>

          {yLevels.map((level, idx) => {
            if (idx % yLabelStep !== 0) return null;
            return (
              <text key={`y-${level}`} x={plotLeft - 6} y={yForValue(level)} textAnchor="end" dominantBaseline="middle" style={{ fontSize: '11px', fill: theme === 'dark' ? colors.light : colors.dark, fontFamily: 'monospace' }}>${level.toFixed(0)}</text>
            );
          })}

          <g clipPath="url(#heatmapClip)">
            {filledCells.map((cell, idx) => {
              const xPos = cell.x * cellWidth + plotLeft;
              const yPos = yForValue(cell.y) - cellHeight / 2 - 0.5;
              return (
                <rect
                  key={idx}
                  x={xPos}
                  y={yPos}
                  width={cellWidth}
                  height={cellHeight + 1}
                  fill={getColor(cell.value, maxAbsValue)}
                  opacity={1}
                />
              );
            })}
          </g>


          <g clipPath="url(#heatmapClip)">
            {derived.timestamps.map((ts, idx) => {
              const row = priceByTs.get(ts);
              if (!row) return null;
              const open = Number(row.open ?? row.close ?? 0);
              const high = Number(row.high ?? row.close ?? open);
              const low = Number(row.low ?? row.close ?? open);
              const close = Number(row.close ?? open);
              const x = idx * cellWidth + plotLeft + cellWidth / 2;
              const up = close >= open;
              const c = up ? colors.bullish : colors.bearish;
              const openY = yForValue(open);
              const closeY = yForValue(close);
              const highY = yForValue(high);
              const lowY = yForValue(low);
              const bodyY = Math.min(openY, closeY);
              const bodyBottom = Math.max(openY, closeY);
              const bodyHeight = Math.max(1, bodyBottom - bodyY);
              const candleWidth = Math.max(2, Math.min(8, cellWidth * 0.42));

              return (
                <g key={`candle-${ts}`}>
                  <line x1={x} x2={x} y1={highY} y2={bodyY} stroke={c} strokeWidth={1.5} opacity={0.95} />
                  <line x1={x} x2={x} y1={bodyBottom} y2={lowY} stroke={c} strokeWidth={1.5} opacity={0.95} />
                  <rect
                    x={x - candleWidth / 2}
                    y={bodyY}
                    width={candleWidth}
                    height={bodyHeight}
                    fill={c}
                    stroke={c}
                    strokeWidth={1.4}
                  />
                </g>
              );
            })}
          </g>

          {derived.timestamps.map((timestamp, idx) => {
            const spacing = cellWidth < 30 ? 6 : cellWidth < 40 ? 4 : 3;
            if (idx % spacing !== 0) return null;
            const time = new Date(timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
            return <text key={`x-${timestamp}`} x={idx * cellWidth + plotLeft + cellWidth / 2} y={chartHeight - 14} textAnchor="middle" style={{ fontSize: '10px', fill: theme === 'dark' ? colors.light : colors.dark, fontFamily: 'monospace' }}>{time}</text>;
          })}
        </svg>
      </div>
    </ExpandableCard>
  );
}
