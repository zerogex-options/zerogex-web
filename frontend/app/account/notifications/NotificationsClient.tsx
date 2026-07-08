'use client';

/**
 * Notifications management — /account/notifications.
 *
 * One card per bot the user follows, with:
 *   * per-channel toggles (in_app / email / webhook)
 *   * a minimum-conviction floor slider
 *   * an Unfollow button
 * Every mutation POSTs the full follow record so the server sees the
 * canonical state on every change — no field-level PATCH complexity.
 *
 * Debounced auto-save: any toggle / slider adjustment fires an upsert
 * 350ms after the last change so a rapid channel-flip-then-slider drag
 * lands as one write. No explicit Save button — the card shows a small
 * "saved" tick briefly after each write.
 */

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, ArrowLeft, BellOff, Check } from 'lucide-react';
import { useApiData } from '@/hooks/useApiData';
import LoadingSpinner from '@/components/LoadingSpinner';
import ErrorMessage from '@/components/ErrorMessage';

interface FollowRecord {
  bot_id: string;
  followed_at: string;
  channels: Record<string, boolean> | string;
  min_confidence: number | null;
  display_name: string | null;
  tagline: string | null;
  tier: string | null;
}

interface FollowsResponse {
  follows: FollowRecord[];
}

interface BotState {
  in_app: boolean;
  email: boolean;
  webhook: boolean;
  min_confidence: number;
}

const CHANNEL_META: Array<{
  key: keyof BotState;
  label: string;
  status: 'Live' | 'Queued';
  description: string;
}> = [
  {
    key: 'in_app',
    label: 'In-app',
    status: 'Live',
    description: 'Appears in the notification bell on the TradeWorkz™ dashboard.',
  },
  {
    key: 'email',
    label: 'Email',
    status: 'Live',
    description: 'Delivered by the minute-cadence email worker. Requires a verified email address.',
  },
  {
    key: 'webhook',
    label: 'Webhook',
    status: 'Queued',
    description: 'Rows are logged now; no outbound-webhook delivery worker is wired yet.',
  },
];

// Palette copy of TradeWorkz colors so this page reads visually related
// without importing the app/trading-signals palette (avoids the /account
// bundle picking up a chart-page dependency).
const BOT_COLORS: Record<string, string> = {
  put_call_wall_bouncer: '#00B8D4',
  gamma_flip_defender: '#6366F1',
  gamma_flip_breaker: '#8B5CF6',
  eod_pin_drifter: '#D946EF',
  dealer_delta_pressure_rider: '#F59E0B',
  vwap_reversion_scalper: '#F97316',
  vix_regime_breakout: '#EC4899',
  opening_range_hunter: '#475569',
  max_pain_gravitator: '#0EA5E9',
};

function normalizeChannels(raw: FollowRecord['channels']): BotState {
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
    min_confidence: 0,
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
    body: JSON.stringify({
      channels,
      min_confidence: state.min_confidence,
    }),
  });
}

async function removeFollow(botId: string): Promise<void> {
  const res = await fetch(`/api/tradeworkz/bots/${botId}/follow`, {
    method: 'DELETE',
    credentials: 'include',
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new Error(`Unfollow failed (HTTP ${res.status})`);
  }
}

export default function NotificationsClient() {
  const follows = useApiData<FollowsResponse>('/api/tradeworkz/me/follows', {
    refreshInterval: 0,
  });

  // Local state keyed by bot_id so debounced saves don't fight the
  // network-driven refresh.
  const [state, setState] = useState<Map<string, BotState>>(new Map());
  const [savedTick, setSavedTick] = useState<Map<string, number>>(new Map());
  const saveTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // Bots the user just unfollowed. The card is hidden optimistically the
  // instant Unfollow is clicked — the previous version waited on
  // follows.refetch() and, if that GET served a stale (pre-DELETE) body, the
  // card appeared to "stay up". Held in a ref too so the debounced save
  // callback can bail for a removed bot instead of re-POSTing (which would
  // resurrect the follow row a click just deleted).
  const [pendingRemoval, setPendingRemoval] = useState<Set<string>>(() => new Set());
  const pendingRemovalRef = useRef(pendingRemoval);
  pendingRemovalRef.current = pendingRemoval;
  const [removeError, setRemoveError] = useState<string | null>(null);

  useEffect(() => {
    if (!follows.data) return;
    setState((prev) => {
      const next = new Map(prev);
      for (const rec of follows.data!.follows) {
        if (!next.has(rec.bot_id)) {
          const s = normalizeChannels(rec.channels);
          s.min_confidence = Number(rec.min_confidence ?? 0);
          next.set(rec.bot_id, s);
        }
      }
      // Drop any local state for bots we're no longer following.
      for (const botId of Array.from(next.keys())) {
        if (!follows.data!.follows.find((f) => f.bot_id === botId)) {
          next.delete(botId);
        }
      }
      return next;
    });
  }, [follows.data]);

  // Once a fresh follows payload no longer lists a bot we optimistically
  // removed, the delete is confirmed on the server — drop it from the
  // pending set. If a stale payload still lists it, keep hiding until a
  // subsequent refresh reflects the delete; the set converges either way.
  useEffect(() => {
    if (!follows.data) return;
    setPendingRemoval((prev) => {
      if (prev.size === 0) return prev;
      const present = new Set(follows.data!.follows.map((f) => f.bot_id));
      let changed = false;
      const next = new Set(prev);
      for (const botId of prev) {
        if (!present.has(botId)) {
          next.delete(botId);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [follows.data]);

  const scheduleSave = useCallback((botId: string, newState: BotState) => {
    const timers = saveTimers.current;
    const existing = timers.get(botId);
    if (existing) clearTimeout(existing);
    const handle = setTimeout(async () => {
      timers.delete(botId);
      // A save that fires after the bot was unfollowed would re-create the
      // follow row (upsert) — exactly the "I unfollowed but it came back"
      // failure. Skip it.
      if (pendingRemovalRef.current.has(botId)) return;
      try {
        await upsertFollow(botId, newState);
        setSavedTick((prev) => {
          const next = new Map(prev);
          next.set(botId, Date.now());
          return next;
        });
      } catch {
        /* leave the local state alone; user can retry with any change */
      }
    }, 350);
    timers.set(botId, handle);
  }, []);

  const updateBotState = useCallback(
    (botId: string, patch: Partial<BotState>) => {
      setState((prev) => {
        const next = new Map(prev);
        const cur = next.get(botId) ?? {
          in_app: true,
          email: false,
          webhook: false,
          min_confidence: 0,
        };
        const merged = { ...cur, ...patch };
        next.set(botId, merged);
        scheduleSave(botId, merged);
        return next;
      });
    },
    [scheduleSave],
  );

  const onUnfollow = useCallback(
    async (botId: string) => {
      const timers = saveTimers.current;
      const existing = timers.get(botId);
      if (existing) clearTimeout(existing);
      timers.delete(botId);
      setRemoveError(null);
      // Hide the card immediately; don't wait on the refetch (which can
      // serve a stale, pre-DELETE follows body).
      setPendingRemoval((prev) => {
        const next = new Set(prev);
        next.add(botId);
        return next;
      });
      try {
        await removeFollow(botId);
        follows.refetch();
      } catch (err) {
        // Roll the card back into view and surface why it couldn't be removed.
        setPendingRemoval((prev) => {
          const next = new Set(prev);
          next.delete(botId);
          return next;
        });
        setRemoveError(
          err instanceof Error ? err.message : 'Could not unfollow — please try again.',
        );
      }
    },
    [follows],
  );

  // Rows still shown = followed rows minus the ones being unfollowed.
  const visibleRows = useMemo(() => {
    const all = follows.data?.follows ?? [];
    return pendingRemoval.size === 0
      ? all
      : all.filter((r) => !pendingRemoval.has(r.bot_id));
  }, [follows.data, pendingRemoval]);

  const anyEmailOn = useMemo(() => {
    for (const rec of visibleRows) {
      const s = state.get(rec.bot_id) ?? normalizeChannels(rec.channels);
      if (s.email) return true;
    }
    return false;
  }, [visibleRows, state]);

  const bulkToggle = useCallback(
    (channel: 'in_app' | 'email' | 'webhook', enable: boolean) => {
      for (const rec of visibleRows) {
        const cur = state.get(rec.bot_id) ?? normalizeChannels(rec.channels);
        if (Boolean(cur[channel]) === enable) continue;
        updateBotState(rec.bot_id, { [channel]: enable } as Partial<BotState>);
      }
    },
    [visibleRows, state, updateBotState],
  );

  if (follows.loading && !follows.data) return <LoadingSpinner />;
  if (follows.error && !follows.data) {
    return <ErrorMessage message={follows.error} onRetry={follows.refetch} />;
  }

  return (
    <main className="min-h-screen">
      <div className="container mx-auto max-w-4xl px-4 py-8">
        <div className="mb-6">
          <Link
            href="/account"
            className="inline-flex items-center gap-1 text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Account
          </Link>
          <h1 className="text-3xl font-bold text-[var(--color-text-primary)] mt-3">
            Notifications
          </h1>
          <p className="text-sm text-[var(--color-text-secondary)] max-w-2xl mt-2 leading-relaxed">
            Manage the TradeWorkz™ bots you follow and the channels each subscription uses.
            Changes save automatically. Turning a channel off or unfollowing also cancels any
            not-yet-delivered notifications on that channel.
          </p>
        </div>

        {removeError ? (
          <div
            className="rounded-xl p-3 mb-4 flex items-start gap-2 text-xs"
            style={{
              backgroundColor: 'var(--color-bear-soft)',
              color: 'var(--color-bear)',
              border: '1px solid var(--color-bear)',
            }}
            role="alert"
          >
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            <span className="leading-snug">{removeError}</span>
          </div>
        ) : null}

        {visibleRows.length > 0 ? (
          <section
            className="rounded-2xl p-5 mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-3"
            style={{
              backgroundColor: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
            }}
          >
            <div>
              <div className="text-sm font-semibold text-[var(--color-text-primary)]">
                Bulk actions
              </div>
              <div className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                {anyEmailOn
                  ? 'Turn off email notifications across every followed bot.'
                  : 'Turn on email notifications for every bot you already follow.'}
              </div>
            </div>
            <button
              onClick={() => bulkToggle('email', !anyEmailOn)}
              className="text-xs font-medium px-3 py-2 rounded-full transition-colors self-start md:self-auto"
              style={{
                backgroundColor: anyEmailOn ? 'transparent' : 'var(--color-info)',
                color: anyEmailOn ? 'var(--color-text-primary)' : 'var(--color-on-info, #ffffff)',
                border: `1px solid ${anyEmailOn ? 'var(--color-border)' : 'var(--color-info)'}`,
              }}
            >
              {anyEmailOn ? 'Turn off all email' : 'Turn on email for all'}
            </button>
          </section>
        ) : null}

        {visibleRows.length === 0 ? (
          <div
            className="p-8 rounded-2xl text-center"
            style={{
              backgroundColor: 'var(--color-surface)',
              border: '1px dashed var(--color-border)',
            }}
          >
            <div
              className="mx-auto mb-3 flex items-center justify-center w-12 h-12 rounded-full"
              style={{ backgroundColor: 'var(--color-info-soft)', color: 'var(--color-info)' }}
            >
              <BellOff className="w-5 h-5" />
            </div>
            <h2 className="text-base font-semibold text-[var(--color-text-primary)] mb-1">
              You aren't following any bots yet
            </h2>
            <p className="text-sm text-[var(--color-text-secondary)] max-w-md mx-auto">
              Head to TradeWorkz™ and click Follow on any bot to start receiving entry / exit
              notifications.
            </p>
            <Link
              href="/trading-signals"
              className="inline-block mt-4 text-xs font-medium px-3 py-2 rounded-full"
              style={{ backgroundColor: 'var(--color-info)', color: 'var(--color-on-info, #ffffff)' }}
            >
              Open TradeWorkz™
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {visibleRows.map((rec) => {
              const s =
                state.get(rec.bot_id) ??
                (() => {
                  const init = normalizeChannels(rec.channels);
                  init.min_confidence = Number(rec.min_confidence ?? 0);
                  return init;
                })();
              const color = BOT_COLORS[rec.bot_id] ?? 'var(--color-info)';
              const saved = savedTick.get(rec.bot_id) ?? 0;
              const savedFresh = Date.now() - saved < 2400;
              return (
                <div
                  key={rec.bot_id}
                  className="rounded-2xl overflow-hidden relative"
                  style={{
                    backgroundColor: 'var(--color-surface)',
                    border: '1px solid var(--color-border)',
                  }}
                >
                  <div
                    className="absolute inset-y-0 left-0 w-1"
                    style={{ backgroundColor: color }}
                    aria-hidden
                  />
                  <div className="p-5 pl-6">
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3
                            className="text-base font-semibold"
                            style={{ color: 'var(--color-text-primary)' }}
                          >
                            {rec.display_name ?? rec.bot_id}
                          </h3>
                          {rec.tier ? (
                            <span
                              className="text-[10px] uppercase tracking-widest px-1.5 py-0.5 rounded"
                              style={{ backgroundColor: `${color}22`, color }}
                            >
                              {rec.tier}
                            </span>
                          ) : null}
                          {savedFresh ? (
                            <span
                              className="text-[10px] inline-flex items-center gap-1"
                              style={{ color: 'var(--color-bull)' }}
                            >
                              <Check className="w-3 h-3" /> Saved
                            </span>
                          ) : null}
                        </div>
                        {rec.tagline ? (
                          <p className="text-xs text-[var(--color-text-secondary)] mt-1 leading-snug">
                            {rec.tagline}
                          </p>
                        ) : null}
                      </div>
                      <button
                        onClick={() => onUnfollow(rec.bot_id)}
                        className="text-[11px] text-[var(--color-bear)] hover:underline whitespace-nowrap"
                      >
                        Unfollow
                      </button>
                    </div>

                    <div className="space-y-2.5 mb-4">
                      {CHANNEL_META.map((ch) => (
                        <label
                          key={ch.key}
                          className="flex items-start gap-3 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={Boolean(s[ch.key])}
                            onChange={() =>
                              updateBotState(rec.bot_id, {
                                [ch.key]: !s[ch.key],
                              } as Partial<BotState>)
                            }
                            className="mt-0.5 w-4 h-4"
                            style={{ accentColor: color }}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-medium text-[var(--color-text-primary)]">
                                {ch.label}
                              </span>
                              <span
                                className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded"
                                style={{
                                  backgroundColor:
                                    ch.status === 'Live'
                                      ? 'var(--color-bull-soft)'
                                      : 'var(--color-warning-soft)',
                                  color:
                                    ch.status === 'Live'
                                      ? 'var(--color-bull)'
                                      : 'var(--color-warning)',
                                }}
                              >
                                {ch.status}
                              </span>
                            </div>
                            <div className="text-[11px] text-[var(--color-text-secondary)] leading-snug mt-0.5">
                              {ch.description}
                            </div>
                          </div>
                        </label>
                      ))}
                    </div>

                    <div className="pt-3 border-t border-[var(--color-border)]">
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[11px] font-semibold text-[var(--color-text-primary)]">
                          Min. conviction
                        </label>
                        <span className="text-[11px] tabular-nums text-[var(--color-text-secondary)]">
                          {(s.min_confidence * 100).toFixed(0)}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={0.95}
                        step={0.05}
                        value={s.min_confidence}
                        onChange={(e) =>
                          updateBotState(rec.bot_id, {
                            min_confidence: Number(e.target.value),
                          })
                        }
                        className="w-full"
                        style={{ accentColor: color }}
                      />
                      <div className="text-[10px] text-[var(--color-text-secondary)] mt-1 leading-snug">
                        Suppress notifications for entries below this bot's confidence-blend
                        score.
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
