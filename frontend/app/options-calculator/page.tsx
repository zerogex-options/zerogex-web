'use client';

import { useMemo, useState } from 'react';
import { Area, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useApiData } from '@/hooks/useApiData';
import { useTimeframe } from '@/core/TimeframeContext';
import LoadingSpinner from '@/components/LoadingSpinner';

interface MaxPainPoint { settlement_price: number; }
interface MaxPainExpiration { expiration: string; strikes: MaxPainPoint[]; }
interface MaxPainCurrentResponse { expirations: MaxPainExpiration[]; }
interface FlowStrikeRow { strike: number | string; total_volume: number; total_premium: number; }
type Strategy = 'long-put' | 'long-call' | 'bear-put-spread';

function payoffPerShare(strategy: Strategy, s: number, k1: number, k2: number, debit: number) {
  if (strategy === 'long-put') return Math.max(k1 - s, 0) - debit;
  if (strategy === 'long-call') return Math.max(s - k1, 0) - debit;
  return Math.max(k1 - s, 0) - Math.max(k2 - s, 0) - debit;
}

export default function OptionsCalculatorPage() {
  const { symbol } = useTimeframe();
  const [strategy, setStrategy] = useState<Strategy>('long-put');
  const [contracts, setContracts] = useState(1);

  const { data: maxPainCurrent, loading } = useApiData<MaxPainCurrentResponse>(`/api/max-pain/current?symbol=${symbol}&strike_limit=500`, { refreshInterval: 30000 });
  const { data: flowByStrike } = useApiData<FlowStrikeRow[]>(`/api/flow/by-strike?symbol=${symbol}&timeframe=1day&window_units=30&limit=50000`, { refreshInterval: 10000 });
  const { data: quoteData } = useApiData<{ close: number }>(`/api/market/quote?symbol=${symbol}`, { refreshInterval: 2000 });

  const expirationOptions = useMemo(() => (maxPainCurrent?.expirations || []).map((e) => e.expiration), [maxPainCurrent]);
  const [expiration1, setExpiration1] = useState('');
  const [expiration2, setExpiration2] = useState('');
  const activeExpiration1 = expiration1 || expirationOptions[0] || '';
  const activeExpiration2 = expiration2 || expirationOptions[0] || '';

  const strikeOptions1 = useMemo(() => {
    const exp = (maxPainCurrent?.expirations || []).find((e) => e.expiration === activeExpiration1) || (maxPainCurrent?.expirations || [])[0];
    return (exp?.strikes || []).map((s) => Number(s.settlement_price)).filter((s) => Number.isFinite(s)).sort((a, b) => a - b);
  }, [maxPainCurrent, activeExpiration1]);
  const strikeOptions2 = useMemo(() => {
    const exp = (maxPainCurrent?.expirations || []).find((e) => e.expiration === activeExpiration2) || (maxPainCurrent?.expirations || [])[0];
    return (exp?.strikes || []).map((s) => Number(s.settlement_price)).filter((s) => Number.isFinite(s)).sort((a, b) => a - b);
  }, [maxPainCurrent, activeExpiration2]);

  const [strike1, setStrike1] = useState<number>(0);
  const [strike2, setStrike2] = useState<number>(0);
  const activeStrike1 = strike1 || strikeOptions1[0] || 0;
  const activeStrike2 = strike2 || strikeOptions2[Math.min(1, Math.max(0, strikeOptions2.length - 1))] || 0;

  const quoteByStrike = useMemo(() => {
    const map = new Map<number, number>();
    for (const row of flowByStrike || []) {
      const strike = Number(row.strike);
      if (!Number.isFinite(strike) || strike <= 0) continue;
      const volume = Math.max(1, Number(row.total_volume || 0));
      const premium = Math.abs(Number(row.total_premium || 0));
      map.set(strike, premium / volume / 100);
    }
    return map;
  }, [flowByStrike]);

  const leg1Quote = quoteByStrike.get(activeStrike1) || 0;
  const leg2Quote = quoteByStrike.get(activeStrike2) || 0;
  const totalDebitPerShare = strategy === 'bear-put-spread' ? Math.max(0, leg1Quote - leg2Quote) : leg1Quote;
  const totalDebit = totalDebitPerShare * contracts * 100;

  const spot = Number(quoteData?.close || activeStrike1 || 1);
  const minS = Math.max(1, Math.min(activeStrike1, activeStrike2 || activeStrike1, spot) * 0.9);
  const maxS = Math.max(activeStrike1, activeStrike2 || activeStrike1, spot) * 1.1;
  const plData = Array.from({ length: 60 }).map((_, i) => {
    const underlying = minS + ((maxS - minS) * i) / 59;
    const perShare = payoffPerShare(strategy, underlying, activeStrike1, activeStrike2, totalDebitPerShare);
    const pnl = perShare * contracts * 100;
    return { underlying, pnl, gain: pnl > 0 ? pnl : 0, loss: pnl < 0 ? pnl : 0 };
  });

  if (loading && !maxPainCurrent) return <LoadingSpinner size="lg" />;

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Options Calculator</h1>
      <div className="bg-[#423d3f] rounded-lg p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <label className="text-sm">Strategy
            <select className="w-full mt-1 bg-[#2f2b2d] border border-gray-600 rounded px-3 py-2" value={strategy} onChange={(e) => setStrategy(e.target.value as Strategy)}>
              <option value="long-put">Single Leg Long Put</option><option value="long-call">Single Leg Long Call</option><option value="bear-put-spread">Bear Put Spread</option>
            </select>
          </label>
          <label className="text-sm">Contracts
            <input className="w-full mt-1 bg-[#2f2b2d] border border-gray-600 rounded px-3 py-2" type="number" min={1} value={contracts} onChange={(e) => setContracts(Math.max(1, Number(e.target.value || 1)))} />
          </label>
          <label className="text-sm">Expiration (Leg 1)
            <select className="w-full mt-1 bg-[#2f2b2d] border border-gray-600 rounded px-3 py-2" value={activeExpiration1} onChange={(e) => setExpiration1(e.target.value)}>{expirationOptions.map((exp) => <option key={exp} value={exp}>{exp}</option>)}</select>
          </label>
          <label className="text-sm">Strike (Leg 1)
            <select className="w-full mt-1 bg-[#2f2b2d] border border-gray-600 rounded px-3 py-2" value={activeStrike1 || ''} onChange={(e) => setStrike1(Number(e.target.value))}>{strikeOptions1.map((s) => <option key={s} value={s}>{s.toFixed(2)}</option>)}</select>
          </label>
          {strategy === 'bear-put-spread' ? <>
            <label className="text-sm">Expiration (Leg 2)
              <select className="w-full mt-1 bg-[#2f2b2d] border border-gray-600 rounded px-3 py-2" value={activeExpiration2} onChange={(e) => setExpiration2(e.target.value)}>{expirationOptions.map((exp) => <option key={exp} value={exp}>{exp}</option>)}</select>
            </label>
            <label className="text-sm">Strike (Leg 2)
              <select className="w-full mt-1 bg-[#2f2b2d] border border-gray-600 rounded px-3 py-2" value={activeStrike2 || ''} onChange={(e) => setStrike2(Number(e.target.value))}>{strikeOptions2.map((s) => <option key={s} value={s}>{s.toFixed(2)}</option>)}</select>
            </label>
          </> : null}
        </div>
        <div className="mt-4 text-sm text-gray-300">
          <div>Leg 1 quote (est): <span className="font-mono">${leg1Quote.toFixed(2)}</span></div>
          {strategy === 'bear-put-spread' ? <div>Leg 2 quote (est): <span className="font-mono">${leg2Quote.toFixed(2)}</span></div> : null}
          <div>Total {strategy === 'bear-put-spread' ? 'debit' : 'cost'}: <span className="font-mono">${totalDebit.toFixed(2)}</span></div>
        </div>
      </div>
      <div className="bg-[#423d3f] rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">Profit / Loss at Expiration</h2>
        <ResponsiveContainer width="100%" height={460}>
          <ComposedChart data={plData} margin={{ top: 8, right: 20, left: 8, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#968f92" opacity={0.3} />
            <XAxis dataKey="underlying" tickFormatter={(v) => `$${Number(v).toFixed(0)}`} />
            <YAxis tickFormatter={(v) => `$${Number(v).toFixed(0)}`} />
            <Tooltip formatter={(value) => `$${Number(value).toFixed(2)}`} labelFormatter={(v) => `Underlying: $${Number(v).toFixed(2)}`} />
            <ReferenceLine y={0} stroke="#f2f2f2" />
            <ReferenceLine x={spot} stroke="#d1d5db" strokeDasharray="4 4" label={{ value: 'Spot', position: 'top', fill: '#d1d5db' }} />
            <Area type="monotone" dataKey="gain" fill="#14b8a6" stroke="none" fillOpacity={0.2} />
            <Area type="monotone" dataKey="loss" fill="#e11d48" stroke="none" fillOpacity={0.2} />
            <Line type="monotone" dataKey="pnl" stroke="#22d3ee" strokeWidth={3} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
