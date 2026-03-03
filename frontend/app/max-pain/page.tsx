'use client';

import { Info } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useApiData, useGEXSummary } from '@/hooks/useApiData';
import MetricCard from '@/components/MetricCard';
import LoadingSpinner from '@/components/LoadingSpinner';
import ErrorMessage from '@/components/ErrorMessage';
import TooltipWrapper from '@/components/TooltipWrapper';
import { useTimeframe } from '@/core/TimeframeContext';
import { omitClosedMarketTimes } from '@/core/utils';

interface MaxPainStrikeRow { settlement_price: number; total_notional: number }
interface MaxPainCurrentResponse { timestamp: string; symbol: string; max_pain: number; strikes: MaxPainStrikeRow[] }
interface MaxPainTimeRow { timestamp?: string; time?: string; time_et?: string; max_pain: number; price?: number; underlying_price?: number }

function SectionTitle({ title, tooltip }: { title: string; tooltip: string }) {
  return <div className="flex items-center gap-2 mb-4"><h2 className="text-2xl font-semibold">{title}</h2><TooltipWrapper text={tooltip}><Info size={14} /></TooltipWrapper></div>;
}

export default function MaxPainPage() {
  const { symbol, timeframe, getMaxDataPoints } = useTimeframe();
  const { data: gexSummary } = useGEXSummary(symbol, 5000);
  const { data: maxPainCurrent, loading: oiLoading, error: oiError } = useApiData<MaxPainCurrentResponse>(`/api/max-pain/current?symbol=${symbol}&strike_limit=200`, { refreshInterval: 30000 });
  const { data: maxPainSeries, loading: seriesLoading, error: seriesError } = useApiData<MaxPainTimeRow[]>(`/api/max-pain/timeseries?symbol=${symbol}&timeframe=${timeframe}&limit=${getMaxDataPoints()}`, { refreshInterval: 10000 });

  if ((oiLoading || seriesLoading) && !maxPainCurrent && !maxPainSeries) return <LoadingSpinner size="lg" />;

  const oiChart = (maxPainCurrent?.strikes || []).map((row) => ({ strike: row.settlement_price, notionalOiM: row.total_notional / 1000000 }));
  const rawSeries = (maxPainSeries || []).map((row) => ({
    timestamp: row.timestamp ?? row.time ?? row.time_et ?? '',
    time: new Date(row.timestamp ?? row.time ?? row.time_et ?? '').toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
    maxPain: row.max_pain,
    price: row.price ?? row.underlying_price,
  }));
  const seriesChart = omitClosedMarketTimes(rawSeries, (row) => row.timestamp);
  const latest = seriesChart[seriesChart.length - 1];

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Max Pain</h1>

      <section className="mb-8">
        <SectionTitle title="Max Pain Snapshot" tooltip="Current max pain context combining summary and intraday series. Max pain approximates the strike that minimizes aggregate option-holder payoff into expiry, and can act as a price magnet near expiration." />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <MetricCard title="Current Max Pain" value={gexSummary?.max_pain ? `$${Number(gexSummary.max_pain).toFixed(2)}` : '--'} tooltip="Latest max pain from /api/gex/summary. Calculation is based on open-interest payout minimization across strikes." theme="dark" />
          <MetricCard title="Last Series Max Pain" value={latest?.maxPain ? `$${latest.maxPain.toFixed(2)}` : '--'} tooltip="Most recent max pain value from /api/max-pain/timeseries. Useful for tracking intraday drift in the max-pain level." theme="dark" />
          <MetricCard title="Underlying Price" value={typeof latest?.price === 'number' ? `$${latest.price.toFixed(2)}` : '--'} trend={typeof latest?.price === 'number' && latest.price > latest.maxPain ? 'bullish' : 'bearish'} tooltip="Latest underlying price from the max-pain timeseries endpoint. Comparing this to max pain helps gauge whether price is above or below the expiry-pinning zone." theme="dark" />
        </div>
      </section>

      <section className="mb-8 bg-[#423d3f] rounded-lg p-6">
        <SectionTitle title="Notional Open Interest by Strike" tooltip="Vertical bar chart of strike-level notional open interest from /api/max-pain/by-strike. Peaks identify strikes with the most positioning weight, often influential for pinning dynamics." />
        {oiError ? <ErrorMessage message={oiError} /> : oiChart.length === 0 ? <div className="text-gray-400 text-center py-8">No max pain OI data available</div> : (
          <ResponsiveContainer width="100%" height={360}><BarChart data={oiChart}><CartesianGrid strokeDasharray="3 3" stroke="#968f92" opacity={0.3} /><XAxis dataKey="strike" stroke="#f2f2f2" tickFormatter={(value) => `$${Number(value).toFixed(0)}`} /><YAxis stroke="#f2f2f2" tickFormatter={(value) => `${Number(value).toFixed(0)}M`} /><Tooltip formatter={(value) => { const numeric = typeof value === 'number' ? value : Number(value ?? 0); return `$${numeric.toFixed(2)}M`; }} /><Bar dataKey="notionalOiM" fill="#10b981" /></BarChart></ResponsiveContainer>
        )}
      </section>

      <section className="mb-8 bg-[#423d3f] rounded-lg p-6">
        <SectionTitle title="Max Pain vs Underlying Price" tooltip="Two-line timeseries from /api/max-pain/timeseries: max pain level and underlying price. Divergence/convergence indicates whether spot is moving toward or away from the max-pain anchor through the session." />
        {seriesError ? <ErrorMessage message={seriesError} /> : seriesChart.length === 0 ? <div className="text-gray-400 text-center py-8">No max pain timeseries data available</div> : (
          <ResponsiveContainer width="100%" height={360}><LineChart data={seriesChart}><CartesianGrid strokeDasharray="3 3" stroke="#968f92" opacity={0.3} /><XAxis dataKey="time" stroke="#f2f2f2" /><YAxis stroke="#f2f2f2" /><Tooltip /><Legend /><Line dataKey="maxPain" name="Max Pain" stroke="#f59e0b" strokeWidth={2} dot={false} /><Line dataKey="price" name="Underlying Price" stroke="#60a5fa" strokeWidth={2} dot={false} /></LineChart></ResponsiveContainer>
        )}
      </section>
    </div>
  );
}
