'use client';

import { useMemo } from 'react';
import { Info } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useGEXSummary, useGEXByStrike, useMarketQuote } from '@/hooks/useApiData';
import MetricCard from '@/components/MetricCard';
import { LoadingCard } from '@/components/LoadingSpinner';
import ErrorMessage from '@/components/ErrorMessage';
import GammaHeatmap from '@/components/GammaHeatmap';
import TooltipWrapper from '@/components/TooltipWrapper';
import { useTimeframe } from '@/core/TimeframeContext';

function SectionTitle({ title, tooltip }: { title: string; tooltip: string }) {
  return <div className="flex items-center gap-2 mb-4"><h2 className="text-2xl font-semibold">{title}</h2><TooltipWrapper text={tooltip}><Info size={14} /></TooltipWrapper></div>;
}

type StrikeAggregate = {
  strike: number;
  spotPrice: number;
  distanceFromSpot: number;
  callGexM: number;
  putGexM: number;
  netGexM: number;
  callOi: number;
  putOi: number;
  callVolume: number;
  putVolume: number;
  vannaM: number;
  charmM: number;
  expirations: number;
};

export default function GammaExposurePage() {
  const { symbol } = useTimeframe();
  const { data: gexData, loading: gexLoading, error: gexError, refetch: refetchGex } = useGEXSummary(symbol, 5000);
  const { data: quoteData } = useMarketQuote(symbol, 1000);
  const { data: gexByStrike, error: byStrikeError } = useGEXByStrike(symbol, 200, 10000, 'impact');

  const strikeData = useMemo(() => {
    const grouped = new Map<string, StrikeAggregate>();

    (gexByStrike || []).forEach((row) => {
      const strike = Number(row.strike);
      const key = strike.toFixed(2);
      if (!grouped.has(key)) {
        grouped.set(key, {
          strike,
          spotPrice: Number(row.spot_price),
          distanceFromSpot: Number(row.distance_from_spot),
          callGexM: 0,
          putGexM: 0,
          netGexM: 0,
          callOi: 0,
          putOi: 0,
          callVolume: 0,
          putVolume: 0,
          vannaM: 0,
          charmM: 0,
          expirations: 0,
        });
      }

      const current = grouped.get(key)!;
      current.callGexM += Number(row.call_gex || 0) / 1000000;
      current.putGexM += Number(row.put_gex || 0) / 1000000;
      current.netGexM += Number(row.net_gex || 0) / 1000000;
      current.callOi += Number(row.call_oi || 0);
      current.putOi += Number(row.put_oi || 0);
      current.callVolume += Number(row.call_volume || 0);
      current.putVolume += Number(row.put_volume || 0);
      current.vannaM += Number(row.vanna_exposure || 0) / 1000000;
      current.charmM += Number(row.charm_exposure || 0) / 1000000;
      current.expirations += 1;
      current.spotPrice = Number(row.spot_price || current.spotPrice);
      current.distanceFromSpot = Number(row.distance_from_spot || current.distanceFromSpot);
    });

    return Array.from(grouped.values()).sort((a, b) => a.strike - b.strike);
  }, [gexByStrike]);

  const topRows = [...strikeData].sort((a, b) => Math.abs(b.netGexM) - Math.abs(a.netGexM)).slice(0, 12);


  if (gexLoading && !gexData) {
    return <div className="container mx-auto px-4 py-8"><h1 className="text-3xl font-bold mb-8">Gamma Exposure</h1><div className="grid grid-cols-1 md:grid-cols-4 gap-4"><LoadingCard /><LoadingCard /><LoadingCard /><LoadingCard /></div></div>;
  }

  const quoteVolume = quoteData?.volume ?? 0;
  const formatLarge = (value: number) => {
    const abs = Math.abs(value);
    if (abs >= 1000) return `${value.toFixed(0)}M`;
    if (abs >= 1) return `${value.toFixed(1)}M`;
    return `${(value * 1000).toFixed(0)}K`;
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Gamma Exposure</h1>
      {gexError && <ErrorMessage message={gexError} onRetry={refetchGex} />}

      <section className="mb-8">
        <SectionTitle title="GEX Snapshot" tooltip="Core gamma regime metrics from /api/gex/summary and /api/market/quote. Together they show where dealer hedging flows may dampen or amplify volatility and where expiry-related pinning pressure may form." />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <MetricCard title="SPY Price" value={quoteData ? `$${quoteData.close.toFixed(2)}` : '--'} subtitle={quoteData ? `Vol: ${(quoteVolume / 1000000).toFixed(1)}M` : ''} tooltip="Latest underlying quote. Calculation: most recent close/last price from /api/market/quote; subtitle shows traded share volume (millions). Use this as reference against gamma levels." theme="dark" />
          <MetricCard title="Net GEX" value={gexData ? `$${(gexData.net_gex / 1000000).toFixed(1)}M` : '--'} trend={gexData && gexData.net_gex > 0 ? 'bullish' : 'bearish'} tooltip="Net gamma exposure across strikes. Calculation: total_call_gex - total_put_gex, normalized to notional dollars. Sign and magnitude indicate whether dealer hedging likely absorbs or amplifies moves." theme="dark" />
          <MetricCard title="Gamma Flip" value={gexData?.gamma_flip ? `$${gexData.gamma_flip.toFixed(2)}` : 'N/A'} subtitle="Dealer positioning" tooltip="Price where aggregate net gamma changes sign. Above/below this level, dealer hedge behavior can invert (buying/selling into moves), often changing intraday volatility characteristics." theme="dark" />
          <MetricCard title="Max Pain" value={gexData?.max_pain ? `$${gexData.max_pain.toFixed(2)}` : 'N/A'} subtitle="Options expiry target" tooltip="Estimated strike where option-holder payout is minimized at expiry. This level can act as a late-cycle magnet, especially into expiration with high open interest concentration." theme="dark" />
        </div>
      </section>

      <section className="mb-8">
        <GammaHeatmap />
      </section>

      <section className="mb-8 bg-[#423d3f] rounded-lg p-6">
        <SectionTitle title="Gamma Exposure by Strike" tooltip="Expanded view of /api/gex/by-strike using strike, OI, volume, call/put/net GEX, and vanna/charm exposure across expirations." />
        {byStrikeError ? <ErrorMessage message={byStrikeError} /> : strikeData.length === 0 ? <div className="text-gray-400 text-center py-8">No strike-level gamma data available</div> : (
          <>
            <ResponsiveContainer width="100%" height={380}>
              <BarChart data={strikeData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#968f92" opacity={0.3} />
                <XAxis dataKey="strike" stroke="#f2f2f2" tickFormatter={(value) => `$${Number(value).toFixed(0)}`} />
                <YAxis stroke="#f2f2f2" domain={['auto', 'auto']} tickFormatter={(value) => formatLarge(Number(value))} />
                <Tooltip
                  formatter={(value, name) => {
                    const numeric = typeof value === 'number' ? value : Number(value ?? 0);
                    const label = String(name);
                    if (label.includes('Oi') || label.includes('Volume')) return numeric.toLocaleString();
                    return `$${numeric.toFixed(2)}M`;
                  }}
                />
                <ReferenceLine y={0} stroke="#f2f2f2" />
                <Bar dataKey="callGexM" name="Call GEX" fill="#34d399" barSize={6} />
                <Bar dataKey="putGexM" name="Put GEX" fill="#f87171" barSize={6} />
                <Bar dataKey="netGexM" name="Net GEX" barSize={10}>
                  {strikeData.map((entry, idx) => (
                    <Cell key={`cell-${idx}`} fill={entry.netGexM >= 0 ? '#10b981' : '#f45854'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>

            <div className="overflow-x-auto mt-6">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-700 text-gray-300">
                    <th className="text-right py-2 px-2">Strike</th>
                    <th className="text-right py-2 px-2">Dist.</th>
                    <th className="text-right py-2 px-2">Call GEX</th>
                    <th className="text-right py-2 px-2">Put GEX</th>
                    <th className="text-right py-2 px-2">Net GEX</th>
                    <th className="text-right py-2 px-2">Vanna</th>
                    <th className="text-right py-2 px-2">Charm</th>
                    <th className="text-right py-2 px-2">Call OI</th>
                    <th className="text-right py-2 px-2">Put OI</th>
                    <th className="text-right py-2 px-2">Call Vol</th>
                    <th className="text-right py-2 px-2">Put Vol</th>
                    <th className="text-right py-2 px-2">Exp</th>
                  </tr>
                </thead>
                <tbody>
                  {topRows.map((row) => (
                    <tr key={row.strike} className="border-b border-gray-800">
                      <td className="text-right py-2 px-2 font-mono">${row.strike.toFixed(2)}</td>
                      <td className="text-right py-2 px-2">{row.distanceFromSpot.toFixed(2)}</td>
                      <td className="text-right py-2 px-2 text-green-300">${row.callGexM.toFixed(2)}M</td>
                      <td className="text-right py-2 px-2 text-red-300">${row.putGexM.toFixed(2)}M</td>
                      <td className={`text-right py-2 px-2 font-semibold ${row.netGexM >= 0 ? 'text-green-400' : 'text-red-400'}`}>${row.netGexM.toFixed(2)}M</td>
                      <td className="text-right py-2 px-2">${row.vannaM.toFixed(2)}M</td>
                      <td className="text-right py-2 px-2">${row.charmM.toFixed(2)}M</td>
                      <td className="text-right py-2 px-2">{row.callOi.toLocaleString()}</td>
                      <td className="text-right py-2 px-2">{row.putOi.toLocaleString()}</td>
                      <td className="text-right py-2 px-2">{row.callVolume.toLocaleString()}</td>
                      <td className="text-right py-2 px-2">{row.putVolume.toLocaleString()}</td>
                      <td className="text-right py-2 px-2">{row.expirations}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
