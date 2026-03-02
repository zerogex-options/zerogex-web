'use client';

import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useApiData, useGEXSummary } from '@/hooks/useApiData';
import MetricCard from '@/components/MetricCard';
import LoadingSpinner from '@/components/LoadingSpinner';
import ErrorMessage from '@/components/ErrorMessage';

export default function MaxPainPage() {
  const { data: gexSummary } = useGEXSummary(5000);
  const { data: oiByStrike, loading: oiLoading, error: oiError } = useApiData<any[]>('/api/max-pain/by-strike?limit=40', { refreshInterval: 30000 });
  const { data: maxPainSeries, loading: seriesLoading, error: seriesError } = useApiData<any[]>('/api/max-pain/timeseries?window_minutes=390&interval_minutes=5', { refreshInterval: 10000 });

  if ((oiLoading || seriesLoading) && !oiByStrike && !maxPainSeries) {
    return <LoadingSpinner size="lg" />;
  }

  const oiChart = (oiByStrike || []).map((row) => ({
    strike: row.strike,
    notionalOiM: (row.notional_oi ?? row.total_notional_oi ?? 0) / 1000000,
  }));

  const seriesChart = (maxPainSeries || []).map((row) => ({
    time: new Date(row.timestamp ?? row.time ?? row.time_et).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
    maxPain: row.max_pain,
    price: row.price ?? row.underlying_price,
  }));

  const latest = seriesChart[seriesChart.length - 1];

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Max Pain</h1>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">Max Pain Snapshot</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <MetricCard title="Current Max Pain" value={gexSummary?.max_pain ? `$${gexSummary.max_pain.toFixed(2)}` : '--'} theme="dark" />
          <MetricCard title="Last Series Max Pain" value={latest?.maxPain ? `$${latest.maxPain.toFixed(2)}` : '--'} theme="dark" />
          <MetricCard title="Underlying Price" value={latest?.price ? `$${latest.price.toFixed(2)}` : '--'} trend={latest && latest.price > latest.maxPain ? 'bullish' : 'bearish'} theme="dark" />
        </div>
      </section>

      <section className="mb-8 bg-[#423d3f] rounded-lg p-6">
        <h2 className="text-2xl font-semibold mb-4">Notional Open Interest by Strike</h2>
        {oiError ? <ErrorMessage message={oiError} /> : oiChart.length === 0 ? <div className="text-gray-400 text-center py-8">No max pain OI data available</div> : (
          <ResponsiveContainer width="100%" height={360}>
            <BarChart data={oiChart}>
              <CartesianGrid strokeDasharray="3 3" stroke="#968f92" opacity={0.3} />
              <XAxis dataKey="strike" stroke="#f2f2f2" tickFormatter={(value) => `$${Number(value).toFixed(0)}`} />
              <YAxis stroke="#f2f2f2" tickFormatter={(value) => `${Number(value).toFixed(0)}M`} />
              <Tooltip formatter={(value: number) => `$${value.toFixed(2)}M`} />
              <Bar dataKey="notionalOiM" fill="#10b981" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </section>

      <section className="mb-8 bg-[#423d3f] rounded-lg p-6">
        <h2 className="text-2xl font-semibold mb-4">Max Pain vs Underlying Price</h2>
        {seriesError ? <ErrorMessage message={seriesError} /> : seriesChart.length === 0 ? <div className="text-gray-400 text-center py-8">No max pain timeseries data available</div> : (
          <ResponsiveContainer width="100%" height={360}>
            <LineChart data={seriesChart}>
              <CartesianGrid strokeDasharray="3 3" stroke="#968f92" opacity={0.3} />
              <XAxis dataKey="time" stroke="#f2f2f2" />
              <YAxis stroke="#f2f2f2" />
              <Tooltip />
              <Legend />
              <Line dataKey="maxPain" name="Max Pain" stroke="#f59e0b" strokeWidth={2} dot={false} />
              <Line dataKey="price" name="Underlying Price" stroke="#60a5fa" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </section>
    </div>
  );
}
