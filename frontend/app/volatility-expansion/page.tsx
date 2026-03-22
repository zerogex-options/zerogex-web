'use client';

import { useMemo, useState } from 'react';
import {
  useVolExpansionAccuracy,
  useVolExpansionSignal,
  GenericAccuracyPoint,
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
import { Activity, ArrowBigDownDash, ArrowBigUpDash, CalendarClock, Crosshair, Gauge, Lightbulb, ShieldCheck, TimerReset } from 'lucide-react';

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

type IndicatorRow = {
  label: string;
  value: number | null | undefined;
  format: 'currency' | 'number' | 'percent';
  tooltip: string;
  interpretation: string;
};

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

export default function VolatilityExpansionPage() {
  const { symbol } = useTimeframe();
  const [lookbackDays, setLookbackDays] = useState(30);

  const { data: signal, loading: signalLoading, error: signalError, refetch } = useVolExpansionSignal(symbol);
  const { data: accuracyPayload, loading: accuracyLoading, error: accuracyError } = useVolExpansionAccuracy(symbol, lookbackDays, 60000);

  const accuracyRows = useMemo(() => parseAccuracyRows(accuracyPayload ?? null), [accuracyPayload]);

  const componentRadarData = useMemo(() => {
    return (signal?.components || []).map((component) => ({
      subject: component.name,
      scorePct: Math.max(0, Math.min(100, (component.raw_score / 100) * 100)),
      rawScore: component.raw_score,
      weight: component.weight,
      description: component.description,
      contribution: component.weighted_score,
    }));
  }, [signal]);

  const componentRankings = useMemo(
    () => [...componentRadarData].sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution)),
    [componentRadarData]
  );

  const accuracyChartData = useMemo(() => {
    return accuracyRows.map((row) => ({
      bucket: inferAccuracyBucket(row),
      hitRate: inferAccuracyRate(row),
      samples: inferAccuracySamples(row),
    }));
  }, [accuracyRows]);

  const indicatorRows: IndicatorRow[] = useMemo(() => {
    if (!signal) return [];

    return [
      {
        label: 'Expected Magnitude',
        value: signal.expected_magnitude_pct,
        format: 'percent',
        tooltip: 'Model-estimated absolute percentage move over the stated time horizon.',
        interpretation: 'This frames the size of the move the model is pricing in. Use it to choose structures that need expansion, such as debit spreads, long premium, or breakout entries that benefit from range extension.',
      },
      {
        label: 'Move Probability',
        value: signal.move_probability != null ? signal.move_probability * 100 : null,
        format: 'percent',
        tooltip: 'Probability that the symbol experiences a meaningful expansion move in the forecast window.',
        interpretation: 'Higher probability means the model sees stronger alignment for an outsized move. Pair this with confidence and catalyst type before sizing up.',
      },
      {
        label: 'Net GEX',
        value: signal.net_gex,
        format: 'currency',
        tooltip: 'Aggregate dealer gamma positioning that can either dampen or amplify realized volatility.',
        interpretation: 'Negative or weak gamma regimes can fuel expansion faster because hedging flows chase price. Strong positive gamma can suppress breakouts unless a catalyst overwhelms positioning.',
      },
      {
        label: 'VWAP Deviation',
        value: signal.vwap_deviation_pct,
        format: 'percent',
        tooltip: 'Distance between current price and VWAP, useful for spotting already-stretched versus coiled setups.',
        interpretation: 'Small deviation with high move probability can indicate a coiled setup before breakout. Large deviation can mean part of the move is already underway, so reward-to-risk may compress.',
      },
      {
        label: 'Hours to Next Expiry',
        value: signal.hours_to_next_expiry,
        format: 'number',
        tooltip: 'Time remaining until the nearest listed expiry becomes the dominant options event.',
        interpretation: 'Short time to expiry can intensify dealer and gamma effects. Expansion setups near expiry often resolve quickly, so entries and exits should be more tactical.',
      },
    ];
  }, [signal]);

  if ((signalLoading && !signal) || (accuracyLoading && !accuracyPayload)) {
    return <LoadingSpinner size="lg" />;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-2">Volatility Expansion</h1>
      <p className="text-gray-400 mb-8">Large-move prediction signals for spotting breakout, squeeze, and expansion regimes before they fully develop.</p>

      {signalError && <ErrorMessage message={signalError} onRetry={refetch} />}
      {accuracyError && <ErrorMessage message={accuracyError} />}

      {signal && (
        <section className="mb-8 grid grid-cols-1 md:grid-cols-4 gap-4">
          <MetricCard title="Expected Direction" value={signal.expected_direction.toUpperCase()} trend={signal.expected_direction === 'up' ? 'bullish' : signal.expected_direction === 'down' ? 'bearish' : 'neutral'} tooltip="Forecast directional bias for the expansion move" theme="dark" />
          <MetricCard title="Confidence" value={signal.confidence.toUpperCase()} tooltip="Confidence bucket for the expansion forecast" theme="dark" />
          <MetricCard title="Move Probability" value={`${(signal.move_probability * 100).toFixed(1)}%`} tooltip="Probability of a meaningful volatility expansion" theme="dark" />
          <MetricCard title="Normalized Score" value={`${(signal.normalized_score * 100).toFixed(1)}%`} tooltip="Composite score normalized by max possible score" theme="dark" />
        </section>
      )}

      {signal && (
        <section className="mb-8 bg-[#423d3f] rounded-lg border border-gray-700 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
            <h2 className="text-2xl font-semibold flex items-center gap-2"><Lightbulb className="text-amber-400" size={22} /> Expansion Playbook</h2>
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-[#302c2d] text-cyan-300 border border-gray-700">
              {titleCase(signal.strategy_type)}
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-lg bg-[#302c2d] border border-gray-700 p-4">
              <div className="text-xs uppercase tracking-wide text-gray-400 mb-1 flex items-center gap-1"><Activity size={14} /> Catalyst</div>
              <div className="text-lg font-semibold">{titleCase(signal.catalyst_type)}</div>
            </div>
            <div className="rounded-lg bg-[#302c2d] border border-gray-700 p-4">
              <div className="text-xs uppercase tracking-wide text-gray-400 mb-1 flex items-center gap-1"><TimerReset size={14} /> Time Horizon</div>
              <div className="text-lg font-semibold">{titleCase(signal.time_horizon)}</div>
            </div>
            <div className="rounded-lg bg-[#302c2d] border border-gray-700 p-4">
              <div className="text-xs uppercase tracking-wide text-gray-400 mb-1 flex items-center gap-1"><Gauge size={14} /> Expected Magnitude</div>
              <div className="text-lg font-semibold text-emerald-300">{signal.expected_magnitude_pct.toFixed(2)}%</div>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div className="rounded-lg bg-[#302c2d] border border-gray-700 p-4">
              <div className="text-xs uppercase tracking-wide text-gray-400 mb-1 flex items-center gap-1"><CalendarClock size={14} /> Entry Window</div>
              <div className="text-base font-semibold">{signal.entry_window ?? 'Monitor continuously; no fixed window provided.'}</div>
            </div>
            <div className="rounded-lg bg-[#302c2d] border border-gray-700 p-4">
              <div className="text-xs uppercase tracking-wide text-gray-400 mb-1 flex items-center gap-1"><Crosshair size={14} /> Suggested Structure</div>
              <div className="text-base font-semibold">{titleCase(signal.strategy_type)}</div>
            </div>
          </div>
        </section>
      )}

      {signal && (
        <section className="mb-8 bg-[#423d3f] rounded-lg p-6 border border-gray-700">
          <h2 className="text-2xl font-semibold mb-4">Live Expansion Matrix</h2>
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
                {signal.smart_money_direction && (
                  <tr className="border-b border-gray-800 align-top">
                    <td className="py-3 px-3 font-medium">
                      <div className="flex items-center gap-2">
                        Smart Money Direction
                        <TooltipWrapper text="Directional classification inferred from unusual large-lot and high-notional options activity." inlineInExpanded={false}>
                          <span className="text-gray-400">ⓘ</span>
                        </TooltipWrapper>
                      </div>
                    </td>
                    <td className={`py-3 px-3 text-right font-semibold ${signal.smart_money_direction === 'down' ? 'text-red-300' : signal.smart_money_direction === 'up' ? 'text-emerald-300' : 'text-amber-300'}`}>
                      <div className="inline-flex items-center gap-2">
                        {signal.smart_money_direction === 'down' ? <ArrowBigDownDash size={14} /> : <ArrowBigUpDash size={14} />}
                        {titleCase(signal.smart_money_direction)}
                      </div>
                    </td>
                    <td className="py-3 px-3 text-gray-300 leading-relaxed">
                      When smart money direction aligns with the expected expansion direction, breakout continuation odds usually improve. When it conflicts, treat the setup as lower quality or require cleaner price confirmation.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="mb-8 bg-[#423d3f] rounded-lg p-6 border border-gray-700">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <h2 className="text-2xl font-semibold flex items-center gap-2"><ShieldCheck size={20} className="text-cyan-300" />Signal Components</h2>
          <div className="text-sm text-gray-400">Endpoint: <span className="font-mono">/api/signals/vol-expansion</span></div>
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
        <div className="text-sm text-gray-400 mb-4">Accuracy endpoint: <span className="font-mono">/api/signals/vol-expansion/accuracy</span></div>
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
