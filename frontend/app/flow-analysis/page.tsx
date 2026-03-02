'use client';

import { Info } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useOptionFlow, useSmartMoneyFlow, useApiData } from '@/hooks/useApiData';
import LoadingSpinner from '@/components/LoadingSpinner';
import ErrorMessage from '@/components/ErrorMessage';
import MetricCard from '@/components/MetricCard';
import OptionsFlowChart from '@/components/OptionsFlowChart';
import TooltipWrapper from '@/components/TooltipWrapper';
import { omitClosedMarketTimes } from '@/core/utils';

interface FlowByStrikeRow {
  strike: number;
  total_volume: number;
  total_premium: number;
}

function SectionTitle({ title, tooltip }: { title: string; tooltip: string }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <h2 className="text-2xl font-semibold">{title}</h2>
      <TooltipWrapper text={tooltip}><Info size={14} /></TooltipWrapper>
    </div>
  );
}

export default function FlowAnalysisPage() {
  const { data: flowData, loading: flowLoading, error: flowError } = useOptionFlow(60, 5000);
  const { data: smartMoney, loading: smartLoading, error: smartError } = useSmartMoneyFlow(20, 10000);
  const { data: flowByStrike, error: strikeError } = useApiData<FlowByStrikeRow[]>('/api/flow/by-strike?limit=25', { refreshInterval: 5000 });

  if (flowLoading && !flowData) return <LoadingSpinner size="lg" />;

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

  const smartMoneyChart = omitClosedMarketTimes((smartMoney || []).map((row) => ({
    time: new Date(row.time_window_end).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
    timestamp: row.time_window_end,
    score: row.unusual_activity_score,
    premiumK: row.total_premium / 1000,
  })), (r) => r.timestamp);

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Flow Analysis</h1>
      {flowError && <ErrorMessage message={flowError} />}

      <section className="mb-8">
        <SectionTitle title="Flow Snapshot" tooltip="Snapshot metrics summarize the current options-flow regime over the selected window. Call/put volume and premium are totals from /api/flow/by-type; net values are calculated as Calls minus Puts. Positive net flow/premium typically suggests call-dominant positioning, while negative values suggest put-dominant positioning." />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <MetricCard title="Call Volume" value={totalCallVolume.toLocaleString()} subtitle={`$${(totalCallPremium / 1000000).toFixed(2)}M premium`} trend="bullish" tooltip="Total call contracts traded in the analysis window. Calculation: sum(total_volume) for CALL records from /api/flow/by-type. Rising call volume often indicates upside participation or hedging demand." theme="dark" />
          <MetricCard title="Put Volume" value={totalPutVolume.toLocaleString()} subtitle={`$${(totalPutPremium / 1000000).toFixed(2)}M premium`} trend="bearish" tooltip="Total put contracts traded in the analysis window. Calculation: sum(total_volume) for PUT records from /api/flow/by-type. Elevated put volume can indicate downside hedging or bearish speculation." theme="dark" />
          <MetricCard title="Net Flow" value={netFlow.toLocaleString()} trend={netFlow > 0 ? 'bullish' : 'bearish'} tooltip="Net contract flow. Calculation: Call Volume - Put Volume. Positive values imply call-led activity; negative values imply put-led activity." theme="dark" />
          <MetricCard title="Net Premium" value={`$${(netPremium / 1000000).toFixed(2)}M`} trend={netPremium > 0 ? 'bullish' : 'bearish'} tooltip="Net premium flow in dollars. Calculation: Call Premium - Put Premium, displayed in millions. Positive values suggest capital flowing into calls; negative values suggest put-premium dominance." theme="dark" />
        </div>
      </section>

      <section className="mb-8 bg-[#423d3f] rounded-lg p-6">
        <SectionTitle title="Flow by Type" tooltip="Compares call vs put totals in both contracts and premium dollars. Bars are generated from /api/flow/by-type. Divergence between volume and premium can indicate larger block trades concentrated on one side." />
        <ResponsiveContainer width="100%" height={320}><BarChart data={byTypeChart}><CartesianGrid strokeDasharray="3 3" stroke="#968f92" opacity={0.3} /><XAxis dataKey="name" stroke="#f2f2f2" /><YAxis stroke="#f2f2f2" /><Tooltip /><Legend /><Bar dataKey="volume" name="Volume" fill="#10b981" /><Bar dataKey="premiumM" name="Premium ($M)" fill="#f45854" /></BarChart></ResponsiveContainer>
      </section>

      <section className="mb-8"><OptionsFlowChart /></section>

      <section className="mb-8 bg-[#423d3f] rounded-lg p-6">
        <SectionTitle title="Flow by Strike" tooltip="Strike-distribution chart for flow concentration. Data from /api/flow/by-strike. Large bars identify strikes where positioning is concentrated, which may become intraday pin or magnet zones." />
        {strikeError ? <ErrorMessage message={strikeError} /> : byStrikeChart.length === 0 ? <div className="text-gray-400 text-center py-8">No flow-by-strike data available</div> : (
          <ResponsiveContainer width="100%" height={340}><BarChart data={byStrikeChart}><CartesianGrid strokeDasharray="3 3" stroke="#968f92" opacity={0.3} /><XAxis dataKey="strike" stroke="#f2f2f2" tickFormatter={(value) => `$${Number(value).toFixed(0)}`} /><YAxis stroke="#f2f2f2" /><Tooltip formatter={(value: number, name: string) => [name === 'premiumM' ? `$${value.toFixed(2)}M` : value.toLocaleString(), name]} /><Legend /><Bar dataKey="volume" name="Volume" fill="#10b981" /><Bar dataKey="premiumM" name="Premium ($M)" fill="#60a5fa" /></BarChart></ResponsiveContainer>
        )}
      </section>

      <section className="mb-8 bg-[#423d3f] rounded-lg p-6">
        <SectionTitle title="Smart Money" tooltip="Timeseries of unusual-activity score and associated premium from /api/flow/smart-money. Score reflects anomaly intensity, while premium size reflects dollar commitment. Spikes in both can indicate institutionally significant prints." />
        {smartError ? <ErrorMessage message={smartError} /> : smartLoading ? <LoadingSpinner /> : smartMoneyChart.length === 0 ? <div className="text-gray-400 text-center py-8">No unusual activity detected</div> : (
          <ResponsiveContainer width="100%" height={320}><LineChart data={smartMoneyChart}><CartesianGrid strokeDasharray="3 3" stroke="#968f92" opacity={0.3} /><XAxis dataKey="time" stroke="#f2f2f2" /><YAxis yAxisId="left" stroke="#f2f2f2" /><YAxis yAxisId="right" orientation="right" stroke="#f2f2f2" /><Tooltip /><Legend /><Line yAxisId="left" dataKey="score" name="Unusual Score" stroke="#f59e0b" strokeWidth={2} dot={false} /><Line yAxisId="right" dataKey="premiumK" name="Premium ($K)" stroke="#a78bfa" strokeWidth={2} dot={false} /></LineChart></ResponsiveContainer>
        )}
      </section>
    </div>
  );
}
