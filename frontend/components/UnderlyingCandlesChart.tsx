'use client';

import { Info } from 'lucide-react';
import { useMemo } from 'react';
import { useApiData } from '@/hooks/useApiData';
import LoadingSpinner from './LoadingSpinner';
import ErrorMessage from './ErrorMessage';
import TooltipWrapper from './TooltipWrapper';
import { colors } from '@/core/colors';
import { useTheme } from '@/core/ThemeContext';
import { omitClosedMarketTimes } from '@/core/utils';

interface PriceBar {
  timestamp: string;
  open?: number;
  high?: number;
  low?: number;
  close?: number;
  price?: number;
  volume?: number;
}

export default function UnderlyingCandlesChart() {
  const { theme } = useTheme();
  const { data, loading, error } = useApiData<PriceBar[]>('/api/price/timeseries?window_minutes=390&interval_minutes=1', { refreshInterval: 5000 });

  const bars = useMemo(() => {
    const filtered = omitClosedMarketTimes(data || [], (d) => d.timestamp);
    let prev = filtered[0]?.close ?? filtered[0]?.price ?? 0;
    return filtered.map((d) => {
      const close = d.close ?? d.price ?? prev;
      const open = d.open ?? prev;
      const high = d.high ?? Math.max(open, close);
      const low = d.low ?? Math.min(open, close);
      prev = close;
      return { ...d, open, high, low, close, volume: d.volume ?? 0 };
    });
  }, [data]);

  if (loading && bars.length === 0) return <LoadingSpinner />;
  if (error) return <ErrorMessage message={error} />;
  if (bars.length === 0) return <div className="bg-[#423d3f] rounded-lg p-6 text-center text-gray-400">No underlying timeseries data available</div>;

  const width = 1100;
  const height = 460;
  const pad = 50;
  const priceHeight = 300;
  const volTop = 340;
  const volHeight = 90;
  const minPrice = Math.min(...bars.map((b) => b.low));
  const maxPrice = Math.max(...bars.map((b) => b.high));
  const maxVol = Math.max(...bars.map((b) => b.volume));
  const xStep = (width - pad * 2) / Math.max(1, bars.length - 1);

  const yPrice = (p: number) => pad + (1 - (p - minPrice) / Math.max(1e-9, maxPrice - minPrice)) * (priceHeight - pad);
  const yVol = (v: number) => volTop + (1 - v / Math.max(1, maxVol)) * volHeight;

  return (
    <div className="bg-[#423d3f] rounded-lg p-6 mb-8">
      <div className="flex items-center gap-2 mb-4">
        <h2 className="text-2xl font-semibold">Underlying Candlestick + Volume</h2>
        <TooltipWrapper text="Candlesticks visualize OHLC over time from /api/price/timeseries: body shows open-to-close, wick shows high-to-low. Volume bars below use the same x-axis timestamps and are colored by candle direction (green up, red down). Together they help identify trend strength, reversals, and participation." ><Info size={14} /></TooltipWrapper>
      </div>
      <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
        {bars.map((b, i) => {
          const x = pad + i * xStep;
          const up = b.close >= b.open;
          const c = up ? colors.bullish : colors.bearish;
          const openY = yPrice(b.open);
          const closeY = yPrice(b.close);
          const highY = yPrice(b.high);
          const lowY = yPrice(b.low);
          const bodyY = Math.min(openY, closeY);
          const bodyH = Math.max(2, Math.abs(openY - closeY));
          return (
            <g key={b.timestamp}>
              <line x1={x} x2={x} y1={highY} y2={lowY} stroke={c} strokeWidth={1} />
              <rect x={x - 2} y={bodyY} width={4} height={bodyH} fill={c} />
              <rect x={x - 2} y={yVol(b.volume)} width={4} height={volTop + volHeight - yVol(b.volume)} fill={c} opacity={0.7} />
              {i % Math.ceil(bars.length / 8) === 0 && <text x={x} y={452} fontSize="10" textAnchor="middle" fill={theme === 'dark' ? colors.light : colors.dark}>{new Date(b.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}</text>}
            </g>
          );
        })}
        <line x1={pad} x2={width - pad} y1={volTop + volHeight} y2={volTop + volHeight} stroke={colors.muted} />
      </svg>
    </div>
  );
}
