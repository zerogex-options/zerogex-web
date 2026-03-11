'use client';

import { useMemo, useState } from 'react';
import {
  Area, AreaChart, CartesianGrid, ReferenceLine,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { useApiData, useMarketQuote } from '@/hooks/useApiData';
import { useTimeframe } from '@/core/TimeframeContext';
import ErrorMessage from '@/components/ErrorMessage';

type LegRole = 'long' | 'short';
type OptionRight = 'call' | 'put' | 'stock';

interface StrategyLegTemplate {
  id: string;
  role: LegRole;
  right: OptionRight;
  label: string;
  qty?: number;
}

interface OptionQuote {
  timestamp: string;
  underlying: string;
  strike: string;
  expiration: string;
  option_type: string;
  bid?: string | null;
  ask?: string | null;
  volume?: number | null;
  open_interest?: number | null;
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

// Helper for concise strategy leg definition
const L = (id: string, role: LegRole, right: OptionRight, label: string, qty?: number): StrategyLegTemplate =>
  qty !== undefined ? { id, role, right, label, qty } : { id, role, right, label };

const STRATEGIES = {
  long_call:              { label: 'Long Call',              legs: [L('lc',       'long',  'call',  'Long Call')] },
  long_put:               { label: 'Long Put',               legs: [L('lp',       'long',  'put',   'Long Put')] },
  short_call:             { label: 'Short Call',             legs: [L('sc',       'short', 'call',  'Short Call')] },
  short_put:              { label: 'Short Put',              legs: [L('sp',       'short', 'put',   'Short Put')] },
  covered_call:           { label: 'Covered Call',           legs: [L('cc_stk',   'long',  'stock', 'Long Stock'), L('cc_c',    'short', 'call',  'Short Call (OTM)')] },
  covered_put:            { label: 'Covered Put',            legs: [L('cp_stk',   'short', 'stock', 'Short Stock'), L('cp_p',   'short', 'put',   'Short Put (OTM)')] },
  protective_put:         { label: 'Protective Put',         legs: [L('pp_stk',   'long',  'stock', 'Long Stock'), L('pp_p',    'long',  'put',   'Long Put (OTM)')] },
  protective_call:        { label: 'Protective Call',        legs: [L('pc_stk',   'short', 'stock', 'Short Stock'), L('pc_c',   'long',  'call',  'Long Call (OTM)')] },
  bull_call_spread:       { label: 'Bull Call Spread',       legs: [L('bcs_l',    'long',  'call',  'Long Call (lower strike)'), L('bcs_s',    'short', 'call',  'Short Call (higher strike)')] },
  bull_put_spread:        { label: 'Bull Put Spread',        legs: [L('bps_s',    'short', 'put',   'Short Put (higher strike)'), L('bps_l',   'long',  'put',   'Long Put (lower strike)')] },
  bear_call_spread:       { label: 'Bear Call Spread',       legs: [L('bea_s',    'short', 'call',  'Short Call (lower strike)'), L('bea_l',   'long',  'call',  'Long Call (higher strike)')] },
  bear_put_spread:        { label: 'Bear Put Spread',        legs: [L('bp_l',     'long',  'put',   'Long Put (higher strike)'), L('bp_s',    'short', 'put',   'Short Put (lower strike)')] },
  long_straddle:          { label: 'Long Straddle',          legs: [L('lst_c',    'long',  'call',  'Long Call (ATM)'), L('lst_p',    'long',  'put',   'Long Put (ATM)')] },
  short_straddle:         { label: 'Short Straddle',         legs: [L('sst_c',    'short', 'call',  'Short Call (ATM)'), L('sst_p',   'short', 'put',   'Short Put (ATM)')] },
  long_strangle:          { label: 'Long Strangle',          legs: [L('lng_c',    'long',  'call',  'Long Call (OTM)'), L('lng_p',    'long',  'put',   'Long Put (OTM)')] },
  short_strangle:         { label: 'Short Strangle',         legs: [L('sng_c',    'short', 'call',  'Short Call (OTM)'), L('sng_p',   'short', 'put',   'Short Put (OTM)')] },
  iron_condor:            { label: 'Iron Condor',            legs: [L('ic_lp',    'long',  'put',   'Long Put (lowest)'), L('ic_sp',  'short', 'put',   'Short Put (lower)'), L('ic_sc', 'short', 'call', 'Short Call (upper)'), L('ic_lc', 'long', 'call', 'Long Call (highest)')] },
  iron_butterfly:         { label: 'Iron Butterfly',         legs: [L('ib_lp',    'long',  'put',   'Long Put (OTM lower)'), L('ib_sp', 'short', 'put',   'Short Put (ATM)'), L('ib_sc', 'short', 'call', 'Short Call (ATM)'), L('ib_lc', 'long', 'call', 'Long Call (OTM upper)')] },
  long_butterfly_spread:  { label: 'Long Butterfly Spread',  legs: [L('lbf_l',   'long',  'call',  'Long Call (lower)', 1), L('lbf_s', 'short', 'call', 'Short Call (middle) ×2', 2), L('lbf_u', 'long', 'call', 'Long Call (upper)', 1)] },
  short_butterfly_spread: { label: 'Short Butterfly Spread', legs: [L('sbf_l',   'short', 'call',  'Short Call (lower)', 1), L('sbf_m', 'long',  'call', 'Long Call (middle) ×2', 2), L('sbf_u', 'short', 'call', 'Short Call (upper)', 1)] },
  call_butterfly:         { label: 'Call Butterfly',         legs: [L('cb_l',     'long',  'call',  'Long Call (lower)', 1), L('cb_m',  'short', 'call', 'Short Call (middle) ×2', 2), L('cb_u',  'long',  'call', 'Long Call (upper)', 1)] },
  put_butterfly:          { label: 'Put Butterfly',          legs: [L('pb_u',     'long',  'put',   'Long Put (upper)', 1), L('pb_m',   'short', 'put',  'Short Put (middle) ×2', 2), L('pb_l',  'long',  'put',  'Long Put (lower)', 1)] },
  box_spread:             { label: 'Box Spread',             legs: [L('box_lc',   'long',  'call',  'Long Call (lower)'), L('box_sc',  'short', 'call',  'Short Call (higher)'), L('box_sp', 'short', 'put', 'Short Put (lower)'), L('box_lp', 'long', 'put', 'Long Put (higher)')] },
  collar:                 { label: 'Collar',                 legs: [L('col_stk',  'long',  'stock', 'Long Stock'), L('col_p',    'long',  'put',   'Long Put (OTM lower)'), L('col_c',  'short', 'call', 'Short Call (OTM upper)')] },
  risk_reversal:          { label: 'Risk Reversal',          legs: [L('rr_sp',    'short', 'put',   'Short Put (OTM lower)'), L('rr_lc', 'long',  'call',  'Long Call (OTM upper)')] },
  reverse_risk_reversal:  { label: 'Reverse Risk Reversal',  legs: [L('rrr_sc',   'short', 'call',  'Short Call (OTM)'), L('rrr_lp', 'long',  'put',   'Long Put (OTM)')] },
  jade_lizard:            { label: 'Jade Lizard',            legs: [L('jl_sp',    'short', 'put',   'Short Put (OTM)'), L('jl_sc',   'short', 'call',  'Short Call (OTM lower)'), L('jl_lc', 'long', 'call', 'Long Call (OTM higher)')] },
  reverse_jade_lizard:    { label: 'Reverse Jade Lizard',    legs: [L('rjl_sc',   'short', 'call',  'Short Call (OTM)'), L('rjl_lp', 'long',  'put',   'Long Put (OTM)'), L('rjl_sp', 'short', 'put', 'Short Put (OTM lower)')] },
  ratio_call_spread:      { label: 'Ratio Call Spread',      legs: [L('rcs_l',    'long',  'call',  'Long Call (lower)', 1), L('rcs_s', 'short', 'call', 'Short Call (higher) ×2', 2)] },
  ratio_put_spread:       { label: 'Ratio Put Spread',       legs: [L('rps_l',    'long',  'put',   'Long Put (higher)', 1), L('rps_s', 'short', 'put',  'Short Put (lower) ×2', 2)] },
  backspread_call:        { label: 'Backspread (Call)',       legs: [L('bsc_s',    'short', 'call',  'Short Call (lower)', 1), L('bsc_l', 'long',  'call', 'Long Call (higher) ×2', 2)] },
  backspread_put:         { label: 'Backspread (Put)',        legs: [L('bsp_s',    'short', 'put',   'Short Put (higher)', 1), L('bsp_l', 'long',  'put',  'Long Put (lower) ×2', 2)] },
  calendar_spread_call:   { label: 'Calendar Spread (Call)', legs: [L('csc_s',    'short', 'call',  'Short Call (near-term)'), L('csc_l', 'long',  'call',  'Long Call (far-term)')] },
  calendar_spread_put:    { label: 'Calendar Spread (Put)',  legs: [L('csp_s',    'short', 'put',   'Short Put (near-term)'), L('csp_l', 'long',  'put',   'Long Put (far-term)')] },
  diagonal_spread_call:   { label: 'Diagonal Spread (Call)', legs: [L('dsc_s',    'short', 'call',  'Short Call (near, higher strike)'), L('dsc_l', 'long', 'call', 'Long Call (far, lower strike)')] },
  diagonal_spread_put:    { label: 'Diagonal Spread (Put)',  legs: [L('dsp_s',    'short', 'put',   'Short Put (near, lower strike)'), L('dsp_l', 'long',  'put',  'Long Put (far, higher strike)')] },
  double_calendar_spread: { label: 'Double Calendar Spread', legs: [L('dcs_sc',   'short', 'call',  'Short Call (near)'), L('dcs_lc', 'long',  'call',  'Long Call (far)'), L('dcs_sp', 'short', 'put', 'Short Put (near)'), L('dcs_lp', 'long', 'put', 'Long Put (far)')] },
  double_diagonal_spread: { label: 'Double Diagonal Spread', legs: [L('dds_sc',   'short', 'call',  'Short Call (near, higher)'), L('dds_lc', 'long', 'call', 'Long Call (far, lower)'), L('dds_sp', 'short', 'put', 'Short Put (near, lower)'), L('dds_lp', 'long', 'put', 'Long Put (far, higher)')] },
  strip:                  { label: 'Strip',                  legs: [L('strip_c',  'long',  'call',  'Long Call (ATM)', 1), L('strip_p', 'long', 'put',  'Long Put (ATM) ×2', 2)] },
  strap:                  { label: 'Strap',                  legs: [L('strap_c',  'long',  'call',  'Long Call (ATM) ×2', 2), L('strap_p', 'long', 'put', 'Long Put (ATM)', 1)] },
  synthetic_long_stock:   { label: 'Synthetic Long Stock',   legs: [L('sls_lc',   'long',  'call',  'Long Call (ATM)'), L('sls_sp',  'short', 'put',   'Short Put (ATM)')] },
  synthetic_short_stock:  { label: 'Synthetic Short Stock',  legs: [L('sss_sc',   'short', 'call',  'Short Call (ATM)'), L('sss_lp', 'long',  'put',   'Long Put (ATM)')] },
  conversion:             { label: 'Conversion',             legs: [L('conv_stk', 'long',  'stock', 'Long Stock'), L('conv_sc',  'short', 'call',  'Short Call'), L('conv_lp', 'long',  'put',  'Long Put')] },
  reversal:               { label: 'Reversal',               legs: [L('rev_stk',  'short', 'stock', 'Short Stock'), L('rev_lc',   'long',  'call',  'Long Call'), L('rev_sp',  'short', 'put',  'Short Put')] },
};

type StrategyType = keyof typeof STRATEGIES;

function formatOptionTicker(symbol: string, expiration: string, right: OptionRight, strike: number): string {
  const exp = expiration ? expiration.replace(/-/g, '').slice(2) : '------';
  const strikeText = Number(strike).toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1');
  return `${symbol} ${exp}${right === 'call' ? 'C' : 'P'}${strikeText}`;
}

interface TooltipPayloadItem { value: number }
interface TooltipProps { active?: boolean; payload?: TooltipPayloadItem[]; label?: number }

function CustomTooltip({ active, payload, label }: TooltipProps) {
  if (!active || !payload?.[0]) return null;
  const pl = payload[0].value;
  const positive = pl >= 0;
  return (
    <div style={{ background: '#0f0d0e', border: `1px solid ${positive ? '#10b98144' : '#ef444444'}`, borderRadius: 8, padding: '8px 14px', minWidth: 140 }}>
      <div style={{ color: '#64748b', fontSize: 11, marginBottom: 4 }}>
        Underlying: <span style={{ color: '#cbd5e1' }}>${Number(label).toFixed(2)}</span>
      </div>
      <div style={{ color: positive ? '#10b981' : '#ef4444', fontSize: 14, fontWeight: 700, letterSpacing: '0.02em' }}>
        {positive ? '+' : ''}${pl.toFixed(2)}
      </div>
    </div>
  );
}

export default function OptionsCalculatorPage() {
  const { symbol } = useTimeframe();
  const [strategy, setStrategy] = useState<StrategyType>('long_put');
  const [contracts, setContracts] = useState(1);
  const [legExpiration, setLegExpiration] = useState<Record<string, string>>({});
  const [legStrike, setLegStrike] = useState<Record<string, string>>({});

  const handleStrategyChange = (next: StrategyType) => {
    setStrategy(next);
    setLegExpiration({});
    setLegStrike({});
  };

  const { data: quoteData } = useMarketQuote(symbol, 3000);
  const { data: maxPainData, error: chainError } = useApiData<MaxPainCurrentResponse>(
    `/api/max-pain/current?symbol=${symbol}&strike_limit=500`,
    { refreshInterval: 30000 }
  );

  const strategyConfig = STRATEGIES[strategy];
  const allLegs = strategyConfig.legs;
  const optLegs = allLegs.filter((l) => l.right !== 'stock');

  const today = new Date().toISOString().slice(0, 10);

  const expirationChoices = useMemo(
    () =>
      (maxPainData?.expirations || [])
        .map((exp) => exp.expiration)
        .filter((exp) => exp >= today)
        .sort((a, b) => a.localeCompare(b)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [maxPainData, today]
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

  // Up to 4 option leg hooks (fixed count required by React rules)
  const getOptLegExp = (idx: number) =>
    optLegs[idx] ? (legExpiration[optLegs[idx].id] || expirationChoices[0] || '') : '';
  const getOptLegStrike = (idx: number, exp: string) =>
    optLegs[idx] ? Number(legStrike[optLegs[idx].id] || strikeMapByExpiration[exp]?.[0] || 0) : 0;

  const opt0Exp = getOptLegExp(0);
  const opt0Strike = getOptLegStrike(0, opt0Exp);
  const opt1Exp = getOptLegExp(1);
  const opt1Strike = getOptLegStrike(1, opt1Exp);
  const opt2Exp = getOptLegExp(2);
  const opt2Strike = getOptLegStrike(2, opt2Exp);
  const opt3Exp = getOptLegExp(3);
  const opt3Strike = getOptLegStrike(3, opt3Exp);

  const mkUrl = (idx: number, exp: string, strike: number) => {
    const leg = optLegs[idx];
    if (!leg) return '/api/option/quote';
    return `/api/option/quote?underlying=${symbol}&strike=${strike}&expiration=${exp}&type=${leg.right === 'call' ? 'C' : 'P'}`;
  };

  const { data: quote0 } = useApiData<OptionQuote>(mkUrl(0, opt0Exp, opt0Strike), { refreshInterval: 5000, enabled: !!optLegs[0] && !!opt0Exp && opt0Strike > 0 });
  const { data: quote1 } = useApiData<OptionQuote>(mkUrl(1, opt1Exp, opt1Strike), { refreshInterval: 5000, enabled: !!optLegs[1] && !!opt1Exp && opt1Strike > 0 });
  const { data: quote2 } = useApiData<OptionQuote>(mkUrl(2, opt2Exp, opt2Strike), { refreshInterval: 5000, enabled: !!optLegs[2] && !!opt2Exp && opt2Strike > 0 });
  const { data: quote3 } = useApiData<OptionQuote>(mkUrl(3, opt3Exp, opt3Strike), { refreshInterval: 5000, enabled: !!optLegs[3] && !!opt3Exp && opt3Strike > 0 });

  const spot = Number(quoteData?.close || 0);

  const selectedLegs = useMemo(() => {
    const optQuotes = [quote0, quote1, quote2, quote3];
    let optIdx = 0;
    return allLegs.map((leg) => {
      if (leg.right === 'stock') {
        return { ...leg, expiration: '', strike: spot, ticker: symbol, quotePerContract: 0, quoteSide: '' };
      }
      const idx = optIdx++;
      const expiration = legExpiration[leg.id] || expirationChoices[0] || '';
      const strike = Number(legStrike[leg.id] || strikeMapByExpiration[expiration]?.[0] || 0);
      const quote = optQuotes[idx];
      const bid = Number(quote?.bid ?? 0);
      const ask = Number(quote?.ask ?? 0);
      const quotePerContract = leg.role === 'long' ? (ask > 0 ? ask : 0) : (bid > 0 ? bid : 0);
      return {
        ...leg,
        expiration,
        strike,
        ticker: formatOptionTicker(symbol, expiration, leg.right, strike),
        quotePerContract,
        quoteSide: leg.role === 'long' ? 'ask' : 'bid',
      };
    });
  }, [allLegs, legExpiration, legStrike, expirationChoices, strikeMapByExpiration, quote0, quote1, quote2, quote3, spot, symbol]);

  const totalPosition = selectedLegs.reduce((sum, leg) => {
    const qty = leg.qty ?? 1;
    const signed = leg.role === 'long' ? -1 : 1;
    return sum + signed * leg.quotePerContract * contracts * 100 * qty;
  }, 0);

  const payoffData = useMemo(() => {
    const center = spot || selectedLegs.find((l) => l.strike > 0)?.strike || 500;
    const minP = Math.max(1, center * 0.8);
    const maxP = center * 1.2;
    return Array.from({ length: 81 }).map((_, i) => {
      const S = minP + ((maxP - minP) * i) / 80;
      const oneContractPL = selectedLegs.reduce((sum, leg) => {
        const qty = leg.qty ?? 1;
        let intrinsic: number;
        if (leg.right === 'stock') {
          intrinsic = S - spot;
        } else if (leg.right === 'call') {
          intrinsic = Math.max(S - leg.strike, 0);
        } else {
          intrinsic = Math.max(leg.strike - S, 0);
        }
        const legPL = leg.role === 'long' ? intrinsic - leg.quotePerContract : leg.quotePerContract - intrinsic;
        return sum + legPL * qty;
      }, 0);
      return { price: Number(S.toFixed(2)), pl: Number((oneContractPL * contracts * 100).toFixed(2)) };
    });
  }, [spot, selectedLegs, contracts]);

  const plValues = payoffData.map((d) => d.pl);
  const maxPL = Math.max(...plValues, 0);
  const minPL = Math.min(...plValues, 0);
  const range = maxPL - minPL;
  const zeroOffset = range > 0 ? Math.round((maxPL / range) * 100) : 50;

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Options Calculator</h1>

      <div className="bg-[#423d3f] rounded-lg p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <label className="text-sm text-gray-300">
            Strategy
            <select
              className="ml-2 rounded bg-[#2f2b2c] border border-gray-600 px-2 py-1"
              value={strategy}
              onChange={(e) => handleStrategyChange(e.target.value as StrategyType)}
            >
              {Object.entries(STRATEGIES).map(([key, cfg]) => (
                <option key={key} value={key}>{cfg.label}</option>
              ))}
            </select>
          </label>
          <label className="text-sm text-gray-300">
            Contracts
            <input
              className="ml-2 w-24 rounded bg-[#2f2b2c] border border-gray-600 px-2 py-1"
              type="number" min={1} value={contracts}
              onChange={(e) => setContracts(Math.max(1, Number(e.target.value || 1)))}
            />
          </label>
          <div className="text-sm text-gray-300">
            Underlying: <span className="font-semibold text-white">{symbol} {spot ? `$${spot.toFixed(2)}` : '--'}</span>
          </div>
        </div>

        {chainError && <ErrorMessage message={chainError} />}

        <div className="space-y-3 mb-5">
          {selectedLegs.map((leg) => {
            const legStrikes = strikeMapByExpiration[leg.expiration] || [];
            const isStock = leg.right === 'stock';
            return (
              <div key={leg.id} className="grid grid-cols-1 md:grid-cols-4 gap-3 items-center bg-[#2f2b2c] p-3 rounded">
                <div className="text-sm font-semibold">{leg.label}</div>
                {isStock ? (
                  <div className="col-span-2 text-sm text-gray-400 italic">Underlying share position · spot ${spot > 0 ? spot.toFixed(2) : '--'}</div>
                ) : (
                  <>
                    <label className="text-sm text-gray-300">Exp
                      <select
                        className="ml-2 rounded bg-[#1f1c1d] border border-gray-600 px-2 py-1"
                        value={leg.expiration}
                        onChange={(e) => setLegExpiration((curr) => ({ ...curr, [leg.id]: e.target.value }))}
                      >
                        {expirationChoices.map((exp) => <option key={exp} value={exp}>{exp}</option>)}
                      </select>
                    </label>
                    <label className="text-sm text-gray-300">Strike
                      <select
                        className="ml-2 rounded bg-[#1f1c1d] border border-gray-600 px-2 py-1"
                        value={String(leg.strike)}
                        onChange={(e) => setLegStrike((curr) => ({ ...curr, [leg.id]: e.target.value }))}
                      >
                        {legStrikes.map((strike) => <option key={strike} value={String(strike)}>{strike.toFixed(2)}</option>)}
                      </select>
                    </label>
                  </>
                )}
                {!isStock && (
                  <div className="text-sm text-gray-300">
                    {leg.ticker} · <span className="text-white font-semibold">${leg.quotePerContract.toFixed(2)}</span> {leg.quoteSide}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="text-sm text-gray-300">
          Total position:{' '}
          <span className={`font-semibold ${totalPosition > 0 ? 'text-emerald-400' : totalPosition < 0 ? 'text-red-400' : 'text-white'}`}>
            ${Math.abs(totalPosition).toFixed(2)}
          </span>{' '}
          <span className="text-gray-400">
            ({totalPosition > 0 ? 'credit' : totalPosition < 0 ? 'debit' : 'even'})
          </span>
        </div>
      </div>

      <div className="bg-[#423d3f] rounded-lg p-4">
        <h2 className="text-xl font-semibold mb-3">Profit / Loss at Expiration</h2>
        <ResponsiveContainer width="100%" height={420}>
          <AreaChart data={payoffData} margin={{ left: 10, right: 24, top: 32, bottom: 10 }}>
            <defs>
              <linearGradient id="plFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity={0.35} />
                <stop offset={`${zeroOffset}%`} stopColor="#10b981" stopOpacity={0.04} />
                <stop offset={`${zeroOffset}%`} stopColor="#ef4444" stopOpacity={0.04} />
                <stop offset="100%" stopColor="#ef4444" stopOpacity={0.35} />
              </linearGradient>
              <linearGradient id="plStroke" x1="0" y1="0" x2="0" y2="1">
                <stop offset={`${zeroOffset}%`} stopColor="#10b981" />
                <stop offset={`${zeroOffset}%`} stopColor="#ef4444" />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#3f3a3c" />
            <XAxis
              dataKey="price"
              tick={{ fontSize: 11, fill: '#94a3b8' }}
              tickLine={false}
              axisLine={{ stroke: '#3f3a3c' }}
              tickFormatter={(v) => `$${Number(v).toFixed(0)}`}
            />
            <YAxis
              tick={{ fontSize: 11, fill: '#94a3b8' }}
              tickLine={false}
              axisLine={{ stroke: '#3f3a3c' }}
              tickFormatter={(v) => `$${Number(v).toFixed(0)}`}
            />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine y={0} stroke="#475569" strokeWidth={1.5} />
            {spot > 0 && (
              <ReferenceLine
                x={spot}
                stroke="#64748b"
                strokeDasharray="5 3"
                label={{
                  value: `Spot $${spot.toFixed(2)}`,
                  position: 'insideTop',
                  dy: -26,
                  fill: '#94a3b8',
                  fontSize: 11,
                  fontWeight: 500,
                }}
              />
            )}
            <Area
              type="monotone"
              dataKey="pl"
              stroke="url(#plStroke)"
              strokeWidth={2.5}
              fill="url(#plFill)"
              dot={false}
              activeDot={{ r: 4, fill: '#f1f5f9', strokeWidth: 0 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
