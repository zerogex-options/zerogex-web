'use client';

import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Brain, Crosshair, Info, ShieldCheck, TableProperties, Target, TrendingUp, Zap } from 'lucide-react';
import { useTimeframe } from '@/core/TimeframeContext';
import { useSignalAction, useTradesHistory, useTradesLive } from '@/hooks/useApiData';
import type { SignalActionAlternative, SignalActionLeg, SignalActionNearMiss, SignalActionPriceLevel, SignalActionResponse } from '@/hooks/useApiData';
import LoadingSpinner from '@/components/LoadingSpinner';
import ErrorMessage from '@/components/ErrorMessage';
import MetricCard from '@/components/MetricCard';
import TooltipWrapper from '@/components/TooltipWrapper';
import { useTheme } from '@/core/ThemeContext';
import { PROPRIETARY_SIGNALS_REFRESH } from '@/core/refreshProfiles';

type TradeRow = Record<string, unknown>;
type TimeframeFilter = 'today' | 'week' | 'month' | 'year';
type SortDirection = 'asc' | 'desc';
type TradeSortKey =
  | 'symbol'
  | 'type'
  | 'expiry'
  | 'strike'
  | 'openedAt'
  | 'closedAt'
  | 'contracts'
  | 'openContracts'
  | 'realizedPnl'
  | 'unrealizedPnl'
  | 'entryScore'
  | 'outcome';

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

function formatMoneyFull(value: number | null) {
  if (value == null) return '—';
  return value.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
  const [sortKey, setSortKey] = useState<TradeSortKey>('closedAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const [hideLowConfidence, setHideLowConfidence] = useState(false);

  const { data: liveData, loading, error, refetch } = useTradesLive(symbol, PROPRIETARY_SIGNALS_REFRESH.liveTradesMs);
  const { data: historyData, error: historyError, refetch: refetchHistory } = useTradesHistory(symbol, PROPRIETARY_SIGNALS_REFRESH.tradeHistoryMs);
  const { data: actionData, error: actionError, refetch: refetchAction } = useSignalAction(symbol, 60000);

  const liveRows = useMemo(() => toRows(liveData), [liveData]);
  const historyRows = useMemo(() => toRows(historyData), [historyData]);

  const portfolioSize = useMemo(() => {
    const value = getNumber((historyData as Record<string, unknown> | null)?.portfolio_size);
    return value != null && value > 0 ? value : null;
  }, [historyData]);

  const filteredHistoryRows = useMemo(
    () => historyRows.filter((row) => inSelectedWindow(getTradeTimestamp(row), timeframeFilter)),
    [historyRows, timeframeFilter],
  );

  const metrics = useMemo(() => {
    const historicalTrades = filteredHistoryRows.length;
    const liveTrades = liveRows.length;
    const totalTrades = historicalTrades + liveTrades;

    const historicalPnl = filteredHistoryRows.reduce((sum, row) => sum + getPnl(row), 0);
    const liveUnrealizedPnl = liveRows.reduce((sum, row) => sum + (getNumber(row.unrealized_pnl) ?? 0), 0);
    const totalPnl = historicalPnl + liveUnrealizedPnl;

    const historicalWins = filteredHistoryRows.filter((row) => getPnl(row) > 0).length;
    const liveWins = liveRows.filter((row) => getPnl(row) >= 0).length;
    const wins = historicalWins + liveWins;
    const winRate = totalTrades > 0 ? (wins / totalTrades) * 100 : null;

    const pnlPct = portfolioSize != null && portfolioSize > 0 ? (totalPnl / portfolioSize) * 100 : null;

    return {
      liveTrades,
      totalTrades,
      totalPnl,
      pnlPct,
      winRate,
    };
  }, [filteredHistoryRows, liveRows, portfolioSize]);

  const combinedRows = useMemo(() => {
    const live = liveRows.map((row) => ({ kind: 'live' as const, row }));
    const history = filteredHistoryRows.map((row) => ({ kind: 'history' as const, row }));
    return [...live, ...history];
  }, [liveRows, filteredHistoryRows]);

  const sortedRows = useMemo(() => {
    const rows = [...combinedRows];
    const direction = sortDirection === 'asc' ? 1 : -1;

    const getSortValue = (item: (typeof combinedRows)[number]): number | string => {
      const row = item.row;
      const isLive = item.kind === 'live';
      const optionType = getString(row.option_type);
      const strike = getNumber(row.strike);
      const contracts = isLive
        ? getNumber(row.quantity_open ?? row.quantity_initial ?? row.contracts)
        : getNumber(row.quantity_initial ?? row.quantity_open ?? row.contracts);
      const openContracts = getNumber(row.quantity_open);
      const entryScore = getNumber(row.score_at_entry);
      const realizedPnl = getNumber(row.realized_pnl);
      const unrealizedPnl = getNumber(row.unrealized_pnl);
      const totalPnl = getPnl(row);
      const outcome = isLive ? (totalPnl > 0 ? 'up' : totalPnl < 0 ? 'down' : 'flat') : (totalPnl > 0 ? 'Win' : totalPnl < 0 ? 'Loss' : 'Flat');

      switch (sortKey) {
        case 'symbol': return getString(row.underlying);
        case 'type': return optionType;
        case 'expiry': return getString(row.expiration);
        case 'strike': return strike ?? Number.NEGATIVE_INFINITY;
        case 'openedAt': return new Date(String(row.opened_at ?? row.created_at ?? row.timestamp ?? '')).getTime() || Number.NEGATIVE_INFINITY;
        case 'closedAt': return isLive ? Number.POSITIVE_INFINITY : (new Date(String(row.closed_at ?? row.exit_at ?? '')).getTime() || Number.NEGATIVE_INFINITY);
        case 'contracts': return contracts ?? Number.NEGATIVE_INFINITY;
        case 'openContracts': return openContracts ?? Number.NEGATIVE_INFINITY;
        case 'realizedPnl': return realizedPnl ?? Number.NEGATIVE_INFINITY;
        case 'unrealizedPnl': return unrealizedPnl ?? Number.NEGATIVE_INFINITY;
        case 'entryScore': return entryScore ?? Number.NEGATIVE_INFINITY;
        case 'outcome': return outcome;
        default: return 0;
      }
    };

    rows.sort((a, b) => {
      const av = getSortValue(a);
      const bv = getSortValue(b);
      if (typeof av === 'string' || typeof bv === 'string') {
        return String(av).localeCompare(String(bv)) * direction;
      }
      return (av - bv) * direction;
    });

    return rows;
  }, [combinedRows, sortDirection, sortKey]);

  const toggleSort = (key: TradeSortKey) => {
    if (sortKey === key) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortKey(key);
    setSortDirection('desc');
  };

  const sortIndicator = (key: TradeSortKey) => {
    if (sortKey !== key) return '↕';
    return sortDirection === 'asc' ? '↑' : '↓';
  };

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

      <ActionCardSection
        data={actionData}
        error={actionError}
        onRetry={refetchAction}
        hideLowConfidence={hideLowConfidence}
        onToggleHide={() => setHideLowConfidence((prev) => !prev)}
      />

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
        <h2 className="mb-3 flex items-center gap-2 text-xl font-semibold"><TrendingUp size={20} /> Performance Snapshot</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <MetricCard title="Live Trades" value={metrics.liveTrades} tooltip="Currently open trades that have not closed yet." theme="dark" />
        <MetricCard title="Total Trades" value={metrics.totalTrades} tooltip="Historical trades in selected timeframe plus all currently live trades." theme="dark" />
        <MetricCard
          title="PnL $"
          value={formatPnl(metrics.totalPnl)}
          subtitle={metrics.pnlPct != null ? `${metrics.pnlPct >= 0 ? '+' : ''}${metrics.pnlPct.toFixed(2)}% of portfolio` : '—'}
          trend={metrics.totalPnl > 0 ? 'bullish' : metrics.totalPnl < 0 ? 'bearish' : 'neutral'}
          tooltip={`Realized PnL from selected historical timeframe + unrealized PnL from all currently live trades. Portfolio size: ${formatMoneyFull(portfolioSize)}.`}
          theme="dark"
        />
        <MetricCard
          title="Win Rate"
          value={metrics.winRate != null ? `${metrics.winRate.toFixed(1)}%` : '—'}
          trend={metrics.winRate != null ? (metrics.winRate >= 50 ? 'bullish' : 'bearish') : 'neutral'}
          tooltip="Win rate across selected historical trades plus all live trades (live up/flat = win, live down = loss)."
          theme="dark"
        />
        </div>
      </section>

      <section className="zg-feature-shell overflow-x-auto p-4 mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="flex items-center gap-2 text-xl font-semibold"><TableProperties size={20} /> Trade Stream</h2>
          <div className="text-xs text-[var(--color-text-secondary)] flex items-center gap-1"><ShieldCheck size={14} /> Live first, then selected history</div>
        </div>
        <table className="w-full min-w-[920px] text-sm">
          <thead>
            <tr className="text-left border-b border-[var(--color-border)]">
              <th className="py-2 pr-3"><button type="button" onClick={() => toggleSort('symbol')} className="inline-flex items-center gap-1">Symbol <span className="opacity-70">{sortIndicator('symbol')}</span></button></th>
              <th className="py-2 pr-3"><button type="button" onClick={() => toggleSort('type')} className="inline-flex items-center gap-1">Type <span className="opacity-70">{sortIndicator('type')}</span></button></th>
              <th className="py-2 pr-3"><button type="button" onClick={() => toggleSort('expiry')} className="inline-flex items-center gap-1">Expiry <span className="opacity-70">{sortIndicator('expiry')}</span></button></th>
              <th className="py-2 pr-3"><button type="button" onClick={() => toggleSort('strike')} className="inline-flex items-center gap-1">Strike <span className="opacity-70">{sortIndicator('strike')}</span></button></th>
              <th className="py-2 pr-3"><button type="button" onClick={() => toggleSort('openedAt')} className="inline-flex items-center gap-1">Opened At <span className="opacity-70">{sortIndicator('openedAt')}</span></button></th>
              <th className="py-2 pr-3"><button type="button" onClick={() => toggleSort('closedAt')} className="inline-flex items-center gap-1">Closed At <span className="opacity-70">{sortIndicator('closedAt')}</span></button></th>
              <th className="py-2 pr-3 text-right"><button type="button" onClick={() => toggleSort('contracts')} className="inline-flex items-center gap-1">Contracts <span className="opacity-70">{sortIndicator('contracts')}</span></button></th>
              <th className="py-2 pr-3 text-right"><button type="button" onClick={() => toggleSort('openContracts')} className="inline-flex items-center gap-1">Open <span className="opacity-70">{sortIndicator('openContracts')}</span></button></th>
              <th className="py-2 pr-3 text-right"><button type="button" onClick={() => toggleSort('realizedPnl')} className="inline-flex items-center gap-1">Realized PnL <span className="opacity-70">{sortIndicator('realizedPnl')}</span></button></th>
              <th className="py-2 pr-3 text-right"><button type="button" onClick={() => toggleSort('unrealizedPnl')} className="inline-flex items-center gap-1">Unrealized PnL <span className="opacity-70">{sortIndicator('unrealizedPnl')}</span></button></th>
              <th className="py-2 pr-3 text-right"><button type="button" onClick={() => toggleSort('entryScore')} className="inline-flex items-center gap-1">Entry Score <span className="opacity-70">{sortIndicator('entryScore')}</span></button></th>
              <th className="py-2 pr-3 text-right"><button type="button" onClick={() => toggleSort('outcome')} className="inline-flex items-center gap-1">Outcome <span className="opacity-70">{sortIndicator('outcome')}</span></button></th>
            </tr>
          </thead>
          <tbody>
            {sortedRows.slice(0, 180).map((item, idx) => {
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
                    {formatMoneyFull(realizedPnl)}
                  </td>
                  <td className="py-2 pr-3 text-right" style={{ color: unrealizedPnl != null ? (unrealizedPnl >= 0 ? 'var(--color-bull)' : 'var(--color-bear)') : undefined }}>
                    {formatMoneyFull(unrealizedPnl)}
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
            {sortedRows.length === 0 && (
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
        <h2 className="mb-4 flex items-center gap-2 text-xl font-semibold">
          <Brain size={20} />
          Trade Execution Logic
          <TooltipWrapper text="All five conditions must be true simultaneously to open a position. There are no fixed stop-losses or take-profits — positions close when the signal degrades.">
            <button type="button" className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-[var(--color-border)] text-[var(--color-text-secondary)]">
              <Info size={12} />
            </button>
          </TooltipWrapper>
        </h2>
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

function structureLabel(legCount: number): string {
  if (legCount === 1) return 'Single';
  if (legCount === 2) return 'Vertical';
  if (legCount === 3) return 'Butterfly';
  if (legCount === 4) return 'Condor';
  return `${legCount}-leg`;
}

function directionColor(direction: string | undefined): string {
  const d = String(direction ?? '').toLowerCase();
  if (d.includes('bull')) return 'var(--color-bull)';
  if (d.includes('bear')) return 'var(--color-bear)';
  return 'var(--color-warning)';
}

function formatPriceUsd(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return `$${value.toFixed(2)}`;
}

interface ActionCardSectionProps {
  data: SignalActionResponse | null | undefined;
  error: string | null;
  onRetry: () => void;
  hideLowConfidence: boolean;
  onToggleHide: () => void;
}

function ActionCardSection({ data, error, onRetry, hideLowConfidence, onToggleHide }: ActionCardSectionProps) {
  const action = String(data?.action ?? '').toUpperCase();
  const isStandDown = action === 'STAND_DOWN';
  const confidence = typeof data?.confidence === 'number' ? data.confidence : null;
  const hidden = !isStandDown && hideLowConfidence && confidence != null && confidence < 0.5;

  return (
    <section className="zg-feature-shell mb-8 p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-xl font-semibold">
          <Zap size={20} />
          Decisive Trade Card
          <TooltipWrapper text="One decisive trade card per cycle, per underlying. Either an actionable trade or a STAND_DOWN with near-misses. Refreshes every minute (~/api/signals/action).">
            <button type="button" className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-[var(--color-border)] text-[var(--color-text-secondary)]">
              <Info size={12} />
            </button>
          </TooltipWrapper>
        </h2>
        <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-[var(--color-text-secondary)]">
          <input type="checkbox" checked={hideLowConfidence} onChange={onToggleHide} className="h-3.5 w-3.5 cursor-pointer" />
          Hide cards with confidence &lt; 0.5
        </label>
      </div>

      {error && <ErrorMessage message={error} onRetry={onRetry} />}

      {!data && !error && (
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-6 text-sm text-[var(--color-text-secondary)]">
          Waiting for the next signal cycle…
        </div>
      )}

      {data && hidden && (
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-6 text-sm text-[var(--color-text-secondary)]">
          Card hidden by confidence filter (&lt; 0.5). Confidence: {confidence != null ? confidence.toFixed(2) : '—'}.
        </div>
      )}

      {data && !hidden && (isStandDown ? <StandDownCard data={data} /> : <TradeCard data={data} />)}
    </section>
  );
}

function ConfidenceRing({ value }: { value: number | null }) {
  const pct = value == null ? 0 : Math.max(0, Math.min(1, value));
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const dash = circumference * pct;
  const color = pct >= 0.7 ? 'var(--color-bull)' : pct >= 0.5 ? 'var(--color-warning)' : 'var(--color-bear)';

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: 96, height: 96 }}>
      <svg width="96" height="96" viewBox="0 0 96 96">
        <circle cx="48" cy="48" r={radius} stroke="var(--color-border)" strokeWidth="8" fill="none" />
        <circle
          cx="48"
          cy="48"
          r={radius}
          stroke={color}
          strokeWidth="8"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference - dash}`}
          transform="rotate(-90 48 48)"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-bold" style={{ color }}>
          {value != null ? value.toFixed(2) : '—'}
        </span>
        <span className="text-[10px] uppercase tracking-wide text-[var(--color-text-secondary)]">conf</span>
      </div>
    </div>
  );
}

function PriceRung({ label, level, color }: { label: string; level: SignalActionPriceLevel | undefined; color: string }) {
  if (!level || level.ref_price == null) return null;
  const detail = level.level_name ?? level.kind ?? level.trigger ?? '';
  return (
    <div className="flex items-baseline justify-between gap-3 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2">
      <span className="text-xs font-semibold uppercase tracking-wide" style={{ color }}>{label}</span>
      <span className="font-mono text-sm">{formatPriceUsd(level.ref_price)}</span>
      {detail && <span className="text-[10px] text-[var(--color-text-secondary)]">{detail}</span>}
    </div>
  );
}

function ActionPriceLadder({ entry, target, stop }: { entry?: SignalActionPriceLevel; target?: SignalActionPriceLevel; stop?: SignalActionPriceLevel }) {
  const rungs: Array<{ key: 'stop' | 'entry' | 'target'; level: SignalActionPriceLevel | undefined; label: string; color: string }> = [
    { key: 'stop', level: stop, label: 'Stop', color: 'var(--color-bear)' },
    { key: 'entry', level: entry, label: 'Entry', color: 'var(--color-warning)' },
    { key: 'target', level: target, label: 'Target', color: 'var(--color-bull)' },
  ].filter((r) => r.level && r.level.ref_price != null) as typeof rungs;

  if (rungs.length === 0) return null;
  rungs.sort((a, b) => (b.level!.ref_price ?? 0) - (a.level!.ref_price ?? 0));

  return (
    <div className="flex flex-col gap-2">
      {rungs.map((r) => (
        <PriceRung key={r.key} label={r.label} level={r.level} color={r.color} />
      ))}
    </div>
  );
}

function LegRow({ leg }: { leg: SignalActionLeg }) {
  const isBuy = String(leg.side).toUpperCase() === 'BUY';
  const sideColor = isBuy ? 'var(--color-bull)' : 'var(--color-bear)';
  const right = String(leg.right).toUpperCase();
  const rightLabel = right === 'C' ? 'Call' : right === 'P' ? 'Put' : right;
  return (
    <div className="flex items-center gap-3 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm">
      <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide" style={{ background: `${sideColor}1f`, color: sideColor }}>
        {String(leg.side).toUpperCase()}
      </span>
      <span className="font-mono">{leg.qty}×</span>
      <span className="font-mono">${Number(leg.strike).toFixed(2)} {rightLabel}</span>
      <span className="ml-auto text-xs text-[var(--color-text-secondary)]">{leg.expiry}</span>
    </div>
  );
}

function TradeCard({ data }: { data: SignalActionResponse }) {
  const action = String(data.action ?? '');
  const pattern = String(data.pattern ?? '—');
  const tier = String(data.tier ?? '—');
  const direction = String(data.direction ?? '—');
  const dirColor = directionColor(direction);
  const legs = Array.isArray(data.legs) ? data.legs : [];
  const alternatives = Array.isArray(data.alternatives_considered) ? data.alternatives_considered : [];
  const sizeMultiplier = typeof data.size_multiplier === 'number' ? data.size_multiplier : null;
  const maxHold = typeof data.max_hold_minutes === 'number' ? data.max_hold_minutes : null;

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-5">
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-sm font-bold uppercase tracking-wide" style={{ background: `${dirColor}1f`, color: dirColor }}>
              <Crosshair size={14} />
              {action.replace(/_/g, ' ')}
            </span>
            <span className="rounded-md border border-[var(--color-border)] px-2 py-0.5 text-xs font-medium">{pattern.replace(/_/g, ' ')}</span>
            <span className="rounded-md border border-[var(--color-border)] px-2 py-0.5 text-xs font-medium">{tier}</span>
            <span className="capitalize rounded-md border px-2 py-0.5 text-xs font-medium" style={{ borderColor: dirColor, color: dirColor }}>
              {direction.replace(/_/g, ' ')}
            </span>
            <span className="rounded-md border border-[var(--color-border)] px-2 py-0.5 text-xs font-medium">{structureLabel(legs.length)}</span>
          </div>
          {data.rationale && (
            <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">{data.rationale}</p>
          )}
          <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-[var(--color-text-secondary)]">
            {sizeMultiplier != null && <span>Size multiplier: <span className="font-mono text-[var(--color-text-primary)]">{sizeMultiplier.toFixed(2)}</span></span>}
            {maxHold != null && <span>Max hold: <span className="font-mono text-[var(--color-text-primary)]">{maxHold} min</span></span>}
            {data.timestamp && <span>Cycle: <span className="font-mono text-[var(--color-text-primary)]">{data.timestamp}</span></span>}
          </div>
        </div>
        <div className="flex flex-col items-center justify-start gap-2 lg:col-span-2">
          <ConfidenceRing value={typeof data.confidence === 'number' ? data.confidence : null} />
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <Target size={14} /> Price ladder
          </div>
          <ActionPriceLadder entry={data.entry} target={data.target} stop={data.stop} />
        </div>
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <TableProperties size={14} /> Legs · {structureLabel(legs.length)}
          </div>
          <div className="flex flex-col gap-2">
            {legs.length === 0 ? (
              <div className="text-xs text-[var(--color-text-secondary)]">No legs reported.</div>
            ) : (
              legs.map((leg, idx) => <LegRow key={idx} leg={leg} />)
            )}
          </div>
        </div>
      </div>

      {alternatives.length > 0 && (
        <div className="mt-5 border-t border-[var(--color-border)]/40 pt-3">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">Alternatives considered</div>
          <ul className="space-y-1 text-xs text-[var(--color-text-secondary)]">
            {alternatives.map((alt: SignalActionAlternative, idx) => (
              <li key={idx}>
                <span className="font-mono text-[var(--color-text-primary)]">{alt.pattern}</span>
                {alt.reason ? <span> — {alt.reason}</span> : null}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function StandDownCard({ data }: { data: SignalActionResponse }) {
  const nearMisses = Array.isArray(data.near_misses) ? data.near_misses : [];

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-5">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1 rounded-md bg-[var(--color-warning-soft)] px-2.5 py-1 text-sm font-bold uppercase tracking-wide text-[var(--color-warning)]">
          <ShieldCheck size={14} />
          STAND DOWN
        </span>
        <span className="rounded-md border border-[var(--color-border)] px-2 py-0.5 text-xs font-medium">non-directional</span>
        <span className="rounded-md border border-[var(--color-border)] px-2 py-0.5 text-xs font-medium">confidence 0.00</span>
        {data.timestamp && <span className="text-[11px] text-[var(--color-text-secondary)] ml-auto font-mono">{data.timestamp}</span>}
      </div>
      {data.rationale && (
        <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">{data.rationale}</p>
      )}
      <div className="mt-4">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">Near misses</div>
        {nearMisses.length === 0 ? (
          <div className="text-xs text-[var(--color-text-secondary)]">No close patterns reported.</div>
        ) : (
          <ul className="space-y-2 text-xs">
            {nearMisses.map((nm: SignalActionNearMiss, idx) => (
              <li key={idx} className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2">
                <div className="font-mono text-sm text-[var(--color-text-primary)]">{nm.pattern}</div>
                {Array.isArray(nm.missing) && nm.missing.length > 0 && (
                  <ul className="mt-1 list-disc pl-4 text-[var(--color-text-secondary)]">
                    {nm.missing.map((m, i) => (
                      <li key={i}>{m}</li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
