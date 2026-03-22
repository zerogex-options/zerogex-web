'use client';

import { useMemo, useState } from 'react';
import {
  usePositionOptimizerAccuracy,
  usePositionOptimizerSignal,
  GenericAccuracyPoint,
} from '@/hooks/useApiData';
import { useTimeframe } from '@/core/TimeframeContext';
import LoadingSpinner from '@/components/LoadingSpinner';
import ErrorMessage from '@/components/ErrorMessage';
import MetricCard from '@/components/MetricCard';
import TooltipWrapper from '@/components/TooltipWrapper';
import {
  Bar,
  BarChart,
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
import { CalendarClock, CircleDollarSign, Compass, Lightbulb, ListOrdered, ShieldCheck, Wallet } from 'lucide-react';

function titleCase(value: string) {
  return value
    .split(/[_\s-]+/)
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(' ');
}

function formatCompact(value: number | null | undefined, options?: { currency?: boolean; percent?: boolean }) {
  if (value == null || Number.isNaN(value)) return '—';
  if (options?.percent) return `${value.toFixed(2)}%`;

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

function parseAccuracyRows(payload: GenericAccuracyPoint[] | Record<string, unknown> | null): GenericAccuracyPoint[] {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  for (const value of Object.values(payload)) {
    if (Array.isArray(value)) return value as GenericAccuracyPoint[];
  }
  return [];
}

function inferAccuracyBucket(row: GenericAccuracyPoint) {
  return titleCase(String(row.strength ?? row.bucket ?? row.confidence ?? row.label ?? 'All Signals'));
}

function inferAccuracyRate(row: GenericAccuracyPoint) {
  const raw = row.hit_rate ?? row.win_rate ?? row.accuracy ?? row.rate ?? row.profitability;
  if (raw == null || Number.isNaN(raw)) return 0;
  return Number((raw <= 1 ? raw * 100 : raw).toFixed(1));
}

function inferAccuracySamples(row: GenericAccuracyPoint) {
  return row.total_signals ?? row.samples ?? row.count ?? 0;
}

type IndicatorRow = {
  label: string;
  value: number | null | undefined;
  format: 'currency' | 'number' | 'percent';
  tooltip: string;
  interpretation: string;
};

export default function PositionOptimizerPage() {
  const { symbol } = useTimeframe();
  const [lookbackDays, setLookbackDays] = useState(30);

  const { data: signal, loading: signalLoading, error: signalError, refetch } = usePositionOptimizerSignal(symbol);
  const { data: accuracyPayload, loading: accuracyLoading, error: accuracyError } = usePositionOptimizerAccuracy(symbol, lookbackDays, 60000);

  const accuracyRows = useMemo(() => parseAccuracyRows(accuracyPayload ?? null), [accuracyPayload]);

  const topCandidate = signal?.candidates?.[0] ?? null;

  const componentRadarData = useMemo(() => {
    return (topCandidate?.components || []).map((component) => ({
      subject: component.name,
      scorePct: Math.max(0, Math.min(100, component.raw_score)),
      rawScore: component.raw_score,
      weight: component.weight,
      description: component.description,
      contribution: component.weighted_score,
    }));
  }, [topCandidate]);

  const componentRankings = useMemo(
    () => [...componentRadarData].sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution)),
    [componentRadarData]
  );

  const candidateScoreChart = useMemo(() => {
    return (signal?.candidates || []).slice(0, 5).map((candidate) => ({
      name: `#${candidate.rank} ${titleCase(candidate.strategy_type)}`,
      edgeScore: candidate.edge_score,
      pop: Number((candidate.probability_of_profit * 100).toFixed(1)),
      ev: candidate.expected_value,
    }));
  }, [signal]);

  const accuracyChartData = useMemo(() => {
    return accuracyRows.map((row) => ({
      bucket: inferAccuracyBucket(row),
      hitRate: inferAccuracyRate(row),
      samples: inferAccuracySamples(row),
    }));
  }, [accuracyRows]);

  const indicatorRows: IndicatorRow[] = useMemo(() => {
    if (!signal || !topCandidate) return [];

    return [
      {
        label: 'Top Probability of Profit',
        value: signal.top_probability_of_profit * 100,
        format: 'percent',
        tooltip: 'Calibrated probability that the top-ranked structure finishes profitably.',
        interpretation: 'Use this to judge how forgiving the setup is. Higher POP often pairs well with credit structures or balanced spreads, while lower POP may still be attractive if expected value is high enough.',
      },
      {
        label: 'Top Expected Value',
        value: signal.top_expected_value,
        format: 'currency',
        tooltip: 'Expected dollar value of the best-ranked candidate after combining payoff and probability assumptions.',
        interpretation: 'Expected value is your expectancy anchor. Favor setups where EV remains attractive after accounting for slippage, commissions, and your ability to execute the spread cleanly.',
      },
      {
        label: 'Kelly Fraction',
        value: signal.top_kelly_fraction * 100,
        format: 'percent',
        tooltip: 'Suggested sizing fraction derived from the edge and payoff profile of the top candidate.',
        interpretation: 'Treat Kelly as an upper bound, not a mandate. Most traders should deploy a fraction of Kelly to reduce path volatility and account for model error.',
      },
      {
        label: 'Liquidity Score',
        value: signal.top_liquidity_score,
        format: 'number',
        tooltip: 'Score reflecting how executable the structure should be based on spread quality and market depth.',
        interpretation: 'Good ideas can still be untradeable if liquidity is poor. A lower score means you should expect worse fills, smaller size, or skipped trades altogether.',
      },
      {
        label: 'Sharpe-like Ratio',
        value: signal.top_sharpe_like_ratio,
        format: 'number',
        tooltip: 'Risk-adjusted quality metric for the top-ranked structure.',
        interpretation: 'This helps separate merely profitable ideas from efficient ones. Higher values imply the optimizer sees a better return per unit of modeled risk.',
      },
    ];
  }, [signal, topCandidate]);

  if ((signalLoading && !signal) || (accuracyLoading && !accuracyPayload)) {
    return <LoadingSpinner size="lg" />;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-2">Position Optimizer</h1>
      <p className="text-gray-400 mb-8">Spread-ranking and sizing intelligence for translating directional context into executable options structures.</p>

      {signalError && <ErrorMessage message={signalError} onRetry={refetch} />}
      {accuracyError && <ErrorMessage message={accuracyError} />}

      {signal && (
        <section className="mb-8 grid grid-cols-1 md:grid-cols-4 gap-4">
          <MetricCard title="Direction" value={signal.signal_direction.toUpperCase()} trend={signal.signal_direction} tooltip="Directional bias for the optimized spread set" theme="dark" />
          <MetricCard title="Strength" value={signal.signal_strength.toUpperCase()} tooltip="Signal strength bucket" theme="dark" />
          <MetricCard title="Normalized Score" value={`${(signal.normalized_score * 100).toFixed(1)}%`} tooltip="Composite score normalized by max possible score" theme="dark" />
          <MetricCard title="Top EV" value={formatCompact(signal.top_expected_value, { currency: true })} tooltip="Expected value of the highest-ranked setup" theme="dark" />
        </section>
      )}

      {signal && (
        <section className="mb-8 bg-[#423d3f] rounded-lg border border-gray-700 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
            <h2 className="text-2xl font-semibold flex items-center gap-2"><Lightbulb className="text-amber-400" size={22} /> Recommended Structure</h2>
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-[#302c2d] text-emerald-300 border border-gray-700">
              {titleCase(signal.trade_type)}
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-lg bg-[#302c2d] border border-gray-700 p-4">
              <div className="text-xs uppercase tracking-wide text-gray-400 mb-1 flex items-center gap-1"><Compass size={14} /> Strategy</div>
              <div className="text-lg font-semibold">{titleCase(signal.top_strategy_type)}</div>
            </div>
            <div className="rounded-lg bg-[#302c2d] border border-gray-700 p-4">
              <div className="text-xs uppercase tracking-wide text-gray-400 mb-1 flex items-center gap-1"><CalendarClock size={14} /> Expiry / DTE</div>
              <div className="text-lg font-semibold">{signal.top_expiry} • {signal.top_dte} DTE</div>
            </div>
            <div className="rounded-lg bg-[#302c2d] border border-gray-700 p-4">
              <div className="text-xs uppercase tracking-wide text-gray-400 mb-1 flex items-center gap-1"><CircleDollarSign size={14} /> Max Profit / Loss</div>
              <div className="text-lg font-semibold text-emerald-300">{formatCompact(signal.top_max_profit, { currency: true })} / {formatCompact(signal.top_max_loss, { currency: true })}</div>
            </div>
          </div>
          <div className="mt-4 rounded-lg bg-[#302c2d] border border-gray-700 p-4">
            <div className="text-xs uppercase tracking-wide text-gray-400 mb-1">Strikes</div>
            <div className="font-mono text-base">{signal.top_strikes}</div>
          </div>
          <div className="mt-4 rounded-lg bg-[#302c2d] border border-gray-700 p-4">
            <div className="text-xs uppercase tracking-wide text-gray-400 mb-2">Why the optimizer prefers it</div>
            <ul className="list-disc pl-5 space-y-2 text-sm leading-relaxed text-gray-200">
              {signal.top_reasoning.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {signal && topCandidate && (
        <section className="mb-8 bg-[#423d3f] rounded-lg p-6 border border-gray-700">
          <h2 className="text-2xl font-semibold mb-4">Top Candidate Matrix</h2>
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
                  const formatted = row.format === 'currency'
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
                          <TooltipWrapper text={row.tooltip} inlineInExpanded={false}>
                            <span className="text-gray-400">ⓘ</span>
                          </TooltipWrapper>
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
                      Market Structure Fit
                      <TooltipWrapper text="How well the spread aligns with the current tape, regime, and structural context used by the optimizer." inlineInExpanded={false}>
                        <span className="text-gray-400">ⓘ</span>
                      </TooltipWrapper>
                    </div>
                  </td>
                  <td className="py-3 px-3 text-right font-mono">{formatCompact(signal.top_market_structure_fit)}</td>
                  <td className="py-3 px-3 text-gray-300 leading-relaxed">
                    This measures whether the spread shape matches the environment. When structure fit is high, the strategy mechanics and market regime are working together instead of fighting each other.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="mb-8 bg-[#423d3f] rounded-lg p-6 border border-gray-700">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <h2 className="text-2xl font-semibold flex items-center gap-2"><ShieldCheck size={20} className="text-cyan-300" />Top Candidate Components</h2>
          <div className="text-sm text-gray-400">Endpoint: <span className="font-mono">/api/signals/position-optimizer</span></div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="rounded-lg border border-gray-700 bg-[#302c2d] p-4">
            <h3 className="text-lg font-semibold mb-3">Top Drivers</h3>
            <div className="space-y-3">
              {componentRankings.slice(0, 6).map((row) => (
                <div key={row.subject} className="rounded-lg border border-gray-700 p-3 bg-[#423d3f]">
                  <div className="flex items-start justify-between gap-3 mb-1">
                    <div className="font-semibold">{row.subject}</div>
                    <div className={`text-sm font-semibold ${row.contribution >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
                      {row.contribution >= 0 ? '+' : ''}{row.contribution.toFixed(0)} pts
                    </div>
                  </div>
                  <div className="text-xs text-gray-400 mb-1">Weight: {row.weight}% • Raw score: {row.rawScore}</div>
                  <div className="text-xs text-gray-300 leading-relaxed">{row.description}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="h-80 rounded-lg border border-gray-700 bg-[#302c2d] p-3">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={componentRadarData}>
                <PolarGrid stroke="#64748b" />
                <PolarAngleAxis dataKey="subject" tick={{ fill: '#cbd5e1', fontSize: 12 }} />
                <Radar name="Score" dataKey="scorePct" stroke="#38bdf8" fill="#38bdf8" fillOpacity={0.45} />
                <Tooltip formatter={(value, _name, item) => {
                  const numericValue = typeof value === 'number' ? value : Number(value ?? 0);
                  const subject = item && typeof item.payload === 'object' && item.payload !== null && 'subject' in item.payload
                    ? String((item.payload as { subject?: string }).subject ?? 'Component')
                    : 'Component';
                  return [`${numericValue.toFixed(1)}%`, subject];
                }} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      {signal && (
        <section className="mb-8 bg-[#423d3f] rounded-lg p-6 border border-gray-700">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
            <h2 className="text-2xl font-semibold flex items-center gap-2"><ListOrdered size={20} className="text-amber-300" />Top Ranked Candidates</h2>
            <div className="text-sm text-gray-400">Highest edge-score spreads for {signal.symbol}</div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="h-80 rounded-lg border border-gray-700 bg-[#302c2d] p-3">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={candidateScoreChart} layout="vertical" margin={{ left: 24, right: 12, top: 8, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#555" />
                  <XAxis type="number" stroke="#ccc" />
                  <YAxis type="category" dataKey="name" stroke="#ccc" width={140} />
                  <Tooltip formatter={(value, name) => [value, name === 'edgeScore' ? 'Edge Score' : name === 'pop' ? 'POP' : 'EV']} />
                  <Bar dataKey="edgeScore" fill="#f59e0b" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-3">
              {(signal.candidates || []).slice(0, 3).map((candidate) => (
                <div key={`${candidate.rank}-${candidate.strategy_type}-${candidate.strikes}`} className="rounded-lg border border-gray-700 p-4 bg-[#302c2d]">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <div className="text-sm text-amber-300 font-semibold">Rank #{candidate.rank}</div>
                      <div className="text-lg font-semibold">{titleCase(candidate.strategy_type)}</div>
                    </div>
                    <div className="text-right text-sm text-gray-300">Edge score<br /><span className="text-lg font-semibold text-slate-100">{candidate.edge_score.toFixed(1)}</span></div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-lg bg-[#423d3f] border border-gray-700 p-3"><div className="text-xs text-gray-400 mb-1">Strikes</div><div className="font-mono">{candidate.strikes}</div></div>
                    <div className="rounded-lg bg-[#423d3f] border border-gray-700 p-3"><div className="text-xs text-gray-400 mb-1">POP</div><div>{(candidate.probability_of_profit * 100).toFixed(1)}%</div></div>
                    <div className="rounded-lg bg-[#423d3f] border border-gray-700 p-3"><div className="text-xs text-gray-400 mb-1">Expected Value</div><div>{formatCompact(candidate.expected_value, { currency: true })}</div></div>
                    <div className="rounded-lg bg-[#423d3f] border border-gray-700 p-3"><div className="text-xs text-gray-400 mb-1">Kelly Fraction</div><div>{(candidate.kelly_fraction * 100).toFixed(1)}%</div></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          {topCandidate?.sizing_profiles?.length ? (
            <div className="mt-6 rounded-lg border border-gray-700 bg-[#302c2d] p-4">
              <h3 className="text-lg font-semibold mb-3 flex items-center gap-2"><Wallet size={18} className="text-emerald-300" /> Suggested Sizing Profiles</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {topCandidate.sizing_profiles.map((profile) => (
                  <div key={profile.profile} className="rounded-lg border border-gray-700 bg-[#423d3f] p-4">
                    <div className="text-sm font-semibold mb-2">{titleCase(profile.profile)}</div>
                    <div className="text-sm text-gray-300 space-y-1">
                      <div>Contracts: <span className="font-semibold text-slate-100">{profile.contracts}</span></div>
                      <div>Max risk: <span className="font-semibold text-slate-100">{formatCompact(profile.max_risk_dollars, { currency: true })}</span></div>
                      <div>Expected value: <span className="font-semibold text-slate-100">{formatCompact(profile.expected_value_dollars, { currency: true })}</span></div>
                      <div>Constraint: <span className="font-semibold text-slate-100">{titleCase(profile.constrained_by)}</span></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </section>
      )}

      <section className="mb-8 bg-[#423d3f] rounded-lg p-6 border border-gray-700">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <h2 className="text-2xl font-semibold">Historical Accuracy</h2>
          <label className="text-sm text-gray-300">
            Lookback Days:
            <select className="ml-2 bg-[#302c2d] border border-gray-700 rounded px-2 py-1" value={lookbackDays} onChange={(e) => setLookbackDays(Number(e.target.value))}>
              <option value={14}>14</option>
              <option value={30}>30</option>
              <option value={60}>60</option>
              <option value={90}>90</option>
            </select>
          </label>
        </div>
        <div className="text-sm text-gray-400 mb-4">Accuracy endpoint: <span className="font-mono">/api/signals/position-optimizer/accuracy</span></div>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={accuracyChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#555" />
              <XAxis dataKey="bucket" stroke="#ccc" />
              <YAxis stroke="#ccc" domain={[0, 100]} unit="%" />
              <Tooltip formatter={(value, _name, item) => {
                const numericValue = typeof value === 'number' ? value : Number(value ?? 0);
                const sampleCount = item && typeof item.payload === 'object' && item.payload !== null && 'samples' in item.payload
                  ? Number((item.payload as { samples?: number }).samples ?? 0)
                  : 0;
                return [`${numericValue.toFixed(1)}%`, `${sampleCount} samples`];
              }} />
              <Line type="monotone" dataKey="hitRate" stroke="#34d399" strokeWidth={3} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>
    </div>
  );
}
