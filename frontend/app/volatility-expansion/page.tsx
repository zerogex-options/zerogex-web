'use client';

import { useMemo } from 'react';
import {
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import { CircleHelp, Gauge, Sparkles, TrendingUp } from 'lucide-react';
import { useTimeframe } from '@/core/TimeframeContext';
import { useVolExpansionSignal } from '@/hooks/useApiData';
import LoadingSpinner from '@/components/LoadingSpinner';
import ErrorMessage from '@/components/ErrorMessage';
import MetricCard from '@/components/MetricCard';
import { useTheme } from '@/core/ThemeContext';

type GenericObject = Record<string, unknown>;

type ComponentAxis = {
  axis: string;
  score: number;
  description: string;
};

function asObject(value: unknown): GenericObject | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as GenericObject;
}

function getNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const num = Number(value);
    if (Number.isFinite(num)) return num;
  }
  return null;
}

function fmtPercent(value: number | null) {
  if (value == null) return '—';
  const normalized = value <= 1 ? value * 100 : value;
  return `${normalized.toFixed(1)}%`;
}

function normalizeComponentScore(rawScore: number | null) {
  if (rawScore == null) return 50;
  if (Math.abs(rawScore) <= 1) return Math.max(0, Math.min(100, rawScore * 100));
  if (Math.abs(rawScore) <= 10) return Math.max(0, Math.min(100, rawScore * 10));
  return Math.max(0, Math.min(100, rawScore));
}

function interpretation(score: number | null) {
  if (score == null) return 'No reading';
  if (score >= 70) return 'Expansion favored';
  if (score >= 55) return 'Expansion tilt';
  if (score <= 30) return 'Compression favored';
  if (score <= 45) return 'Compression tilt';
  return 'Balanced regime';
}

export default function VolatilityExpansionPage() {
  const { symbol } = useTimeframe();
  const { theme } = useTheme();
  const { data, loading, error, refetch } = useVolExpansionSignal(symbol, 10000);

  const payload = useMemo(() => asObject(data) ?? {}, [data]);
  const components = useMemo(() => {
    const source = payload.components;
    if (Array.isArray(source)) {
      return source.filter((item) => item && typeof item === 'object') as GenericObject[];
    }
    return [];
  }, [payload]);

  const componentRadarData = useMemo<ComponentAxis[]>(() => {
    if (components.length === 0) {
      return [
        { axis: 'Magnitude', score: 50, description: 'No component data' },
        { axis: 'Direction', score: 50, description: 'No component data' },
        { axis: 'Flow', score: 50, description: 'No component data' },
        { axis: 'Structure', score: 50, description: 'No component data' },
        { axis: 'Volatility', score: 50, description: 'No component data' },
      ];
    }

    return components.slice(0, 8).map((component) => ({
      axis: String(component.name ?? 'Component'),
      score: normalizeComponentScore(getNumber(component.raw_score ?? component.score ?? component.weighted_score)),
      description: String(component.description ?? 'Component contribution'),
    }));
  }, [components]);

  const compositeScore = getNumber(payload.composite_score ?? payload.score ?? payload.normalized_score);
  const direction = String(payload.expected_direction ?? payload.direction ?? 'neutral').toLowerCase();
  const moveProbability = getNumber(payload.move_probability ?? payload.probability);
  const expectedMagnitude = getNumber(payload.expected_magnitude_pct ?? payload.magnitude_pct);
  const confidence = String(payload.confidence ?? payload.strength ?? 'n/a').toUpperCase();

  if (loading && !data) return <LoadingSpinner size="lg" />;

  const trend: 'bullish' | 'bearish' | 'neutral' = direction === 'up' || direction === 'bullish'
    ? 'bullish'
    : direction === 'down' || direction === 'bearish'
      ? 'bearish'
      : 'neutral';

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-2">Volatility Expansion</h1>
      <p className="text-[var(--color-text-secondary)] mb-8">
        Breakout regime detection with multi-factor scoring and confidence diagnostics.
      </p>

      {error && <ErrorMessage message={error} onRetry={refetch} />}

      <section className="mb-8 rounded-2xl border border-[var(--color-border)] p-6" style={{ background: theme === 'light' ? '#FFFFFF' : 'var(--color-surface)' }}>
        <div className="flex flex-col lg:flex-row gap-6 justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.14em] text-[var(--color-text-secondary)] mb-2">Expansion Regime Score</div>
            <div className="text-5xl font-black" style={{ color: trend === 'bullish' ? 'var(--color-bull)' : trend === 'bearish' ? 'var(--color-bear)' : 'var(--color-warning)' }}>
              {compositeScore != null ? compositeScore.toFixed(1) : '—'}
            </div>
            <div className="mt-2 text-lg font-semibold">{interpretation(compositeScore)}</div>
            <div className="mt-4 text-sm text-[var(--color-text-secondary)] max-w-xl">
              The model combines directional pressure, volatility context, flow, and structure conditions to estimate whether price is likely to expand into a larger-than-normal move.
            </div>
          </div>
          <div className="w-full lg:w-[450px] h-[320px] rounded-xl border border-[var(--color-border)]" style={{ backgroundColor: theme === 'light' ? '#FFFFFF' : 'var(--color-surface-subtle)' }}>
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={componentRadarData} outerRadius="72%">
                <PolarGrid stroke="var(--color-border)" />
                <PolarAngleAxis dataKey="axis" tick={{ fill: 'var(--color-text-secondary)', fontSize: 12 }} />
                <Radar dataKey="score" stroke="var(--color-warning)" fill="var(--color-warning)" fillOpacity={0.45} />
                <Tooltip
                  contentStyle={{ background: theme === 'light' ? '#FFFFFF' : 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 10 }}
                  formatter={(value, _n, item) => [`${Number(value).toFixed(1)}/100`, String((item.payload as ComponentAxis).description)]}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      <section className="mb-8 grid grid-cols-1 md:grid-cols-4 gap-4">
        <MetricCard title="Expected Direction" value={direction.toUpperCase()} trend={trend} tooltip="Forecast directional bias for expansion." theme="dark" icon={<TrendingUp size={16} />} />
        <MetricCard title="Confidence" value={confidence} tooltip="Model confidence bucket." theme="dark" icon={<Gauge size={16} />} />
        <MetricCard title="Move Probability" value={fmtPercent(moveProbability)} tooltip="Estimated probability of a meaningful expansion." theme="dark" icon={<Sparkles size={16} />} />
        <MetricCard title="Expected Magnitude" value={fmtPercent(expectedMagnitude)} tooltip="Expected magnitude of move over forecast horizon." theme="dark" icon={<CircleHelp size={16} />} />
      </section>

      <section className="mb-8 rounded-2xl border border-[var(--color-border)] p-6" style={{ background: theme === 'light' ? '#FFFFFF' : 'var(--color-surface)' }}>
        <h2 className="text-2xl font-semibold mb-4">What This Rating Means</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div className="rounded-xl border border-[var(--color-border)] p-4" style={{ background: theme === 'light' ? '#FFFFFF' : 'var(--color-surface-subtle)' }}>
            <div className="font-semibold mb-2">Calculation logic</div>
            <ul className="space-y-2 text-[var(--color-text-secondary)]">
              <li>• Component factors are normalized into a common 0–100 scale.</li>
              <li>• Weighted component values roll into a composite expansion score.</li>
              <li>• Composite plus supporting fields determine direction and confidence labels.</li>
              <li>• Probability and expected magnitude provide trade selection context.</li>
            </ul>
          </div>
          <div className="rounded-xl border border-[var(--color-border)] p-4" style={{ background: theme === 'light' ? '#FFFFFF' : 'var(--color-surface-subtle)' }}>
            <div className="font-semibold mb-2">Operational interpretation</div>
            <ul className="space-y-2 text-[var(--color-text-secondary)]">
              <li>• <strong>High score + high probability</strong>: strongest breakout conditions.</li>
              <li>• <strong>High score + low probability</strong>: selective catalyst-driven setups.</li>
              <li>• <strong>Low score</strong>: expansion less likely; favor compression/mean-reversion ideas.</li>
              <li>• <strong>Mid score</strong>: require confirmation before committing size.</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-[var(--color-border)] p-6" style={{ background: theme === 'light' ? '#FFFFFF' : 'var(--color-surface)' }}>
        <h2 className="text-xl font-semibold mb-4">Signal Details</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm mb-6">
          {Object.entries(payload)
            .filter(([key]) => key !== 'components')
            .map(([key, value]) => (
              <div key={key} className="flex justify-between gap-4 border-b border-[var(--color-border)]/50 py-2">
                <span className="text-[var(--color-text-secondary)]">{key}</span>
                <span className="text-right">{typeof value === 'object' ? JSON.stringify(value) : String(value)}</span>
              </div>
            ))}
        </div>

        <h3 className="text-lg font-semibold mb-3">Component Breakdown</h3>
        {components.length === 0 ? (
          <p className="text-[var(--color-text-secondary)]">No component rows returned by the API.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b border-[var(--color-border)]">
                  <th className="py-2 pr-3">Name</th>
                  <th className="py-2 pr-3">Weight</th>
                  <th className="py-2 pr-3">Raw Score</th>
                  <th className="py-2 pr-3">Weighted Score</th>
                  <th className="py-2 pr-3">Description</th>
                </tr>
              </thead>
              <tbody>
                {components.map((row, idx) => (
                  <tr key={idx} className="border-b border-[var(--color-border)]/50">
                    <td className="py-2 pr-3">{String(row.name ?? '—')}</td>
                    <td className="py-2 pr-3">{getNumber(row.weight)?.toFixed(2) ?? '—'}</td>
                    <td className="py-2 pr-3">{getNumber(row.raw_score)?.toFixed(2) ?? '—'}</td>
                    <td className="py-2 pr-3">{getNumber(row.weighted_score)?.toFixed(2) ?? '—'}</td>
                    <td className="py-2 pr-3 text-[var(--color-text-secondary)]">{String(row.description ?? '—')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
