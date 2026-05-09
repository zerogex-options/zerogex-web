'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Area, AreaChart, CartesianGrid, ReferenceLine,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { Minus, Plus } from 'lucide-react';
import MobileScrollableChart from '@/components/MobileScrollableChart';
import { useApiData, useMarketQuote } from '@/hooks/useApiData';
import { useTimeframe } from '@/core/TimeframeContext';
import {
  buildOptionChainUrl,
  getCachedOptionChain,
  setCachedOptionChain,
  type MaxPainCurrentResponse,
} from '@/core/optionChainCache';
import ErrorMessage from '@/components/ErrorMessage';
import LoadingSpinner from '@/components/LoadingSpinner';

type XAxisMode = 'percent' | 'dollar';

// Default visible range is ±5% of spot. Each zoom level shrinks/grows by 25%
// on the x-axis (and lets the y-axis auto-fit to the visible data, so the
// effective y-range tracks). Cap zoom so we don't accidentally render an
// empty range or pull a worthless 100%-wide curve.
const BASE_X_RANGE_PCT = 0.05;
const ZOOM_STEP = 0.75;
const MIN_ZOOM = -4; // 0.05 * 0.75^-4 ≈ 0.158, so ±15.8% spot
const MAX_ZOOM = 8;  // 0.05 * 0.75^8  ≈ 0.005, so ±0.5% spot

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

// MaxPainCurrentResponse + related types now live in core/optionChainCache
// alongside the module-scope cache and the prewarm helper.

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

function fmtDollar(v: number, decimals = 2): string {
  const sign = v < 0 ? '-' : '';
  return sign + '$' + Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function niceStep(rawStep: number): number {
  if (!Number.isFinite(rawStep) || rawStep <= 0) return 1;
  const mag = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const n = rawStep / mag;
  if (n < 1.5) return mag;
  if (n < 3.5) return 2 * mag;
  if (n < 7.5) return 5 * mag;
  return 10 * mag;
}

interface TooltipPayloadItem { value: number }
interface TooltipProps {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: number;
  spot?: number;
}

// Returns the smart default expiration for a leg.
// Legs whose label contains "(far…)" get the 2nd available expiration (calendar/diagonal spreads).
function smartDefaultExp(label: string, expirationChoices: string[]): string {
  if (expirationChoices.length === 0) return '';
  const match = label.match(/\(([^)]+)\)/);
  const hint = match ? match[1].toLowerCase() : '';
  if (hint.includes('far') && expirationChoices.length > 1) return expirationChoices[1];
  return expirationChoices[0];
}

// Returns the smart default strike for a leg by reading the parenthetical hint in the label.
// Mapping: lowest→0%, lower→25%, atm/middle→closest to spot, otm lower→20%,
//          otm upper/higher→80%, otm (call)→65% (put)→35%, upper/higher→75%, highest→100%.
// No hint (single-leg) → closest to spot / middle of list.
function smartDefaultStrike(label: string, right: OptionRight, strikes: number[], spot: number): number {
  if (strikes.length === 0) return 0;
  const match = label.match(/\(([^)]+)\)/);
  const hint = match ? match[1].toLowerCase() : '';
  const pick = (pct: number) =>
    strikes[Math.max(0, Math.min(strikes.length - 1, Math.round(pct * (strikes.length - 1))))];
  const atm = () =>
    spot > 0 ? strikes.reduce((p, c) => (Math.abs(c - spot) < Math.abs(p - spot) ? c : p)) : pick(0.5);
  if (hint.includes('lowest')) return pick(0);
  if (hint.includes('highest')) return pick(1);
  if (hint.includes('atm') || hint.includes('middle')) return atm();
  if (hint.includes('otm') && (hint.includes('lower') || hint.includes('low'))) return pick(0.2);
  if (hint.includes('otm') && (hint.includes('upper') || hint.includes('higher'))) return pick(0.8);
  if (hint.includes('otm')) return right === 'call' ? pick(0.65) : pick(0.35);
  if (hint.includes('lower')) return pick(0.25);
  if (hint.includes('upper') || hint.includes('higher')) return pick(0.75);
  // No directional hint → single-leg style: closest to spot (or middle of list)
  return atm();
}

function CustomTooltip({ active, payload, label, spot = 0 }: TooltipProps) {
  if (!active || !payload?.[0]) return null;
  const pl = payload[0].value;
  const positive = pl >= 0;
  const price = Number(label);
  const dollarDelta = spot > 0 ? price - spot : 0;
  const pctDelta = spot > 0 ? ((price - spot) / spot) * 100 : 0;
  const pctSign = pctDelta > 0 ? '+' : pctDelta < 0 ? '' : '';
  const dollarSign = dollarDelta > 0 ? '+' : dollarDelta < 0 ? '-' : '';
  return (
    <div style={{ background: 'var(--color-chart-tooltip-bg)', border: `1px solid ${positive ? 'var(--color-positive)66' : 'var(--color-negative)66'}`, borderRadius: 8, padding: '10px 14px', minWidth: 160 }}>
      <div style={{ color: positive ? 'var(--color-positive)' : 'var(--color-negative)', fontSize: 16, fontWeight: 700, letterSpacing: '0.02em', marginBottom: 6 }}>
        {positive ? '+' : ''}{fmtDollar(pl)}
      </div>
      <div style={{ color: 'var(--color-chart-tooltip-muted)', fontSize: 11, lineHeight: 1.6 }}>
        <div>Spot: <span style={{ color: 'var(--color-chart-tooltip-text)' }}>${price.toFixed(2)}</span></div>
        {spot > 0 && (
          <>
            <div>%Δ: <span style={{ color: 'var(--color-chart-tooltip-text)' }}>{pctSign}{pctDelta.toFixed(2)}%</span></div>
            <div>$Δ: <span style={{ color: 'var(--color-chart-tooltip-text)' }}>{dollarSign}${Math.abs(dollarDelta).toFixed(2)}</span></div>
          </>
        )}
      </div>
    </div>
  );
}

export default function OptionsCalculatorPage() {
  const { symbol } = useTimeframe();
  const [strategy, setStrategy] = useState<StrategyType>('long_put');
  // contracts is held as a string so the input can transiently be empty
  // while the user is editing — clamping to 1 on every keystroke
  // prevents mobile users from clearing the field to overwrite the value.
  const [contractsText, setContractsText] = useState('1');
  const contracts = Math.max(1, Math.floor(Number(contractsText)) || 1);
  const [legExpiration, setLegExpiration] = useState<Record<string, string>>({});
  const [legStrike, setLegStrike] = useState<Record<string, string>>({});
  // Chart view controls (Phase 2). zoomLevel is an integer; positive = zoomed
  // in, negative = zoomed out. Each step shrinks/grows the visible price
  // range by 25%. xAxisMode toggles whether ticks render as %Δ or $Δ from
  // current spot — the data itself is always indexed by absolute price.
  const [zoomLevel, setZoomLevel] = useState(0);
  const [xAxisMode, setXAxisMode] = useState<XAxisMode>('percent');

  const handleStrategyChange = (next: StrategyType) => {
    setStrategy(next);
    setLegExpiration({});
    setLegStrike({});
  };

  const { data: quoteData } = useMarketQuote(symbol, 3000);
  // useApiData wants a path-relative endpoint so it can prepend NEXT_PUBLIC_API_URL,
  // but buildOptionChainUrl in optionChainCache.ts gives us the full absolute URL
  // (the prewarm uses it directly with fetch()). Strip the base back off here so
  // both code paths stay in sync on strike_limit / symbol encoding.
  const fullChainUrl = buildOptionChainUrl(symbol);
  const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
  const chainEndpoint = fullChainUrl.startsWith(apiBase) ? fullChainUrl.slice(apiBase.length) : fullChainUrl;
  const {
    data: maxPainDataRaw,
    error: chainError,
  } = useApiData<MaxPainCurrentResponse>(chainEndpoint, { refreshInterval: 30000 });

  // Hydrate from the shared module-scope cache (also written to by
  // OptionChainPrewarm at app boot) while waiting for the live fetch. Fresh
  // responses go straight back into the cache so symbol toggles and
  // navigation revisits skip the loading state entirely.
  const maxPainData = maxPainDataRaw ?? getCachedOptionChain(symbol);
  useEffect(() => {
    if (maxPainDataRaw) setCachedOptionChain(symbol, maxPainDataRaw);
  }, [maxPainDataRaw, symbol]);

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
    [maxPainData, today]
  );

  // The chain is "ready" once we've actually populated the expiration list.
  // chainLoading flips false the moment useApiData resolves, but if the
  // payload is empty we still want to keep the placeholder up rather than
  // expose blank dropdowns.
  const chainReady = expirationChoices.length > 0;

  const strikeMapByExpiration = useMemo(() => {
    const out: Record<string, number[]> = {};
    (maxPainData?.expirations || []).forEach((exp) => {
      out[exp.expiration] = Array.from(
        new Set((exp.strikes || []).map((row) => Number(row.settlement_price)).filter((n) => Number.isFinite(n) && n > 0))
      ).sort((a, b) => a - b);
    });
    return out;
  }, [maxPainData]);

  const spot = Number(quoteData?.close || 0);

  // Up to 4 option leg hooks (fixed count required by React rules)
  const getOptLegExp = (idx: number) =>
    optLegs[idx] ? (legExpiration[optLegs[idx].id] || smartDefaultExp(optLegs[idx].label, expirationChoices)) : '';
  const getOptLegStrike = (idx: number, exp: string) => {
    if (!optLegs[idx]) return 0;
    const leg = optLegs[idx];
    if (legStrike[leg.id]) return Number(legStrike[leg.id]);
    return smartDefaultStrike(leg.label, leg.right, strikeMapByExpiration[exp] || [], spot);
  };

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
    return `/api/option/quote?symbol=${encodeURIComponent(symbol)}&underlying=${encodeURIComponent(symbol)}&strike=${strike}&expiration=${exp}&type=${leg.right === 'call' ? 'C' : 'P'}`;
  };

  const { data: quote0 } = useApiData<OptionQuote>(mkUrl(0, opt0Exp, opt0Strike), { refreshInterval: 5000, enabled: !!optLegs[0] && !!opt0Exp && opt0Strike > 0 });
  const { data: quote1 } = useApiData<OptionQuote>(mkUrl(1, opt1Exp, opt1Strike), { refreshInterval: 5000, enabled: !!optLegs[1] && !!opt1Exp && opt1Strike > 0 });
  const { data: quote2 } = useApiData<OptionQuote>(mkUrl(2, opt2Exp, opt2Strike), { refreshInterval: 5000, enabled: !!optLegs[2] && !!opt2Exp && opt2Strike > 0 });
  const { data: quote3 } = useApiData<OptionQuote>(mkUrl(3, opt3Exp, opt3Strike), { refreshInterval: 5000, enabled: !!optLegs[3] && !!opt3Exp && opt3Strike > 0 });

  const selectedLegs = useMemo(() => {
    const optQuotes = [quote0, quote1, quote2, quote3];
    let optIdx = 0;
    return allLegs.map((leg) => {
      if (leg.right === 'stock') {
        return { ...leg, expiration: '', strike: spot, ticker: symbol, quotePerContract: 0, quoteSide: '' };
      }
      const idx = optIdx++;
      const expiration = legExpiration[leg.id] || smartDefaultExp(leg.label, expirationChoices);
      const strikes = strikeMapByExpiration[expiration] || [];
      const strike = legStrike[leg.id]
        ? Number(legStrike[leg.id])
        : smartDefaultStrike(leg.label, leg.right, strikes, spot);
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

  // Visible x-range as a fraction of spot. zoomLevel = 0 means default
  // ±5%; +1 narrows to ±3.75% (25% smaller); -1 widens to ±6.67%, etc.
  // We let the y-axis auto-fit to whatever portion of the curve is visible
  // at the current x-range — this is what "y range tracks the visible
  // data" feels like in practice.
  const xRangePct = useMemo(
    () => BASE_X_RANGE_PCT * Math.pow(ZOOM_STEP, zoomLevel),
    [zoomLevel],
  );

  const payoffData = useMemo(() => {
    const center = spot || selectedLegs.find((l) => l.strike > 0)?.strike || 500;
    const minP = Math.max(1, center * (1 - xRangePct));
    const maxP = center * (1 + xRangePct);
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
  }, [spot, selectedLegs, contracts, xRangePct]);

  // Compute breakevens analytically from the piecewise-linear P/L function.
  // The only kink points are the leg strike prices; the function is linear between them,
  // so linear interpolation between adjacent kinks is exact — and works at any price range.
  const breakevens = useMemo(() => {
    // Skip when no quotes are loaded yet (all premiums are 0 → no real breakeven)
    if (!selectedLegs.some((l) => l.right !== 'stock' && l.quotePerContract > 0)) return [];

    const evalPL = (S: number): number =>
      selectedLegs.reduce((sum, leg) => {
        const qty = leg.qty ?? 1;
        let intrinsic: number;
        if (leg.right === 'stock') intrinsic = S - spot;
        else if (leg.right === 'call') intrinsic = Math.max(S - leg.strike, 0);
        else intrinsic = Math.max(leg.strike - S, 0);
        const legPL = leg.role === 'long' ? intrinsic - leg.quotePerContract : leg.quotePerContract - intrinsic;
        return sum + legPL * qty;
      }, 0);

    const kinks = Array.from(
      new Set(selectedLegs.filter((l) => l.right !== 'stock' && l.strike > 0).map((l) => l.strike))
    ).sort((a, b) => a - b);

    if (kinks.length === 0) return [];

    // Add boundaries well outside the kink range to catch BEs above/below all strikes
    const pad = Math.max((kinks[kinks.length - 1] - kinks[0]) * 0.75, kinks[0] * 0.4, 50);
    const pts = [Math.max(0.01, kinks[0] - pad), ...kinks, kinks[kinks.length - 1] + pad];

    const bps: number[] = [];
    for (let i = 1; i < pts.length; i++) {
      const s0 = pts[i - 1];
      const s1 = pts[i];
      const pl0 = evalPL(s0);
      const pl1 = evalPL(s1);
      if ((pl0 < 0 && pl1 > 0) || (pl0 > 0 && pl1 < 0)) {
        const t = Math.abs(pl0) / (Math.abs(pl0) + Math.abs(pl1));
        bps.push(Number((s0 + t * (s1 - s0)).toFixed(2)));
      }
    }
    return bps;
  }, [selectedLegs, spot]);

  // Detect strategies with legs on different expirations (e.g. calendar/diagonal spreads)
  const hasMultipleExpirations = useMemo(() => {
    const exps = new Set(selectedLegs.filter((l) => l.right !== 'stock').map((l) => l.expiration));
    return exps.size > 1;
  }, [selectedLegs]);

  const plValues = payoffData.map((d) => d.pl);
  const maxPL = Math.max(...plValues, 0);
  const minPL = Math.min(...plValues, 0);
  const range = maxPL - minPL;
  const zeroOffset = range > 0 ? Math.round((maxPL / range) * 100) : 50;

  // Tick positions are always actual prices (the chart's dataKey is `price`),
  // but the spacing/rounding is computed in the chosen display unit so the
  // labels themselves come out as nice round numbers — e.g. "+1.0%" / "-1.0%"
  // in percent mode, or "+$5" / "-$5" in dollar mode — and the spacing
  // tightens automatically as the user zooms in.
  const xTicks = useMemo(() => {
    if (payoffData.length < 2 || spot <= 0) return [] as number[];
    const minX = payoffData[0].price;
    const maxX = payoffData[payoffData.length - 1].price;

    if (xAxisMode === 'percent') {
      const minPct = ((minX - spot) / spot) * 100;
      const maxPct = ((maxX - spot) / spot) * 100;
      const step = niceStep((maxPct - minPct) / 7);
      const start = Math.ceil(minPct / step) * step;
      const ticks: number[] = [];
      for (let pct = start; pct <= maxPct + step * 0.01; pct += step) {
        const price = spot * (1 + pct / 100);
        if (price >= minX && price <= maxX) ticks.push(Number(price.toFixed(4)));
      }
      return ticks;
    }

    const minDelta = minX - spot;
    const maxDelta = maxX - spot;
    const step = niceStep((maxDelta - minDelta) / 7);
    const start = Math.ceil(minDelta / step) * step;
    const ticks: number[] = [];
    for (let d = start; d <= maxDelta + step * 0.01; d += step) {
      const price = spot + d;
      if (price >= minX && price <= maxX) ticks.push(Number(price.toFixed(4)));
    }
    return ticks;
  }, [payoffData, spot, xAxisMode]);

  // The XAxisMode toggle now drives only where the ticks LAND (on round %
  // values or round $ values). The tick label itself is rendered by
  // renderXTick below as a 4-line stack regardless of mode, so we don't need
  // the single-line tickFormatter that used to live here.

  // Linear interpolation of P/L at an arbitrary price within the payoff
  // curve. Tick prices come from xTicks (computed in the chosen unit) and
  // generally don't land exactly on the 81 sample prices we generated, so
  // straight lookup misses; interpolation between the two nearest samples
  // is exact for the piecewise-linear payoff function anyway.
  const plAtPrice = useMemo(() => {
    return (price: number) => {
      if (payoffData.length === 0) return 0;
      if (price <= payoffData[0].price) return payoffData[0].pl;
      if (price >= payoffData[payoffData.length - 1].price) return payoffData[payoffData.length - 1].pl;
      let lo = payoffData[0];
      let hi = payoffData[payoffData.length - 1];
      for (let i = 1; i < payoffData.length; i++) {
        if (payoffData[i].price >= price) {
          lo = payoffData[i - 1];
          hi = payoffData[i];
          break;
        }
      }
      if (lo.price === hi.price) return lo.pl;
      const t = (price - lo.price) / (hi.price - lo.price);
      return lo.pl + t * (hi.pl - lo.pl);
    };
  }, [payoffData]);

  const fmtCompactDollar = (v: number): string => {
    const sign = v < 0 ? '-' : v > 0 ? '+' : '';
    const abs = Math.abs(v);
    if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
    if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(abs >= 10_000 ? 0 : 1)}k`;
    return `${sign}$${abs.toFixed(0)}`;
  };

  // Per-tick stacked label: P/L (color-coded) and spot price stacked on top,
  // then the actual x-axis tick label at the bottom in whichever unit the
  // user toggled — %Δ or $Δ — anchored centered on the gridline x so the
  // bottom row visually IS the x-axis label rather than a separate annotation.
  // Hover tooltip is unchanged and still useful for prices between ticks.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const renderXTick = (props: any) => {
    const x = Number(props?.x ?? 0);
    const y = Number(props?.y ?? 0);
    const price = Number(props?.payload?.value ?? 0);
    const pl = plAtPrice(price);
    const positive = pl >= 0;
    const dollarDelta = spot > 0 ? price - spot : 0;
    const pctDelta = spot > 0 ? ((price - spot) / spot) * 100 : 0;
    const trim = (s: string) => s.replace(/\.?0+$/, '');
    const axisLabel = (() => {
      if (spot <= 0) return `$${price.toFixed(2)}`;
      if (xAxisMode === 'percent') {
        const sign = pctDelta > 0 ? '+' : '';
        const txt = Math.abs(pctDelta) < 1 ? trim(pctDelta.toFixed(2)) : trim(pctDelta.toFixed(1));
        return `${sign}${txt}%`;
      }
      const sign = dollarDelta > 0 ? '+' : dollarDelta < 0 ? '-' : '';
      const abs = Math.abs(dollarDelta);
      const txt = abs >= 1 ? abs.toFixed(0) : trim(abs.toFixed(2));
      return `${sign}$${txt}`;
    })();
    return (
      <g transform={`translate(${x},${y})`}>
        <text x={0} dy={12} textAnchor="middle" fill={positive ? 'var(--color-positive)' : 'var(--color-negative)'} fontSize={10} fontWeight={700}>
          {fmtCompactDollar(pl)}
        </text>
        <text x={0} dy={26} textAnchor="middle" fill="var(--color-text-secondary)" fontSize={10}>
          ${price.toFixed(2)}
        </text>
        <text x={0} dy={42} textAnchor="middle" fill="var(--color-text-primary)" fontSize={11} fontWeight={600}>
          {axisLabel}
        </text>
      </g>
    );
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Strategy Builder</h1>

      <div className="bg-[var(--color-surface)] rounded-lg p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <label className="text-sm text-[var(--color-text-secondary)]">
            Strategy
            <select
              className="ml-2 rounded bg-[var(--color-surface-subtle)] border border-[var(--color-border)] px-2 py-1"
              value={strategy}
              onChange={(e) => handleStrategyChange(e.target.value as StrategyType)}
            >
              {Object.entries(STRATEGIES).map(([key, cfg]) => (
                <option key={key} value={key}>{cfg.label}</option>
              ))}
            </select>
          </label>
          <label className="text-sm text-[var(--color-text-secondary)]">
            Contracts
            <input
              className="ml-2 w-24 rounded bg-[var(--color-surface-subtle)] border border-[var(--color-border)] px-2 py-1"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={contractsText}
              onFocus={(e) => e.currentTarget.select()}
              onChange={(e) => setContractsText(e.target.value.replace(/[^0-9]/g, ''))}
              onBlur={() => setContractsText(String(Math.max(1, Math.floor(Number(contractsText)) || 1)))}
            />
          </label>
          <div className="text-sm text-[var(--color-text-secondary)]">
            Underlying: <span className="font-semibold text-[var(--color-text-primary)]">{symbol} {spot ? `$${spot.toFixed(2)}` : '--'}</span>
          </div>
        </div>

        {chainError && <ErrorMessage message={chainError} />}

        {/* While the option chain is still loading on first paint, render a
            placeholder instead of empty <select>s with "------C0" tickers and
            $0.00 quotes — that combination looked broken for the few seconds
            between mount and the first /api/max-pain/current response. Once
            chainReady flips true, the leg pickers populate normally and stay
            populated for subsequent refreshes. */}
        {chainReady ? (
          <>
        <div className="space-y-3 mb-5">
          {selectedLegs.map((leg) => {
            const legStrikes = strikeMapByExpiration[leg.expiration] || [];
            const isStock = leg.right === 'stock';
            return (
              <div key={leg.id} className="grid grid-cols-1 md:grid-cols-4 gap-3 items-center bg-[var(--color-surface-subtle)] p-3 rounded">
                <div className="text-sm font-semibold">{leg.label}</div>
                {isStock ? (
                  <div className="col-span-2 text-sm text-[var(--color-text-secondary)] italic">Underlying share position · spot ${spot > 0 ? spot.toFixed(2) : '--'}</div>
                ) : (
                  <>
                    <label className="text-sm text-[var(--color-text-secondary)]">Exp
                      <select
                        className="ml-2 rounded bg-[var(--color-surface)] border border-[var(--color-border)] px-2 py-1"
                        value={leg.expiration}
                        onChange={(e) => setLegExpiration((curr) => ({ ...curr, [leg.id]: e.target.value }))}
                      >
                        {expirationChoices.map((exp) => <option key={exp} value={exp}>{exp}</option>)}
                      </select>
                    </label>
                    <label className="text-sm text-[var(--color-text-secondary)]">Strike
                      <select
                        className="ml-2 rounded bg-[var(--color-surface)] border border-[var(--color-border)] px-2 py-1"
                        value={String(leg.strike)}
                        onChange={(e) => setLegStrike((curr) => ({ ...curr, [leg.id]: e.target.value }))}
                      >
                        {legStrikes.map((strike) => <option key={strike} value={String(strike)}>{strike.toFixed(2)}</option>)}
                      </select>
                    </label>
                  </>
                )}
                {!isStock && (
                  <div className="text-sm text-[var(--color-text-secondary)]">
                    {leg.ticker} · <span className="text-[var(--color-text-primary)] font-semibold">${leg.quotePerContract.toFixed(2)}</span> {leg.quoteSide}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="text-sm text-[var(--color-text-secondary)]">
          Total position:{' '}
          <span className={`font-semibold ${totalPosition > 0 ? 'text-[var(--color-bull)]' : totalPosition < 0 ? 'text-[var(--color-bear)]' : 'text-[var(--color-text-primary)]'}`}>
            {fmtDollar(Math.abs(totalPosition))}
          </span>{' '}
          <span className="text-[var(--color-text-secondary)]">
            ({totalPosition > 0 ? 'credit' : totalPosition < 0 ? 'debit' : 'even'})
          </span>
        </div>
          </>
        ) : (
          <div className="bg-[var(--color-surface-subtle)] rounded p-8 flex flex-col items-center gap-3 text-sm text-[var(--color-text-secondary)]">
            <LoadingSpinner />
            <div>Loading option chain for {symbol}…</div>
          </div>
        )}
      </div>

      <div className="bg-[var(--color-surface)] rounded-lg p-4">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
          <h2 className="text-xl font-semibold">Profit / Loss at Expiration</h2>
          {chainReady && (
            <div className="flex items-center gap-3 text-xs">
              {/* x-axis $/% toggle */}
              <div
                role="group"
                aria-label="X-axis units"
                className="inline-flex rounded border border-[var(--color-border)] overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => setXAxisMode('percent')}
                  aria-pressed={xAxisMode === 'percent'}
                  className={`px-3 py-1 font-semibold transition-colors ${xAxisMode === 'percent' ? 'bg-[var(--color-brand-primary)] text-[var(--text-inverse)]' : 'bg-[var(--color-surface-subtle)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'}`}
                >
                  %
                </button>
                <button
                  type="button"
                  onClick={() => setXAxisMode('dollar')}
                  aria-pressed={xAxisMode === 'dollar'}
                  className={`px-3 py-1 font-semibold transition-colors ${xAxisMode === 'dollar' ? 'bg-[var(--color-brand-primary)] text-[var(--text-inverse)]' : 'bg-[var(--color-surface-subtle)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'}`}
                >
                  $
                </button>
              </div>
              {/* zoom controls */}
              <div className="inline-flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setZoomLevel((z) => Math.max(MIN_ZOOM, z - 1))}
                  disabled={zoomLevel <= MIN_ZOOM}
                  aria-label="Zoom out"
                  className="rounded border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-1.5 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Minus size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => setZoomLevel(0)}
                  disabled={zoomLevel === 0}
                  className="rounded border border-[var(--color-border)] bg-[var(--color-surface-subtle)] px-2 py-1 text-[10px] font-semibold text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  RESET
                </button>
                <button
                  type="button"
                  onClick={() => setZoomLevel((z) => Math.min(MAX_ZOOM, z + 1))}
                  disabled={zoomLevel >= MAX_ZOOM}
                  aria-label="Zoom in"
                  className="rounded border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-1.5 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Plus size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
        {!chainReady ? (
          <div className="bg-[var(--color-surface-subtle)] rounded p-12 flex flex-col items-center gap-3 text-sm text-[var(--color-text-secondary)]">
            <LoadingSpinner />
            <div>Loading payoff curve…</div>
          </div>
        ) : (
        <>
        {hasMultipleExpirations && (
          <p className="text-xs text-[var(--color-warning)]/80 mb-3">
            ⚠ This strategy has legs with different expirations. The chart shows intrinsic P&amp;L as if all legs expired simultaneously, which underestimates the far-leg&apos;s remaining time value. Use it as a rough guide only.
          </p>
        )}
        <MobileScrollableChart>
        <ResponsiveContainer width="100%" height={420}>
          <AreaChart data={payoffData} margin={{ left: 10, right: 24, top: 32, bottom: 48 }}>
            <defs>
              <linearGradient id="plFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-positive)" stopOpacity={0.35} />
                <stop offset={`${zeroOffset}%`} stopColor="var(--color-positive)" stopOpacity={0.04} />
                <stop offset={`${zeroOffset}%`} stopColor="var(--color-negative)" stopOpacity={0.04} />
                <stop offset="100%" stopColor="var(--color-negative)" stopOpacity={0.35} />
              </linearGradient>
              <linearGradient id="plStroke" x1="0" y1="0" x2="0" y2="1">
                <stop offset={`${zeroOffset}%`} stopColor="var(--color-positive)" />
                <stop offset={`${zeroOffset}%`} stopColor="var(--color-negative)" />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-chart-grid)" />
            <XAxis
              type="number"
              dataKey="price"
              domain={['dataMin', 'dataMax']}
              ticks={xTicks}
              interval={0}
              tick={renderXTick}
              tickLine={false}
              axisLine={{ stroke: 'var(--color-chart-grid)' }}
              height={52}
            />
            <YAxis
              tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }}
              tickLine={false}
              axisLine={{ stroke: 'var(--color-chart-grid)' }}
              tickFormatter={(v) => fmtDollar(Number(v), 0)}
              width={70}
            />
            <Tooltip content={<CustomTooltip spot={spot} />} />
            <ReferenceLine y={0} stroke="var(--color-chart-axis)" strokeWidth={1.5} />
            {spot > 0 && (
              <ReferenceLine
                x={spot}
                stroke="var(--color-border)"
                strokeDasharray="5 3"
                label={{
                  value: `Spot $${spot.toFixed(2)}`,
                  position: 'insideTop',
                  dy: -26,
                  fill: 'var(--color-text-secondary)',
                  fontSize: 11,
                  fontWeight: 500,
                }}
              />
            )}
            {breakevens
              .filter((be) => {
                const minP = payoffData[0]?.price ?? 0;
                const maxP = payoffData[payoffData.length - 1]?.price ?? 0;
                return be >= minP && be <= maxP;
              })
              .map((be) => (
                <ReferenceLine
                  key={`be-${be}`}
                  x={be}
                  stroke="var(--color-brand-primary)"
                  strokeDasharray="5 3"
                  label={{
                    value: `BE $${be.toFixed(2)}`,
                    position: 'insideTop',
                    dy: -12,
                    fill: 'var(--color-primary-400)',
                    fontSize: 11,
                    fontWeight: 500,
                  }}
                />
              ))}
            <Area
              type="monotone"
              dataKey="pl"
              stroke="url(#plStroke)"
              strokeWidth={2.5}
              fill="url(#plFill)"
              dot={false}
              activeDot={{ r: 4, fill: 'var(--color-text-primary)', strokeWidth: 0 }}
            />
          </AreaChart>
        </ResponsiveContainer>
        </MobileScrollableChart>
        </>
        )}
      </div>
    </div>
  );
}
