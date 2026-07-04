'use client';

/**
 * Leaderboard — ranked list of the fleet with inline sparklines.
 *
 * Rank is expressed by row position; a bot's identity is expressed by the
 * left-edge color chip (from palette.ts) that never changes with rank.
 * Sparkline is the bot's 30-day cumulative return curve rendered as a hand-
 * rolled SVG so rendering N of them stays cheap.
 */

import { useMemo } from 'react';
import { LeaderboardSkeleton } from './Skeleton';
import Sparkline from './Sparkline';
import EmptyState from './EmptyState';
import FollowControl from './FollowControl';
import { botColor, botColorSoft } from './palette';
import { fmtMoney, fmtPct, fmtSignedPct, toneVar } from './format';
import type { BotEquityBundle, LeaderboardResponse, BotRow } from './types';

interface Props {
  data: LeaderboardResponse | null;
  loading: boolean;
  error: string | null;
  onSelect: (botId: string) => void;
  selectedBotId: string | null;
  sparklineByBot: Map<string, BotEquityBundle>;
  bots: BotRow[]; // for palette index mapping (fixed by roster order)
  followedIds: Set<string>;
  onFollowChanged: () => void;
}

export default function LeaderboardTable({
  data,
  loading,
  error,
  onSelect,
  selectedBotId,
  sparklineByBot,
  bots,
  followedIds,
  onFollowChanged,
}: Props) {
  const rows = useMemo(() => data?.leaderboard ?? [], [data]);
  // Palette index is fixed by the FULL roster order (not the leaderboard
  // ordering) so a bot keeps its color across period toggles.
  const paletteIndexOf = useMemo(() => {
    const m = new Map<string, number>();
    bots.forEach((b, i) => m.set(b.id, i));
    return (id: string) => m.get(id) ?? 0;
  }, [bots]);
  if (loading && !data) return <LeaderboardSkeleton />;
  if (error && !data) {
    return (
      <EmptyState
        title="Leaderboard unavailable"
        description={error}
      />
    );
  }
  if (rows.length === 0) {
    return (
      <EmptyState
        title="No trades yet in this window"
        description="The leaderboard populates as bots close round-trip trades. Change the period above or seed demo data to explore the shape."
      />
    );
  }

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        backgroundColor: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
      }}
    >
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr
              className="border-b"
              style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface-subtle)' }}
            >
              <Th className="pl-5 w-14">Rank</Th>
              <Th>Bot</Th>
              <Th className="w-32 hidden md:table-cell">Trend (30d)</Th>
              <Th align="right" className="hidden md:table-cell">Trades</Th>
              <Th align="right">Win %</Th>
              <Th align="right">Avg %</Th>
              <Th align="right">P&amp;L</Th>
              <Th align="right">Return</Th>
              <Th align="right" className="pr-5 w-14">Follow</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => {
              const isSelected = row.bot_id === selectedBotId;
              const positive = row.pnl >= 0;
              const color = botColor(row.bot_id, idx);
              const sparkPoints =
                sparklineByBot.get(row.bot_id)?.points.map((p) => p.ending_nav) ?? [];
              return (
                <tr
                  key={row.bot_id}
                  onClick={() => onSelect(row.bot_id)}
                  className="cursor-pointer transition-colors border-b border-[var(--color-border)]/40 last:border-b-0"
                  style={{
                    backgroundColor: isSelected ? botColorSoft(row.bot_id, idx) : 'transparent',
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) {
                      (e.currentTarget as HTMLTableRowElement).style.backgroundColor =
                        'var(--color-surface-subtle)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLTableRowElement).style.backgroundColor = isSelected
                      ? botColorSoft(row.bot_id, idx)
                      : 'transparent';
                  }}
                >
                  <td className="pl-5 py-3">
                    <div className="flex items-center gap-2.5">
                      <span
                        className="inline-block w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: color }}
                        aria-hidden
                      />
                      <span className="tabular-nums font-mono text-[var(--color-text-primary)]">
                        {row.rank}
                      </span>
                    </div>
                  </td>
                  <td className="py-3 pr-3">
                    <div
                      className="font-medium text-[var(--color-text-primary)] leading-tight"
                      style={isSelected ? { color } : undefined}
                    >
                      {row.display_name}
                    </div>
                    <div className="text-[11px] text-[var(--color-text-secondary)] uppercase tracking-wider mt-0.5">
                      {row.tier}
                      {row.tagline ? <span className="normal-case tracking-normal"> · {row.tagline}</span> : null}
                    </div>
                  </td>
                  <td className="py-3 hidden md:table-cell">
                    <Sparkline
                      values={sparkPoints}
                      color={color}
                      baseline={sparkPoints[0]}
                      width={96}
                      height={28}
                      ariaLabel={`${row.display_name} 30-day equity curve`}
                    />
                  </td>
                  <td className="py-3 text-right tabular-nums text-[var(--color-text-primary)] hidden md:table-cell">
                    {row.trades}
                  </td>
                  <td className="py-3 text-right tabular-nums text-[var(--color-text-primary)]">
                    {fmtPct(row.win_rate, 1)}
                  </td>
                  <td className="py-3 text-right tabular-nums text-[var(--color-text-primary)]">
                    {fmtPct(row.avg_pnl_pct, 1)}
                  </td>
                  <td
                    className="py-3 text-right tabular-nums font-medium"
                    style={{ color: positive ? 'var(--color-bull)' : 'var(--color-bear)' }}
                  >
                    {fmtMoney(row.pnl)}
                  </td>
                  <td
                    className="py-3 text-right tabular-nums font-medium"
                    style={{ color: toneVar(row.return_pct) }}
                  >
                    {fmtSignedPct(row.return_pct, 2)}
                  </td>
                  <td
                    className="pr-5 py-3 text-right"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="inline-flex">
                      <FollowControl
                        botId={row.bot_id}
                        paletteIndex={paletteIndexOf(row.bot_id)}
                        followed={followedIds.has(row.bot_id)}
                        onFollowChanged={onFollowChanged}
                        variant="icon"
                      />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Th({
  children,
  align = 'left',
  className = '',
}: {
  children: React.ReactNode;
  align?: 'left' | 'right';
  className?: string;
}) {
  return (
    <th
      className={`px-4 py-3 text-${align} text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-secondary)] ${className}`}
    >
      {children}
    </th>
  );
}
