'use client';

import { Info } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useGEXSummary, useGEXByStrike, useMarketQuote } from '@/hooks/useApiData';
import MetricCard from '@/components/MetricCard';
import { LoadingCard } from '@/components/LoadingSpinner';
import ErrorMessage from '@/components/ErrorMessage';
import GammaHeatmap from '@/components/GammaHeatmap';
import TooltipWrapper from '@/components/TooltipWrapper';

function SectionTitle({ title, tooltip }: { title: string; tooltip: string }) {
  return <div className="flex items-center gap-2 mb-4"><h2 className="text-2xl font-semibold">{title}</h2><TooltipWrapper text={tooltip}><Info size={14} /></TooltipWrapper></div>;
}

export default function GammaExposurePage() {
  const { data: gexData, loading: gexLoading, error: gexError, refetch: refetchGex } = useGEXSummary(5000);
  const { data: quoteData } = useMarketQuote(1000);
  const { data: gexByStrike, error: byStrikeError } = useGEXByStrike(40, 10000);

  if (gexLoading && !gexData) {
    return <div className="container mx-auto px-4 py-8"><h1 className="text-3xl font-bold mb-8">Gamma Exposure</h1><div className="grid grid-cols-1 md:grid-cols-4 gap-4"><LoadingCard /><LoadingCard /><LoadingCard /><LoadingCard /></div></div>;
  }

  const strikeChart = (gexByStrike || []).map((row) => ({ strike: row.strike, netGexM: row.net_gex / 1000000 }));

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Gamma Exposure</h1>
      {gexError && <ErrorMessage message={gexError} onRetry={refetchGex} />}

      <section className="mb-8">
        <SectionTitle title="GEX Snapshot" tooltip="Core gamma regime metrics from /api/gex/summary and /api/market/quote. Together they show where dealer hedging flows may dampen or amplify volatility and where expiry-related pinning pressure may form." />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <MetricCard title="SPY Price" value={quoteData ? `$${quoteData.close.toFixed(2)}` : '--'} subtitle={quoteData ? `Vol: ${(quoteData.volume / 1000000).toFixed(1)}M` : ''} tooltip="Latest underlying quote. Calculation: most recent close/last price from /api/market/quote; subtitle shows traded share volume (millions). Use this as reference against gamma levels." theme="dark" />
          <MetricCard title="Net GEX" value={gexData ? `$${(gexData.net_gex / 1000000).toFixed(1)}M` : '--'} trend={gexData && gexData.net_gex > 0 ? 'bullish' : 'bearish'} tooltip="Net gamma exposure across strikes. Calculation: total_call_gex - total_put_gex, normalized to notional dollars. Sign and magnitude indicate whether dealer hedging likely absorbs or amplifies moves." theme="dark" />
          <MetricCard title="Gamma Flip" value={gexData?.gamma_flip ? `$${gexData.gamma_flip.toFixed(2)}` : 'N/A'} subtitle="Dealer positioning" tooltip="Price where aggregate net gamma changes sign. Above/below this level, dealer hedge behavior can invert (buying/selling into moves), often changing intraday volatility characteristics." theme="dark" />
          <MetricCard title="Max Pain" value={gexData?.max_pain ? `$${gexData.max_pain.toFixed(2)}` : 'N/A'} subtitle="Options expiry target" tooltip="Estimated strike where option-holder payout is minimized at expiry. This level can act as a late-cycle magnet, especially into expiration with high open interest concentration." theme="dark" />
        </div>
      </section>

      <section className="mb-8">
        <SectionTitle title="Gamma Exposure Heatmap" tooltip="Time/strike matrix of net gamma from /api/gex/heatmap, overlaid with underlying price path. Color intensity reflects magnitude; sign indicates positive vs negative gamma pockets that can act as support/resistance zones." />
        <GammaHeatmap />
      </section>

      <section className="mb-8 bg-[#423d3f] rounded-lg p-6">
        <SectionTitle title="Gamma Exposure by Strike" tooltip="Strike-by-strike net gamma bars from /api/gex/by-strike. Values above zero indicate positive net gamma; below zero indicate negative net gamma. Clusters reveal potential hedging pressure zones around key strikes." />
        {byStrikeError ? <ErrorMessage message={byStrikeError} /> : strikeChart.length === 0 ? <div className="text-gray-400 text-center py-8">No strike-level gamma data available</div> : (
          <ResponsiveContainer width="100%" height={360}><BarChart data={strikeChart}><CartesianGrid strokeDasharray="3 3" stroke="#968f92" opacity={0.3} /><XAxis dataKey="strike" stroke="#f2f2f2" tickFormatter={(value) => `$${Number(value).toFixed(0)}`} /><YAxis stroke="#f2f2f2" tickFormatter={(value) => `${Number(value).toFixed(0)}M`} /><Tooltip formatter={(value) => { const numeric = typeof value === 'number' ? value : Number(value ?? 0); return `$${numeric.toFixed(2)}M`; }} /><ReferenceLine y={0} stroke="#f2f2f2" /><Bar dataKey="netGexM" fill="#60a5fa" /></BarChart></ResponsiveContainer>
        )}
      </section>
    </div>
  );
}
