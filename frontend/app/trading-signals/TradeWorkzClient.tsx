'use client';

/**
 * TradeWorkz™ — competitive multi-bot signaled-trading dashboard.
 *
 * Layout:
 *  1. Fleet summary hero (fleet P&L, live positions, best/worst bot 24h).
 *  2. Leaderboard with period toggle (Today / Week / Month / Year / Lifetime).
 *  3. Fleet roster — one card per bot with sparkline equity + trend chips.
 *  4. Bot drilldown modal — equity curve + recent trades + ML state.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useApiData } from '@/hooks/useApiData';
import LoadingSpinner from '@/components/LoadingSpinner';
import ErrorMessage from '@/components/ErrorMessage';
import MetricCard from '@/components/MetricCard';
import TooltipWrapper from '@/components/TooltipWrapper';
import { useTheme } from '@/core/ThemeContext';
import BotDetailPanel from './BotDetailPanel';
import BotRosterCard from './BotRosterCard';
import LeaderboardTable from './LeaderboardTable';
import { PERIOD_OPTIONS } from './types';
import type {
  BotListResponse,
  FleetSummary,
  LeaderboardResponse,
  PeriodKey,
} from './types';

function formatMoney(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(1)}K`;
  return `${sign}$${abs.toFixed(2)}`;
}

function formatPct(value: number | null | undefined, digits = 2): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return `${(value * 100).toFixed(digits)}%`;
}

export default function TradeWorkzClient() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [period, setPeriod] = useState<PeriodKey>('all');
  const [selectedBotId, setSelectedBotId] = useState<string | null>(null);

  const summary = useApiData<FleetSummary>('/api/tradeworkz/summary', {
    refreshInterval: 15_000,
  });
  const botsData = useApiData<BotListResponse>('/api/tradeworkz/bots', {
    refreshInterval: 20_000,
  });
  const leaderboard = useApiData<LeaderboardResponse>(
    `/api/tradeworkz/leaderboard?period=${period}`,
    { refreshInterval: 20_000 },
  );

  const bots = botsData.data?.bots ?? [];
  const sortedBots = useMemo(
    () => [...bots].sort((a, b) => (b.lifetime_pnl ?? 0) - (a.lifetime_pnl ?? 0)),
    [bots],
  );

  const onSelectBot = useCallback((id: string) => setSelectedBotId(id), []);
  const onClose = useCallback(() => setSelectedBotId(null), []);

  useEffect(() => {
    if (selectedBotId && !bots.find((b) => b.id === selectedBotId)) {
      setSelectedBotId(null);
    }
  }, [selectedBotId, bots]);

  const summaryLoading = summary.loading && !summary.data;
  const summaryError = summary.error && !summary.data;

  return (
    <div className="min-h-screen">
      <div className="container mx-auto max-w-7xl px-4 py-8">
        <header className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-bold text-[var(--color-text-primary)]">
              TradeWorkz<span className="text-xs align-top ml-1">™</span>
            </h1>
            <span
              className="text-[10px] uppercase tracking-widest px-2 py-1 rounded"
              style={{
                backgroundColor: 'var(--color-info-soft)',
                color: 'var(--color-info)',
              }}
            >
              Admin Beta
            </span>
          </div>
          <p className="text-sm text-[var(--color-text-secondary)] max-w-3xl">
            A competing fleet of autonomous trading bots. Each bot owns a
            capital sleeve, an entry / exit rule set (put/call wall bouncer,
            gamma-flip defender, EOD pin drifter, …), and a per-bot online-ML
            calibrator. Leaderboard ranks by realized P&amp;L over the selected
            period.
          </p>
        </header>

        {summaryError ? (
          <ErrorMessage message={summary.error ?? 'Failed to load'} onRetry={summary.refetch} />
        ) : summaryLoading ? (
          <LoadingSpinner />
        ) : summary.data ? (
          <section className="mb-10">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <MetricCard
                title="Fleet NAV"
                value={formatMoney(summary.data.fleet_capital_current)}
                subtitle={`Start: ${formatMoney(summary.data.fleet_capital_starting)}`}
                trend={
                  (summary.data.fleet_return_pct ?? 0) >= 0 ? 'bullish' : 'bearish'
                }
                tooltip="Sum of live bot capital sleeves + unrealized P&L."
              />
              <MetricCard
                title="Realized P&L Today"
                value={formatMoney(summary.data.realized_pnl_today)}
                subtitle={`${summary.data.trades_today ?? 0} trades · ${
                  summary.data.wins_today ?? 0
                } wins`}
                trend={summary.data.realized_pnl_today >= 0 ? 'bullish' : 'bearish'}
                tooltip="Sum of realized P&L across every bot's closed trades today."
              />
              <MetricCard
                title="Live Positions"
                value={String(summary.data.live_positions ?? 0)}
                subtitle={`Unrealized ${formatMoney(summary.data.unrealized_pnl)}`}
                trend={summary.data.unrealized_pnl >= 0 ? 'bullish' : 'bearish'}
                tooltip="Every bot's open positions and combined unrealized P&L."
              />
              <MetricCard
                title="Bots in Fleet"
                value={String(summary.data.n_bots ?? 0)}
                subtitle={
                  summary.data.best_bot_id
                    ? `Best 24h: ${summary.data.best_bot_id.replace(/_/g, ' ')} · ${formatMoney(
                        summary.data.best_bot_pnl,
                      )}`
                    : 'Awaiting first trades'
                }
                tooltip="Number of enabled bots and the top performer over the last 24 hours."
              />
            </div>
          </section>
        ) : null}

        <section className="mb-10">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-4 gap-3">
            <div>
              <h2 className="text-xl font-semibold text-[var(--color-text-primary)]">
                Leaderboard
              </h2>
              <p className="text-xs text-[var(--color-text-secondary)]">
                Ranked by realized P&amp;L over the selected window. Click a bot
                row to open its drilldown.
              </p>
            </div>
            <div className="flex gap-2 flex-wrap">
              {PERIOD_OPTIONS.map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => setPeriod(opt.key)}
                  className="px-3 py-1.5 text-xs font-medium rounded-full transition-colors"
                  style={{
                    backgroundColor:
                      period === opt.key
                        ? 'var(--color-info)'
                        : isDark
                        ? 'var(--color-surface)'
                        : 'var(--color-surface-subtle)',
                    color:
                      period === opt.key ? 'var(--color-on-info)' : 'var(--color-text-primary)',
                    border: `1px solid ${period === opt.key ? 'var(--color-info)' : 'var(--color-border)'}`,
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <LeaderboardTable
            data={leaderboard.data}
            loading={leaderboard.loading}
            error={leaderboard.error}
            onSelect={onSelectBot}
            selectedBotId={selectedBotId}
          />
        </section>

        <section className="mb-10">
          <h2 className="text-xl font-semibold text-[var(--color-text-primary)] mb-4">
            The Fleet
          </h2>
          {botsData.loading && !botsData.data ? (
            <LoadingSpinner />
          ) : botsData.error && !botsData.data ? (
            <ErrorMessage message={botsData.error} onRetry={botsData.refetch} />
          ) : sortedBots.length === 0 ? (
            <div
              className="p-8 rounded-2xl text-center"
              style={{
                backgroundColor: isDark ? 'var(--color-surface)' : 'var(--color-surface-subtle)',
                border: '1px solid var(--color-border)',
              }}
            >
              <p className="text-sm text-[var(--color-text-secondary)] mb-3">
                No bots provisioned yet. On the first API boot the default
                roster (put/call wall bouncer, gamma-flip defender, EOD pin
                drifter, …) is seeded automatically.
              </p>
              <TooltipWrapper text="Trigger provisioning via POST /api/tradeworkz/admin/provision.">
                <span className="text-xs text-[var(--color-text-secondary)] underline">
                  How to provision
                </span>
              </TooltipWrapper>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {sortedBots.map((bot) => (
                <BotRosterCard
                  key={bot.id}
                  bot={bot}
                  onOpen={() => onSelectBot(bot.id)}
                />
              ))}
            </div>
          )}
        </section>

        {selectedBotId ? (
          <BotDetailPanel botId={selectedBotId} onClose={onClose} />
        ) : null}
      </div>
    </div>
  );
}
