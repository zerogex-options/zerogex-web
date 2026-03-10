'use client';

import { useMemo, useState } from 'react';
import { Info } from 'lucide-react';
import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
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
  distanceFromSpot: number;
  netGexM: number;
  callOi: number;
  putOi: number;
  callVolume: number;
  putVolume: number;
  vannaM: number;
  charmM: number;
  expirations: number;
};

type SortKey = keyof StrikeAggregate;

export default function GammaExposurePage() {
  const { symbol } = useTimeframe();
  const { data: gexData, loading: gexLoading, error: gexError, refetch: refetchGex } = useGEXSummary(symbol, 5000);
  const { data: quoteData } = useMarketQuote(symbol, 1000);
  const { data: gexByStrike, error: byStrikeError } = useGEXByStrike(symbol, 200, 10000, 'impact');

  const expirationOptions = useMemo(() => {
    const unique = new Set((gexByStrike || []).map((row) => String(row.expiration)));
    return Array.from(unique).sort((a, b) => a.localeCompare(b));
  }, [gexByStrike]);

  const [selectedExpirations, setSelectedExpirations] = useState<string[] | null>(null);
  const [strikeFilter, setStrikeFilter] = useState('');
  const [minAbsNetGexM, setMinAbsNetGexM] = useState(0);
  const [sortKey, setSortKey] = useState<SortKey>('netGexM');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const strikeData = useMemo(() => {
    const activeExpirations = new Set(selectedExpirations ?? expirationOptions);
    const filteredSource = (gexByStrike || []).filter((row) => activeExpirations.has(String(row.expiration)));

    const grouped = new Map<string, StrikeAggregate>();
    filteredSource.forEach((row) => {
      const strike = Number(row.strike);
      const key = strike.toFixed(2);
      if (!grouped.has(key)) {
        grouped.set(key, {
          strike,
          distanceFromSpot: Number(row.distance_from_spot || 0),
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
      current.netGexM += Number(row.net_gex || 0) / 1000000;
      current.callOi += Number(row.call_oi || 0);
      current.putOi += Number(row.put_oi || 0);
      current.callVolume += Number(row.call_volume || 0);
      current.putVolume += Number(row.put_volume || 0);
      current.vannaM += Number(row.vanna_exposure || 0) / 1000000;
      current.charmM += Number(row.charm_exposure || 0) / 1000000;
      current.expirations += 1;
      current.distanceFromSpot = Number(row.distance_from_spot || current.distanceFromSpot);
    });

    return Array.from(grouped.values()).sort((a, b) => a.strike - b.strike);
  }, [gexByStrike, selectedExpirations, expirationOptions]);

  const filteredAndSortedRows = useMemo(() => {
    const filterText = strikeFilter.trim();
    const filtered = strikeData.filter((row) => {
      const matchesStrike = filterText === '' || row.strike.toFixed(2).includes(filterText);
      const matchesAbsNet = Math.abs(row.netGexM) >= minAbsNetGexM;
      return matchesStrike && matchesAbsNet;
    });

    filtered.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      const comparison = av < bv ? -1 : av > bv ? 1 : 0;
      return sortDir === 'asc' ? comparison : -comparison;
    });

    return filtered;
  }, [strikeData, strikeFilter, minAbsNetGexM, sortKey, sortDir]);

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

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((dir) => (dir === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortKey(key);
    setSortDir('desc');
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
        <SectionTitle title="Gamma Exposure by Strike" tooltip="Filter expirations and inspect strike-level net GEX, vanna, charm, OI, and volume from /api/gex/by-strike." />
        {byStrikeError ? <ErrorMessage message={byStrikeError} /> : strikeData.length === 0 ? <div className="text-gray-400 text-center py-8">No strike-level gamma data available</div> : (
          <>
            <div className="mb-5 flex flex-col gap-4">
              <div className="flex flex-wrap gap-2 items-center">
                <span className="text-sm text-gray-300">Expirations:</span>
                <button onClick={() => setSelectedExpirations(null)} className="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded">All</button>
                <button onClick={() => setSelectedExpirations([])} className="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded">None</button>
                {expirationOptions.map((exp) => {
                  const active = selectedExpirations === null || selectedExpirations.includes(exp);
                  return (
                    <button
                      key={exp}
                      onClick={() => setSelectedExpirations((current) => {
                        const base = current === null ? [...expirationOptions] : [...current];
                        return active ? base.filter((v) => v !== exp) : [...base, exp];
                      })}
                      className={`px-3 py-1 text-xs rounded border ${active ? 'bg-cyan-900 border-cyan-400 text-cyan-100' : 'bg-gray-800 border-gray-600 text-gray-300 hover:bg-gray-700'}`}
                    >
                      {exp}
                    </button>
                  );
                })}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <label className="text-sm text-gray-300">
                  Strike filter
                  <input
                    className="mt-1 w-full rounded bg-[#2f2b2c] border border-gray-600 px-3 py-2 text-sm"
                    placeholder="e.g. 550"
                    value={strikeFilter}
                    onChange={(e) => setStrikeFilter(e.target.value)}
                  />
                </label>
                <label className="text-sm text-gray-300">
                  Min |Net GEX| (M)
                  <input
                    type="number"
                    min={0}
                    step={0.1}
                    className="mt-1 w-full rounded bg-[#2f2b2c] border border-gray-600 px-3 py-2 text-sm"
                    value={minAbsNetGexM}
                    onChange={(e) => setMinAbsNetGexM(Number(e.target.value || 0))}
                  />
                </label>
              </div>
            </div>

            <ResponsiveContainer width="100%" height={390}>
              <ComposedChart data={filteredAndSortedRows}>
                <CartesianGrid strokeDasharray="3 3" stroke="#968f92" opacity={0.3} />
                <XAxis dataKey="strike" stroke="#f2f2f2" tickFormatter={(value) => `$${Number(value).toFixed(0)}`} />
                <YAxis stroke="#f2f2f2" domain={['auto', 'auto']} tickFormatter={(value) => formatLarge(Number(value))} />
                <Tooltip formatter={(value) => `$${Number(value).toFixed(2)}M`} />
                <Legend />
                <ReferenceLine y={0} stroke="#f2f2f2" />
                <Bar dataKey="netGexM" name="Net GEX" barSize={12}>
                  {filteredAndSortedRows.map((entry, idx) => (
                    <Cell key={`cell-${idx}`} fill={entry.netGexM >= 0 ? '#10b981' : '#f45854'} />
                  ))}
                </Bar>
                <Line type="monotone" dataKey="vannaM" name="Vanna" stroke="#60a5fa" dot={false} strokeWidth={2} />
                <Line type="monotone" dataKey="charmM" name="Charm" stroke="#facc15" dot={false} strokeWidth={2} />
              </ComposedChart>
            </ResponsiveContainer>

            <div className="overflow-x-auto mt-6">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-700 text-gray-300">
                    <th className="text-right py-2 px-2 cursor-pointer" onClick={() => toggleSort('strike')}>Strike</th>
                    <th className="text-right py-2 px-2 cursor-pointer" onClick={() => toggleSort('distanceFromSpot')}>Dist.</th>
                    <th className="text-right py-2 px-2 cursor-pointer" onClick={() => toggleSort('netGexM')}>Net GEX</th>
                    <th className="text-right py-2 px-2 cursor-pointer" onClick={() => toggleSort('vannaM')}>Vanna</th>
                    <th className="text-right py-2 px-2 cursor-pointer" onClick={() => toggleSort('charmM')}>Charm</th>
                    <th className="text-right py-2 px-2 cursor-pointer" onClick={() => toggleSort('callOi')}>Call OI</th>
                    <th className="text-right py-2 px-2 cursor-pointer" onClick={() => toggleSort('putOi')}>Put OI</th>
                    <th className="text-right py-2 px-2 cursor-pointer" onClick={() => toggleSort('callVolume')}>Call Vol</th>
                    <th className="text-right py-2 px-2 cursor-pointer" onClick={() => toggleSort('putVolume')}>Put Vol</th>
                    <th className="text-right py-2 px-2 cursor-pointer" onClick={() => toggleSort('expirations')}>Exp</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAndSortedRows.map((row) => (
                    <tr key={row.strike} className="border-b border-gray-800">
                      <td className="text-right py-2 px-2 font-mono">${row.strike.toFixed(2)}</td>
                      <td className="text-right py-2 px-2">{row.distanceFromSpot.toFixed(2)}</td>
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
