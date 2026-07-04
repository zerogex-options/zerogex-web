'use client';

/**
 * NotificationBell — pill button in the page header that opens a dropdown
 * feed of recent bot entry / exit events for the logged-in user.
 *
 * Data model:
 *   - Backend writes one row per follower into ``tw_notifications_log`` on
 *     every open / close (see ``src/tradeworkz/notifications.py``).
 *   - ``GET /api/tradeworkz/me/feed`` returns the caller's rows for the
 *     ``in_app`` channel.
 *   - Read state is tracked client-side in localStorage (last-seen
 *     notification id) — no server round-trip for a "mark read" action.
 *     Rows newer than that id are the unread badge count.
 *
 * If the user has no follows the bell renders in a muted state with a
 * one-line hint pointing at the "Follow" buttons on the roster cards.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Bell } from 'lucide-react';
import { useApiData } from '@/hooks/useApiData';
import { botColor } from './palette';
import { fmtDateTime, fmtSignedMoney, fmtSignedPct } from './format';

interface FeedEntry {
  id: number;
  bot_id: string;
  bot_display_name: string | null;
  event_type: string;
  trade_id: number | null;
  position_id: number | null;
  status: string;
  payload: {
    underlying?: string;
    direction?: string;
    outcome?: string;
    realized_pnl?: number;
    pnl_percent?: number;
    reason?: string;
    contracts?: number;
    entry_price?: number;
    exit_price?: number;
    target_price?: number;
    stop_price?: number;
    conviction?: number;
    rationale?: string;
    strategy_type?: string;
  };
  sent_at: string | null;
}

interface FeedResponse {
  feed: FeedEntry[];
}

const LOCAL_STORAGE_KEY = 'tradeworkz.last_seen_notification_id';

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [lastSeen, setLastSeen] = useState<number>(() => readLastSeen());
  const popoverRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const feed = useApiData<FeedResponse>('/api/tradeworkz/me/feed?limit=40', {
    refreshInterval: 20_000,
  });

  const entries = useMemo(() => feed.data?.feed ?? [], [feed.data]);
  const unreadCount = useMemo(
    () => entries.filter((e) => e.id > lastSeen).length,
    [entries, lastSeen],
  );

  useEffect(() => {
    if (!open) return;
    const highest = entries.reduce((m, e) => Math.max(m, e.id), lastSeen);
    if (highest > lastSeen) {
      setLastSeen(highest);
      try {
        window.localStorage.setItem(LOCAL_STORAGE_KEY, String(highest));
      } catch {
        /* localStorage unavailable — accept the lost-across-reload cost */
      }
    }
  }, [open, entries, lastSeen]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        popoverRef.current &&
        !popoverRef.current.contains(target) &&
        buttonRef.current &&
        !buttonRef.current.contains(target)
      ) {
        setOpen(false);
      }
    };
    const keyHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', keyHandler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown', keyHandler);
    };
  }, [open]);

  const toggleOpen = useCallback(() => setOpen((v) => !v), []);

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={toggleOpen}
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
        className="relative inline-flex items-center justify-center w-9 h-9 rounded-full transition-colors"
        style={{
          backgroundColor: open ? 'var(--color-info-soft)' : 'transparent',
          border: '1px solid var(--color-border)',
          color: unreadCount > 0 ? 'var(--color-info)' : 'var(--color-text-secondary)',
        }}
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 ? (
          <span
            className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full text-[10px] font-semibold flex items-center justify-center"
            style={{
              backgroundColor: 'var(--color-bear)',
              color: 'var(--color-on-info, #ffffff)',
              lineHeight: 1,
            }}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          ref={popoverRef}
          className="absolute right-0 mt-2 w-96 max-w-[90vw] rounded-2xl overflow-hidden z-40"
          style={{
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            boxShadow: '0 24px 48px rgba(0,0,0,0.24)',
          }}
        >
          <div
            className="px-4 py-3 flex items-center justify-between border-b"
            style={{ borderColor: 'var(--color-border)' }}
          >
            <div className="text-sm font-semibold text-[var(--color-text-primary)]">
              Notifications
            </div>
            <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-secondary)]">
              In-app · Live
            </div>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {feed.loading && !feed.data ? (
              <div className="p-6 text-center text-xs text-[var(--color-text-secondary)]">
                Loading feed…
              </div>
            ) : entries.length === 0 ? (
              <div className="p-6 text-center">
                <div className="text-xs text-[var(--color-text-primary)] font-medium mb-1">
                  No notifications yet
                </div>
                <div className="text-[11px] text-[var(--color-text-secondary)] leading-snug">
                  Follow a bot (click <span className="text-[var(--color-text-primary)]">Follow</span> on
                  any roster card) and you'll get an in-app notification when it enters or exits a trade.
                </div>
              </div>
            ) : (
              <ul className="divide-y" style={{ borderColor: 'var(--color-border)' }}>
                {entries.map((e) => (
                  <FeedRow key={e.id} entry={e} isUnread={e.id > lastSeen} />
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function FeedRow({ entry, isUnread }: { entry: FeedEntry; isUnread: boolean }) {
  const color = botColor(entry.bot_id);
  const payload = entry.payload || {};
  const eventLabel = entry.event_type.toUpperCase();
  const isExit = entry.event_type === 'exit';
  const outcomeColor =
    payload.outcome === 'win'
      ? 'var(--color-bull)'
      : payload.outcome === 'loss'
        ? 'var(--color-bear)'
        : undefined;

  return (
    <li
      className="px-4 py-3"
      style={{
        backgroundColor: isUnread ? 'var(--color-info-soft)' : 'transparent',
      }}
    >
      <div className="flex items-start gap-3">
        <span
          className="mt-1 inline-block w-2.5 h-2.5 rounded-full flex-shrink-0"
          style={{ backgroundColor: color }}
          aria-hidden
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <div className="text-xs font-semibold text-[var(--color-text-primary)] truncate">
              {entry.bot_display_name ?? entry.bot_id}
            </div>
            <span
              className="text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded"
              style={{
                backgroundColor: isExit ? 'var(--color-info-soft)' : 'var(--color-bull-soft)',
                color: isExit ? 'var(--color-info)' : 'var(--color-bull)',
              }}
            >
              {eventLabel}
            </span>
          </div>
          <div className="mt-1 text-[11px] text-[var(--color-text-secondary)] leading-snug">
            {payload.underlying ?? 'SPY'} ·{' '}
            {payload.direction === 'bullish' ? 'LONG' : payload.direction === 'bearish' ? 'SHORT' : payload.direction} ·{' '}
            {payload.strategy_type ?? 'debit'}
            {payload.contracts ? ` · ${payload.contracts} contracts` : ''}
          </div>
          {isExit ? (
            <div
              className="mt-1 text-[11px] font-medium tabular-nums"
              style={{ color: outcomeColor }}
            >
              {fmtSignedMoney(payload.realized_pnl ?? null)}{' '}
              {payload.pnl_percent !== undefined ? (
                <span className="text-[10px]">
                  ({fmtSignedPct(payload.pnl_percent, 1)})
                </span>
              ) : null}
              {payload.reason ? (
                <span className="text-[10px] text-[var(--color-text-secondary)] ml-1">· {payload.reason}</span>
              ) : null}
            </div>
          ) : (
            <div className="mt-1 text-[11px] text-[var(--color-text-secondary)]">
              Entry @ ${payload.entry_price?.toFixed(2) ?? '—'} · target ${payload.target_price?.toFixed(2) ?? '—'} · stop ${payload.stop_price?.toFixed(2) ?? '—'}
            </div>
          )}
          <div className="mt-1 text-[10px] text-[var(--color-text-secondary)]">
            {fmtDateTime(entry.sent_at)}
          </div>
        </div>
      </div>
    </li>
  );
}

function readLastSeen(): number {
  if (typeof window === 'undefined') return 0;
  try {
    const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY);
    const n = raw ? Number(raw) : 0;
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}
