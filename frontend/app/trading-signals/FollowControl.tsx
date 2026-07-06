'use client';

/**
 * FollowControl — Follow / Following pill (or icon) that opens a portal
 * popover for channel + threshold selection.
 *
 * Flow:
 *   * Click trigger → popover opens with the current channels and
 *     min-conf pre-loaded from the follow record.
 *   * Toggle any checkbox or drag the slider — single click each, local
 *     state updates immediately.
 *   * Click Save (or Follow, for a first-time follow) — one write to the
 *     server, popover closes.
 *
 * The popover renders through document.body via createPortal with fixed
 * positioning derived from the trigger's bounding rect. That escapes any
 * overflow-hidden ancestor (the roster card clips its left color rail
 * to rounded corners with overflow-hidden) and stays inside the viewport
 * — the placement algorithm nudges left / above when a right/below
 * anchor would spill off the edge.
 *
 * Two variants:
 *   * pill (default) — the roster-card "Follow / ✓ Following" button.
 *     Painted in --color-info when not-following so the CTA reads as
 *     an active affordance.
 *   * icon — a 28px round Bell / BellDot for the leaderboard rows.
 */

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { Bell, BellDot, Loader2 } from 'lucide-react';
import { useApiData } from '@/hooks/useApiData';
import { botColor, botColorSoft } from './palette';

type Variant = 'pill' | 'icon';

interface Props {
  botId: string;
  paletteIndex: number;
  followed: boolean;
  onFollowChanged: () => void;
  variant?: Variant;
}

interface BotState {
  in_app: boolean;
  email: boolean;
  webhook: boolean;
  min_confidence: number;
}

interface FollowsResponse {
  follows: Array<{
    bot_id: string;
    channels: Record<string, boolean> | string;
    min_confidence: number | null;
  }>;
}

const POPOVER_WIDTH = 288;

const DEFAULT_STATE: BotState = {
  in_app: true,
  email: false,
  webhook: false,
  min_confidence: 0,
};

function normalizeChannels(
  raw: Record<string, boolean> | string | undefined,
): Pick<BotState, 'in_app' | 'email' | 'webhook'> {
  let obj: Record<string, boolean> = {};
  if (typeof raw === 'string') {
    try {
      obj = JSON.parse(raw);
    } catch {
      obj = {};
    }
  } else if (raw && typeof raw === 'object') {
    obj = raw;
  }
  return {
    in_app: Boolean(obj.in_app ?? true),
    email: Boolean(obj.email ?? false),
    webhook: Boolean(obj.webhook ?? false),
  };
}

async function upsertFollow(botId: string, state: BotState): Promise<void> {
  const channels: Record<string, boolean> = {};
  if (state.in_app) channels.in_app = true;
  if (state.email) channels.email = true;
  if (state.webhook) channels.webhook = true;
  await fetch(`/api/tradeworkz/bots/${botId}/follow`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ channels, min_confidence: state.min_confidence }),
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
  // Two state slices tracked separately so the Save button can compare
  // them: `saved` is the last-known DB record for this (user, bot), and
  // `draft` is what the popover currently shows. A change is any diff
  // between the two. For a bot the user does NOT yet follow, `saved` is
  // null and Save is enabled as long as at least one channel is picked
  // — the first Save creates the follow row.
  const [saved, setSaved] = useState<BotState | null>(null);
  const [draft, setDraft] = useState<BotState>(DEFAULT_STATE);
  const [busy, setBusy] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<{ top: number; left: number }>({
    top: -1000,
    left: -1000,
  });
  const color = botColor(botId, paletteIndex);

  // Pull the caller's existing follow record so the popover opens with
  // the ACTUAL current channels + threshold pre-loaded, not the client
  // default. Refresh whenever the popover is opened so a change made on
  // /account/notifications reflects here without a page reload.
  const followsRes = useApiData<FollowsResponse>('/api/tradeworkz/me/follows', {
    refreshInterval: 0,
  });

  useEffect(() => {
    if (!open) return;
    followsRes.refetch();
    const record = followsRes.data?.follows.find((f) => f.bot_id === botId);
    if (record) {
      const ch = normalizeChannels(record.channels);
      const s: BotState = {
        in_app: ch.in_app,
        email: ch.email,
        webhook: ch.webhook,
        min_confidence: Number(record.min_confidence ?? 0),
      };
      setSaved(s);
      setDraft(s);
    } else {
      // Not currently following — saved is null so Save reads as an
      // active affordance from the moment the popover opens.
      setSaved(null);
      setDraft(DEFAULT_STATE);
    }
    // Popovers re-open often — leaving followsRes / botId out of deps
    // keeps the reset from firing while the user is toggling.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, botId]);

  const hasChanges = useMemo(() => {
    if (saved === null) return true;
    return (
      saved.in_app !== draft.in_app ||
      saved.email !== draft.email ||
      saved.webhook !== draft.webhook ||
      saved.min_confidence !== draft.min_confidence
    );
  }, [saved, draft]);

  const anyChannelOn = draft.in_app || draft.email || draft.webhook;
  const canSave = !busy && hasChanges && anyChannelOn;

  const reposition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    let left = Math.round(rect.right - POPOVER_WIDTH);
    if (left < 8) left = 8;
    if (left + POPOVER_WIDTH > window.innerWidth - 8) {
      left = Math.max(8, window.innerWidth - 8 - POPOVER_WIDTH);
    }
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

  const onSave = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      if (busy || !canSave) return;
      setBusy(true);
      try {
        await upsertFollow(botId, draft);
        // Snapshot the new "saved" state so a second Save without any
        // further edits reads as a no-op (button greys out again).
        setSaved({ ...draft });
        onFollowChanged();
        setOpen(false);
      } finally {
        setBusy(false);
      }
    },
    [busy, canSave, botId, draft, onFollowChanged],
  );

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

  const toggleOpen = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setOpen((v) => !v);
  }, []);

  const trigger =
    variant === 'icon' ? (
      <button
        ref={triggerRef}
        onClick={toggleOpen}
        disabled={busy}
        aria-label={followed ? 'Manage notifications for this bot' : 'Follow this bot'}
        aria-expanded={open}
        aria-haspopup="menu"
        title={followed ? 'Following — click to manage' : 'Follow this bot'}
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
        aria-expanded={open}
        aria-haspopup="menu"
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
                  {followed ? 'Notification settings' : 'Follow this bot'}
                </div>
                <div className="text-[11px] text-[var(--color-text-secondary)] mt-0.5 leading-snug">
                  Pick channels for entry / exit events and the minimum
                  conviction to notify on.
                </div>
              </div>
              <div className="px-4 py-3 space-y-2.5">
                <ChannelRow
                  label="In-app"
                  status="Live"
                  checked={draft.in_app}
                  onToggle={() =>
                    setDraft((s) => ({ ...s, in_app: !s.in_app }))
                  }
                  color={color}
                  description="Appears in the bell at the top of the TradeWorkz™ page."
                />
                <ChannelRow
                  label="Email"
                  status="Live"
                  checked={draft.email}
                  onToggle={() =>
                    setDraft((s) => ({ ...s, email: !s.email }))
                  }
                  color={color}
                  description="Sent by the minute-cadence email worker. Requires a verified email."
                />
                <ChannelRow
                  label="Webhook"
                  status="Queued"
                  checked={draft.webhook}
                  onToggle={() =>
                    setDraft((s) => ({ ...s, webhook: !s.webhook }))
                  }
                  color={color}
                  description="Rows are logged now; a webhook delivery worker is not yet wired."
                />

                <div className="pt-2">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-semibold text-[var(--color-text-primary)]">
                      Min. conviction
                    </label>
                    <span className="text-[11px] tabular-nums text-[var(--color-text-secondary)]">
                      {(draft.min_confidence * 100).toFixed(0)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={0.95}
                    step={0.05}
                    value={draft.min_confidence}
                    onChange={(e) =>
                      setDraft((s) => ({
                        ...s,
                        min_confidence: Number(e.target.value),
                      }))
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
                    {busy ? 'Working…' : 'Unfollow'}
                  </button>
                ) : (
                  <span
                    className="text-[11px] text-[var(--color-text-secondary)]"
                    style={{ opacity: hasChanges && anyChannelOn ? 1 : 0.6 }}
                  >
                    {anyChannelOn
                      ? 'Ready to follow'
                      : 'Pick at least one channel'}
                  </span>
                )}
                <button
                  onClick={onSave}
                  disabled={!canSave}
                  className="text-xs font-medium px-3 py-1.5 rounded-full transition-colors inline-flex items-center gap-1.5"
                  style={{
                    backgroundColor: canSave
                      ? color
                      : 'var(--color-surface-subtle)',
                    color: canSave
                      ? 'var(--color-on-info, #ffffff)'
                      : 'var(--color-text-secondary)',
                    border: `1px solid ${canSave ? color : 'var(--color-border)'}`,
                    opacity: canSave ? 1 : 0.7,
                    cursor: canSave ? 'pointer' : 'not-allowed',
                  }}
                  aria-live="polite"
                >
                  {busy ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Saving…
                    </>
                  ) : (
                    'Save'
                  )}
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
  status: 'Live' | 'Queued';
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
                status === 'Live'
                  ? 'var(--color-bull-soft)'
                  : 'var(--color-warning-soft)',
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
