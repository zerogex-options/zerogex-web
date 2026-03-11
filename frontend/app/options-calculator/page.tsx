'use client';

import { useMemo, useState } from 'react';
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useApiData, useMarketQuote } from '@/hooks/useApiData';
import { useTimeframe } from '@/core/TimeframeContext';
import ErrorMessage from '@/components/ErrorMessage';

type StrategyType = 'long_put' | 'long_call' | 'bear_put_spread';
type LegRole = 'long' | 'short';
type OptionRight = 'call' | 'put';

interface SmartMoneyRow {
  contract?: string;
  strike: number;
  expiration: string;
  option_type: string;
  flow: number;
  notional: number;
  bid?: number | null;
  ask?: number | null;
}

interface MaxPainPoint {
  settlement_price: number;
}

interface MaxPainExpiration {
  expiration: string;
  strikes: MaxPainPoint[];
}

interface MaxPainCurrentResponse {
  expirations: MaxPainExpiration[];
}

interface StrategyLegTemplate {
  id: string;
  role: LegRole;
  right: OptionRight;
  label: string;
}

const STRATEGIES: Record<StrategyType, { label: string; legs: StrategyLegTemplate[] }> = {
  long_put: { label: 'Single Leg Long Put', legs: [{ id: 'lp', role: 'long', right: 'put', label: 'Long Put' }] },
  long_call: { label: 'Single Leg Long Call', legs: [{ id: 'lc', role: 'long', right: 'call', label: 'Long Call' }] },
  bear_put_spread: {
    label: 'Bear Put Spread',
    legs: [
      { id: 'bp_long', role: 'long', right: 'put', label: 'Long Put (higher strike)' },
      { id: 'bp_short', role: 'short', right: 'put', label: 'Short Put (lower strike)' },
    ],
  },
};

function inferredPremium(row: SmartMoneyRow | undefined): number {
  if (!row) return 0;
  const contracts = Math.max(Math.abs(Number(row.flow || 0)), 1);
  return Math.abs(Number(row.notional || 0)) / (contracts * 100);
}

function formatOptionTicker(symbol: string, expiration: string, right: OptionRight, strike: number): string {
  const exp = expiration ? expiration.replace(/-/g, '').slice(2) : '------';
  const strikeText = Number(strike).toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1');
  return `${symbol} ${exp}${right === 'call' ? 'C' : 'P'}${strikeText}`;
}

export default function OptionsCalculatorPage() {
  const { symbol } = useTimeframe();
  const [strategy, setStrategy] = useState<StrategyType>('long_put');
  const [contracts, setContracts] = useState(1);
  const [legExpiration, setLegExpiration] = useState<Record<string, string>>({});
  const [legStrike, setLegStrike] = useState<Record<string, string>>({});

  const { data: quoteData } = useMarketQuote(symbol, 3000);
  const { data: maxPainData, error: chainError } = useApiData<MaxPainCurrentResponse>(
    `/api/max-pain/current?symbol=${symbol}&strike_limit=500`,
    { refreshInterval: 30000 }
  );
  const { data: smartMoneyData } = useApiData<SmartMoneyRow[]>(
    `/api/flow/smart-money?symbol=${symbol}&timeframe=1day&window_units=30&limit=30`,
    { refreshInterval: 15000 }
  );

  const strategyConfig = STRATEGIES[strategy];

  const expirationChoices = useMemo(
    () => (maxPainData?.expirations || []).map((exp) => exp.expiration).sort((a, b) => a.localeCompare(b)),
    [maxPainData]
  );

  const strikeMapByExpiration = useMemo(() => {
    const out: Record<string, number[]> = {};
    (maxPainData?.expirations || []).forEach((exp) => {
      out[exp.expiration] = Array.from(
        new Set((exp.strikes || []).map((row) => Number(row.settlement_price)).filter((n) => Number.isFinite(n) && n > 0))
      ).sort((a, b) => a - b);
    });
    return out;
  }, [maxPainData]);

  const normalizedQuotes = useMemo(
    () =>
      (smartMoneyData || []).map((row) => ({
        ...row,
        optionType: String(row.option_type || '').toLowerCase().includes('call') ? 'call' as const : 'put' as const,
        strikeNum: Number(row.strike),
        bid: Number(row.bid),
        ask: Number(row.ask),
      })),
    [smartMoneyData]
  );

  const selectedLegs = useMemo(
    () =>
      strategyConfig.legs.map((leg) => {
        const expiration = legExpiration[leg.id] || expirationChoices[0] || '';
        const strike = Number(legStrike[leg.id] || strikeMapByExpiration[expiration]?.[0] || 0);
        const quoteRow = normalizedQuotes
          .filter((row) => row.optionType === leg.right && row.expiration === expiration && Number(row.strikeNum) === strike)
          .sort((a, b) => Math.abs(Number(b.notional || 0)) - Math.abs(Number(a.notional || 0)))[0] as SmartMoneyRow | undefined;

        const fallback = inferredPremium(quoteRow);
        const bid = Number(quoteRow?.bid);
        const ask = Number(quoteRow?.ask);
        const quotePerContract = leg.role === 'long'
          ? (Number.isFinite(ask) && ask > 0 ? ask : fallback)
          : (Number.isFinite(bid) && bid > 0 ? bid : fallback);

        return {
          ...leg,
          expiration,
          strike,
          ticker: formatOptionTicker(symbol, expiration, leg.right, strike),
          quotePerContract,
          quoteSide: leg.role === 'long' ? 'ask' : 'bid',
        };
      }),
    [strategyConfig.legs, legExpiration, expirationChoices, legStrike, strikeMapByExpiration, normalizedQuotes, symbol]
  );

  const totalPosition = selectedLegs.reduce((sum, leg) => {
    const signed = leg.role === 'long' ? 1 : -1;
    return sum + signed * leg.quotePerContract * contracts * 100;
  }, 0);

  const spot = Number(quoteData?.close || 0);
  const payoffData = useMemo(() => {
    const center = spot || selectedLegs.find((l) => l.strike > 0)?.strike || 500;
    const minP = Math.max(1, center * 0.8);
    const maxP = center * 1.2;
    return Array.from({ length: 81 }).map((_, i) => {
      const underlyingAtExp = minP + ((maxP - minP) * i) / 80;
      const oneContractPL = selectedLegs.reduce((sum, leg) => {
        const intrinsic = leg.right === 'call' ? Math.max(underlyingAtExp - leg.strike, 0) : Math.max(leg.strike - underlyingAtExp, 0);
        return leg.role === 'long' ? sum + intrinsic - leg.quotePerContract : sum + leg.quotePerContract - intrinsic;
      }, 0);
      return { price: Number(underlyingAtExp.toFixed(2)), pl: Number((oneContractPL * contracts * 100).toFixed(2)) };
    });
  }, [spot, selectedLegs, contracts]);

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Options Calculator</h1>

      <div className="bg-[#423d3f] rounded-lg p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <label className="text-sm text-gray-300">
            Strategy
            <select className="ml-2 rounded bg-[#2f2b2c] border border-gray-600 px-2 py-1" value={strategy} onChange={(e) => setStrategy(e.target.value as StrategyType)}>
              {Object.entries(STRATEGIES).map(([key, cfg]) => <option key={key} value={key}>{cfg.label}</option>)}
            </select>
          </label>
          <label className="text-sm text-gray-300">
            Contracts
            <input className="ml-2 w-24 rounded bg-[#2f2b2c] border border-gray-600 px-2 py-1" type="number" min={1} value={contracts} onChange={(e) => setContracts(Math.max(1, Number(e.target.value || 1)))} />
          </label>
          <div className="text-sm text-gray-300">Underlying: <span className="font-semibold text-white">{symbol} {spot ? `$${spot.toFixed(2)}` : '--'}</span></div>
        </div>

        {chainError && <ErrorMessage message={chainError} />}

        <div className="space-y-3 mb-5">
          {selectedLegs.map((leg) => {
            const legStrikes = strikeMapByExpiration[leg.expiration] || [];
            return (
              <div key={leg.id} className="grid grid-cols-1 md:grid-cols-4 gap-3 items-center bg-[#2f2b2c] p-3 rounded">
                <div className="text-sm font-semibold">{leg.label}</div>
                <label className="text-sm text-gray-300">Exp
                  <select className="ml-2 rounded bg-[#1f1c1d] border border-gray-600 px-2 py-1" value={leg.expiration} onChange={(e) => setLegExpiration((curr) => ({ ...curr, [leg.id]: e.target.value }))}>
                    {expirationChoices.map((exp) => <option key={exp} value={exp}>{exp}</option>)}
                  </select>
                </label>
                <label className="text-sm text-gray-300">Strike
                  <select className="ml-2 rounded bg-[#1f1c1d] border border-gray-600 px-2 py-1" value={String(leg.strike)} onChange={(e) => setLegStrike((curr) => ({ ...curr, [leg.id]: e.target.value }))}>
                    {legStrikes.map((strike) => <option key={strike} value={String(strike)}>{strike.toFixed(2)}</option>)}
                  </select>
                </label>
                <div className="text-sm text-gray-300">
                  {leg.ticker} · <span className="text-white font-semibold">${leg.quotePerContract.toFixed(2)}</span> {leg.quoteSide}
                </div>
              </div>
            );
          })}
        </div>

        <div className="text-sm text-gray-300">
          Total position: <span className="text-white font-semibold">${Math.abs(totalPosition).toFixed(2)}</span>{totalPosition < 0 ? ' (credit)' : ''}
        </div>
      </div>

      <div className="bg-[#423d3f] rounded-lg p-4">
        <h2 className="text-xl font-semibold mb-3">Profit / Loss at Expiration</h2>
        <ResponsiveContainer width="100%" height={420}>
          <LineChart data={payoffData} margin={{ left: 10, right: 24, top: 10, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#968f92" opacity={0.3} />
            <XAxis dataKey="price" tick={{ fontSize: 11 }} tickFormatter={(v) => `$${Number(v).toFixed(0)}`} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${Number(v).toFixed(0)}`} />
            <Tooltip formatter={(value) => `$${Number(value).toFixed(2)}`} labelFormatter={(label) => `Underlying: $${Number(label).toFixed(2)}`} />
            <ReferenceLine y={0} stroke="#f2f2f2" />
            {spot > 0 && <ReferenceLine x={spot} stroke="#94a3b8" strokeDasharray="4 4" label={{ value: `Spot $${spot.toFixed(2)}`, position: 'top', fill: '#cbd5e1', fontSize: 11 }} />}
            <Line type="monotone" dataKey="pl" stroke="#2dd4bf" strokeWidth={3} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
