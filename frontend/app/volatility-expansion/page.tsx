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
import TooltipWrapper from '@/components/TooltipWrapper';

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

function normalizeWeightScore(weight: number | null) {
  if (weight == null) return 0;
  if (Math.abs(weight) <= 1) return Math.max(0, Math.min(100, weight * 100));
  return Math.max(0, Math.min(100, weight));
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
  const { data, loading, error, refetch } = useVolExpansionSignal(symbol, 10000);

  const payload = useMemo(() => asObject(data) ?? {}, [data]);
  const components = useMemo(() => {
    const source = payload.components;
    if (Array.isArray(source)) {
      return source.filter((item) => item && typeof item === 'object') as GenericObject[];
    }
    return [];
  }, [payload]);

  const componentTooltipText = useMemo(() => {
    if (components.length === 0) {
      return 'Component breakdown unavailable in the current API payload.';
    }

    return components
      .slice(0, 10)
      .map((component) => {
        const name = String(component.name ?? 'Component');
        const raw = getNumber(component.raw_score ?? component.score);
        const weighted = getNumber(component.weighted_score);
        const desc = String(component.description ?? 'No description');
        return `${name}: raw=${raw != null ? raw.toFixed(2) : '—'}, weighted=${weighted != null ? weighted.toFixed(2) : '—'} — ${desc}`;
      })
      .join(' | ');
  }, [components]);

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
      score: normalizeWeightScore(getNumber(component.weight)),
      description: `${(normalizeWeightScore(getNumber(component.weight))).toFixed(0)}% model weighting`,
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

      <section className="zg-feature-shell mb-8 p-6">
        <div className="flex flex-col lg:flex-row gap-6 justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.14em] text-[var(--color-text-secondary)] mb-2 flex items-center gap-2">
              Expansion Regime Score
              <TooltipWrapper text={componentTooltipText} placement="bottom">
                <span className="text-[var(--color-text-secondary)] cursor-help">ⓘ</span>
              </TooltipWrapper>
            </div>
            <div className="text-5xl font-black" style={{ color: trend === 'bullish' ? 'var(--color-bull)' : trend === 'bearish' ? 'var(--color-bear)' : 'var(--color-warning)' }}>
              {compositeScore != null ? compositeScore.toFixed(1) : '—'}
            </div>
            <div className="mt-2 text-lg font-semibold">{interpretation(compositeScore)}</div>
            <div className="mt-4 text-sm text-[var(--color-text-secondary)] max-w-xl">
              The model combines directional pressure, volatility context, flow, and structure conditions to estimate whether price is likely to expand into a larger-than-normal move.
            </div>
          </div>
          <div className="w-full lg:w-[450px] h-[320px] rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-subtle)]">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={componentRadarData} outerRadius="72%">
                <PolarGrid stroke="var(--color-border)" />
                <PolarAngleAxis dataKey="axis" tick={{ fill: 'var(--color-text-secondary)', fontSize: 12 }} />
                <Radar dataKey="score" stroke="var(--color-warning)" fill="var(--color-warning)" fillOpacity={0.45} />
                <Tooltip
                  contentStyle={{ background: 'var(--color-chart-tooltip-bg)', border: '1px solid var(--color-border)', borderRadius: 8, color: 'var(--color-chart-tooltip-text)' }}
                  formatter={(value, _n, item) => [`${Number(value).toFixed(0)}%`, String((item.payload as ComponentAxis).description)]}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      <section className="zg-feature-shell mb-8 p-6">
        <h2 className="text-2xl font-semibold mb-4">Component Score Breakdown</h2>
        <div className="grid grid-cols-[minmax(140px,1.4fr)_0.8fr_0.8fr_0.8fr] gap-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)] pb-2 border-b border-[var(--color-border)]">
          <span>Component</span>
          <span className="text-right">Weight</span>
          <span className="text-right">Raw Score</span>
          <span className="text-right">Weighted</span>
        </div>
        <div className="divide-y divide-[var(--color-border)]">
          {components.map((component, idx) => {
            const name = String(component.name ?? `Component ${idx + 1}`);
            const weight = getNumber(component.weight);
            const raw = getNumber(component.raw_score ?? component.score);
            const weighted = getNumber(component.weighted_score);

            return (
              <div key={`${name}-${idx}`} className="grid grid-cols-[minmax(140px,1.4fr)_0.8fr_0.8fr_0.8fr] gap-2 text-sm py-2 items-center">
                <span className="font-medium">{name}</span>
                <span className="text-right text-[var(--color-text-secondary)]">{weight != null ? `${(normalizeWeightScore(weight)).toFixed(0)}%` : '—'}</span>
                <span className="text-right">{raw != null ? raw.toFixed(2) : '—'}</span>
                <span className="text-right" style={{ color: weighted != null ? (weighted >= 0 ? 'var(--color-bull)' : 'var(--color-bear)') : 'var(--color-text-secondary)' }}>
                  {weighted != null ? `${weighted >= 0 ? '+' : ''}${weighted.toFixed(3)}` : '—'}
                </span>
              </div>
            );
          })}
          {components.length === 0 && (
            <div className="py-8 text-center text-sm text-[var(--color-text-secondary)]">No component rows available.</div>
          )}
        </div>
      </section>

      <section className="mb-8 grid grid-cols-1 md:grid-cols-4 gap-4">
        <MetricCard title="Expected Direction" value={direction.toUpperCase()} trend={trend} tooltip="Forecast directional bias for expansion." theme="dark" icon={<TrendingUp size={16} />} />
        <MetricCard title="Confidence" value={confidence} tooltip="Model confidence bucket." theme="dark" icon={<Gauge size={16} />} />
        <MetricCard title="Move Probability" value={fmtPercent(moveProbability)} tooltip="Estimated probability of a meaningful expansion." theme="dark" icon={<Sparkles size={16} />} />
        <MetricCard title="Expected Magnitude" value={fmtPercent(expectedMagnitude)} tooltip="Expected magnitude of move over forecast horizon." theme="dark" icon={<CircleHelp size={16} />} />
      </section>

      <section className="zg-feature-shell mb-8 p-6">
        <h2 className="text-2xl font-semibold mb-4">What This Rating Means</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div className="rounded-xl border border-[var(--color-border)] p-4 bg-[var(--color-surface-subtle)]">
            <div className="font-semibold mb-2">Calculation logic</div>
            <ul className="space-y-2 text-[var(--color-text-secondary)]">
              <li>• Component factors are normalized into a common 0–100 scale.</li>
              <li>• Weighted component values roll into a composite expansion score.</li>
              <li>• Composite plus supporting fields determine direction and confidence labels.</li>
              <li>• Probability and expected magnitude provide trade selection context.</li>
            </ul>
          </div>
          <div className="rounded-xl border border-[var(--color-border)] p-4 bg-[var(--color-surface-subtle)]">
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
    </div>
  );
}
