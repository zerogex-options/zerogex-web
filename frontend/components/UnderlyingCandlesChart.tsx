'use client';

import { Info } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useApiData, useMarketQuote } from '@/hooks/useApiData';
import LoadingSpinner from './LoadingSpinner';
import ErrorMessage from './ErrorMessage';
import TooltipWrapper from './TooltipWrapper';
import ExpandableCard from './ExpandableCard';
import { colors } from '@/core/colors';
import { useTheme } from '@/core/ThemeContext';
import { omitClosedMarketTimes } from '@/core/utils';
import { useTimeframe } from '@/core/TimeframeContext';

interface PriceBar {
  timestamp: string;
  open?: number;
  high?: number;
  low?: number;
  close?: number;
  price?: number;
  volume?: number;
}

interface CandleBar {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

function aggregateBars(data: CandleBar[], bucketMinutes: number, maxPoints: number): CandleBar[] {
  if (data.length === 0) return [];
  const sorted = [...data].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  const bucketMs = bucketMinutes * 60 * 1000;
  const buckets = new Map<number, CandleBar[]>();

  sorted.forEach((bar) => {
    const t = new Date(bar.timestamp).getTime();
    const bucket = Math.floor(t / bucketMs) * bucketMs;
    if (!buckets.has(bucket)) buckets.set(bucket, []);
    buckets.get(bucket)!.push(bar);
  });

  return Array.from(buckets.entries())
    .sort((a, b) => a[0] - b[0])
    .slice(-maxPoints)
    .map(([bucket, bars]) => ({
      timestamp: new Date(bucket).toISOString(),
      open: bars[0].open,
      close: bars[bars.length - 1].close,
      high: Math.max(...bars.map((b) => b.high)),
      low: Math.min(...bars.map((b) => b.low)),
      volume: bars.reduce((sum, b) => sum + b.volume, 0),
    }));
}

export default function UnderlyingCandlesChart() {
  const { theme } = useTheme();
  const { getIntervalMinutes, getWindowMinutes, getMaxDataPoints, symbol } = useTimeframe();
  const { data: quote } = useMarketQuote(symbol, 1000);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const intervalMinutes = getIntervalMinutes();
  const windowMinutes = getWindowMinutes();
  const maxPoints = getMaxDataPoints();

  const { data, loading, error } = useApiData<PriceBar[]>(
    `/api/market/historical?symbol=${symbol}&timeframe=1min&limit=${Math.max(windowMinutes, 120)}`,
    { refreshInterval: 5000 }
  );

  const bars = useMemo(() => {
    const filtered = omitClosedMarketTimes(data || [], (d) => d.timestamp);
    let prev = filtered[0]?.close ?? filtered[0]?.price ?? 0;
    const normalized: CandleBar[] = filtered.map((d) => {
      const close = d.close ?? d.price ?? prev;
      const open = d.open ?? prev;
      const high = d.high ?? Math.max(open, close);
      const low = d.low ?? Math.min(open, close);
      prev = close;
      return { timestamp: d.timestamp, open, high, low, close, volume: d.volume ?? 0 };
    });
    return aggregateBars(normalized, intervalMinutes, maxPoints);
  }, [data, intervalMinutes, maxPoints]);

  if (loading && bars.length === 0) return <LoadingSpinner />;
  if (error) return <ErrorMessage message={error} />;
  if (bars.length === 0) return <div className="bg-[#423d3f] rounded-lg p-6 text-center text-gray-400">No underlying timeseries data available</div>;

  const width = 1100;
  const height = 500;
  const padLeft = 70;
  const padRight = 30;
  const padTop = 30;
  const padBottom = 45;
  const priceAreaBottom = 350;
  const volumeAreaTop = 370;
  const volumeAreaBottom = 470;

  const minPrice = Math.min(...bars.map((b) => b.low));
  const maxPrice = Math.max(...bars.map((b) => b.high));
  const maxVol = Math.max(...bars.map((b) => b.volume));
  const xStep = (width - padLeft - padRight) / Math.max(1, bars.length - 1);
  const candleWidth = Math.max(3, Math.min(10, xStep * 0.6));

  const yPrice = (p: number) => padTop + (1 - (p - minPrice) / Math.max(1e-9, maxPrice - minPrice)) * (priceAreaBottom - padTop);
  const yVol = (v: number) => volumeAreaBottom - (v / Math.max(1, maxVol)) * (volumeAreaBottom - volumeAreaTop);

  const hovered = hoveredIdx !== null ? bars[hoveredIdx] : null;

  return (
    <ExpandableCard>
      <div className="bg-[#423d3f] rounded-lg p-6 mb-8">
      <div className="flex items-center gap-2 mb-4">
        <h2 className="text-2xl font-semibold">{quote?.symbol || 'Underlying'} Price Action</h2>
        <TooltipWrapper text="Hollow OHLC candles aggregated to the selected interval (1m/5m/15m/1h/1d). Hollow candle means close >= open; filled means close < open. Volume bars are overlaid on the lower panel with shared x-axis time."><Info size={14} /></TooltipWrapper>
      </div>
      <div className="relative">
        {hovered && (
          <div className="absolute right-3 top-2 z-10 text-xs rounded px-3 py-2 bg-black/70 text-white font-mono">
            <div>{new Date(hovered.timestamp).toLocaleString()}</div>
            <div>O: {hovered.open.toFixed(2)} H: {hovered.high.toFixed(2)} L: {hovered.low.toFixed(2)} C: {hovered.close.toFixed(2)}</div>
            <div>Vol: {hovered.volume.toLocaleString()}</div>
          </div>
        )}
        <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
          <text x="18" y={(padTop + priceAreaBottom) / 2} transform={`rotate(-90, 18, ${(padTop + priceAreaBottom) / 2})`} fontSize="12" fill={colors.muted}>Price</text>

          {[0, 0.25, 0.5, 0.75, 1].map((p) => {
            const price = minPrice + (1 - p) * (maxPrice - minPrice);
            const y = padTop + p * (priceAreaBottom - padTop);
            return (
              <g key={p}>
                <line x1={padLeft} x2={width - padRight} y1={y} y2={y} stroke={colors.muted} opacity={0.2} />
                <text x={padLeft - 8} y={y + 4} textAnchor="end" fontSize="10" fill={colors.muted}>${price.toFixed(2)}</text>
              </g>
            );
          })}

          {bars.map((b, i) => {
            const x = padLeft + i * xStep;
            const up = b.close >= b.open;
            const c = up ? colors.bullish : colors.bearish;
            const openY = yPrice(b.open);
            const closeY = yPrice(b.close);
            const highY = yPrice(b.high);
            const lowY = yPrice(b.low);
            const bodyY = Math.min(openY, closeY);
            const bodyH = Math.max(1, Math.abs(openY - closeY));
            return (
              <g key={b.timestamp} onMouseEnter={() => setHoveredIdx(i)} onMouseLeave={() => setHoveredIdx(null)}>
                <line x1={x} x2={x} y1={highY} y2={lowY} stroke={c} strokeWidth={1.4} />
                <rect
                  x={x - candleWidth / 2}
                  y={bodyY}
                  width={candleWidth}
                  height={bodyH}
                  fill={up ? 'transparent' : c}
                  stroke={c}
                  strokeWidth={1.5}
                />
                <rect
                  x={x - candleWidth / 2}
                  y={yVol(b.volume)}
                  width={candleWidth}
                  height={volumeAreaBottom - yVol(b.volume)}
                  fill={c}
                  opacity={0.75}
                />
                {i % Math.ceil(bars.length / 8) === 0 && (
                  <text x={x} y={height - 12} fontSize="10" textAnchor="middle" fill={theme === 'dark' ? colors.light : colors.dark}>
                    {new Date(b.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}
                  </text>
                )}
              </g>
            );
          })}
          <line x1={padLeft} x2={width - padRight} y1={priceAreaBottom} y2={priceAreaBottom} stroke={colors.muted} opacity={0.35} />
          <line x1={padLeft} x2={width - padRight} y1={volumeAreaBottom} y2={volumeAreaBottom} stroke={colors.muted} opacity={0.6} />
        </svg>
      </div>
      </div>
    </ExpandableCard>
  );
}
