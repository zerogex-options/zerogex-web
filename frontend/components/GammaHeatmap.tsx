'use client';

import { Info } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useApiData } from '@/hooks/useApiData';
import { useTimeframe } from '@/core/TimeframeContext';
import { useTheme } from '@/core/ThemeContext';
import { colors } from '@/core/colors';
import LoadingSpinner from './LoadingSpinner';
import ErrorMessage from './ErrorMessage';
import TooltipWrapper from './TooltipWrapper';
import ExpandableCard from './ExpandableCard';

interface GammaDataPoint { timestamp: string; strike: number; net_gex: number; }

const GEX_COLOR_CAP = 10_000_000;
interface PriceDataPoint { timestamp: string; open?: number; high?: number; low?: number; close?: number; }

export default function GammaHeatmap() {
  const { theme } = useTheme();
  const { getMaxDataPoints, timeframe, symbol } = useTimeframe();
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(1200);
  const maxPoints = getMaxDataPoints();

  const { data: gexData, loading, error } = useApiData<GammaDataPoint[]>(
    `/api/gex/heatmap?symbol=${symbol}&timeframe=${timeframe}&window_units=${maxPoints}`,
    { refreshInterval: 5000 }
  );

  const { data: priceData } = useApiData<PriceDataPoint[]>(
    `/api/market/historical?symbol=${symbol}&timeframe=${timeframe}&window_units=${maxPoints}`,
    { refreshInterval: 5000 }
  );

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) setContainerWidth(entry.contentRect.width);
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const derived = useMemo(() => {
    const rows = (gexData || []).slice(-5000);
    if (rows.length === 0) return { cells: [], strikes: [] as number[], timestamps: [] as string[] };

    const sortedTimestamps = Array.from(new Set(rows.map((r) => r.timestamp))).sort().slice(-maxPoints);
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

  const getColor = (value: number) => {
    const clamped = Math.max(-GEX_COLOR_CAP, Math.min(GEX_COLOR_CAP, value));
    const sign = clamped >= 0 ? 1 : -1;
    const magnitude = Math.abs(clamped);
    const logNorm = Math.log10(1 + magnitude) / Math.log10(1 + GEX_COLOR_CAP);
    const normalized = (sign * logNorm + 1) / 2;

    const hue = 280 - normalized * 240; // purple -> cyan -> green
    const saturation = 84 + normalized * 12;
    const lightness = 28 + normalized * 40;
    return `hsl(${hue.toFixed(1)} ${saturation.toFixed(1)}% ${lightness.toFixed(1)}%)`;
  };

  const yAxisWidth = 80;
  const availableWidth = containerWidth - yAxisWidth - 40;
  const cellWidth = Math.max(18, Math.floor(availableWidth / Math.max(1, derived.timestamps.length)));
  const cellHeight = 28;
  const chartWidth = Math.max(600, derived.timestamps.length * cellWidth + yAxisWidth + 40);
  const chartHeight = Math.max(240, derived.strikes.length * cellHeight + 80);

  const priceByTs = new Map((priceData || []).map((p) => [p.timestamp, p]));
  const minStrike = Math.min(...derived.strikes);
  const maxStrike = Math.max(...derived.strikes);
  const yForPrice = (p: number) => 40 + (derived.strikes.length * cellHeight) * (1 - (p - minStrike) / Math.max(1e-9, maxStrike - minStrike));

  return (
    <ExpandableCard>
      <div ref={containerRef} className="rounded-lg p-6" style={{ backgroundColor: theme === 'dark' ? colors.cardDark : colors.cardLight, border: `1px solid ${colors.muted}` }}>
        <div className="flex items-center gap-2 mb-4">
          <h3 className="text-xl font-bold" style={{ color: theme === 'dark' ? colors.light : colors.dark }}>Gamma Exposure Heatmap</h3>
          <TooltipWrapper text="Heatmap from /api/gex/heatmap. Price overlay is OHLC candlesticks from /api/market/historical aligned to the same timeframe."><Info size={14} /></TooltipWrapper>
        </div>

        <svg width="100%" height={chartHeight} viewBox={`0 0 ${chartWidth} ${chartHeight}`} preserveAspectRatio="xMidYMid meet">
          <defs>
            <linearGradient id="gexScale" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor={getColor(-GEX_COLOR_CAP)} />
              <stop offset="50%" stopColor={getColor(0)} />
              <stop offset="100%" stopColor={getColor(GEX_COLOR_CAP)} />
            </linearGradient>
          </defs>

          <rect x={84} y={8} width="220" height="12" fill="url(#gexScale)" rx="3" />
          <text x={84} y={32} fontSize="11" fill={theme === 'dark' ? colors.light : colors.dark}>-{(GEX_COLOR_CAP / 1_000_000).toFixed(0)}M</text>
          <text x={186} y={32} fontSize="11" textAnchor="middle" fill={theme === 'dark' ? colors.light : colors.dark}>0</text>
          <text x={304} y={32} fontSize="11" textAnchor="end" fill={theme === 'dark' ? colors.light : colors.dark}>+{(GEX_COLOR_CAP / 1_000_000).toFixed(0)}M</text>

          {derived.strikes.map((strike, idx) => (
            <text key={`y-${strike}`} x={70} y={idx * cellHeight + cellHeight / 2 + 40} textAnchor="end" dominantBaseline="middle" style={{ fontSize: '11px', fill: theme === 'dark' ? colors.light : colors.dark, fontFamily: 'monospace' }}>${strike.toFixed(0)}</text>
          ))}

          {derived.cells.map((cell, idx) => {
            const xPos = cell.x * cellWidth + 80;
            const yPos = derived.strikes.indexOf(cell.y) * cellHeight + 40;
            return <rect key={idx} x={xPos} y={yPos} width={cellWidth} height={cellHeight} fill={getColor(cell.value)} />;
          })}

          {derived.timestamps.map((ts, idx) => {
            const row = priceByTs.get(ts);
            if (!row) return null;
            const open = Number(row.open ?? row.close ?? 0);
            const high = Number(row.high ?? row.close ?? open);
            const low = Number(row.low ?? row.close ?? open);
            const close = Number(row.close ?? open);
            const x = idx * cellWidth + 80 + cellWidth / 2;
            const up = close >= open;
            const c = up ? colors.bullish : colors.bearish;
            const openY = yForPrice(open);
            const closeY = yForPrice(close);
            const highY = yForPrice(high);
            const lowY = yForPrice(low);
            const bodyY = Math.min(openY, closeY);
            const bodyBottom = Math.max(openY, closeY);
            const bodyHeight = Math.max(1, bodyBottom - bodyY);
            const candleWidth = Math.max(3, Math.min(10, cellWidth * 0.45));

            return (
              <g key={`candle-${ts}`}>
                <line x1={x} x2={x} y1={highY} y2={bodyY} stroke={c} strokeWidth={1.9} />
                <line x1={x} x2={x} y1={bodyBottom} y2={lowY} stroke={c} strokeWidth={1.9} />
                <rect
                  x={x - candleWidth / 2}
                  y={bodyY}
                  width={candleWidth}
                  height={bodyHeight}
                  fill={up ? 'transparent' : c}
                  stroke={c}
                  strokeWidth={1.9}
                />
              </g>
            );
          })}

          {derived.timestamps.map((timestamp, idx) => {
            const spacing = cellWidth < 30 ? 6 : cellWidth < 40 ? 4 : 3;
            if (idx % spacing !== 0) return null;
            const time = new Date(timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
            return <text key={`x-${timestamp}`} x={idx * cellWidth + 80 + cellWidth / 2} y={chartHeight - 20} textAnchor="middle" style={{ fontSize: '10px', fill: theme === 'dark' ? colors.light : colors.dark, fontFamily: 'monospace' }}>{time}</text>;
          })}
        </svg>
      </div>
    </ExpandableCard>
  );
}
