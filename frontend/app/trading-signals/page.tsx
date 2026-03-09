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
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const scoreColors: Record<string, string> = {
  bullish: '#10b981',
  bearish: '#ef4444',
  neutral: '#f59e0b',
};

const timeframeLabels: Record<SignalTimeframe, string> = {
  intraday: 'Intraday',
  swing: 'Swing',
  multi_day: 'Multi-Day',
};

function parseAccuracyRows(payload: SignalAccuracyPoint[] | Record<string, unknown> | null): SignalAccuracyPoint[] {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;

  const values = Object.values(payload);
  for (const value of values) {
    if (Array.isArray(value)) {
      return value as SignalAccuracyPoint[];
    }
  }

  return [];
}

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

  const componentChartData = useMemo(() => {
    return (signal?.components || []).map((component) => ({
      name: component.name,
      score: component.score,
      weight: component.weight,
      impact: component.score * component.weight,
      applicable: component.applicable !== false,
    }));
  }, [signal]);

  const accuracyChartData = useMemo(() => {
    return accuracyRows
      .filter((row) => row.timeframe === signalTimeframe)
      .map((row) => ({
        bucket: row.strength,
        winRate: Number((row.win_rate * 100).toFixed(1)),
        samples: row.total_signals,
      }));
  }, [accuracyRows, signalTimeframe]);

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
        <section className="mb-8 bg-[#423d3f] rounded-lg p-6">
          <h2 className="text-2xl font-semibold mb-4">Suggested Trade Idea</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div><span className="text-gray-400">Trade Type:</span> {signal.trade_idea.trade_type}</div>
            <div><span className="text-gray-400">Target Expiry:</span> {signal.trade_idea.target_expiry}</div>
            <div className="md:col-span-2"><span className="text-gray-400">Suggested Strikes:</span> {signal.trade_idea.suggested_strikes}</div>
            <div className="md:col-span-2"><span className="text-gray-400">Rationale:</span> {signal.trade_idea.rationale}</div>
          </div>
        </section>
      )}

      <section className="mb-8 bg-[#423d3f] rounded-lg p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <h2 className="text-2xl font-semibold">Signal Components</h2>
          <div className="text-sm text-gray-400">Timeframe: {timeframeLabels[signalTimeframe]}</div>
        </div>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={componentChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#555" />
              <XAxis dataKey="name" stroke="#ccc" angle={-20} textAnchor="end" height={70} interval={0} />
              <YAxis stroke="#ccc" />
              <Tooltip />
              <Bar dataKey="impact" radius={[6, 6, 0, 0]}>
                {componentChartData.map((entry, idx) => (
                  <Cell key={idx} fill={entry.applicable ? '#60a5fa' : '#6b7280'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
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
              <Tooltip />
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
                {[
                  ['Net GEX', signal.net_gex, 'Dealer positioning pressure'],
                  ['Gamma Flip', signal.gamma_flip, 'Volatility regime pivot'],
                  ['VWAP Deviation %', signal.vwap_deviation_pct, 'Mean reversion extension'],
                  ['Put/Call Ratio', signal.put_call_ratio, 'Sentiment skew'],
                  ['Dealer Net Delta', signal.dealer_net_delta, 'Hedging direction bias'],
                ].map(([label, value, desc]) => (
                  <tr key={String(label)} className="border-b border-gray-800">
                    <td className="py-2 px-3">{label}</td>
                    <td className="py-2 px-3 text-right font-mono">{value == null ? '—' : Number(value).toFixed(3)}</td>
                    <td className="py-2 px-3 text-gray-400">{desc}</td>
                  </tr>
                ))}
                <tr className="border-b border-gray-800">
                  <td className="py-2 px-3">Unusual Volume</td>
                  <td className="py-2 px-3 text-right" style={{ color: signal.unusual_volume_detected ? scoreColors.bullish : scoreColors.neutral }}>
                    {signal.unusual_volume_detected ? 'Detected' : 'Not Detected'}
                  </td>
                  <td className="py-2 px-3 text-gray-400">Large flow anomaly flag</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
