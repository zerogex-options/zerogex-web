'use client';

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
import { useMemo } from 'react';
import { omitClosedMarketTimes } from '@/core/utils';
import { useIsMobile } from '@/hooks/useIsMobile';

function toTime(ts: string) {
  return new Date(ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/New_York' });
}

export default function OptionsFlowChart() {
  const { theme } = useTheme();
  const { getMaxDataPoints, symbol } = useTimeframe();
  const isMobile = useIsMobile();
  const maxPoints = getMaxDataPoints();

  // Fetch the current trading session.
  const { data: flowData, loading, error } = useOptionFlow(symbol, 'current', 5000);

  const chartData = useMemo(() => {
    const rows = (flowData || [])
      .map((row) => ({
        timestamp: row.timestamp,
        time: toTime(row.timestamp),
        calls: Number(row.call_premium || 0) / 1_000_000,
        puts: Number(row.put_premium || 0) / 1_000_000,
      }))
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    return omitClosedMarketTimes(rows, (row) => row.timestamp).slice(-maxPoints);
  }, [flowData, maxPoints]);

  const totals = useMemo(() => chartData.reduce((acc, row) => ({ calls: acc.calls + row.calls, puts: acc.puts + row.puts }), { calls: 0, puts: 0 }), [chartData]);

  if (loading && chartData.length === 0) return <LoadingSpinner size="lg" />;
  if (error && chartData.length === 0) return <ErrorMessage message={error} />;

  if (chartData.length === 0) {
    return <div className="rounded-lg p-8 text-center" style={{ backgroundColor: theme === 'dark' ? colors.cardDark : colors.cardLight, border: `1px solid ${colors.muted}` }}><p style={{ color: colors.muted }}>No flow data available</p></div>;
  }

  return (
    <ExpandableCard expandTrigger="button" expandButtonLabel="Expand chart">
      <div className="rounded-lg p-6" style={{ backgroundColor: theme === 'dark' ? colors.cardDark : colors.cardLight, border: `1px solid ${colors.muted}` }}>
        <div className="flex items-center gap-2 mb-4">
          <h3 className="text-xl font-bold" style={{ color: theme === 'dark' ? colors.light : colors.dark }}>Options Notional Flow by Type</h3>
          <TooltipWrapper text="Polled from /api/flow/by-type across the selected timeframe and 90 units window."><Info size={14} /></TooltipWrapper>
        </div>

        <div className="overflow-x-auto">
          <div className={isMobile ? 'min-w-[620px]' : 'min-w-0'}>
            <ResponsiveContainer width="100%" height={400}>
          <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={colors.muted} opacity={0.3} />
            <XAxis dataKey="time" stroke={theme === 'dark' ? colors.light : colors.dark} tick={{ fill: theme === 'dark' ? colors.light : colors.dark, fontSize: isMobile ? 9 : 12 }} minTickGap={isMobile ? 50 : 20} angle={isMobile ? -45 : 0} textAnchor={isMobile ? 'end' : 'middle'} height={isMobile ? 50 : 30} />
            <YAxis stroke={theme === 'dark' ? colors.light : colors.dark} tick={{ fill: theme === 'dark' ? colors.light : colors.dark }} label={{ value: 'Premium ($M)', angle: -90, position: 'insideLeft', style: { fill: theme === 'dark' ? colors.light : colors.dark } }} domain={['auto', 'auto']} />
            <Tooltip
              contentStyle={{
                backgroundColor: 'var(--color-chart-tooltip-bg)',
                borderColor: 'var(--color-border)',
                borderRadius: 8,
                color: 'var(--color-chart-tooltip-text)',
              }}
              labelStyle={{ color: 'var(--color-chart-tooltip-text)' }}
              itemStyle={{ color: 'var(--color-chart-tooltip-muted)' }}
            />
            <Legend />
            <Line type="monotone" dataKey="calls" name="Call Premium" stroke={colors.bullish} strokeWidth={3} dot={false} />
            <Line type="monotone" dataKey="puts" name="Put Premium" stroke={colors.bearish} strokeWidth={3} dot={false} />
          </LineChart>
        </ResponsiveContainer>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 mt-6">
          <div className="text-center"><div style={{ color: colors.muted, fontSize: '12px' }}>Total Call Premium</div><div style={{ color: colors.bullish, fontSize: '20px', fontWeight: 'bold' }}>${totals.calls.toFixed(2)}M</div></div>
          <div className="text-center"><div style={{ color: colors.muted, fontSize: '12px' }}>Total Put Premium</div><div style={{ color: colors.bearish, fontSize: '20px', fontWeight: 'bold' }}>${totals.puts.toFixed(2)}M</div></div>
          <div className="text-center"><div style={{ color: colors.muted, fontSize: '12px' }}>Net Premium</div><div style={{ color: totals.calls - totals.puts >= 0 ? colors.bullish : colors.bearish, fontSize: '20px', fontWeight: 'bold' }}>${(totals.calls - totals.puts).toFixed(2)}M</div></div>
        </div>
      </div>
    </ExpandableCard>
  );
}
