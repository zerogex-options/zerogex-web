'use client';

import { useMemo } from 'react';
import { Activity, ArrowDown, ArrowUp, Gauge, ShieldCheck, Sparkles } from 'lucide-react';
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
  if (abs >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toFixed(2)}`;
}

function formatPnl(value: number | null) {
  if (value == null) return '—';
  const formatted = formatMoney(value);
  if (value > 0) return `+${formatted}`;
  return formatted;
}

function formatOpenedAt(value: unknown): string {
  const parsed = typeof value === 'string' ? new Date(value) : null;
  if (!parsed || Number.isNaN(parsed.getTime())) return getString(value);
  return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    + ' '
    + parsed.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: false, timeZone: 'America/New_York' })
    + ' ET';
}


export default function TradingSignalsPage() {
  const { symbol } = useTimeframe();
  const { data, loading, error, refetch } = useTradesLive(symbol, 5000);

  const rows = useMemo(() => toRows(data), [data]);

  const analytics = useMemo(() => {
    const netPremium = rows.reduce((sum, row) => sum + (getNumber(row.net_premium ?? row.premium ?? row.total_pnl) ?? 0), 0);
    const netVolume = rows.reduce((sum, row) => sum + (getNumber(row.net_volume ?? row.flow ?? row.quantity_initial ?? row.quantity_open) ?? 0), 0);
    const bullishCount = rows.filter((row) => getString(row.flow_bias ?? row.trade_side ?? row.direction).toLowerCase().includes('bull')).length;
    const bearishCount = rows.filter((row) => getString(row.flow_bias ?? row.trade_side ?? row.direction).toLowerCase().includes('bear')).length;

    return { netPremium, netVolume, bullishCount, bearishCount };
  }, [rows]);

  if (loading && !data) {
    return <LoadingSpinner size="lg" />;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-2">Trade Ideas</h1>
      <p className="text-[var(--color-text-secondary)] mb-8">
        Real-time flow intelligence for fast trade selection and directional conviction.
      </p>

      {error && <ErrorMessage message={error} onRetry={refetch} />}

      <section className="mb-8 grid grid-cols-1 md:grid-cols-4 gap-4">
        <MetricCard title="Live Signals" value={rows.length} tooltip="Current number of live rows feeding the model." theme="dark" />
        <MetricCard
          title="Net Premium"
          value={formatMoney(analytics.netPremium)}
          trend={analytics.netPremium > 0 ? 'bullish' : analytics.netPremium < 0 ? 'bearish' : 'neutral'}
          tooltip="Aggregate premium pressure across live signal rows."
          theme="dark"
          icon={<Sparkles size={16} />}
        />
        <MetricCard
          title="Net Flow"
          value={Math.round(analytics.netVolume).toLocaleString()}
          trend={analytics.netVolume > 0 ? 'bullish' : analytics.netVolume < 0 ? 'bearish' : 'neutral'}
          tooltip="Net signed flow from live trade rows."
          theme="dark"
          icon={<Activity size={16} />}
        />
        <MetricCard
          title="Bull vs Bear"
          value={`${analytics.bullishCount}/${analytics.bearishCount}`}
          tooltip="Row count split between bullish and bearish directional tags."
          theme="dark"
          icon={<Gauge size={16} />}
        />
      </section>

      <section className="zg-feature-shell overflow-x-auto p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xl font-semibold">Live Trade Stream</h2>
          <div className="text-xs text-[var(--color-text-secondary)] flex items-center gap-1"><ShieldCheck size={14} /> Updated every few seconds</div>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b border-[var(--color-border)]">
              <th className="py-2 pr-3">Symbol</th>
              <th className="py-2 pr-3">Type</th>
              <th className="py-2 pr-3">Expiry</th>
              <th className="py-2 pr-3">Strike</th>
              <th className="py-2 pr-3">Opened At</th>
              <th className="py-2 pr-3 text-right">Contracts Open</th>
              <th className="py-2 pr-3 text-right">Realized PnL</th>
              <th className="py-2 pr-3 text-right">Unrealized PnL</th>
              <th className="py-2 pr-3 text-right">Entry Score</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 60).map((row, idx) => {
              const direction = getString(row.direction).toLowerCase();
              const isBullish = direction.includes('bull');
              const isBearish = direction.includes('bear');
              const scoreColor = isBullish ? 'var(--color-bull)' : isBearish ? 'var(--color-bear)' : 'var(--color-text-primary)';
              const entryScore = getNumber(row.score_at_entry);
              const realizedPnl = getNumber(row.realized_pnl);
              const unrealizedPnl = getNumber(row.unrealized_pnl);
              const optionType = getString(row.option_type);
              const strike = getNumber(row.strike);

              return (
                <tr key={idx} className="border-b border-[var(--color-border)]/45">
                  <td className="py-2 pr-3 font-medium">{getString(row.underlying)}</td>
                  <td className="py-2 pr-3">{optionType === 'C' ? 'Call' : optionType === 'P' ? 'Put' : optionType}</td>
                  <td className="py-2 pr-3 whitespace-nowrap">{getString(row.expiration)}</td>
                  <td className="py-2 pr-3">{strike != null ? `$${strike.toFixed(2)}` : '—'}</td>
                  <td className="py-2 pr-3 whitespace-nowrap">{formatOpenedAt(row.opened_at)}</td>
                  <td className="py-2 pr-3 text-right">{getString(row.quantity_open)}</td>
                  <td className="py-2 pr-3 text-right" style={{ color: realizedPnl != null ? (realizedPnl >= 0 ? 'var(--color-bull)' : 'var(--color-bear)') : undefined }}>
                    {formatPnl(realizedPnl)}
                  </td>
                  <td className="py-2 pr-3 text-right" style={{ color: unrealizedPnl != null ? (unrealizedPnl >= 0 ? 'var(--color-bull)' : 'var(--color-bear)') : undefined }}>
                    {formatPnl(unrealizedPnl)}
                  </td>
                  <td className="py-2 pr-3 text-right">
                    <span className="inline-flex items-center gap-1" style={{ color: scoreColor }}>
                      {isBullish && <ArrowUp size={14} />}
                      {isBearish && <ArrowDown size={14} />}
                      {entryScore != null ? entryScore.toFixed(4) : '—'}
                    </span>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={9} className="py-10 text-center text-[var(--color-text-secondary)]">
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
