'use client';

import { useMemo } from 'react';
import LoadingSpinner from '@/components/LoadingSpinner';
import ErrorMessage from '@/components/ErrorMessage';
import type { LeaderboardResponse } from './types';

interface Props {
  data: LeaderboardResponse | null;
  loading: boolean;
  error: string | null;
  onSelect: (botId: string) => void;
  selectedBotId: string | null;
}

function fmtMoney(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(1)}K`;
  return `${sign}$${abs.toFixed(2)}`;
}

function fmtPct(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return `${(value * 100).toFixed(digits)}%`;
}

export default function LeaderboardTable({
  data,
  loading,
  error,
  onSelect,
  selectedBotId,
}: Props) {
  const rows = useMemo(() => data?.leaderboard ?? [], [data]);

  if (loading && !data) return <LoadingSpinner />;
  if (error && !data) return <ErrorMessage message={error} />;

  if (rows.length === 0) {
    return (
      <div
        className="p-6 rounded-2xl text-sm text-[var(--color-text-secondary)]"
        style={{
          backgroundColor: 'var(--color-surface-subtle)',
          border: '1px solid var(--color-border)',
        }}
      >
        No closed trades in this window yet.
      </div>
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
            <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface-subtle)]">
              <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
                Rank
              </th>
              <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
                Bot
              </th>
              <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
                Tier
              </th>
              <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
                Trades
              </th>
              <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
                Win Rate
              </th>
              <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
                Avg %
              </th>
              <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
                P&amp;L
              </th>
              <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
                Return
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const isSelected = row.bot_id === selectedBotId;
              const positive = row.pnl >= 0;
              return (
                <tr
                  key={row.bot_id}
                  onClick={() => onSelect(row.bot_id)}
                  className="cursor-pointer transition-colors border-b border-[var(--color-border)]/50 last:border-b-0"
                  style={{
                    backgroundColor: isSelected ? 'var(--color-info-soft)' : 'transparent',
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) {
                      (e.currentTarget as HTMLTableRowElement).style.backgroundColor =
                        'var(--color-surface-subtle)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLTableRowElement).style.backgroundColor =
                      isSelected ? 'var(--color-info-soft)' : 'transparent';
                  }}
                >
                  <td className="px-4 py-3 text-[var(--color-text-primary)] font-mono">
                    #{row.rank}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-[var(--color-text-primary)]">
                      {row.display_name}
                    </div>
                    {row.tagline ? (
                      <div className="text-[11px] text-[var(--color-text-secondary)]">
                        {row.tagline}
                      </div>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-xs text-[var(--color-text-secondary)] uppercase tracking-wider">
                    {row.tier}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-[var(--color-text-primary)]">
                    {row.trades}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-[var(--color-text-primary)]">
                    {fmtPct(row.win_rate, 1)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-[var(--color-text-primary)]">
                    {fmtPct(row.avg_pnl_pct, 1)}
                  </td>
                  <td
                    className="px-4 py-3 text-right tabular-nums font-medium"
                    style={{
                      color: positive ? 'var(--color-bull)' : 'var(--color-bear)',
                    }}
                  >
                    {fmtMoney(row.pnl)}
                  </td>
                  <td
                    className="px-4 py-3 text-right tabular-nums font-medium"
                    style={{
                      color:
                        (row.return_pct ?? 0) >= 0 ? 'var(--color-bull)' : 'var(--color-bear)',
                    }}
                  >
                    {fmtPct(row.return_pct, 2)}
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
