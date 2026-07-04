'use client';

/**
 * TradeWorkz™ competing-bot dashboard.
 *
 * Layout (top → bottom):
 *   1. Header + admin action row (seed / clear demo data).
 *   2. Fleet summary hero (4 stat tiles + best/worst callouts).
 *   3. Fleet-wide overlaid equity chart (indexed to 100, one line per bot).
 *   4. Period-switchable leaderboard with inline sparklines.
 *   5. Fleet roster grid — one card per bot.
 *   6. Drilldown modal on bot click (portal).
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { useApiData } from '@/hooks/useApiData';
import { useAuthSession } from '@/hooks/useAuthSession';
import TooltipWrapper from '@/components/TooltipWrapper';
import BotDetailPanel from './BotDetailPanel';
import BotRosterCard from './BotRosterCard';
import EmptyState from './EmptyState';
import FleetOverviewChart from './FleetOverviewChart';
import LeaderboardTable from './LeaderboardTable';
import NotificationBell from './NotificationBell';
import { RosterSkeleton, SummarySkeleton } from './Skeleton';
import { botColor } from './palette';
import { fmtMoney, fmtSignedMoney, fmtSignedPct, toneVar } from './format';
import { PERIOD_OPTIONS } from './types';
import type {
  BotEquityBundle,
  BotListResponse,
  EquityBundlesResponse,
  FleetSummary,
  PeriodKey,
} from './types';

interface FollowResponse {
  follows: Array<{ bot_id: string; channels: Record<string, boolean> }>;
}

const AUTO_REFRESH_MS = 15_000;

export default function TradeWorkzClient() {
  const [period, setPeriod] = useState<PeriodKey>('30d');
  const [selectedBotId, setSelectedBotId] = useState<string | null>(null);
  const [simMessage, setSimMessage] = useState<string | null>(null);
  const [simBusy, setSimBusy] = useState(false);

  const session = useAuthSession();
  const isAdmin = session.data?.user?.tier === 'admin';

  const summary = useApiData<FleetSummary>('/api/tradeworkz/summary', {
    refreshInterval: AUTO_REFRESH_MS,
  });
  const botsData = useApiData<BotListResponse>('/api/tradeworkz/bots', {
    refreshInterval: AUTO_REFRESH_MS,
  });
  const leaderboard = useApiData<{ period: string; leaderboard: import('./types').LeaderboardEntry[] }>(
    `/api/tradeworkz/leaderboard?period=${period}`,
    { refreshInterval: AUTO_REFRESH_MS },
  );
  const follows = useApiData<FollowResponse>('/api/tradeworkz/me/follows', {
    refreshInterval: 60_000,
  });
  const equityBundlesRes = useApiData<EquityBundlesResponse>(
    '/api/tradeworkz/equity-curves?days=90',
    { refreshInterval: 60_000 },
  );

  const bots = botsData.data?.bots ?? [];
  const sortedBots = useMemo(
    () => [...bots].sort((a, b) => (b.lifetime_pnl ?? 0) - (a.lifetime_pnl ?? 0)),
    [bots],
  );

  const followedIds = useMemo(
    () => new Set((follows.data?.follows ?? []).map((f) => f.bot_id)),
    [follows.data],
  );

  const paletteIndex = useCallback(
    (botId: string) => {
      const i = bots.findIndex((b) => b.id === botId);
      return i >= 0 ? i : 0;
    },
    [bots],
  );

  const onSelectBot = useCallback((id: string) => setSelectedBotId(id), []);
  const onCloseDetail = useCallback(() => setSelectedBotId(null), []);

  useEffect(() => {
    if (selectedBotId && !bots.find((b) => b.id === selectedBotId)) {
      setSelectedBotId(null);
    }
  }, [selectedBotId, bots]);

  const equityBundles = useMemo(
    () => equityBundlesRes.data?.bundles ?? [],
    [equityBundlesRes.data],
  );
  const bundleByBot = useMemo(() => {
    const m = new Map<string, BotEquityBundle>();
    for (const b of equityBundles) m.set(b.bot_id, b);
    return m;
  }, [equityBundles]);

  const summaryLoading = summary.loading && !summary.data;
  const summaryError = summary.error && !summary.data;

  const bestBot = summary.data?.best_bot_id
    ? bots.find((b) => b.id === summary.data!.best_bot_id) ?? null
    : null;
  const worstBot = summary.data?.worst_bot_id
    ? bots.find((b) => b.id === summary.data!.worst_bot_id) ?? null
    : null;

  const runSimulate = useCallback(async () => {
    if (simBusy) return;
    setSimBusy(true);
    setSimMessage(null);
    try {
      const res = await fetch('/api/tradeworkz/admin/simulate', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ days: 60, seed: 42 }),
      });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`HTTP ${res.status}: ${body.slice(0, 200)}`);
      }
      const data = await res.json();
      setSimMessage(
        `Seeded ${data.total_trades ?? 0} synthetic trades across ${
          data.bots_simulated?.length ?? 0
        } bots (${data.days_simulated ?? 0} sessions).`,
      );
      summary.refetch();
      botsData.refetch();
      leaderboard.refetch();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setSimMessage(`Simulate failed: ${message}`);
    } finally {
      setSimBusy(false);
    }
  }, [simBusy, summary, botsData, leaderboard]);

  const runClear = useCallback(async () => {
    if (simBusy) return;
    setSimBusy(true);
    setSimMessage(null);
    try {
      const res = await fetch('/api/tradeworkz/admin/simulate/clear', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setSimMessage('Cleared simulated history. Fleet reset to starting capital.');
      summary.refetch();
      botsData.refetch();
      leaderboard.refetch();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setSimMessage(`Clear failed: ${message}`);
    } finally {
      setSimBusy(false);
    }
  }, [simBusy, summary, botsData, leaderboard]);

  return (
    <div className="min-h-screen">
      <div className="container mx-auto max-w-7xl px-4 py-8">
        <header className="mb-6 flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-bold text-[var(--color-text-primary)]">
                TradeWorkz<span className="text-xs align-top ml-1">™</span>
              </h1>
              <span
                className="text-[10px] uppercase tracking-widest px-2 py-1 rounded"
                style={{ backgroundColor: 'var(--color-info-soft)', color: 'var(--color-info)' }}
              >
                Admin Beta
              </span>
            </div>
            <p className="text-sm text-[var(--color-text-secondary)] max-w-3xl leading-relaxed">
              A competing fleet of autonomous trading bots. Each bot owns a capital sleeve, an
              entry / exit rule set, and a per-bot online-ML calibrator. Leaderboard ranks by
              realized P&amp;L over the selected window.
            </p>
          </div>
          <div className="flex flex-col items-start md:items-end gap-2">
            <div className="flex items-center gap-2">
              <NotificationBell />
              {isAdmin ? (
                <>
                  <TooltipWrapper text="Wipe existing history and seed 60 sessions of deterministic synthetic trades per bot. Admin only.">
                    <button
                      onClick={runSimulate}
                      disabled={simBusy}
                      className="inline-flex items-center gap-2 text-xs font-medium px-3 py-2 rounded-full transition-colors"
                      style={{
                        backgroundColor: 'var(--color-info)',
                        color: 'var(--color-on-info, #ffffff)',
                        opacity: simBusy ? 0.6 : 1,
                      }}
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      Seed demo data
                    </button>
                  </TooltipWrapper>
                  <TooltipWrapper text="Wipe every bot's trade / equity / metrics / ml_state back to the pre-trade baseline. Admin only.">
                    <button
                      onClick={runClear}
                      disabled={simBusy}
                      className="text-xs font-medium px-3 py-2 rounded-full transition-colors"
                      style={{
                        backgroundColor: 'transparent',
                        color: 'var(--color-text-secondary)',
                        border: '1px solid var(--color-border)',
                        opacity: simBusy ? 0.6 : 1,
                      }}
                    >
                      Clear
                    </button>
                  </TooltipWrapper>
                </>
              ) : null}
            </div>
            {simMessage ? (
              <div
                className="text-[11px] max-w-xs md:text-right"
                style={{ color: simMessage.startsWith('Cleared') || simMessage.startsWith('Seeded') ? 'var(--color-bull)' : 'var(--color-bear)' }}
              >
                {simMessage}
              </div>
            ) : null}
          </div>
        </header>

        <section className="mb-6">
          {summaryError ? (
            <EmptyState title="Summary unavailable" description={summary.error ?? 'Failed to load fleet summary'} />
          ) : summaryLoading ? (
            <SummarySkeleton />
          ) : summary.data ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatTile
                label="Fleet NAV"
                value={fmtMoney(summary.data.fleet_capital_current)}
                subline={`Start ${fmtMoney(summary.data.fleet_capital_starting)}`}
                tone={toneVar(summary.data.fleet_return_pct)}
                delta={
                  summary.data.fleet_return_pct !== null
                    ? fmtSignedPct(summary.data.fleet_return_pct, 2)
                    : null
                }
              />
              <StatTile
                label="Realized P&L Today"
                value={fmtSignedMoney(summary.data.realized_pnl_today)}
                subline={`${summary.data.trades_today} trades · ${summary.data.wins_today} wins`}
                tone={toneVar(summary.data.realized_pnl_today)}
              />
              <StatTile
                label="Live Positions"
                value={String(summary.data.live_positions)}
                subline={`Unrealized ${fmtSignedMoney(summary.data.unrealized_pnl)}`}
                tone={toneVar(summary.data.unrealized_pnl)}
              />
              <StatTile
                label="Bots in Fleet"
                value={String(summary.data.n_bots)}
                subline="Slice: fleet capital / bots"
                tone="var(--color-text-secondary)"
              />
            </div>
          ) : null}
        </section>

        {(bestBot || worstBot) && summary.data ? (
          <section className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            {bestBot ? (
              <Callout
                label="Best 24h"
                bot={bestBot.display_name}
                botId={bestBot.id}
                paletteIndex={paletteIndex(bestBot.id)}
                value={fmtSignedMoney(summary.data.best_bot_pnl)}
                tone="var(--color-bull)"
                onClick={() => onSelectBot(bestBot.id)}
              />
            ) : null}
            {worstBot ? (
              <Callout
                label="Worst 24h"
                bot={worstBot.display_name}
                botId={worstBot.id}
                paletteIndex={paletteIndex(worstBot.id)}
                value={fmtSignedMoney(summary.data.worst_bot_pnl)}
                tone="var(--color-bear)"
                onClick={() => onSelectBot(worstBot.id)}
              />
            ) : null}
          </section>
        ) : null}

        <section className="mb-8">
          <div className="flex items-center justify-between mb-3 gap-3">
            <div>
              <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
                Fleet Performance
              </h2>
              <p className="text-xs text-[var(--color-text-secondary)]">
                90-day cumulative return, indexed to 100 at the start of each bot's window.
              </p>
            </div>
          </div>
          <div
            className="rounded-2xl p-4"
            style={{
              backgroundColor: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
            }}
          >
            {equityBundles.length === 0 || equityBundles.every((b) => b.points.length < 2) ? (
              <div className="h-52 flex items-center justify-center text-xs text-[var(--color-text-secondary)]">
                Fleet equity curves appear here once bots have at least two closed sessions.
              </div>
            ) : (
              <>
                <FleetOverviewChart
                  bundles={equityBundles}
                  selectedBotId={selectedBotId}
                  onSelect={onSelectBot}
                />
                <FleetLegend
                  bots={bots.map((b) => ({ id: b.id, name: b.display_name }))}
                  selectedBotId={selectedBotId}
                  onSelect={onSelectBot}
                />
              </>
            )}
          </div>
        </section>

        <section className="mb-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-3 gap-3">
            <div>
              <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
                Leaderboard
              </h2>
              <p className="text-xs text-[var(--color-text-secondary)]">
                Ranked by realized P&amp;L over the selected window. Row click opens the drilldown.
              </p>
            </div>
            <PeriodToggle current={period} onChange={setPeriod} />
          </div>
          <LeaderboardTable
            data={leaderboard.data ?? null}
            loading={leaderboard.loading}
            error={leaderboard.error}
            onSelect={onSelectBot}
            selectedBotId={selectedBotId}
            sparklineByBot={bundleByBot}
            bots={bots}
            followedIds={followedIds}
            onFollowChanged={follows.refetch}
          />
        </section>

        <section className="mb-10">
          <div className="flex items-center justify-between mb-3 gap-3">
            <div>
              <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
                The Fleet
              </h2>
              <p className="text-xs text-[var(--color-text-secondary)]">
                Every bot: identity color, 30-day equity curve, and rolling P&amp;L windows.
              </p>
            </div>
          </div>
          {botsData.loading && !botsData.data ? (
            <RosterSkeleton />
          ) : botsData.error && !botsData.data ? (
            <EmptyState title="Roster unavailable" description={botsData.error} />
          ) : sortedBots.length === 0 ? (
            <EmptyState
              title="No bots provisioned"
              description="On first API boot the default roster is auto-seeded. If you're seeing this and the API is up, hit POST /api/tradeworkz/admin/provision to re-run seeding."
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {sortedBots.map((bot) => (
                <BotRosterCard
                  key={bot.id}
                  bot={bot}
                  paletteIndex={paletteIndex(bot.id)}
                  onOpen={() => onSelectBot(bot.id)}
                  selected={selectedBotId === bot.id}
                  followed={followedIds.has(bot.id)}
                  onFollowChanged={follows.refetch}
                />
              ))}
            </div>
          )}
        </section>

        {selectedBotId ? (
          <BotDetailPanel
            botId={selectedBotId}
            paletteIndex={paletteIndex(selectedBotId)}
            onClose={onCloseDetail}
          />
        ) : null}
      </div>
    </div>
  );
}

function PeriodToggle({
  current,
  onChange,
}: {
  current: PeriodKey;
  onChange: (key: PeriodKey) => void;
}) {
  return (
    <div
      className="inline-flex rounded-full p-1"
      style={{
        backgroundColor: 'var(--color-surface-subtle)',
        border: '1px solid var(--color-border)',
      }}
    >
      {PERIOD_OPTIONS.map((opt) => {
        const active = opt.key === current;
        return (
          <button
            key={opt.key}
            onClick={() => onChange(opt.key)}
            className="text-xs px-3 py-1.5 rounded-full transition-colors font-medium"
            style={{
              backgroundColor: active ? 'var(--color-info)' : 'transparent',
              color: active ? 'var(--color-on-info, #ffffff)' : 'var(--color-text-secondary)',
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function StatTile({
  label,
  value,
  subline,
  tone,
  delta,
}: {
  label: string;
  value: string;
  subline: string;
  tone: string;
  delta?: string | null;
}) {
  return (
    <div
      className="p-5 rounded-2xl"
      style={{
        backgroundColor: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
      }}
    >
      <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-secondary)] mb-2">
        {label}
      </div>
      <div className="flex items-baseline gap-2 flex-wrap">
        <div className="text-2xl font-semibold tabular-nums" style={{ color: tone }}>
          {value}
        </div>
        {delta ? (
          <div className="text-xs font-medium tabular-nums" style={{ color: tone }}>
            {delta}
          </div>
        ) : null}
      </div>
      <div className="text-[11px] text-[var(--color-text-secondary)] mt-1">{subline}</div>
    </div>
  );
}

function Callout({
  label,
  bot,
  botId,
  paletteIndex,
  value,
  tone,
  onClick,
}: {
  label: string;
  bot: string;
  botId: string;
  paletteIndex: number;
  value: string;
  tone: string;
  onClick: () => void;
}) {
  const color = botColor(botId, paletteIndex);
  return (
    <button
      onClick={onClick}
      className="text-left p-4 rounded-2xl transition-all hover:scale-[1.01]"
      style={{
        backgroundColor: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
      }}
    >
      <div className="flex items-center gap-3">
        <span
          className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0"
          style={{ backgroundColor: color }}
          aria-hidden
        />
        <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-secondary)]">
          {label}
        </div>
      </div>
      <div className="flex items-baseline justify-between gap-4 mt-2">
        <div className="font-semibold text-[var(--color-text-primary)] truncate">{bot}</div>
        <div className="text-lg font-semibold tabular-nums" style={{ color: tone }}>
          {value}
        </div>
      </div>
    </button>
  );
}

function FleetLegend({
  bots,
  selectedBotId,
  onSelect,
}: {
  bots: Array<{ id: string; name: string }>;
  selectedBotId: string | null;
  onSelect: (botId: string) => void;
}) {
  return (
    <div className="mt-3 flex flex-wrap gap-2 pt-3 border-t border-[var(--color-border)]/60">
      {bots.map((b, i) => {
        const active = selectedBotId === b.id;
        const color = botColor(b.id, i);
        return (
          <button
            key={b.id}
            onClick={() => onSelect(b.id)}
            className="inline-flex items-center gap-2 text-[11px] px-2 py-1 rounded-full transition-colors"
            style={{
              backgroundColor: active ? `${color}22` : 'transparent',
              color: active ? color : 'var(--color-text-secondary)',
              border: `1px solid ${active ? color : 'var(--color-border)'}`,
            }}
          >
            <span
              className="inline-block w-2 h-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: color }}
              aria-hidden
            />
            {b.name}
          </button>
        );
      })}
    </div>
  );
}

