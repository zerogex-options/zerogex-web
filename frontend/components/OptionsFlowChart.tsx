'use client';

import { useEffect, useMemo, useState } from 'react';
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

export default function OptionsFlowChart() {
  const { theme } = useTheme();
  const { getWindowMinutes, getMaxDataPoints, symbol } = useTimeframe();
  const windowMinutes = getWindowMinutes();
  const maxPoints = getMaxDataPoints();
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);

  const { data: flowData, loading, error } = useOptionFlow(symbol, windowMinutes, 5000);

  useEffect(() => {
    if (!flowData || flowData.length === 0) return;

    const callRow = flowData.find((r) => r.option_type === 'CALL');
    const putRow = flowData.find((r) => r.option_type === 'PUT');
    const timestamp = (callRow?.time_window_end || putRow?.time_window_end || new Date().toISOString()) as string;

    const point: ChartDataPoint = {
      timestamp,
      time: new Date(timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
      calls: ((callRow?.total_premium as number) || 0) / 1_000_000,
      puts: ((putRow?.total_premium as number) || 0) / 1_000_000,
    };

    setChartData((prev) => {
      const merged = [...prev, point]
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
        .filter((row, idx, arr) => idx === 0 || row.timestamp !== arr[idx - 1].timestamp)
        .slice(-maxPoints);
      return merged;
    });
  }, [flowData, maxPoints]);

  const totals = useMemo(() => {
    return chartData.reduce(
      (acc, row) => ({ calls: acc.calls + row.calls, puts: acc.puts + row.puts }),
      { calls: 0, puts: 0 }
    );
  }, [chartData]);

  if (loading && chartData.length === 0) return <LoadingSpinner size="lg" />;
  if (error) return <ErrorMessage message={error} />;

  if (chartData.length === 0) {
    return (
      <div className="rounded-lg p-8 text-center" style={{ backgroundColor: theme === 'dark' ? colors.cardDark : colors.cardLight, border: `1px solid ${colors.muted}` }}>
        <p style={{ color: colors.muted }}>No flow data available</p>
      </div>
    );
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="p-3 rounded-lg shadow-lg" style={{ backgroundColor: theme === 'dark' ? colors.cardDark : colors.cardLight, border: `1px solid ${colors.muted}` }}>
          <p className="font-semibold mb-2" style={{ color: theme === 'dark' ? colors.light : colors.dark }}>{label}</p>
          <p style={{ color: colors.bullish, fontSize: '14px' }}>Calls: ${payload[0].value.toFixed(2)}M</p>
          <p style={{ color: colors.bearish, fontSize: '14px' }}>Puts: ${payload[1].value.toFixed(2)}M</p>
          <p style={{ color: theme === 'dark' ? colors.light : colors.dark, fontSize: '12px', marginTop: '4px' }}>
            Net: ${(payload[0].value - payload[1].value).toFixed(2)}M
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <ExpandableCard>
      <div className="rounded-lg p-6" style={{ backgroundColor: theme === 'dark' ? colors.cardDark : colors.cardLight, border: `1px solid ${colors.muted}` }}>
        <div className="flex items-center gap-2 mb-4">
          <h3 className="text-xl font-bold" style={{ color: theme === 'dark' ? colors.light : colors.dark }}>Options Notional Flow by Type</h3>
          <TooltipWrapper text="Polled from /api/flow/by-type for the selected symbol + window. Tracks call and put notional premium over time in millions."><Info size={14} /></TooltipWrapper>
        </div>

        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={colors.muted} opacity={0.3} />
            <XAxis dataKey="time" stroke={theme === 'dark' ? colors.light : colors.dark} tick={{ fill: theme === 'dark' ? colors.light : colors.dark }} />
            <YAxis stroke={theme === 'dark' ? colors.light : colors.dark} tick={{ fill: theme === 'dark' ? colors.light : colors.dark }} label={{ value: 'Premium ($M)', angle: -90, position: 'insideLeft', style: { fill: theme === 'dark' ? colors.light : colors.dark } }} domain={[0, 'auto']} />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            <Line type="monotone" dataKey="calls" name="Call Premium" stroke={colors.bullish} strokeWidth={3} dot={false} activeDot={{ r: 6 }} />
            <Line type="monotone" dataKey="puts" name="Put Premium" stroke={colors.bearish} strokeWidth={3} dot={false} activeDot={{ r: 6 }} />
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
