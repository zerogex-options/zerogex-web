'use client';

import { useEffect, useMemo } from 'react';
import { Info } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useOptionFlow } from '@/hooks/useApiData';
import { useTheme } from '@/core/ThemeContext';
import { useTimeframe } from '@/core/TimeframeContext';
import { colors } from '@/core/colors';
import LoadingSpinner from './LoadingSpinner';
import ErrorMessage from './ErrorMessage';
import TooltipWrapper from './TooltipWrapper';
import ExpandableCard from './ExpandableCard';

interface ChartDataPoint {
  timestamp: string;
  time: string;
  calls: number;
  puts: number;
}

function mergeSeries(prev: ChartDataPoint[], point: ChartDataPoint, maxPoints: number) {
  const existingIdx = prev.findIndex((p) => p.timestamp === point.timestamp);
  const next = [...prev];
  if (existingIdx >= 0) {
    next[existingIdx] = point; // update most recent bucket only
  } else {
    next.push(point);
  }
  return next
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    .slice(-maxPoints);
}

export default function OptionsFlowChart() {
  const { theme } = useTheme();
  const { timeframe, getWindowMinutes, getMaxDataPoints, symbol } = useTimeframe();
  const intervalMinutes = timeframe === "1day" ? 1440 : timeframe === "1hr" ? 60 : Number(timeframe.replace("min", ""));
  const windowUnits = Math.max(1, Math.min(90, Math.round(getWindowMinutes() / Math.max(1, intervalMinutes))));
  const maxPoints = getMaxDataPoints();
  const cacheKey = `zerogex:options-flow:${symbol}:${timeframe}:${windowUnits}`;

  const { data: flowData, loading, error } = useOptionFlow(symbol, timeframe, windowUnits, 5000);

  const chartData = useMemo(() => {
    const cachedRows: ChartDataPoint[] = [];

    if (typeof window !== "undefined") {
      try {
        const cached = localStorage.getItem(cacheKey);
        if (cached) cachedRows.push(...(JSON.parse(cached) as ChartDataPoint[]));
      } catch {
        // Ignore parse failures
      }
    }

    if (!flowData || flowData.length === 0) {
      return cachedRows.slice(-maxPoints);
    }

    const callRow = flowData.find((r) => r.option_type === 'CALL');
    const putRow = flowData.find((r) => r.option_type === 'PUT');
    const timestamp = (callRow?.time_window_end || putRow?.time_window_end || new Date().toISOString()) as string;

    const point: ChartDataPoint = {
      timestamp,
      time: new Date(timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
      calls: Number(callRow?.total_premium || 0) / 1_000_000,
      puts: Number(putRow?.total_premium || 0) / 1_000_000,
    };

    return mergeSeries(cachedRows, point, maxPoints);
  }, [cacheKey, flowData, maxPoints]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(cacheKey, JSON.stringify(chartData));
    } catch {
      // Ignore storage failures
    }
  }, [cacheKey, chartData]);

  const totals = useMemo(() => chartData.reduce((acc, row) => ({ calls: acc.calls + row.calls, puts: acc.puts + row.puts }), { calls: 0, puts: 0 }), [chartData]);

  if (loading && chartData.length === 0) return <LoadingSpinner size="lg" />;
  if (error && chartData.length === 0) return <ErrorMessage message={error} />;

  if (chartData.length === 0) {
    return <div className="rounded-lg p-8 text-center" style={{ backgroundColor: theme === 'dark' ? colors.cardDark : colors.cardLight, border: `1px solid ${colors.muted}` }}><p style={{ color: colors.muted }}>No flow data available</p></div>;
  }

  return (
    <ExpandableCard>
      <div className="rounded-lg p-6" style={{ backgroundColor: theme === 'dark' ? colors.cardDark : colors.cardLight, border: `1px solid ${colors.muted}` }}>
        <div className="flex items-center gap-2 mb-4">
          <h3 className="text-xl font-bold" style={{ color: theme === 'dark' ? colors.light : colors.dark }}>Options Notional Flow by Type</h3>
          <TooltipWrapper text="Polled from /api/flow/by-type. Historical points are cached client-side; only the current bucket is updated."><Info size={14} /></TooltipWrapper>
        </div>

        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={colors.muted} opacity={0.3} />
            <XAxis dataKey="time" stroke={theme === 'dark' ? colors.light : colors.dark} tick={{ fill: theme === 'dark' ? colors.light : colors.dark }} />
            <YAxis stroke={theme === 'dark' ? colors.light : colors.dark} tick={{ fill: theme === 'dark' ? colors.light : colors.dark }} label={{ value: 'Premium ($M)', angle: -90, position: 'insideLeft', style: { fill: theme === 'dark' ? colors.light : colors.dark } }} domain={['auto', 'auto']} />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="calls" name="Call Premium" stroke={colors.bullish} strokeWidth={3} dot={false} />
            <Line type="monotone" dataKey="puts" name="Put Premium" stroke={colors.bearish} strokeWidth={3} dot={false} />
          </LineChart>
        </ResponsiveContainer>

        <div className="grid grid-cols-3 gap-4 mt-6">
          <div className="text-center"><div style={{ color: colors.muted, fontSize: '12px' }}>Total Call Premium</div><div style={{ color: colors.bullish, fontSize: '20px', fontWeight: 'bold' }}>${totals.calls.toFixed(2)}M</div></div>
          <div className="text-center"><div style={{ color: colors.muted, fontSize: '12px' }}>Total Put Premium</div><div style={{ color: colors.bearish, fontSize: '20px', fontWeight: 'bold' }}>${totals.puts.toFixed(2)}M</div></div>
          <div className="text-center"><div style={{ color: colors.muted, fontSize: '12px' }}>Net Flow</div><div style={{ color: totals.calls - totals.puts > 0 ? colors.bullish : colors.bearish, fontSize: '20px', fontWeight: 'bold' }}>${(totals.calls - totals.puts).toFixed(2)}M</div></div>
        </div>
      </div>
    </ExpandableCard>
  );
}
