'use client';

import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useGEXSummary, useGEXByStrike, useMarketQuote } from '@/hooks/useApiData';
import MetricCard from '@/components/MetricCard';
import { LoadingCard } from '@/components/LoadingSpinner';
import ErrorMessage from '@/components/ErrorMessage';
import GammaHeatmap from '@/components/GammaHeatmap';

export default function GammaExposurePage() {
  const { data: gexData, loading: gexLoading, error: gexError, refetch: refetchGex } = useGEXSummary(5000);
  const { data: quoteData } = useMarketQuote(1000);
  const { data: gexByStrike, error: byStrikeError } = useGEXByStrike(40, 10000);

  if (gexLoading && !gexData) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">Gamma Exposure</h1>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <LoadingCard />
          <LoadingCard />
          <LoadingCard />
          <LoadingCard />
        </div>
      </div>
    );
  }

  const strikeChart = (gexByStrike || []).map((row) => ({
    strike: row.strike,
    netGexM: row.net_gex / 1000000,
  }));

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Gamma Exposure</h1>

      {gexError && <ErrorMessage message={gexError} onRetry={refetchGex} />}

      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">GEX Snapshot</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <MetricCard title="SPY Price" value={quoteData ? `$${quoteData.close.toFixed(2)}` : '--'} subtitle={quoteData ? `Vol: ${(quoteData.volume / 1000000).toFixed(1)}M` : ''} theme="dark" />
          <MetricCard title="Net GEX" value={gexData ? `$${(gexData.net_gex / 1000000).toFixed(1)}M` : '--'} trend={gexData && gexData.net_gex > 0 ? 'bullish' : 'bearish'} theme="dark" />
          <MetricCard title="Gamma Flip" value={gexData?.gamma_flip ? `$${gexData.gamma_flip.toFixed(2)}` : 'N/A'} subtitle="Dealer positioning" theme="dark" />
          <MetricCard title="Max Pain" value={gexData?.max_pain ? `$${gexData.max_pain.toFixed(2)}` : 'N/A'} subtitle="Options expiry target" theme="dark" />
        </div>
      </section>

      <section className="mb-8">
        <GammaHeatmap />
      </section>

      <section className="mb-8 bg-[#423d3f] rounded-lg p-6">
        <h2 className="text-2xl font-semibold mb-4">Gamma Exposure by Strike</h2>
        {byStrikeError ? (
          <ErrorMessage message={byStrikeError} />
        ) : strikeChart.length === 0 ? (
          <div className="text-gray-400 text-center py-8">No strike-level gamma data available</div>
        ) : (
          <ResponsiveContainer width="100%" height={360}>
            <BarChart data={strikeChart}>
              <CartesianGrid strokeDasharray="3 3" stroke="#968f92" opacity={0.3} />
              <XAxis dataKey="strike" stroke="#f2f2f2" tickFormatter={(value) => `$${Number(value).toFixed(0)}`} />
              <YAxis stroke="#f2f2f2" tickFormatter={(value) => `${Number(value).toFixed(0)}M`} />
              <Tooltip formatter={(value: number) => `$${value.toFixed(2)}M`} />
              <ReferenceLine y={0} stroke="#f2f2f2" />
              <Bar dataKey="netGexM" fill="#60a5fa" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </section>
    </div>
  );
}
