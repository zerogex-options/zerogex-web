'use client';

/**
 * BotRosterCard — one card per bot in the fleet grid.
 *
 * Composition:
 *   - Left-edge color rail (identity, never rank).
 *   - Header: display name, tier chip, LIVE / PAUSED status.
 *   - Tagline.
 *   - 30-day equity sparkline in the bot's identity color.
 *   - Four period P&L chips (1D / 7D / 30D / YTD).
 *   - Footer: NAV + hit-rate + trade count + follow button.
 *
 * A user should be able to tell whether a bot is winning without reading
 * anything but color and shape.
 */

import { useMemo } from 'react';
import { useApiData } from '@/hooks/useApiData';
import FollowControl from './FollowControl';
import Sparkline from './Sparkline';
import { botColor, botColorSoft } from './palette';
import { fmtMoney, fmtPct, fmtSignedMoney, toneVar } from './format';
import type { BotRow, EquityCurveResponse } from './types';

interface Props {
  bot: BotRow;
  onOpen: () => void;
  selected?: boolean;
  paletteIndex?: number;
  followed: boolean;
  onFollowChanged: () => void;
  onOptimisticFollow?: (botId: string, followed: boolean) => void;
}

export default function BotRosterCard({
  bot,
  onOpen,
  selected = false,
  paletteIndex = 0,
  followed,
  onFollowChanged,
  onOptimisticFollow,
}: Props) {
  const sparkline = useApiData<EquityCurveResponse>(
    `/api/tradeworkz/bots/${bot.id}/equity-curve?days=30`,
    { refreshInterval: 60_000 },
  );
  const color = botColor(bot.id, paletteIndex);

  const sparkPoints = useMemo(
    () => sparkline.data?.points.map((p) => p.ending_nav) ?? [],
    [sparkline.data],
  );

  return (
    <div
      onClick={onOpen}
      className="relative rounded-2xl cursor-pointer transition-all overflow-hidden group"
      style={{
        backgroundColor: 'var(--color-surface)',
        border: `1px solid ${selected ? color : 'var(--color-border)'}`,
        boxShadow: selected
          ? `0 12px 24px ${botColorSoft(bot.id, paletteIndex)}`
          : '0 2px 8px rgba(0,0,0,0.04)',
      }}
    >
      <div
        className="absolute inset-y-0 left-0 w-1"
        style={{ backgroundColor: color }}
        aria-hidden
      />
      <div className="p-5 pl-6">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="min-w-0 flex-1">
            <h3
              className="font-semibold leading-tight truncate"
              style={{ color: selected ? color : 'var(--color-text-primary)' }}
            >
              {bot.display_name}
            </h3>
            <div className="text-[10px] text-[var(--color-text-secondary)] uppercase tracking-wider mt-1 flex items-center gap-2">
              <span
                className="px-1.5 py-0.5 rounded"
                style={{ backgroundColor: botColorSoft(bot.id, paletteIndex), color }}
              >
                {bot.tier}
              </span>
              <span>{bot.direction_mode}</span>
              <span aria-hidden>·</span>
              <span>{bot.universe}</span>
            </div>
          </div>
          <span
            className="text-[10px] px-2 py-0.5 rounded-full whitespace-nowrap"
            style={{
              backgroundColor: bot.enabled ? 'var(--color-bull-soft)' : 'var(--color-bear-soft)',
              color: bot.enabled ? 'var(--color-bull)' : 'var(--color-bear)',
            }}
          >
            {bot.enabled ? 'LIVE' : 'PAUSED'}
          </span>
        </div>

        {bot.tagline ? (
          <p className="text-xs text-[var(--color-text-secondary)] leading-snug mb-4 line-clamp-2">
            {bot.tagline}
          </p>
        ) : null}

        <div className="mb-4">
          {sparkline.loading && sparkPoints.length === 0 ? (
            <div
              className="rounded-md"
              style={{ height: 60, backgroundColor: 'var(--color-surface-subtle)' }}
            />
          ) : (
            <Sparkline
              values={sparkPoints}
              color={color}
              baseline={sparkPoints[0]}
              width={340}
              height={60}
              showEndDot
              ariaLabel={`${bot.display_name} 30-day equity`}
            />
          )}
        </div>

        <div className="grid grid-cols-4 gap-2 mb-4">
          <PnlChip label="1D" value={bot.pnl_1d} />
          <PnlChip label="7D" value={bot.pnl_7d} />
          <PnlChip label="30D" value={bot.pnl_30d} />
          <PnlChip label="YTD" value={bot.pnl_365d} />
        </div>

        <div className="flex items-center justify-between gap-3 pt-3 border-t border-[var(--color-border)]/60">
          <div className="text-xs text-[var(--color-text-secondary)] leading-tight">
            <div>
              <span className="text-[var(--color-text-primary)] font-medium tabular-nums">
                {fmtMoney(bot.current_capital)}
              </span>{' '}
              <span className="text-[10px]" style={{ color: toneVar(bot.lifetime_pnl) }}>
                {fmtSignedMoney(bot.lifetime_pnl)}
              </span>
            </div>
            <div className="mt-0.5">
              Hit rate {fmtPct(bot.lifetime_win_rate, 1)} · {bot.lifetime_trades} trades
            </div>
          </div>
          <FollowControl
            botId={bot.id}
            paletteIndex={paletteIndex}
            followed={followed}
            onFollowChanged={onFollowChanged}
            onOptimisticFollow={onOptimisticFollow}
          />
        </div>
      </div>
    </div>
  );
}

function PnlChip({ label, value }: { label: string; value: number | null | undefined }) {
  const v = value ?? 0;
  const positive = v >= 0;
  return (
    <div>
      <div className="text-[10px] text-[var(--color-text-secondary)] uppercase tracking-wider">
        {label}
      </div>
      <div
        className="text-[12px] font-medium tabular-nums leading-tight mt-0.5"
        style={{ color: positive ? 'var(--color-bull)' : 'var(--color-bear)' }}
      >
        {fmtSignedMoney(v)}
      </div>
    </div>
  );
}
