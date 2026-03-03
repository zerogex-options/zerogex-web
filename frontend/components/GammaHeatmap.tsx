'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Info } from 'lucide-react';
import { useApiData } from '@/hooks/useApiData';
import { useTheme } from '@/core/ThemeContext';
import { useTimeframe } from '@/core/TimeframeContext';
import { colors } from '@/core/colors';
import LoadingSpinner from './LoadingSpinner';
import ErrorMessage from './ErrorMessage';
import TooltipWrapper from './TooltipWrapper';
import ExpandableCard from './ExpandableCard';

interface GammaDataPoint {
  timestamp: string;
  strike: number;
  net_gex: number;
}

interface PriceDataPoint {
  timestamp: string;
  close: number;
}

export default function GammaHeatmap() {
  const { theme } = useTheme();
  const { getIntervalMinutes, getMaxDataPoints, timeframe, symbol } = useTimeframe();
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(1200);

  const intervalMinutes = getIntervalMinutes();
  const maxPoints = getMaxDataPoints();

  const { data: gexData, loading, error } = useApiData<GammaDataPoint[]>(
    `/api/gex/heatmap?symbol=${symbol}&timeframe=${timeframe}&interval_minutes=${intervalMinutes}`,
    { refreshInterval: 5000 }
  );

  const { data: priceData } = useApiData<PriceDataPoint[]>(
    `/api/market/historical?symbol=${symbol}&timeframe=${timeframe}&limit=${Math.max(maxPoints * 2, 120)}`,
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
      strikes.map((strike) => ({ x, y: strike, value: map.get(`${ts}_${strike}`) ?? 0, timestamp: ts }))
    );

    return { cells, strikes, timestamps: sortedTimestamps };
  }, [gexData, maxPoints]);

  if (loading && derived.cells.length === 0) return <LoadingSpinner size="lg" />;
  if (error) return <ErrorMessage message={error} />;
  if (derived.cells.length === 0) {
    return <div className="rounded-lg p-8 text-center" style={{ backgroundColor: theme === 'dark' ? colors.cardDark : colors.cardLight, border: `1px solid ${colors.muted}` }}><p style={{ color: colors.muted }}>No heatmap data available</p></div>;
  }

  const values = derived.cells.map((d) => d.value);
  const absMax = Math.max(1, ...values.map((v) => Math.abs(v)));
  const getColor = (value: number) => {
    const intensity = Math.pow(Math.abs(value / absMax), 0.55);
    const opacity = 0.22 + 0.78 * intensity;
    return value >= 0 ? `rgba(16,185,129,${opacity})` : `rgba(244,88,84,${opacity})`;
  };

  const yAxisWidth = 80;
  const availableWidth = containerWidth - yAxisWidth - 40;
  const cellWidth = Math.max(18, Math.floor(availableWidth / Math.max(1, derived.timestamps.length)));
  const cellHeight = 28;
  const chartWidth = Math.max(600, derived.timestamps.length * cellWidth + yAxisWidth + 40);
  const chartHeight = Math.max(240, derived.strikes.length * cellHeight + 80);

  const priceByTs = new Map((priceData || []).map((p) => [p.timestamp, Number(p.close)]));

  return (
    <ExpandableCard>
      <div ref={containerRef} className="rounded-lg p-6" style={{ backgroundColor: theme === 'dark' ? colors.cardDark : colors.cardLight, border: `1px solid ${colors.muted}` }}>
        <div className="flex items-center gap-2 mb-4">
          <h3 className="text-xl font-bold" style={{ color: theme === 'dark' ? colors.light : colors.dark }}>Gamma Exposure Heatmap</h3>
          <TooltipWrapper text="Heatmap from /api/gex/heatmap for selected symbol/timeframe. Overlay line uses /api/market/historical closes."><Info size={14} /></TooltipWrapper>
        </div>

        <svg width="100%" height={chartHeight} viewBox={`0 0 ${chartWidth} ${chartHeight}`} preserveAspectRatio="xMidYMid meet">
          {derived.strikes.map((strike, idx) => (
            <text key={`y-${strike}`} x={70} y={idx * cellHeight + cellHeight / 2 + 40} textAnchor="end" dominantBaseline="middle" style={{ fontSize: '11px', fill: theme === 'dark' ? colors.light : colors.dark, fontFamily: 'monospace' }}>${strike.toFixed(0)}</text>
          ))}

          {derived.cells.map((cell, idx) => {
            const xPos = cell.x * cellWidth + 80;
            const yPos = derived.strikes.indexOf(cell.y) * cellHeight + 40;
            return <rect key={idx} x={xPos} y={yPos} width={cellWidth} height={cellHeight} fill={getColor(cell.value)} />;
          })}

          {(() => {
            if (derived.strikes.length === 0) return null;
            const minStrike = Math.min(...derived.strikes);
            const maxStrike = Math.max(...derived.strikes);
            const points = derived.timestamps
              .map((ts, idx) => {
                const p = priceByTs.get(ts);
                if (!p) return null;
                const x = idx * cellWidth + 80 + cellWidth / 2;
                const y = 40 + (derived.strikes.length * cellHeight) * (1 - (p - minStrike) / Math.max(1e-9, maxStrike - minStrike));
                return { x, y, p };
              })
              .filter(Boolean) as { x: number; y: number; p: number }[];

            if (points.length < 2) return null;
            const pathData = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
            return <path d={pathData} fill="none" stroke={colors.primary} strokeWidth={2.5} />;
          })()}

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
