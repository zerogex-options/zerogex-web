'use client';

import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Brain, Info, ShieldCheck } from 'lucide-react';
import { useTimeframe } from '@/core/TimeframeContext';
import { useTradesHistory, useTradesLive } from '@/hooks/useApiData';
import LoadingSpinner from '@/components/LoadingSpinner';
import ErrorMessage from '@/components/ErrorMessage';
import MetricCard from '@/components/MetricCard';
import TooltipWrapper from '@/components/TooltipWrapper';
import { useTheme } from '@/core/ThemeContext';
import { PROPRIETARY_SIGNALS_REFRESH } from '@/core/refreshProfiles';

type TradeRow = Record<string, unknown>;
type TimeframeFilter = 'today' | 'week' | 'month' | 'year';

const TIMEFRAME_OPTIONS: Array<{ key: TimeframeFilter; label: string }> = [
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'This Week' },
  { key: 'month', label: 'This Month' },
  { key: 'year', label: 'This Year' },
];

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

function formatPnlCell(value: number | null) {
  if (value == null) return '—';
  if (Math.abs(value) < 1e-9) return '-';
  return formatPnl(value);
}

function formatOpenedAt(value: unknown): string {
  const parsed = typeof value === 'string' ? new Date(value) : null;
  if (!parsed || Number.isNaN(parsed.getTime())) return getString(value);
  return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    + ' '
    + parsed.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: false, timeZone: 'America/New_York' })
    + ' ET';
}

function getTradeTimestamp(row: TradeRow): Date | null {
  const raw = row.closed_at ?? row.exit_at ?? row.opened_at ?? row.created_at ?? row.timestamp;
  if (typeof raw !== 'string') return null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function inSelectedWindow(date: Date | null, timeframe: TimeframeFilter): boolean {
  if (!date) return false;
  const now = new Date();
  if (timeframe === 'today') {
    const etDate = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
    return etDate(date) === etDate(now);
  }

  const start = new Date(now);
  if (timeframe === 'week') {
    const day = start.getDay();
    const diff = day === 0 ? 6 : day - 1;
    start.setDate(start.getDate() - diff);
    start.setHours(0, 0, 0, 0);
    return date >= start;
  }

  if (timeframe === 'month') {
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
    return date >= start;
  }

  start.setMonth(0, 1);
  start.setHours(0, 0, 0, 0);
  return date >= start;
}

function getPnl(row: TradeRow): number {
  const realized = getNumber(row.realized_pnl);
  const unrealized = getNumber(row.unrealized_pnl);
  const total = getNumber(row.total_pnl ?? row.pnl ?? row.net_pnl);
  if (total != null) return total;
  return (realized ?? 0) + (unrealized ?? 0);
}

export default function TradingSignalsPage() {
  const { symbol } = useTimeframe();
  const { theme } = useTheme();
  const [timeframeFilter, setTimeframeFilter] = useState<TimeframeFilter>('today');

  const { data: liveData, loading, error, refetch } = useTradesLive(symbol, PROPRIETARY_SIGNALS_REFRESH.liveTradesMs);
  const { data: historyData, error: historyError, refetch: refetchHistory } = useTradesHistory(symbol, PROPRIETARY_SIGNALS_REFRESH.tradeHistoryMs);

  const liveRows = useMemo(() => toRows(liveData), [liveData]);
  const historyRows = useMemo(() => toRows(historyData), [historyData]);

  const portfolioSize = useMemo(() => {
    const candidates = [
      getNumber((historyData as Record<string, unknown> | null)?.portfolio_size),
      getNumber((historyData as Record<string, unknown> | null)?.portfolio_value),
      getNumber((liveData as Record<string, unknown> | null)?.portfolio_size),
      getNumber((liveData as Record<string, unknown> | null)?.portfolio_value),
    ].filter((value): value is number => value != null && value > 0);

    return candidates[0] ?? 100_000;
  }, [historyData, liveData]);

  const filteredLiveRows = useMemo(
    () => liveRows.filter((row) => inSelectedWindow(getTradeTimestamp(row), timeframeFilter)),
    [liveRows, timeframeFilter],
  );
  const filteredHistoryRows = useMemo(
    () => historyRows.filter((row) => inSelectedWindow(getTradeTimestamp(row), timeframeFilter)),
    [historyRows, timeframeFilter],
  );

  const metrics = useMemo(() => {
    const totalTrades = filteredHistoryRows.length;
    const totalPnl = filteredHistoryRows.reduce((sum, row) => sum + getPnl(row), 0);
    const wins = filteredHistoryRows.filter((row) => getPnl(row) > 0).length;
    const winRate = totalTrades > 0 ? (wins / totalTrades) * 100 : null;
    const pnlPct = portfolioSize > 0 ? (totalPnl / portfolioSize) * 100 : null;

    return {
      liveTrades: filteredLiveRows.length,
      totalTrades,
      totalPnl,
      pnlPct,
      winRate,
    };
  }, [filteredHistoryRows, filteredLiveRows.length, portfolioSize]);

  const combinedRows = useMemo(() => {
    const live = liveRows.map((row) => ({ kind: 'live' as const, row }));
    const history = filteredHistoryRows.map((row) => ({ kind: 'history' as const, row }));
    return [...live, ...history];
  }, [liveRows, filteredHistoryRows]);

  if (loading && !liveData) {
    return <LoadingSpinner size="lg" />;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6 flex items-center gap-2">
        <h1 className="text-3xl font-bold">Signaled Trades</h1>
        <TooltipWrapper text="All trades are hypothetical — the engine observes live market data but does not connect to a broker. Everything is recorded as if executed at mid-mark with no slippage or commissions.">
          <button type="button" className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-[var(--color-border)] text-[var(--color-text-secondary)]">
            <Info size={14} />
          </button>
        </TooltipWrapper>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-2">
        {TIMEFRAME_OPTIONS.map((option) => {
          const active = option.key === timeframeFilter;
          return (
            <button
              key={option.key}
              type="button"
              onClick={() => setTimeframeFilter(option.key)}
              className="rounded-lg border px-3 py-1.5 text-sm font-medium transition"
              style={{
                borderColor: active ? 'var(--color-warning)' : 'var(--color-border)',
                color: active ? 'var(--color-warning)' : 'var(--color-text-secondary)',
                background: active ? 'var(--color-warning-soft)' : 'transparent',
              }}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      {(error || historyError) && <ErrorMessage message={error || historyError || 'Unable to load trades'} onRetry={() => { refetch(); refetchHistory(); }} />}

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">Performance Snapshot</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <MetricCard title="Live Trades" value={metrics.liveTrades} tooltip="Currently open trades in the selected timeframe window." theme="dark" />
        <MetricCard title="Total Trades" value={metrics.totalTrades} tooltip="Closed or recorded trades in the selected timeframe window." theme="dark" />
        <MetricCard
          title="PnL $"
          value={formatPnl(metrics.totalPnl)}
          subtitle={metrics.pnlPct != null ? `${metrics.pnlPct >= 0 ? '+' : ''}${metrics.pnlPct.toFixed(2)}% of portfolio` : '—'}
          trend={metrics.totalPnl > 0 ? 'bullish' : metrics.totalPnl < 0 ? 'bearish' : 'neutral'}
          tooltip={`Net realized + unrealized PnL over selected timeframe. Portfolio size: ${formatMoney(portfolioSize)}.`}
          theme="dark"
        />
        <MetricCard
          title="Win Rate"
          value={metrics.winRate != null ? `${metrics.winRate.toFixed(1)}%` : '—'}
          trend={metrics.winRate != null ? (metrics.winRate >= 50 ? 'bullish' : 'bearish') : 'neutral'}
          tooltip="Percentage of trades with positive PnL in selected timeframe."
          theme="dark"
        />
        </div>
      </section>

      <section className="zg-feature-shell overflow-x-auto p-4 mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xl font-semibold">Trade Stream</h2>
          <div className="text-xs text-[var(--color-text-secondary)] flex items-center gap-1"><ShieldCheck size={14} /> Live first, then selected history</div>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b border-[var(--color-border)]">
              <th className="py-2 pr-3">Symbol</th>
              <th className="py-2 pr-3">Type</th>
              <th className="py-2 pr-3">Expiry</th>
              <th className="py-2 pr-3">Strike</th>
              <th className="py-2 pr-3">Opened At</th>
              <th className="py-2 pr-3">Closed At</th>
              <th className="py-2 pr-3 text-right">Contracts</th>
              <th className="py-2 pr-3 text-right">Open</th>
              <th className="py-2 pr-3 text-right">Realized PnL</th>
              <th className="py-2 pr-3 text-right">Unrealized PnL</th>
              <th className="py-2 pr-3 text-right">Entry Score</th>
              <th className="py-2 pr-3 text-right">Outcome</th>
            </tr>
          </thead>
          <tbody>
            {combinedRows.slice(0, 180).map((item, idx) => {
              const row = item.row;
              const isLive = item.kind === 'live';
              const direction = getString(row.direction).toLowerCase();
              const isBullish = direction.includes('bull');
              const isBearish = direction.includes('bear');
              const scoreColor = isBullish ? 'var(--color-bull)' : isBearish ? 'var(--color-bear)' : 'var(--color-text-primary)';
              const entryScore = getNumber(row.score_at_entry);
              const realizedPnl = getNumber(row.realized_pnl);
              const unrealizedPnl = getNumber(row.unrealized_pnl);
              const totalPnl = getPnl(row);
              const optionType = getString(row.option_type);
              const strike = getNumber(row.strike);
              const contracts = isLive
                ? getNumber(row.quantity_open ?? row.quantity_initial ?? row.contracts)
                : getNumber(row.quantity_initial ?? row.quantity_open ?? row.contracts);
              const openContracts = getNumber(row.quantity_open);
              const outcome = isLive
                ? (totalPnl > 0 ? 'up' : totalPnl < 0 ? 'down' : 'flat')
                : (totalPnl > 0 ? 'Win' : totalPnl < 0 ? 'Loss' : 'Flat');

              return (
                <tr key={idx} className="border-b border-[var(--color-border)]/45">
                  <td className="py-2 pr-3 font-medium">{getString(row.underlying)}</td>
                  <td className="py-2 pr-3">{optionType === 'C' ? 'Call' : optionType === 'P' ? 'Put' : optionType}</td>
                  <td className="py-2 pr-3 whitespace-nowrap">{getString(row.expiration)}</td>
                  <td className="py-2 pr-3">{strike != null ? `$${strike.toFixed(2)}` : '—'}</td>
                  <td className="py-2 pr-3 whitespace-nowrap">{formatOpenedAt(row.opened_at)}</td>
                  <td className="py-2 pr-3 whitespace-nowrap">
                    {isLive ? (
                      <span className="inline-flex items-center rounded-full bg-[var(--color-bull)]/15 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-[var(--color-bull)]">live</span>
                    ) : (
                      formatOpenedAt(row.closed_at ?? row.exit_at)
                    )}
                  </td>
                  <td className="py-2 pr-3 text-right">{contracts != null ? contracts.toLocaleString() : '—'}</td>
                  <td className="py-2 pr-3 text-right">{openContracts != null ? openContracts.toLocaleString() : (isLive ? '—' : '0')}</td>
                  <td className="py-2 pr-3 text-right" style={{ color: realizedPnl != null ? (realizedPnl >= 0 ? 'var(--color-bull)' : 'var(--color-bear)') : undefined }}>
                    {formatPnlCell(realizedPnl)}
                  </td>
                  <td className="py-2 pr-3 text-right" style={{ color: unrealizedPnl != null ? (unrealizedPnl >= 0 ? 'var(--color-bull)' : 'var(--color-bear)') : undefined }}>
                    {formatPnlCell(unrealizedPnl)}
                  </td>
                  <td className="py-2 pr-3 text-right">
                    <span className="inline-flex items-center gap-1" style={{ color: scoreColor }}>
                      {isBullish && <ArrowUp size={14} />}
                      {isBearish && <ArrowDown size={14} />}
                      {entryScore != null ? entryScore.toFixed(4) : '—'}
                    </span>
                  </td>
                  <td className="py-2 pr-3 text-right">{outcome}</td>
                </tr>
              );
            })}
            {combinedRows.length === 0 && (
              <tr>
                <td colSpan={12} className="py-10 text-center text-[var(--color-text-secondary)]">
                  No trade rows available.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <section className="zg-feature-shell mb-8 p-6">
        <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2"><Brain size={20} /> Trade Execution Logic</h2>
        <p className="text-sm text-[var(--color-text-secondary)] mb-4">
          All five conditions must be true simultaneously to open a position. There are no fixed stop-losses or take-profits — positions close when the signal degrades.
        </p>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 text-sm">
          <div className="rounded-xl border border-[var(--color-border)] p-4" style={{ background: theme === 'light' ? '#FFFFFF' : 'var(--color-surface-subtle)' }}>
            <div className="font-semibold mb-3">Conditions to Open</div>
            <ul className="text-xs text-[var(--color-text-secondary)] space-y-2">
              <li>• <strong>Normalized score ≥ threshold</strong> (default 58, raised to 72 in high IV, lowered to 52 in low IV)</li>
              <li>• <strong>Trend confirmation</strong> — at least 2 of the last 4 non-neutral scores agree with current direction</li>
              <li>• <strong>Valid options structure</strong> — optimizer finds positive-EV candidate in the appropriate DTE window</li>
              <li>• <strong>Portfolio heat headroom</strong> — new position won&apos;t exceed max heat %</li>
              <li>• <strong>Open trade count headroom</strong> — below max open trades limit</li>
            </ul>
          </div>
          <div className="rounded-xl border border-[var(--color-border)] p-4" style={{ background: theme === 'light' ? '#FFFFFF' : 'var(--color-surface-subtle)' }}>
            <div className="font-semibold mb-3">Conditions to Close</div>
            <ul className="text-xs text-[var(--color-text-secondary)] space-y-2">
              <li>• <strong>Score drops below threshold</strong> → all positions closed, move to cash</li>
              <li>• <strong>Direction reverses</strong> → existing closed, new position opened in opposite direction</li>
              <li>• <strong>Position size target decreases</strong> → oldest trades closed first to reach new target</li>
              <li>• <strong>No positive-EV structure</strong> for held direction → full liquidation</li>
            </ul>
          </div>
          <div className="rounded-xl border border-[var(--color-border)] p-4" style={{ background: theme === 'light' ? '#FFFFFF' : 'var(--color-surface-subtle)' }}>
            <div className="font-semibold mb-3">Position Sizing</div>
            <ul className="text-xs text-[var(--color-text-secondary)] space-y-2">
              <li>• Contracts = <strong>int(optimal_contracts × normalized_score)</strong>, min 1</li>
              <li>• A score of 85 opens ~85% of the optimizer&apos;s suggested contracts</li>
              <li>• A score of 58 opens ~58% — higher conviction = larger position</li>
              <li>• DTE window adapts: high IV (&gt; 0.70) uses 0–2 DTE, normal/low IV uses 1–7 DTE</li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}
