'use client';

import { Info } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useOptionFlow, useSmartMoneyFlow, useApiData } from '@/hooks/useApiData';
import LoadingSpinner from '@/components/LoadingSpinner';
import ErrorMessage from '@/components/ErrorMessage';
import MetricCard from '@/components/MetricCard';
import OptionsFlowChart from '@/components/OptionsFlowChart';
import TooltipWrapper from '@/components/TooltipWrapper';
import { omitClosedMarketTimes } from '@/core/utils';
import { useTimeframe } from '@/core/TimeframeContext';

interface FlowByStrikeRow {
  strike: number;
  total_volume: number;
  total_premium: number;
}

function safeTimeLabel(value?: string) {
  if (!value) return '--:--';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '--:--';
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function SectionTitle({ title, tooltip }: { title: string; tooltip: string }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <h2 className="text-2xl font-semibold">{title}</h2>
      <TooltipWrapper text={tooltip}>
        <Info size={14} />
      </TooltipWrapper>
    </div>
  );
}

export default function FlowAnalysisPage() {
  const { getWindowMinutes, symbol } = useTimeframe();
  const windowMinutes = getWindowMinutes();

  const { data: flowData, loading: flowLoading, error: flowError } = useOptionFlow(symbol, windowMinutes, 5000);
  const { data: smartMoney, loading: smartLoading, error: smartError } = useSmartMoneyFlow(symbol, 20, windowMinutes, 10000);
  const { data: flowByStrike, error: strikeError } = useApiData<FlowByStrikeRow[]>(`/api/flow/by-strike?symbol=${symbol}&window_minutes=${windowMinutes}&limit=25`, {
    refreshInterval: 5000,
  });

  const callFlow = flowData?.find((f) => f.option_type === 'CALL');
  const putFlow = flowData?.find((f) => f.option_type === 'PUT');

  const totalCallVolume = Number(callFlow?.total_volume || 0);
  const totalPutVolume = Number(putFlow?.total_volume || 0);
  const totalCallPremium = Number(callFlow?.total_premium || 0);
  const totalPutPremium = Number(putFlow?.total_premium || 0);
  const netFlow = totalCallVolume - totalPutVolume;
  const netPremium = totalCallPremium - totalPutPremium;
  const putCallRatio = totalCallVolume > 0 ? totalPutVolume / totalCallVolume : 0;

  const [putCallRatioSeries, setPutCallRatioSeries] = useState<Array<{ timestamp: string; time: string; ratio: number }>>([]);

  useEffect(() => {
    if (!flowData || flowData.length === 0) return;
    const timestamp = new Date().toISOString();
    setPutCallRatioSeries((prev) =>
      [...prev, {
        timestamp,
        time: safeTimeLabel(timestamp),
        ratio: Number.isFinite(putCallRatio) ? putCallRatio : 0,
      }].slice(-96)
    );
  }, [flowData, putCallRatio]);

  const byStrikeChart = useMemo(() => (flowByStrike || []).map((row) => ({
    strike: Number(row.strike),
    volume: Number(row.total_volume || 0),
    premiumM: Number(row.total_premium || 0) / 1_000_000,
  })), [flowByStrike]);

  const smartMoneyChart = useMemo(() => omitClosedMarketTimes(
    (smartMoney || []).map((row) => ({
      time: safeTimeLabel(row.time_window_end),
      timestamp: row.time_window_end,
      score: Number(row.unusual_activity_score || 0),
      premiumK: Number(row.total_premium || 0) / 1000,
    })),
    (r) => r.timestamp
  ), [smartMoney]);

  if (flowLoading && !flowData) return <LoadingSpinner size="lg" />;

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Flow Analysis</h1>
      {flowError && <ErrorMessage message={flowError} />}

      <section className="mb-8">
        <SectionTitle
          title="Flow Snapshot"
          tooltip="Snapshot metrics summarize options-flow over the currently selected interval/window. Net values are call minus put totals, and put/call ratio is put volume divided by call volume."
        />
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <MetricCard title="Call Volume" value={totalCallVolume.toLocaleString()} subtitle={`$${(totalCallPremium / 1_000_000).toFixed(2)}M premium`} trend="bullish" tooltip="Total call contracts traded in-window (from /api/flow/by-type)." theme="dark" />
          <MetricCard title="Put Volume" value={totalPutVolume.toLocaleString()} subtitle={`$${(totalPutPremium / 1_000_000).toFixed(2)}M premium`} trend="bearish" tooltip="Total put contracts traded in-window (from /api/flow/by-type)." theme="dark" />
          <MetricCard title="Net Flow" value={netFlow.toLocaleString()} trend={netFlow > 0 ? 'bullish' : 'bearish'} tooltip="Call volume minus put volume." theme="dark" />
          <MetricCard title="Net Premium" value={`$${(netPremium / 1_000_000).toFixed(2)}M`} trend={netPremium > 0 ? 'bullish' : 'bearish'} tooltip="Call premium minus put premium in dollars." theme="dark" />
          <MetricCard title="Put/Call Ratio" value={putCallRatio.toFixed(2)} trend={putCallRatio > 1 ? 'bearish' : 'bullish'} tooltip="Live put-to-call ratio for selected interval. Calculation: put volume / call volume." theme="dark" />
        </div>
      </section>

      <section className="mb-8 bg-[#423d3f] rounded-lg p-6">
        <SectionTitle
          title="Put/Call Ratio Timeseries"
          tooltip="Shows how the put/call notional ratio evolves through the window. Values above 1 indicate put notional dominating call notional."
        />
        {putCallRatioSeries.length === 0 ? <div className="text-gray-400 text-center py-8">No put/call ratio timeseries available</div> : (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={putCallRatioSeries}>
              <CartesianGrid strokeDasharray="3 3" stroke="#968f92" opacity={0.3} />
              <XAxis dataKey="time" stroke="#f2f2f2" />
              <YAxis stroke="#f2f2f2" />
              <Tooltip formatter={(value) => { const n = typeof value === 'number' ? value : Number(value ?? 0); return n.toFixed(2); }} />
              <Legend />
              <Line dataKey="ratio" name="Put/Call Ratio" stroke="#f59e0b" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </section>

      <section className="mb-8">
        <OptionsFlowChart />
      </section>

      <section className="mb-8 bg-[#423d3f] rounded-lg p-6">
        <SectionTitle title="Flow by Strike" tooltip="Strike-distribution for flow concentration. Helps identify levels with heavy options positioning." />
        {strikeError ? <ErrorMessage message={strikeError} /> : byStrikeChart.length === 0 ? <div className="text-gray-400 text-center py-8">No flow-by-strike data available</div> : (
          <ResponsiveContainer width="100%" height={340}>
            <BarChart data={byStrikeChart}>
              <CartesianGrid strokeDasharray="3 3" stroke="#968f92" opacity={0.3} />
              <XAxis dataKey="strike" stroke="#f2f2f2" tickFormatter={(value) => `$${Number(value).toFixed(0)}`} />
              <YAxis stroke="#f2f2f2" />
              <Tooltip formatter={(value, name) => { const numeric = typeof value === 'number' ? value : Number(value ?? 0); return [name === 'premiumM' ? `$${numeric.toFixed(2)}M` : numeric.toLocaleString(), String(name)]; }} />
              <Legend />
              <Bar dataKey="volume" name="Volume" fill="#10b981" />
              <Bar dataKey="premiumM" name="Premium ($M)" fill="#60a5fa" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </section>

      <section className="mb-8 bg-[#423d3f] rounded-lg p-6">
        <SectionTitle title="Smart Money" tooltip="Unusual flow score and premium size over time from /api/flow/smart-money." />
        {smartError ? <ErrorMessage message={smartError} /> : smartLoading ? <LoadingSpinner /> : smartMoneyChart.length === 0 ? <div className="text-gray-400 text-center py-8">No unusual activity detected</div> : (
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
