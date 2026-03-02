'use client';

import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useOptionFlow, useSmartMoneyFlow, useApiData } from '@/hooks/useApiData';
import LoadingSpinner from '@/components/LoadingSpinner';
import ErrorMessage from '@/components/ErrorMessage';
import MetricCard from '@/components/MetricCard';
import OptionsFlowChart from '@/components/OptionsFlowChart';

export default function FlowAnalysisPage() {
  const { data: flowData, loading: flowLoading, error: flowError } = useOptionFlow(60, 5000);
  const { data: smartMoney, loading: smartLoading, error: smartError } = useSmartMoneyFlow(20, 10000);
  const { data: flowByStrike, error: strikeError } = useApiData<any[]>('/api/flow/by-strike?limit=25', { refreshInterval: 5000 });

  if (flowLoading && !flowData) {
    return <LoadingSpinner size="lg" />;
  }

  const callFlow = flowData?.find((f) => f.option_type === 'CALL');
  const putFlow = flowData?.find((f) => f.option_type === 'PUT');

  const totalCallVolume = callFlow?.total_volume || 0;
  const totalPutVolume = putFlow?.total_volume || 0;
  const totalCallPremium = callFlow?.total_premium || 0;
  const totalPutPremium = putFlow?.total_premium || 0;

  const netFlow = totalCallVolume - totalPutVolume;
  const netPremium = totalCallPremium - totalPutPremium;

  const byTypeChart = [
    { name: 'Calls', volume: totalCallVolume, premiumM: totalCallPremium / 1000000 },
    { name: 'Puts', volume: totalPutVolume, premiumM: totalPutPremium / 1000000 },
  ];

  const byStrikeChart = (flowByStrike || []).map((row) => ({
    strike: row.strike,
    volume: row.total_volume,
    premiumM: row.total_premium / 1000000,
  }));

  const smartMoneyChart = (smartMoney || []).map((row) => ({
    time: new Date(row.time_window_end).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
    score: row.unusual_activity_score,
    premiumK: row.total_premium / 1000,
    strike: row.strike,
  }));

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Flow Analysis</h1>

      {flowError && <ErrorMessage message={flowError} />}

      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">Flow Snapshot</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <MetricCard title="Call Volume" value={totalCallVolume.toLocaleString()} subtitle={`$${(totalCallPremium / 1000000).toFixed(2)}M premium`} trend="bullish" theme="dark" />
          <MetricCard title="Put Volume" value={totalPutVolume.toLocaleString()} subtitle={`$${(totalPutPremium / 1000000).toFixed(2)}M premium`} trend="bearish" theme="dark" />
          <MetricCard title="Net Flow" value={netFlow.toLocaleString()} trend={netFlow > 0 ? 'bullish' : 'bearish'} theme="dark" />
          <MetricCard title="Net Premium" value={`$${(netPremium / 1000000).toFixed(2)}M`} trend={netPremium > 0 ? 'bullish' : 'bearish'} theme="dark" />
        </div>
      </section>

      <section className="mb-8 bg-[#423d3f] rounded-lg p-6">
        <h2 className="text-2xl font-semibold mb-4">Flow by Type</h2>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={byTypeChart}>
            <CartesianGrid strokeDasharray="3 3" stroke="#968f92" opacity={0.3} />
            <XAxis dataKey="name" stroke="#f2f2f2" />
            <YAxis stroke="#f2f2f2" />
            <Tooltip />
            <Legend />
            <Bar dataKey="volume" name="Volume" fill="#10b981" />
            <Bar dataKey="premiumM" name="Premium ($M)" fill="#f45854" />
          </BarChart>
        </ResponsiveContainer>
      </section>

      <section className="mb-8">
        <OptionsFlowChart />
      </section>

      <section className="mb-8 bg-[#423d3f] rounded-lg p-6">
        <h2 className="text-2xl font-semibold mb-4">Flow by Strike</h2>
        {strikeError ? (
          <ErrorMessage message={strikeError} />
        ) : byStrikeChart.length === 0 ? (
          <div className="text-gray-400 text-center py-8">No flow-by-strike data available</div>
        ) : (
          <ResponsiveContainer width="100%" height={340}>
            <BarChart data={byStrikeChart}>
              <CartesianGrid strokeDasharray="3 3" stroke="#968f92" opacity={0.3} />
              <XAxis dataKey="strike" stroke="#f2f2f2" tickFormatter={(value) => `$${Number(value).toFixed(0)}`} />
              <YAxis stroke="#f2f2f2" />
              <Tooltip formatter={(value: number, name: string) => [name === 'premiumM' ? `$${value.toFixed(2)}M` : value.toLocaleString(), name]} />
              <Legend />
              <Bar dataKey="volume" name="Volume" fill="#10b981" />
              <Bar dataKey="premiumM" name="Premium ($M)" fill="#60a5fa" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </section>

      <section className="mb-8 bg-[#423d3f] rounded-lg p-6">
        <h2 className="text-2xl font-semibold mb-4">Smart Money</h2>
        {smartError ? (
          <ErrorMessage message={smartError} />
        ) : smartLoading ? (
          <LoadingSpinner />
        ) : smartMoneyChart.length === 0 ? (
          <div className="text-gray-400 text-center py-8">No unusual activity detected</div>
        ) : (
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={smartMoneyChart}>
              <CartesianGrid strokeDasharray="3 3" stroke="#968f92" opacity={0.3} />
              <XAxis dataKey="time" stroke="#f2f2f2" />
              <YAxis yAxisId="left" stroke="#f2f2f2" />
              <YAxis yAxisId="right" orientation="right" stroke="#f2f2f2" />
              <Tooltip />
              <Legend />
              <Line yAxisId="left" dataKey="score" name="Unusual Score" stroke="#f59e0b" strokeWidth={2} dot={false} />
              <Line yAxisId="right" dataKey="premiumK" name="Premium ($K)" stroke="#a78bfa" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </section>
    </div>
  );
}
