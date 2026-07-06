'use client';

/**
 * FollowControl — direct-toggle Follow / Unfollow affordance.
 *
 * One click toggles the follow state instantly. Newly-followed bots
 * default to the ``in_app`` channel and no conviction floor; the user
 * changes channels / thresholds under Account > Notifications, which
 * is the single source of truth for their per-bot preferences. Keeping
 * the trigger click-to-toggle (no popover) avoids the "click Follow to
 * open the picker, then click Follow again to save" double-click UX
 * that read as a bug.
 *
 * Two variants:
 *   * pill (default) — the roster-card "Follow / ✓ Following" pill.
 *     Painted in --color-info when not-following so the CTA reads as
 *     an active affordance; flips to a bot-color soft/outline state
 *     once followed so a page of followed bots doesn't scream.
 *   * icon — a 28px round Bell / BellDot for the leaderboard, where
 *     the pill would eat too much column width.
 */

import { useCallback, useState } from 'react';
import { Bell, BellDot } from 'lucide-react';
import { botColor, botColorSoft } from './palette';

type Variant = 'pill' | 'icon';

interface Props {
  botId: string;
  paletteIndex: number;
  followed: boolean;
  onFollowChanged: () => void;
  variant?: Variant;
}

async function postFollow(botId: string): Promise<void> {
  await fetch(`/api/tradeworkz/bots/${botId}/follow`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    // Default to in_app only; users manage the rest under Account >
    // Notifications. Keeping the initial POST minimal matches the
    // "toggle first, tune later" UX and stays honest about what the
    // user opted into with one click.
    body: JSON.stringify({ channels: { in_app: true }, min_confidence: 0 }),
  });
}

async function deleteFollow(botId: string): Promise<void> {
  await fetch(`/api/tradeworkz/bots/${botId}/follow`, {
    method: 'DELETE',
    credentials: 'include',
  });
}

export default function FollowControl({
  botId,
  paletteIndex,
  followed,
  onFollowChanged,
  variant = 'pill',
}: Props) {
  const [busy, setBusy] = useState(false);
  const color = botColor(botId, paletteIndex);

  const handleClick = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      if (busy) return;
      setBusy(true);
      try {
        if (followed) await deleteFollow(botId);
        else await postFollow(botId);
        onFollowChanged();
      } finally {
        setBusy(false);
      }
    },
    [busy, followed, botId, onFollowChanged],
  );

  if (variant === 'icon') {
    return (
      <button
        onClick={handleClick}
        disabled={busy}
        aria-label={followed ? 'Unfollow this bot' : 'Follow this bot'}
        aria-pressed={followed}
        title={followed ? 'Following — click to unfollow' : 'Follow this bot'}
        className="inline-flex items-center justify-center w-7 h-7 rounded-full transition-colors"
        style={{
          backgroundColor: followed ? botColorSoft(botId, paletteIndex) : 'transparent',
          color: followed ? color : 'var(--color-text-secondary)',
          border: `1px solid ${followed ? color : 'var(--color-border)'}`,
          opacity: busy ? 0.6 : 1,
        }}
      >
        {followed ? <BellDot className="w-3.5 h-3.5" /> : <Bell className="w-3.5 h-3.5" />}
      </button>
    );
  }

  return (
    <button
      onClick={handleClick}
      disabled={busy}
      aria-pressed={followed}
      className="text-xs px-3 py-1.5 rounded-full transition-colors whitespace-nowrap font-medium"
      style={{
        backgroundColor: followed ? botColorSoft(botId, paletteIndex) : 'var(--color-info)',
        color: followed ? color : 'var(--color-on-info, #ffffff)',
        border: `1px solid ${followed ? color : 'var(--color-info)'}`,
        opacity: busy ? 0.6 : 1,
      }}
    >
      {followed ? '✓ Following' : 'Follow'}
    </button>
  );
}
