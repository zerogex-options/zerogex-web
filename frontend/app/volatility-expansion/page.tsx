'use client';

import { useMemo } from 'react';
import { useTimeframe } from '@/core/TimeframeContext';
import { useVolExpansionSignal } from '@/hooks/useApiData';
import LoadingSpinner from '@/components/LoadingSpinner';
import ErrorMessage from '@/components/ErrorMessage';
import MetricCard from '@/components/MetricCard';

type GenericObject = Record<string, unknown>;

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

  const compositeScore = getNumber(payload.composite_score ?? payload.score);
  const direction = String(payload.expected_direction ?? payload.direction ?? 'neutral').toLowerCase();
  const moveProbability = getNumber(payload.move_probability ?? payload.probability);
  const expectedMagnitude = getNumber(payload.expected_magnitude_pct ?? payload.magnitude_pct);

  if (loading && !data) return <LoadingSpinner size="lg" />;

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-2">Volatility Expansion</h1>
      <p className="text-[var(--color-text-secondary)] mb-8">
        Signal data from <span className="font-mono">/api/signals/vol-expansion</span>.
      </p>

      {error && <ErrorMessage message={error} onRetry={refetch} />}

      <section className="mb-8 grid grid-cols-1 md:grid-cols-4 gap-4">
        <MetricCard
          title="Direction"
          value={direction.toUpperCase()}
          trend={direction === 'up' || direction === 'bullish' ? 'bullish' : direction === 'down' || direction === 'bearish' ? 'bearish' : 'neutral'}
          tooltip="Expected direction from the volatility expansion endpoint."
          theme="dark"
        />
        <MetricCard
          title="Composite Score"
          value={compositeScore != null ? compositeScore.toFixed(2) : '—'}
          trend={compositeScore != null && compositeScore > 0 ? 'bullish' : compositeScore != null && compositeScore < 0 ? 'bearish' : 'neutral'}
          tooltip="Raw composite score returned by the vol expansion API."
          theme="dark"
        />
        <MetricCard title="Move Probability" value={fmtPercent(moveProbability)} tooltip="Probability of a meaningful expansion move." theme="dark" />
        <MetricCard title="Expected Magnitude" value={fmtPercent(expectedMagnitude)} tooltip="Expected absolute move magnitude percentage." theme="dark" />
      </section>

      <section className="bg-[var(--color-surface)] rounded-lg border border-[var(--color-border)] p-6">
        <h2 className="text-xl font-semibold mb-4">Signal Details</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          {Object.entries(payload)
            .filter(([key]) => key !== 'components')
            .map(([key, value]) => (
              <div key={key} className="flex justify-between gap-4 border-b border-[var(--color-border)]/50 py-2">
                <span className="text-[var(--color-text-secondary)]">{key}</span>
                <span className="text-right">{typeof value === 'object' ? JSON.stringify(value) : String(value)}</span>
              </div>
            ))}
        </div>
      </section>

      <section className="mt-8 bg-[var(--color-surface)] rounded-lg border border-[var(--color-border)] p-6">
        <h2 className="text-xl font-semibold mb-4">Component Breakdown</h2>
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
                </tr>
              </thead>
              <tbody>
                {components.map((row, idx) => (
                  <tr key={idx} className="border-b border-[var(--color-border)]/50">
                    <td className="py-2 pr-3">{String(row.name ?? '—')}</td>
                    <td className="py-2 pr-3">{getNumber(row.weight)?.toFixed(2) ?? '—'}</td>
                    <td className="py-2 pr-3">{getNumber(row.raw_score)?.toFixed(2) ?? '—'}</td>
                    <td className="py-2 pr-3">{getNumber(row.weighted_score)?.toFixed(2) ?? '—'}</td>
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
