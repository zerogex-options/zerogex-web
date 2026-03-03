'use client';

import { Info } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useApiData, useGEXSummary, useMarketQuote } from '@/hooks/useApiData';
import MetricCard from '@/components/MetricCard';
import LoadingSpinner from '@/components/LoadingSpinner';
import ErrorMessage from '@/components/ErrorMessage';
import TooltipWrapper from '@/components/TooltipWrapper';
import { useTimeframe } from '@/core/TimeframeContext';
import { omitClosedMarketTimes } from '@/core/utils';

interface MaxPainStrikeRow { settlement_price: number; total_notional: number }
interface MaxPainCurrentResponse { timestamp: string; symbol: string; max_pain: number; strikes: MaxPainStrikeRow[] }
interface MaxPainTimeRow { timestamp?: string; max_pain: number }

function SectionTitle({ title, tooltip }: { title: string; tooltip: string }) {
  return <div className="flex items-center gap-2 mb-4"><h2 className="text-2xl font-semibold">{title}</h2><TooltipWrapper text={tooltip}><Info size={14} /></TooltipWrapper></div>;
}

export default function MaxPainPage() {
  const { symbol, timeframe, getMaxDataPoints } = useTimeframe();
  const { data: gexSummary } = useGEXSummary(symbol, 5000);
  const { data: quoteData } = useMarketQuote(symbol, 3000);
  const { data: maxPainCurrent, loading: oiLoading, error: oiError } = useApiData<MaxPainCurrentResponse>(`/api/max-pain/current?symbol=${symbol}&strike_limit=200`, { refreshInterval: 30000 });
  const { data: maxPainSeries, loading: seriesLoading, error: seriesError } = useApiData<MaxPainTimeRow[]>(`/api/max-pain/timeseries?symbol=${symbol}&timeframe=${timeframe}&limit=${getMaxDataPoints()}`, { refreshInterval: 10000 });

  if ((oiLoading || seriesLoading) && !maxPainCurrent && !maxPainSeries) return <LoadingSpinner size="lg" />;

  const sortedStrikes = [...(maxPainCurrent?.strikes || [])].sort((a, b) => Number(a.settlement_price) - Number(b.settlement_price));
  const currentMaxPain = Number(maxPainCurrent?.max_pain || gexSummary?.max_pain || 0);
  const focusedStrikes = sortedStrikes
    .sort((a, b) => Math.abs(Number(a.settlement_price) - currentMaxPain) - Math.abs(Number(b.settlement_price) - currentMaxPain))
    .slice(0, 60)
    .sort((a, b) => Number(a.settlement_price) - Number(b.settlement_price));

  const oiChart = focusedStrikes.map((row) => ({
    strike: Number(row.settlement_price),
    notionalOiM: Number(row.total_notional || 0) / 1_000_000,
  }));

  const rawSeries = (maxPainSeries || []).map((row) => {
    const ts = row.timestamp || '';
    const date = new Date(ts);
    return {
      timestamp: ts,
      time: Number.isNaN(date.getTime()) ? '--:--' : date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
      maxPain: Number(row.max_pain || 0),
      price: Number(quoteData?.close || 0),
    };
  });
  const seriesChart = omitClosedMarketTimes(rawSeries, (row) => row.timestamp);
  const latest = seriesChart[seriesChart.length - 1];

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Max Pain</h1>

      <section className="mb-8">
        <SectionTitle title="Max Pain Snapshot" tooltip="Current max pain context combining summary and intraday series. Max pain approximates the strike that minimizes aggregate option-holder payoff into expiry, and can act as a price magnet near expiration." />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <MetricCard title="Current Max Pain" value={currentMaxPain ? `$${currentMaxPain.toFixed(2)}` : '--'} tooltip="Latest max pain from /api/max-pain/current (fallback /api/gex/summary)." theme="dark" />
          <MetricCard title="Last Series Max Pain" value={latest?.maxPain ? `$${latest.maxPain.toFixed(2)}` : '--'} tooltip="Most recent max pain value from /api/max-pain/timeseries." theme="dark" />
          <MetricCard title="Underlying Price" value={quoteData?.close ? `$${Number(quoteData.close).toFixed(2)}` : '--'} trend={quoteData?.close && currentMaxPain ? (Number(quoteData.close) > currentMaxPain ? 'bullish' : 'bearish') : 'neutral'} tooltip="Current underlying quote from /api/market/quote." theme="dark" />
        </div>
      </section>

      <section className="mb-8 bg-[#423d3f] rounded-lg p-6">
        <SectionTitle title="Notional Open Interest by Strike" tooltip="Strike-level total notional from /api/max-pain/current. Display is focused around current max pain for readability." />
        {oiError ? <ErrorMessage message={oiError} /> : oiChart.length === 0 ? <div className="text-gray-400 text-center py-8">No max pain OI data available</div> : (
          <ResponsiveContainer width="100%" height={360}><BarChart data={oiChart}><CartesianGrid strokeDasharray="3 3" stroke="#968f92" opacity={0.3} /><XAxis dataKey="strike" stroke="#f2f2f2" tickFormatter={(value) => `$${Number(value).toFixed(0)}`} /><YAxis stroke="#f2f2f2" tickFormatter={(value) => `${Number(value).toFixed(0)}M`} /><Tooltip formatter={(value) => { const numeric = typeof value === 'number' ? value : Number(value ?? 0); return `$${numeric.toFixed(2)}M`; }} /><Bar dataKey="notionalOiM" fill="#10b981" /></BarChart></ResponsiveContainer>
        )}
      </section>

      <section className="mb-8 bg-[#423d3f] rounded-lg p-6">
        <SectionTitle title="Max Pain vs Underlying Price" tooltip="Max pain from /api/max-pain/timeseries with current underlying price from /api/market/quote." />
        {seriesError ? <ErrorMessage message={seriesError} /> : seriesChart.length === 0 ? <div className="text-gray-400 text-center py-8">No max pain timeseries data available</div> : (
          <ResponsiveContainer width="100%" height={360}><LineChart data={seriesChart}><CartesianGrid strokeDasharray="3 3" stroke="#968f92" opacity={0.3} /><XAxis dataKey="time" stroke="#f2f2f2" /><YAxis stroke="#f2f2f2" /><Tooltip /><Legend /><Line dataKey="maxPain" name="Max Pain" stroke="#f59e0b" strokeWidth={2} dot={false} /><Line dataKey="price" name="Underlying Price" stroke="#60a5fa" strokeWidth={2} dot={false} /></LineChart></ResponsiveContainer>
        )}
      </section>
    </div>
  );
}
