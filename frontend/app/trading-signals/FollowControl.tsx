'use client';

/**
 * FollowControl — the Follow / Following affordance, plus the popover
 * that lets the user pick channels and a minimum-conviction floor.
 *
 * Two visual variants share the same popover:
 *   * variant="pill" (default) — a full "Follow / ✓ Following" pill for
 *     the bot roster cards. Colored in the info accent when not-following
 *     so the CTA reads as an active affordance rather than a soft button.
 *   * variant="icon" — a 28px round icon-only button for the leaderboard
 *     rows, where horizontal space is tight. Bell outline when not
 *     following, filled Bell with a dot when following.
 *
 * The popover renders via createPortal into document.body with fixed
 * positioning derived from the trigger's bounding rect on each open.
 * That escapes any overflow-hidden ancestor (the roster card has one to
 * clip its left color rail) and always sits inside the viewport — the
 * placement algorithm nudges left / above when a right/below anchor
 * would spill off the edge.
 *
 * Channel wiring status (see NotificationBell + core/mailer.ts):
 *   * in_app — Live via the bell in the page header.
 *   * email — Live via zerogex-web-tradeworkz-notify.timer (every minute).
 *   * webhook — Queued only; no outbound-webhook worker yet.
 */

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
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

const POPOVER_WIDTH = 288; // matches the w-72 the popover renders at

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
  variant = 'pill',
}: Props) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<FollowState>(DEFAULT_STATE);
  const [busy, setBusy] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<{ top: number; left: number }>({ top: -1000, left: -1000 });
  const color = botColor(botId, paletteIndex);

  // Position the portal-rendered popover relative to the trigger's
  // bounding rect. Recomputed on open and on scroll / resize so the
  // popover tracks the trigger even inside a scrollable container.
  const reposition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    // Right-anchor by default (popover's right edge lines up with trigger's).
    let left = Math.round(rect.right - POPOVER_WIDTH);
    if (left < 8) left = 8;
    if (left + POPOVER_WIDTH > window.innerWidth - 8) {
      left = Math.max(8, window.innerWidth - 8 - POPOVER_WIDTH);
    }
    // Prefer below; flip above if the estimated 380px popover would spill.
    const estimatedHeight = 380;
    let top = Math.round(rect.bottom + 8);
    if (top + estimatedHeight > window.innerHeight - 8) {
      top = Math.max(8, Math.round(rect.top - estimatedHeight - 8));
    }
    setCoords({ top, left });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    reposition();
    const handler = () => reposition();
    window.addEventListener('scroll', handler, true);
    window.addEventListener('resize', handler);
    return () => {
      window.removeEventListener('scroll', handler, true);
      window.removeEventListener('resize', handler);
    };
  }, [open, reposition]);

  // Outside-click + Escape to close. Uses mousedown so a click on the
  // trigger that's ALSO the outside-click target (edge cases) closes
  // cleanly instead of racing.
  useEffect(() => {
    if (!open) return;
    const onMouse = (e: MouseEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (popoverRef.current?.contains(target)) return;
      if (triggerRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onMouse);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onMouse);
      document.removeEventListener('keydown', onKey);
    };
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

  const toggleOpen = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      setOpen((v) => !v);
    },
    [],
  );

  const trigger =
    variant === 'icon' ? (
      <button
        ref={triggerRef}
        onClick={toggleOpen}
        disabled={busy}
        aria-label={followed ? 'Following — edit notifications' : 'Follow this bot'}
        aria-expanded={open}
        aria-haspopup="menu"
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
    ) : (
      <button
        ref={triggerRef}
        onClick={toggleOpen}
        disabled={busy}
        className="text-xs px-3 py-1.5 rounded-full transition-colors whitespace-nowrap font-medium"
        style={{
          backgroundColor: followed
            ? botColorSoft(botId, paletteIndex)
            : 'var(--color-info)',
          color: followed ? color : 'var(--color-on-info, #ffffff)',
          border: `1px solid ${followed ? color : 'var(--color-info)'}`,
          opacity: busy ? 0.6 : 1,
        }}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        {followed ? '✓ Following' : 'Follow'}
      </button>
    );

  return (
    <>
      {trigger}
      {open && typeof window !== 'undefined'
        ? createPortal(
            <div
              ref={popoverRef}
              role="menu"
              className="rounded-xl overflow-hidden"
              style={{
                position: 'fixed',
                top: coords.top,
                left: coords.left,
                width: POPOVER_WIDTH,
                zIndex: 60,
                backgroundColor: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                boxShadow: '0 12px 32px rgba(0,0,0,0.24)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div
                className="px-4 py-3 border-b"
                style={{ borderColor: 'var(--color-border)' }}
              >
                <div className="text-xs font-semibold text-[var(--color-text-primary)]">
                  {followed ? 'Following' : 'Follow this bot'}
                </div>
                <div className="text-[11px] text-[var(--color-text-secondary)] mt-0.5 leading-snug">
                  Pick channels for entry / exit notifications and the minimum
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
                  status="Live"
                  checked={state.email}
                  onToggle={() => setState((s) => ({ ...s, email: !s.email }))}
                  color={color}
                  description="Delivered via the zerogex-web-tradeworkz-notify.timer every minute. Requires a verified email."
                />
                <ChannelRow
                  label="Webhook"
                  status="Queued"
                  checked={state.webhook}
                  onToggle={() => setState((s) => ({ ...s, webhook: !s.webhook }))}
                  color={color}
                  description="Rows are logged now; a delivery worker for outbound webhooks is not yet wired."
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
                    className="w-full"
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
                style={{
                  borderColor: 'var(--color-border)',
                  backgroundColor: 'var(--color-surface-subtle)',
                }}
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
                  disabled={
                    busy || (!state.in_app && !state.email && !state.webhook)
                  }
                  className="text-xs font-medium px-3 py-1.5 rounded-full transition-colors"
                  style={{
                    backgroundColor: color,
                    color: 'var(--color-on-info, #ffffff)',
                    opacity:
                      busy || (!state.in_app && !state.email && !state.webhook)
                        ? 0.6
                        : 1,
                  }}
                >
                  {followed ? 'Save' : 'Follow'}
                </button>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
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
        className="mt-0.5 w-4 h-4"
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
