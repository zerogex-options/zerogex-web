'use client';

import { useMemo, useState } from 'react';
import { useApiData } from '@/hooks/useApiData';
import { Area, AreaChart, ResponsiveContainer, Tooltip } from 'recharts';
import type { BotRow, EquityCurveResponse } from './types';

interface Props {
  bot: BotRow;
  onOpen: () => void;
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

interface FollowResponse {
  follows: Array<{ bot_id: string; channels: Record<string, boolean> }>;
}

async function postFollow(botId: string): Promise<void> {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? '';
  await fetch(`${baseUrl}/api/tradeworkz/bots/${botId}/follow`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ channels: { in_app: true } }),
  });
}

async function deleteFollow(botId: string): Promise<void> {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? '';
  await fetch(`${baseUrl}/api/tradeworkz/bots/${botId}/follow`, {
    method: 'DELETE',
    credentials: 'include',
  });
}

export default function BotRosterCard({ bot, onOpen }: Props) {
  const sparkline = useApiData<EquityCurveResponse>(
    `/api/tradeworkz/bots/${bot.id}/equity-curve?days=30`,
    { refreshInterval: 60_000 },
  );
  const follows = useApiData<FollowResponse>('/api/tradeworkz/me/follows', {
    refreshInterval: 60_000,
  });
  const isFollowing = follows.data?.follows.some((f) => f.bot_id === bot.id) ?? false;
  const [busy, setBusy] = useState(false);

  const sparkData = useMemo(() => {
    const pts = sparkline.data?.points ?? [];
    return pts.map((p) => ({ date: p.session_date, nav: p.ending_nav }));
  }, [sparkline.data]);

  const lifetimeReturn = bot.lifetime_return_pct ?? 0;
  const trend30d = bot.pnl_30d ?? 0;
  const isBull = lifetimeReturn >= 0;

  const handleFollow = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (busy) return;
    setBusy(true);
    try {
      if (isFollowing) await deleteFollow(bot.id);
      else await postFollow(bot.id);
      follows.refetch();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      onClick={onOpen}
      className="p-5 rounded-2xl cursor-pointer transition-all hover:scale-[1.01]"
      style={{
        backgroundColor: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        boxShadow: '0 4px 12px var(--color-info-soft)',
      }}
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="min-w-0">
          <h3 className="font-semibold text-[var(--color-text-primary)] leading-tight">
            {bot.display_name}
          </h3>
          <div className="text-[11px] text-[var(--color-text-secondary)] uppercase tracking-wider mt-1">
            {bot.tier} · {bot.direction_mode}
          </div>
        </div>
        <div className="flex-shrink-0">
          <span
            className="text-[10px] px-2 py-0.5 rounded-full"
            style={{
              backgroundColor: bot.enabled ? 'var(--color-bull-soft)' : 'var(--color-bear-soft)',
              color: bot.enabled ? 'var(--color-bull)' : 'var(--color-bear)',
            }}
          >
            {bot.enabled ? 'LIVE' : 'PAUSED'}
          </span>
        </div>
      </div>

      {bot.tagline ? (
        <p className="text-xs text-[var(--color-text-secondary)] mb-3 line-clamp-2">
          {bot.tagline}
        </p>
      ) : null}

      <div className="h-16 mb-3">
        {sparkData.length >= 2 ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={sparkData} margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
              <defs>
                <linearGradient id={`spark-${bot.id}`} x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="0%"
                    stopColor={isBull ? 'var(--color-bull)' : 'var(--color-bear)'}
                    stopOpacity={0.4}
                  />
                  <stop
                    offset="100%"
                    stopColor={isBull ? 'var(--color-bull)' : 'var(--color-bear)'}
                    stopOpacity={0}
                  />
                </linearGradient>
              </defs>
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 8,
                  fontSize: 12,
                }}
                formatter={(value) => fmtMoney(Number(value))}
                labelFormatter={(label) => String(label)}
              />
              <Area
                type="monotone"
                dataKey="nav"
                stroke={isBull ? 'var(--color-bull)' : 'var(--color-bear)'}
                strokeWidth={2}
                fill={`url(#spark-${bot.id})`}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full flex items-center justify-center text-[11px] text-[var(--color-text-secondary)]">
            equity curve loading…
          </div>
        )}
      </div>

      <div className="grid grid-cols-4 gap-2 mb-3">
        <StatCell label="1D" value={fmtMoney(bot.pnl_1d)} tone={bot.pnl_1d >= 0 ? 'bull' : 'bear'} />
        <StatCell label="7D" value={fmtMoney(bot.pnl_7d)} tone={bot.pnl_7d >= 0 ? 'bull' : 'bear'} />
        <StatCell label="30D" value={fmtMoney(trend30d)} tone={trend30d >= 0 ? 'bull' : 'bear'} />
        <StatCell label="YTD" value={fmtMoney(bot.pnl_365d)} tone={bot.pnl_365d >= 0 ? 'bull' : 'bear'} />
      </div>

      <div className="flex items-center justify-between gap-3 pt-3 border-t border-[var(--color-border)]">
        <div className="text-xs text-[var(--color-text-secondary)]">
          <div>
            NAV{' '}
            <span className="text-[var(--color-text-primary)] font-medium">
              {fmtMoney(bot.current_capital)}
            </span>
          </div>
          <div>
            Win {fmtPct(bot.lifetime_win_rate, 1)} · {bot.lifetime_trades} trades
          </div>
        </div>
        <button
          onClick={handleFollow}
          disabled={busy}
          className="text-xs px-3 py-1.5 rounded-full transition-colors"
          style={{
            backgroundColor: isFollowing ? 'var(--color-bull-soft)' : 'var(--color-info-soft)',
            color: isFollowing ? 'var(--color-bull)' : 'var(--color-info)',
            border: `1px solid ${isFollowing ? 'var(--color-bull)' : 'var(--color-info)'}`,
            opacity: busy ? 0.5 : 1,
          }}
        >
          {isFollowing ? '✓ Following' : 'Follow'}
        </button>
      </div>
    </div>
  );
}

function StatCell({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: 'bull' | 'bear';
}) {
  return (
    <div>
      <div className="text-[10px] text-[var(--color-text-secondary)] uppercase tracking-wider">
        {label}
      </div>
      <div
        className="text-xs font-medium tabular-nums"
        style={{ color: tone === 'bull' ? 'var(--color-bull)' : 'var(--color-bear)' }}
      >
        {value}
      </div>
    </div>
  );
}
