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
import { AlertCircle, Bell, BellDot, Check, Loader2 } from 'lucide-react';
import { botColor, botColorSoft } from './palette';

type Variant = 'pill' | 'icon';

interface Props {
  botId: string;
  paletteIndex: number;
  followed: boolean;
  onFollowChanged: () => void;
  // Optional: parent flips the pill's local `followedIds` set instantly
  // instead of waiting on the network refetch. Without this, the pill
  // can still read "Follow" for the ~200ms between a successful save
  // and the parent's follows.refetch() landing, which reads as a dead
  // click and prompts the user to click again.
  onOptimisticFollow?: (botId: string, followed: boolean) => void;
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

// One-off cache-busted GET of the caller's follow list. Only used on
// the VERY FIRST open of a followed bot to hydrate the popover with the
// server state; after that, local `saved` is authoritative and every
// mutation (Save / Unfollow / one-click Follow) uses the POST/DELETE
// response as canonical. See onSave for why we don't verify-round-trip
// via GET anymore.
async function fetchMyFollows(): Promise<FollowsResponse | null> {
  try {
    const res = await fetch(
      `/api/tradeworkz/me/follows?_=${Date.now()}`,
      {
        credentials: 'include',
        cache: 'no-store',
        headers: { 'cache-control': 'no-cache', pragma: 'no-cache' },
      },
    );
    if (!res.ok) return null;
    return (await res.json()) as FollowsResponse;
  } catch {
    return null;
  }
}

function stateFromRecord(
  record: FollowsResponse['follows'][number] | undefined,
): BotState | null {
  if (!record) return null;
  const ch = normalizeChannels(record.channels);
  return {
    in_app: ch.in_app,
    email: ch.email,
    webhook: ch.webhook,
    min_confidence: Number(record.min_confidence ?? 0),
  };
}

// POST /follow returns the exact channels + min_confidence that were
// written, so upsertFollow surfaces that back to the caller as the
// authoritative BotState — no separate verify GET, which used to race
// with the write and paint a stale row on the next popover open.
async function upsertFollow(botId: string, state: BotState): Promise<BotState> {
  const channels: Record<string, boolean> = {};
  if (state.in_app) channels.in_app = true;
  if (state.email) channels.email = true;
  if (state.webhook) channels.webhook = true;
  const res = await fetch(`/api/tradeworkz/bots/${botId}/follow`, {
    method: 'POST',
    credentials: 'include',
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ channels, min_confidence: state.min_confidence }),
  });
  if (!res.ok) {
    let detail = '';
    try {
      const body = await res.text();
      detail = body.slice(0, 200);
    } catch {
      /* ignore body-read errors */
    }
    throw new Error(
      `Follow failed (HTTP ${res.status})${detail ? `: ${detail}` : ''}`,
    );
  }
  // The server echoes {channels, min_confidence} verbatim on success.
  // Fall back to what we sent if the response body isn't parseable, so
  // the local state still reflects the intended write.
  try {
    const json = (await res.json()) as {
      channels?: Record<string, boolean> | string;
      min_confidence?: number | string | null;
    };
    const ch = normalizeChannels(json.channels);
    return {
      in_app: ch.in_app,
      email: ch.email,
      webhook: ch.webhook,
      min_confidence: Number(json.min_confidence ?? state.min_confidence),
    };
  } catch {
    return { ...state };
  }
}

async function removeFollow(botId: string): Promise<void> {
  const res = await fetch(`/api/tradeworkz/bots/${botId}/follow`, {
    method: 'DELETE',
    credentials: 'include',
  });
  if (!res.ok) {
    throw new Error(`Unfollow failed (HTTP ${res.status})`);
  }
}

export default function FollowControl({
  botId,
  paletteIndex,
  followed,
  onFollowChanged,
  onOptimisticFollow,
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
  // Transient states so a save / unfollow round-trip is always
  // visible in the popover. `error` is the inline-surfaced fetch
  // failure, cleared on any edit. `phase` drives the button copy
  // through the four-step arc:
  //   idle    → normal button state (Save enabled/disabled, Unfollow link)
  //   saving  → HTTP request in flight after Save click
  //   saved   → success confirmation; popover about to auto-close
  //   removing→ HTTP request in flight after Unfollow click
  //   removed → success confirmation for Unfollow
  // The popover stays open through the whole arc; only `idle` allows
  // further interaction, and the "removed"/"saved" phases lock the
  // controls so a stray click can't fire a second request.
  const [error, setError] = useState<string | null>(null);
  type Phase = 'idle' | 'saving' | 'saved' | 'removing' | 'removed';
  const [phase, setPhase] = useState<Phase>('idle');
  const busy = phase === 'saving' || phase === 'removing';
  const done = phase === 'saved' || phase === 'removed';
  const locked = busy || done;
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<{ top: number; left: number }>({
    top: -1000,
    left: -1000,
  });
  const color = botColor(botId, paletteIndex);

  // Hydration + loading state for the initial fetch. We hydrate from
  // the server ONCE — on the first open with no local `saved` yet —
  // and after that trust every mutation's own response as the source
  // of truth. A refetch-on-every-open would race a fresh save: the
  // GET can return a snapshot from before the INSERT is visible on
  // its pooled connection, then overwrite the just-saved local state
  // with the pre-save row, which is exactly the "stale on reopen"
  // regression the user reported.
  const [loading, setLoading] = useState(false);
  const hydratedForBotRef = useRef<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setPhase('idle');
    // If we've already hydrated for this bot (either by fetching once
    // on a prior open, or because a mutation populated `saved`), the
    // local state IS the source of truth — do not refetch.
    if (hydratedForBotRef.current === botId && saved !== null) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const body = await fetchMyFollows();
      if (cancelled) return;
      const record = body?.follows.find((f) => f.bot_id === botId);
      const s = stateFromRecord(record);
      if (s) {
        setSaved(s);
        setDraft(s);
      } else {
        // Not currently following — saved is null so Save reads as an
        // active affordance from the moment the popover opens.
        setSaved(null);
        setDraft(DEFAULT_STATE);
      }
      hydratedForBotRef.current = botId;
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
    // Deliberately only depends on open/botId — `saved` changing must
    // not re-trigger this effect (that would cause an infinite loop
    // through setSaved).
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
  const canSave = !locked && !loading && hasChanges && anyChannelOn;

  // Any user edit clears a lingering error so the popover doesn't
  // pretend a stale failure still applies to the new draft.
  const patchDraft = useCallback(
    (patch: Partial<BotState>) => {
      if (error) setError(null);
      setDraft((s) => ({ ...s, ...patch }));
    },
    [error],
  );

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
      // Don't dismiss while a save / unfollow round-trip is in flight or
      // its confirmation is still on screen — the user just watched the
      // action arc start, we owe them the completion frame.
      if (locked) return;
      const target = e.target as Node | null;
      if (!target) return;
      if (popoverRef.current?.contains(target)) return;
      if (triggerRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !locked) setOpen(false);
    };
    document.addEventListener('mousedown', onMouse);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onMouse);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, locked]);

  // Save arc: idle → saving → saved (~900ms confirmation) → close.
  // The POST response echoes the exact channels + min_confidence that
  // were written, so we use it directly as canonical — no follow-up
  // verify GET (a stale pooled connection could return a pre-write
  // snapshot and stomp the local state we just saved).
  const onSave = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      if (locked || !canSave) return;
      setError(null);
      setPhase('saving');
      try {
        const canonical = await upsertFollow(botId, draft);
        setSaved(canonical);
        setDraft(canonical);
        // Mark the local state as authoritative so the next popover
        // open skips the hydration fetch and paints from `saved`.
        hydratedForBotRef.current = botId;
        onOptimisticFollow?.(botId, true);
        onFollowChanged();
        setPhase('saved');
        setTimeout(() => {
          setPhase('idle');
          setOpen(false);
        }, 900);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Unknown error saving';
        setError(message);
        setPhase('idle');
      }
    },
    [locked, canSave, botId, draft, onFollowChanged, onOptimisticFollow],
  );

  // Unfollow arc: idle → removing → removed → close. On a successful
  // DELETE the row is gone, so local `saved` resets to null and the
  // hydration marker clears — if the user immediately re-follows via
  // the icon, the next popover open will re-hydrate cleanly.
  const onUnfollow = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      if (locked) return;
      setError(null);
      setPhase('removing');
      try {
        await removeFollow(botId);
        setSaved(null);
        setDraft(DEFAULT_STATE);
        hydratedForBotRef.current = null;
        onOptimisticFollow?.(botId, false);
        onFollowChanged();
        setPhase('removed');
        setTimeout(() => {
          setPhase('idle');
          setOpen(false);
        }, 900);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Unknown error';
        setError(message);
        setPhase('idle');
      }
    },
    [locked, botId, onFollowChanged, onOptimisticFollow],
  );

  // Two behaviors sharing the same trigger:
  //   * NOT following → one-click POST /follow with default channels
  //     (in_app on, email/webhook off, min_conf 0). No popover. The
  //     pill / icon flips instantly via the optimistic overlay.
  //   * ALREADY following → open the popover so the user can edit
  //     channels, drag the threshold, or Unfollow.
  //
  // On a failed one-click follow we escalate into the popover with the
  // error banner so the user sees the HTTP status instead of a silent
  // failure — same failure surface as the Save-button path.
  const handleTriggerClick = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      if (locked) return;
      if (followed) {
        setOpen((v) => !v);
        return;
      }
      setPhase('saving');
      setError(null);
      try {
        const canonical = await upsertFollow(botId, DEFAULT_STATE);
        // Prime local state from the POST response so the next popover
        // open shows the fresh channels without waiting on a hydration
        // fetch (that fetch used to race the write and paint stale).
        setSaved(canonical);
        setDraft(canonical);
        hydratedForBotRef.current = botId;
        onOptimisticFollow?.(botId, true);
        onFollowChanged();
        setPhase('idle');
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Unknown error following';
        setError(message);
        setSaved(null);
        setDraft(DEFAULT_STATE);
        hydratedForBotRef.current = null;
        setOpen(true);
        setPhase('idle');
      }
    },
    [locked, followed, botId, onFollowChanged, onOptimisticFollow],
  );

  // triggerBusy tracks the one-click-follow round-trip specifically so
  // the icon / pill shows a spinner while the request is in flight —
  // otherwise a slow POST looks like a dead click. Popover interactions
  // (Save, Unfollow) set `busy` too, but those are painted inside the
  // popover footer.
  const triggerBusy = busy && !open;
  const trigger =
    variant === 'icon' ? (
      <button
        ref={triggerRef}
        onClick={handleTriggerClick}
        disabled={busy}
        aria-label={
          followed
            ? 'Manage notifications for this bot'
            : 'Follow this bot'
        }
        aria-expanded={followed ? open : undefined}
        aria-haspopup={followed ? 'menu' : undefined}
        title={followed ? 'Following — click to manage' : 'Follow this bot'}
        className="inline-flex items-center justify-center w-7 h-7 rounded-full transition-colors"
        style={{
          backgroundColor: followed ? botColorSoft(botId, paletteIndex) : 'transparent',
          color: followed ? color : 'var(--color-text-secondary)',
          border: `1px solid ${followed ? color : 'var(--color-border)'}`,
          opacity: busy ? 0.7 : 1,
        }}
      >
        {triggerBusy ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : followed ? (
          <BellDot className="w-3.5 h-3.5" />
        ) : (
          <Bell className="w-3.5 h-3.5" />
        )}
      </button>
    ) : (
      <button
        ref={triggerRef}
        onClick={handleTriggerClick}
        disabled={busy}
        aria-expanded={followed ? open : undefined}
        aria-haspopup={followed ? 'menu' : undefined}
        className="text-xs px-3 py-1.5 rounded-full transition-colors whitespace-nowrap font-medium inline-flex items-center gap-1.5"
        style={{
          backgroundColor: followed ? botColorSoft(botId, paletteIndex) : 'var(--color-info)',
          color: followed ? color : 'var(--color-on-info, #ffffff)',
          border: `1px solid ${followed ? color : 'var(--color-info)'}`,
          opacity: busy ? 0.7 : 1,
        }}
      >
        {triggerBusy ? (
          <>
            <Loader2 className="w-3 h-3 animate-spin" />
            Following…
          </>
        ) : followed ? (
          '✓ Following'
        ) : (
          'Follow'
        )}
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
                  onToggle={() => patchDraft({ in_app: !draft.in_app })}
                  color={color}
                  description="Appears in the bell at the top of the TradeWorkz™ page."
                />
                <ChannelRow
                  label="Email"
                  status="Live"
                  checked={draft.email}
                  onToggle={() => patchDraft({ email: !draft.email })}
                  color={color}
                  description="Sent by the minute-cadence email worker. Requires a verified email."
                />
                <ChannelRow
                  label="Webhook"
                  status="Queued"
                  checked={draft.webhook}
                  onToggle={() => patchDraft({ webhook: !draft.webhook })}
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
                      patchDraft({ min_confidence: Number(e.target.value) })
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
              {error ? (
                <div
                  className="px-4 py-2 text-[11px] flex items-start gap-2"
                  style={{
                    backgroundColor: 'var(--color-bear-soft)',
                    color: 'var(--color-bear)',
                    borderTop: '1px solid var(--color-border)',
                  }}
                  role="alert"
                >
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                  <span className="leading-snug break-words">{error}</span>
                </div>
              ) : null}
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
                    disabled={locked}
                    className="text-[11px] text-[var(--color-bear)] hover:underline inline-flex items-center gap-1"
                    aria-live="polite"
                    aria-busy={phase === 'removing'}
                  >
                    {phase === 'removing' ? (
                      <>
                        <Loader2 className="w-3 h-3 animate-spin" />
                        Removing…
                      </>
                    ) : phase === 'removed' ? (
                      <>
                        <Check className="w-3 h-3" />
                        Unfollowed
                      </>
                    ) : (
                      'Unfollow'
                    )}
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
                {/*
                  Save button is a four-state visual:
                    idle + canSave  → colored, active
                    idle + no-can   → surface-tinted, disabled
                    saving           → colored, spinner + "Saving…"
                    saved            → bull-green, check + "Saved"
                  The button stays visible through every phase so the
                  status is always in the same place the user just
                  clicked, and the popover doesn't close until the
                  confirmation has rendered for ~900ms.
                */}
                {(() => {
                  const savingUi = phase === 'saving';
                  const savedUi = phase === 'saved';
                  const active = canSave || savingUi || savedUi;
                  const bgColor = savedUi
                    ? 'var(--color-bull)'
                    : active
                      ? color
                      : 'var(--color-surface-subtle)';
                  const fgColor = active
                    ? 'var(--color-on-info, #ffffff)'
                    : 'var(--color-text-secondary)';
                  const borderColor = savedUi
                    ? 'var(--color-bull)'
                    : active
                      ? color
                      : 'var(--color-border)';
                  return (
                    <button
                      onClick={onSave}
                      disabled={!canSave}
                      className="text-xs font-medium px-3 py-1.5 rounded-full transition-colors inline-flex items-center gap-1.5"
                      style={{
                        backgroundColor: bgColor,
                        color: fgColor,
                        border: `1px solid ${borderColor}`,
                        opacity: active ? 1 : 0.7,
                        cursor: canSave ? 'pointer' : 'default',
                      }}
                      aria-live="polite"
                      aria-busy={savingUi}
                    >
                      {savingUi ? (
                        <>
                          <Loader2 className="w-3 h-3 animate-spin" />
                          Saving…
                        </>
                      ) : savedUi ? (
                        <>
                          <Check className="w-3 h-3" />
                          Saved
                        </>
                      ) : (
                        'Save'
                      )}
                    </button>
                  );
                })()}
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
