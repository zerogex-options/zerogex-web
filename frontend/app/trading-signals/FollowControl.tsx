'use client';

/**
 * FollowControl — the Follow / Following pill button on each bot roster
 * card, with a popover that lets the user pick channels + a minimum
 * conviction floor for notifications.
 *
 * The follow record is stored server-side in ``tw_bot_followers`` with a
 * JSONB ``channels`` blob and a numeric ``min_confidence``. Every open /
 * exit event that the bot emits is fanned out per follower per enabled
 * channel; only rows below ``min_confidence`` are suppressed.
 *
 * Channel wiring — where the bytes actually go:
 *   * in_app  — WORKS. Rows land in tw_notifications_log with status='sent'
 *               and appear in the bell dropdown.
 *   * email   — QUEUED. Rows land with status='queued'. No delivery worker
 *               ships them yet; enabling here means "start collecting
 *               would-have-been-sent rows". A future SMTP or Resend worker
 *               will drain them.
 *   * webhook — QUEUED. Same story — rows are staged; delivery is not.
 * The UI labels the queued channels as such so nobody expects an email.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { botColor, botColorSoft } from './palette';

interface Props {
  botId: string;
  paletteIndex: number;
  followed: boolean;
  onFollowChanged: () => void;
}

interface FollowState {
  in_app: boolean;
  email: boolean;
  webhook: boolean;
  min_confidence: number;
}

const DEFAULT_STATE: FollowState = {
  in_app: true,
  email: false,
  webhook: false,
  min_confidence: 0,
};

async function upsertFollow(botId: string, state: FollowState): Promise<void> {
  const channels: Record<string, boolean> = {};
  if (state.in_app) channels.in_app = true;
  if (state.email) channels.email = true;
  if (state.webhook) channels.webhook = true;
  await fetch(`/api/tradeworkz/bots/${botId}/follow`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      channels,
      min_confidence: state.min_confidence,
    }),
  });
}

async function removeFollow(botId: string): Promise<void> {
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
}: Props) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<FollowState>(DEFAULT_STATE);
  const [busy, setBusy] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const color = botColor(botId, paletteIndex);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const onUnfollow = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      if (busy) return;
      setBusy(true);
      try {
        await removeFollow(botId);
        onFollowChanged();
        setOpen(false);
      } finally {
        setBusy(false);
      }
    },
    [busy, botId, onFollowChanged],
  );

  const onSave = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      if (busy) return;
      setBusy(true);
      try {
        await upsertFollow(botId, state);
        onFollowChanged();
        setOpen(false);
      } finally {
        setBusy(false);
      }
    },
    [busy, botId, state, onFollowChanged],
  );

  return (
    <div
      className="relative inline-block"
      ref={wrapperRef}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        disabled={busy}
        className="text-xs px-3 py-1.5 rounded-full transition-colors whitespace-nowrap"
        style={{
          backgroundColor: followed ? botColorSoft(botId, paletteIndex) : 'transparent',
          color: followed ? color : 'var(--color-text-primary)',
          border: `1px solid ${followed ? color : 'var(--color-border)'}`,
          opacity: busy ? 0.6 : 1,
        }}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        {followed ? '✓ Following' : 'Follow'}
      </button>

      {open ? (
        <div
          className="absolute right-0 mt-2 w-72 max-w-[90vw] rounded-xl overflow-hidden z-30"
          style={{
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            boxShadow: '0 12px 32px rgba(0,0,0,0.24)',
          }}
        >
          <div
            className="px-4 py-3 border-b"
            style={{ borderColor: 'var(--color-border)' }}
          >
            <div className="text-xs font-semibold text-[var(--color-text-primary)]">
              {followed ? 'Following' : 'Follow this bot'}
            </div>
            <div className="text-[11px] text-[var(--color-text-secondary)] mt-0.5 leading-snug">
              Pick the channels for entry / exit notifications and the minimum
              conviction to notify on.
            </div>
          </div>
          <div className="px-4 py-3 space-y-2.5">
            <ChannelRow
              label="In-app"
              status="Live"
              checked={state.in_app}
              onToggle={() => setState((s) => ({ ...s, in_app: !s.in_app }))}
              color={color}
              description="Appears in the bell at the top of this page."
            />
            <ChannelRow
              label="Email"
              status="Queued"
              checked={state.email}
              onToggle={() => setState((s) => ({ ...s, email: !s.email }))}
              color={color}
              description="Rows are logged now; delivery worker not yet wired."
            />
            <ChannelRow
              label="Webhook"
              status="Queued"
              checked={state.webhook}
              onToggle={() => setState((s) => ({ ...s, webhook: !s.webhook }))}
              color={color}
              description="Rows are logged now; delivery worker not yet wired."
            />

            <div className="pt-2">
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-semibold text-[var(--color-text-primary)]">
                  Min. conviction
                </label>
                <span className="text-[11px] tabular-nums text-[var(--color-text-secondary)]">
                  {(state.min_confidence * 100).toFixed(0)}%
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={0.95}
                step={0.05}
                value={state.min_confidence}
                onChange={(e) =>
                  setState((s) => ({ ...s, min_confidence: Number(e.target.value) }))
                }
                onClick={(e) => e.stopPropagation()}
                className="w-full accent-[var(--color-info)]"
                style={{ accentColor: color }}
              />
              <div className="text-[10px] text-[var(--color-text-secondary)] mt-1 leading-snug">
                Suppress notifications for entries below this bot's
                confidence-blend score.
              </div>
            </div>
          </div>
          <div
            className="px-4 py-3 flex items-center justify-between gap-2 border-t"
            style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface-subtle)' }}
          >
            {followed ? (
              <button
                onClick={onUnfollow}
                disabled={busy}
                className="text-[11px] text-[var(--color-bear)] hover:underline"
              >
                Unfollow
              </button>
            ) : (
              <span />
            )}
            <button
              onClick={onSave}
              disabled={busy || (!state.in_app && !state.email && !state.webhook)}
              className="text-xs font-medium px-3 py-1.5 rounded-full transition-colors"
              style={{
                backgroundColor: color,
                color: 'var(--color-on-info, #ffffff)',
                opacity:
                  busy || (!state.in_app && !state.email && !state.webhook) ? 0.6 : 1,
              }}
            >
              {followed ? 'Save' : 'Follow'}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ChannelRow({
  label,
  status,
  checked,
  onToggle,
  color,
  description,
}: {
  label: string;
  status: string;
  checked: boolean;
  onToggle: () => void;
  color: string;
  description: string;
}) {
  return (
    <label
      className="flex items-start gap-3 cursor-pointer"
      onClick={(e) => e.stopPropagation()}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={onToggle}
        className="mt-0.5 w-4 h-4 accent-current"
        style={{ accentColor: color }}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-[var(--color-text-primary)]">
            {label}
          </span>
          <span
            className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded"
            style={{
              backgroundColor:
                status === 'Live' ? 'var(--color-bull-soft)' : 'var(--color-warning-soft)',
              color: status === 'Live' ? 'var(--color-bull)' : 'var(--color-warning)',
            }}
          >
            {status}
          </span>
        </div>
        <div className="text-[10px] text-[var(--color-text-secondary)] leading-snug mt-0.5">
          {description}
        </div>
      </div>
    </label>
  );
}
