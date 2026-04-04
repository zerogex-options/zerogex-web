'use client';

import { useMemo } from 'react';
import { useTimeframe } from '@/core/TimeframeContext';
import { useTradesLive } from '@/hooks/useApiData';
import LoadingSpinner from '@/components/LoadingSpinner';
import ErrorMessage from '@/components/ErrorMessage';
import MetricCard from '@/components/MetricCard';

type TradeRow = Record<string, unknown>;

function toRows(data: unknown): TradeRow[] {
  if (Array.isArray(data)) return data as TradeRow[];
  if (data && typeof data === 'object') {
    const values = Object.values(data as Record<string, unknown>);
    const firstArray = values.find((value) => Array.isArray(value));
    if (Array.isArray(firstArray)) return firstArray as TradeRow[];
  }
  return [];
}

function getNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function getString(value: unknown): string {
  if (value == null) return '—';
  return String(value);
}

function formatMoney(value: number | null) {
  if (value == null) return '—';
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `$${(value / 1_000).toFixed(2)}K`;
  return `$${value.toFixed(2)}`;
}

function formatDate(value: unknown) {
  const parsed = typeof value === 'string' ? new Date(value) : null;
  if (!parsed || Number.isNaN(parsed.getTime())) return getString(value);
  return parsed.toLocaleString();
}

export default function TradingSignalsPage() {
  const { symbol } = useTimeframe();
  const { data, loading, error, refetch } = useTradesLive(symbol, 5000);

  const rows = useMemo(() => toRows(data), [data]);

  const totals = useMemo(() => {
    const netPremium = rows.reduce((sum, row) => sum + (getNumber(row.net_premium) ?? 0), 0);
    const netVolume = rows.reduce((sum, row) => sum + (getNumber(row.net_volume) ?? getNumber(row.flow) ?? 0), 0);
    const bullishCount = rows.filter((row) => getString(row.flow_bias).toLowerCase().includes('bull')).length;
    return { netPremium, netVolume, bullishCount };
  }, [rows]);

  if (loading && !data) {
    return <LoadingSpinner size="lg" />;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-2">Trade Ideas</h1>
      <p className="text-[var(--color-text-secondary)] mb-8">
        Live trade signals sourced from <span className="font-mono">/api/signals/trades-live</span>.
      </p>

      {error && <ErrorMessage message={error} onRetry={refetch} />}

      <section className="mb-8 grid grid-cols-1 md:grid-cols-4 gap-4">
        <MetricCard title="Live Signals" value={rows.length} tooltip="Current number of rows returned by the live trades signal endpoint." theme="dark" />
        <MetricCard
          title="Net Premium"
          value={formatMoney(totals.netPremium)}
          trend={totals.netPremium > 0 ? 'bullish' : totals.netPremium < 0 ? 'bearish' : 'neutral'}
          tooltip="Aggregate net premium across the currently returned live trade signals."
          theme="dark"
        />
        <MetricCard
          title="Net Flow"
          value={Math.round(totals.netVolume).toLocaleString()}
          trend={totals.netVolume > 0 ? 'bullish' : totals.netVolume < 0 ? 'bearish' : 'neutral'}
          tooltip="Aggregate net flow from the currently returned trade rows."
          theme="dark"
        />
        <MetricCard title="Bullish Rows" value={totals.bullishCount} tooltip="Rows where flow bias contains 'bull'." theme="dark" />
      </section>

      <section className="bg-[var(--color-surface)] rounded-lg border border-[var(--color-border)] p-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b border-[var(--color-border)]">
              <th className="py-2 pr-3">Timestamp</th>
              <th className="py-2 pr-3">Contract</th>
              <th className="py-2 pr-3">Flow Bias</th>
              <th className="py-2 pr-3">Notional</th>
              <th className="py-2 pr-3">Score</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 50).map((row, idx) => {
              const score = getNumber(row.score);
              return (
                <tr key={idx} className="border-b border-[var(--color-border)]/50">
                  <td className="py-2 pr-3 whitespace-nowrap">{formatDate(row.timestamp)}</td>
                  <td className="py-2 pr-3">{getString(row.contract ?? row.symbol)}</td>
                  <td className="py-2 pr-3">{getString(row.flow_bias ?? row.trade_side ?? row.direction)}</td>
                  <td className="py-2 pr-3">{formatMoney(getNumber(row.notional ?? row.net_premium ?? row.premium))}</td>
                  <td className="py-2 pr-3" style={{ color: score != null && score > 0 ? 'var(--color-bull)' : score != null && score < 0 ? 'var(--color-bear)' : 'var(--color-text-primary)' }}>
                    {score != null ? score.toFixed(2) : '—'}
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="py-8 text-center text-[var(--color-text-secondary)]">
                  No live trade rows available.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
