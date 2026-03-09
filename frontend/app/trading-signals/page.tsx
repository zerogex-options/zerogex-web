'use client';

import { useMemo, useState } from 'react';
import {
  useSignalAccuracy,
  useTradeSignal,
  SignalAccuracyPoint,
  SignalTimeframe,
} from '@/hooks/useApiData';
import { useTimeframe } from '@/core/TimeframeContext';
import LoadingSpinner from '@/components/LoadingSpinner';
import ErrorMessage from '@/components/ErrorMessage';
import MetricCard from '@/components/MetricCard';
import TooltipWrapper from '@/components/TooltipWrapper';
import {
  CartesianGrid,
  Line,
  LineChart,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { BadgeCheck, CalendarClock, CircleDollarSign, Compass, Lightbulb, ShieldCheck, TrendingDown, TrendingUp } from 'lucide-react';

const timeframeLabels: Record<SignalTimeframe, string> = {
  intraday: 'Intraday',
  swing: 'Swing',
  multi_day: 'Multi-Day',
};

function parseAccuracyRows(payload: SignalAccuracyPoint[] | Record<string, unknown> | null): SignalAccuracyPoint[] {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;

  for (const value of Object.values(payload)) {
    if (Array.isArray(value)) return value as SignalAccuracyPoint[];
  }

  return [];
}

function titleCase(value: string) {
  return value
    .split('_')
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(' ');
}

function formatCompact(value: number | null | undefined, options?: { currency?: boolean; percent?: boolean }) {
  if (value == null || Number.isNaN(value)) return '—';

  if (options?.percent) {
    return `${value.toFixed(2)}%`;
  }

  const abs = Math.abs(value);
  let suffix = '';
  let scaled = value;

  if (abs >= 1_000_000_000) {
    scaled = value / 1_000_000_000;
    suffix = 'B';
  } else if (abs >= 1_000_000) {
    scaled = value / 1_000_000;
    suffix = 'M';
  } else if (abs >= 1_000) {
    scaled = value / 1_000;
    suffix = 'K';
  }

  const num = suffix ? scaled.toFixed(2) : value.toLocaleString(undefined, { maximumFractionDigits: 3 });
  return `${options?.currency ? '$' : ''}${num}${suffix}`;
}

type IndicatorRow = {
  label: string;
  value: number | null | undefined;
  format: 'currency' | 'number' | 'percent';
  tooltip: string;
  interpretation: string;
};

export default function TradingSignalsPage() {
  const { symbol, timeframe } = useTimeframe();
  const [lookbackDays, setLookbackDays] = useState(30);

  const signalTimeframe: SignalTimeframe = useMemo(() => {
    if (timeframe === '1min' || timeframe === '5min') return 'intraday';
    if (timeframe === '15min' || timeframe === '1hr') return 'swing';
    return 'multi_day';
  }, [timeframe]);

  const { data: signal, loading: signalLoading, error: signalError, refetch } = useTradeSignal(symbol, signalTimeframe);
  const { data: accuracyPayload, loading: accuracyLoading, error: accuracyError } = useSignalAccuracy(symbol, lookbackDays, 60000);

  const accuracyRows = useMemo(() => parseAccuracyRows(accuracyPayload ?? null), [accuracyPayload]);

  const componentRadarData = useMemo(() => {
    return (signal?.components || []).map((component) => ({
      subject: component.name,
      scorePct: Math.max(0, Math.min(100, ((component.score + 100) / 200) * 100)),
      rawScore: component.score,
      weight: component.weight,
      applicable: component.applicable !== false,
      description: component.description,
      contribution: component.score * component.weight,
    }));
  }, [signal]);

  const componentRankings = useMemo(
    () => [...componentRadarData].sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution)),
    [componentRadarData]
  );

  const accuracyChartData = useMemo(() => {
    return accuracyRows
      .filter((row) => row.timeframe === signalTimeframe)
      .map((row) => ({
        bucket: titleCase(row.strength),
        winRate: Number((row.win_rate * 100).toFixed(1)),
        samples: row.total_signals,
      }));
  }, [accuracyRows, signalTimeframe]);

  const indicatorRows: IndicatorRow[] = useMemo(() => {
    if (!signal) return [];

    return [
      {
        label: 'Net GEX',
        value: signal.net_gex,
        format: 'currency',
        tooltip: 'Aggregate net gamma exposure from dealer positioning. Positive values often imply stabilizing hedging flows; negative values can amplify volatility.',
        interpretation:
          'Use this as your market-regime anchor. Strongly positive Net GEX often supports mean-reversion and tighter ranges, while negative Net GEX favors momentum and larger intraday swings. Scale position size and stop width to regime.',
      },
      {
        label: 'Gamma Flip',
        value: signal.gamma_flip,
        format: 'currency',
        tooltip: 'Price zone where net gamma transitions sign and dealer hedging behavior can change materially.',
        interpretation:
          'Treat Gamma Flip as a volatility pivot. If price is above flip and holding, trend continuation can be cleaner; below flip, expect whippier tape. Around flip, reduce conviction and wait for confirmation before pressing size.',
      },
      {
        label: 'VWAP Deviation',
        value: signal.vwap_deviation_pct,
        format: 'percent',
        tooltip: 'Distance of current price from intraday VWAP in percentage terms.',
        interpretation:
          'Large positive/negative deviations indicate stretch. In positive gamma regimes, extreme deviation tends to mean-revert faster. In negative gamma regimes, extreme deviation can persist—so require stronger confirmation before fading.',
      },
      {
        label: 'Put/Call Ratio',
        value: signal.put_call_ratio,
        format: 'number',
        tooltip: 'Relative demand for puts versus calls from recent options flow.',
        interpretation:
          'Rising put/call ratio reflects defensive or bearish hedging demand. Combine with price action: if ratio rises while price holds up, downside hedging may be absorbed; if ratio rises and price weakens, downside continuation risk increases.',
      },
      {
        label: 'Dealer Net Delta',
        value: signal.dealer_net_delta,
        format: 'number',
        tooltip: 'Estimated aggregate dealer delta imbalance requiring hedging adjustments.',
        interpretation:
          'Higher absolute dealer delta imbalance can mechanically drive hedging flows into key levels. Use it to anticipate acceleration through levels (chase breakouts) versus hedging dampeners (favor pullback entries).',
      },
    ];
  }, [signal]);

  if ((signalLoading && !signal) || (accuracyLoading && !accuracyPayload)) {
    return <LoadingSpinner size="lg" />;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-2">Trading Signals</h1>
      <p className="text-gray-400 mb-8">Actionable options trade signals powered by composite analytics.</p>

      {signalError && <ErrorMessage message={signalError} onRetry={refetch} />}
      {accuracyError && <ErrorMessage message={accuracyError} />}

      {signal && (
        <section className="mb-8 grid grid-cols-1 md:grid-cols-4 gap-4">
          <MetricCard title="Direction" value={signal.direction.toUpperCase()} trend={signal.direction} tooltip="Model signal direction" theme="dark" />
          <MetricCard title="Strength" value={signal.strength.toUpperCase()} tooltip="Signal confidence bucket" theme="dark" />
          <MetricCard title="Signal Score" value={`${(signal.normalized_score * 100).toFixed(1)}%`} tooltip="Composite score normalized by max possible score" theme="dark" />
          <MetricCard title="Estimated Win Rate" value={`${(signal.estimated_win_pct * 100).toFixed(1)}%`} tooltip="Calibrated expected win percentage" theme="dark" />
        </section>
      )}

      {signal?.trade_idea && (
        <section className="mb-8 rounded-2xl border border-slate-700 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
            <h2 className="text-2xl font-semibold flex items-center gap-2"><Lightbulb className="text-amber-400" size={22} /> Suggested Trade Idea</h2>
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-900/50 text-emerald-300 border border-emerald-700/60">
              {timeframeLabels[signalTimeframe]} Setup
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-xl bg-black/20 border border-slate-700 p-4">
              <div className="text-xs uppercase tracking-wide text-slate-400 mb-1 flex items-center gap-1"><Compass size={14} /> Strategy</div>
              <div className="text-lg font-semibold">{titleCase(signal.trade_idea.trade_type)}</div>
            </div>
            <div className="rounded-xl bg-black/20 border border-slate-700 p-4">
              <div className="text-xs uppercase tracking-wide text-slate-400 mb-1 flex items-center gap-1"><CalendarClock size={14} /> Target Expiry</div>
              <div className="text-lg font-semibold">{signal.trade_idea.target_expiry}</div>
            </div>
            <div className="rounded-xl bg-black/20 border border-slate-700 p-4">
              <div className="text-xs uppercase tracking-wide text-slate-400 mb-1 flex items-center gap-1"><CircleDollarSign size={14} /> Est. Win %</div>
              <div className="text-lg font-semibold text-emerald-300">{(signal.trade_idea.estimated_win_pct * 100).toFixed(1)}%</div>
            </div>
          </div>
          <div className="mt-4 rounded-xl bg-black/20 border border-slate-700 p-4">
            <div className="text-xs uppercase tracking-wide text-slate-400 mb-1">Suggested Strikes</div>
            <div className="font-mono text-base text-slate-100">{signal.trade_idea.suggested_strikes}</div>
          </div>
          <div className="mt-4 rounded-xl bg-black/20 border border-slate-700 p-4">
            <div className="text-xs uppercase tracking-wide text-slate-400 mb-1">Why this setup</div>
            <div className="text-sm leading-relaxed text-slate-200">{signal.trade_idea.rationale}</div>
          </div>
        </section>
      )}

      <section className="mb-8 bg-[#423d3f] rounded-lg p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <h2 className="text-2xl font-semibold flex items-center gap-2"><ShieldCheck size={20} className="text-cyan-300" />Signal Components</h2>
          <div className="text-sm text-gray-400">Timeframe: {timeframeLabels[signalTimeframe]}</div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-80 rounded-xl border border-slate-700 bg-black/20 p-3">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={componentRadarData}>
                <PolarGrid stroke="#64748b" />
                <PolarAngleAxis dataKey="subject" tick={{ fill: '#cbd5e1', fontSize: 12 }} />
                <Radar name="Score" dataKey="scorePct" stroke="#38bdf8" fill="#38bdf8" fillOpacity={0.45} />
                <Tooltip formatter={(value: number, _name, payload) => [`${value.toFixed(1)}%`, payload?.payload?.subject || 'Component']} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
          <div className="rounded-xl border border-slate-700 bg-black/20 p-4">
            <h3 className="text-lg font-semibold mb-3">Top Drivers</h3>
            <div className="space-y-3">
              {componentRankings.slice(0, 5).map((row) => (
                <div key={row.subject} className="rounded-lg border border-slate-700 p-3">
                  <div className="flex items-start justify-between gap-3 mb-1">
                    <div className="font-semibold text-slate-100">{row.subject}</div>
                    <div className={`text-sm font-semibold ${row.contribution >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
                      {row.contribution >= 0 ? '+' : ''}{row.contribution.toFixed(0)} pts
                    </div>
                  </div>
                  <div className="text-xs text-slate-400 mb-1">Weight: {row.weight}% • Raw score: {row.rawScore}</div>
                  <div className="text-xs text-slate-300 leading-relaxed">{row.description}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mb-8 bg-[#423d3f] rounded-lg p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <h2 className="text-2xl font-semibold">Historical Accuracy</h2>
          <label className="text-sm text-gray-300">
            Lookback Days:
            <select
              className="ml-2 bg-[#302c2d] border border-gray-700 rounded px-2 py-1"
              value={lookbackDays}
              onChange={(e) => setLookbackDays(Number(e.target.value))}
            >
              <option value={14}>14</option>
              <option value={30}>30</option>
              <option value={60}>60</option>
              <option value={90}>90</option>
            </select>
          </label>
        </div>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={accuracyChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#555" />
              <XAxis dataKey="bucket" stroke="#ccc" />
              <YAxis stroke="#ccc" domain={[0, 100]} unit="%" />
              <Tooltip formatter={(value: number, _name, payload) => [`${value.toFixed(1)}%`, `${payload?.payload?.samples ?? 0} samples`]} />
              <Line type="monotone" dataKey="winRate" stroke="#34d399" strokeWidth={3} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      {signal && (
        <section className="bg-[#423d3f] rounded-lg p-6">
          <h2 className="text-2xl font-semibold mb-4">Live Indicator Matrix</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-700 text-gray-300">
                  <th className="text-left py-2 px-3">Indicator</th>
                  <th className="text-right py-2 px-3">Value</th>
                  <th className="text-left py-2 px-3">Interpretation</th>
                </tr>
              </thead>
              <tbody>
                {indicatorRows.map((row) => {
                  const formatted =
                    row.format === 'currency'
                      ? formatCompact(row.value, { currency: true })
                      : row.format === 'percent'
                        ? formatCompact(row.value, { percent: true })
                        : formatCompact(row.value);
                  const negative = (row.value ?? 0) < 0;

                  return (
                    <tr key={row.label} className="border-b border-gray-800 align-top">
                      <td className="py-3 px-3 font-medium">
                        <div className="flex items-center gap-2">
                          {row.label}
                          <TooltipWrapper text={row.tooltip} inlineInExpanded={false} />
                        </div>
                      </td>
                      <td className={`py-3 px-3 text-right font-mono ${negative ? 'text-red-300' : 'text-slate-100'}`}>{formatted}</td>
                      <td className="py-3 px-3 text-gray-300 leading-relaxed">{row.interpretation}</td>
                    </tr>
                  );
                })}
                <tr className="border-b border-gray-800 align-top">
                  <td className="py-3 px-3 font-medium">
                    <div className="flex items-center gap-2">
                      Unusual Volume
                      <TooltipWrapper text="Detects statistically abnormal volume/flow bursts versus baseline behavior for this symbol and timeframe." inlineInExpanded={false} />
                    </div>
                  </td>
                  <td className="py-3 px-3 text-right">
                    <span className={`inline-flex items-center gap-1 font-semibold ${signal.unusual_volume_detected ? 'text-emerald-300' : 'text-amber-300'}`}>
                      {signal.unusual_volume_detected ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                      {signal.unusual_volume_detected ? 'Detected' : 'Not Detected'}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-gray-300 leading-relaxed">
                    Elevated volume can precede directional expansion and volatility repricing. If unusual volume confirms your directional signal, you can justify more conviction. If it conflicts with your setup, reduce size or wait for cleaner alignment.
                  </td>
                </tr>
                {signal.smart_money_direction && (
                  <tr className="border-b border-gray-800 align-top">
                    <td className="py-3 px-3 font-medium flex items-center gap-2">
                      Smart Money Direction
                      <TooltipWrapper text="Directional classification inferred from unusual large-lot / high-notional options flow." inlineInExpanded={false} />
                    </td>
                    <td className={`py-3 px-3 text-right font-semibold ${signal.smart_money_direction === 'bearish' ? 'text-red-300' : signal.smart_money_direction === 'bullish' ? 'text-emerald-300' : 'text-amber-300'}`}>
                      <div className="inline-flex items-center gap-2">
                        <BadgeCheck size={14} />
                        {titleCase(signal.smart_money_direction)}
                      </div>
                    </td>
                    <td className="py-3 px-3 text-gray-300 leading-relaxed">
                      Use this as a confirmation layer, not a standalone trigger. Alignment between smart-money direction, composite signal direction, and price structure improves trade quality; disagreement suggests chop risk and lower expectancy.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
