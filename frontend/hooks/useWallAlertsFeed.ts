'use client';

// The member's in-app wall alerts, shared by every consumer on the page.
//
// The header renders its bell more than once (desktop layouts are mounted and
// CSS-hidden on phones, and the phone menu sheet carries its own), so a
// per-instance poll would double the requests and — worse — double every toast.
// One module-level store, the same pattern as hooks/useAuthSession.ts: it polls
// only while something is subscribed, every 15s while the tab is visible and
// every 60s while it is hidden (still often enough to raise a desktop
// notification), and immediately when the tab comes back into view.
//
// New arrivals are pushed to onNewWallAlerts listeners — the toaster — exactly
// once per page load. The first response only sets the baseline: alerts that
// were already waiting show in the badge, but a page load never toasts history.

import { useCallback, useSyncExternalStore } from 'react';
import type { WallAlertFeedEntry, WallAlertFeedResponse } from '@/core/wallAlerts';

const FEED_URL = '/api/alerts/walls/feed?limit=20';
const VISIBLE_POLL_MS = 15_000;
const HIDDEN_POLL_MS = 60_000;

type FeedSnapshot = { data: WallAlertFeedResponse | null; loading: boolean };

let snapshot: FeedSnapshot = { data: null, loading: true };
const SERVER_SNAPSHOT: FeedSnapshot = { data: null, loading: true };
const listeners = new Set<() => void>();
const arrivalListeners = new Set<(entries: WallAlertFeedEntry[]) => void>();
let baselineId: number | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
let inflight = false;
let visibilityBound = false;

function emit(): void {
  for (const listener of listeners) listener();
}

function schedule(): void {
  if (timer) clearTimeout(timer);
  timer = null;
  if (listeners.size === 0 || typeof document === 'undefined') return;
  timer = setTimeout(() => void poll(), document.visibilityState === 'hidden' ? HIDDEN_POLL_MS : VISIBLE_POLL_MS);
}

async function poll(): Promise<void> {
  if (inflight) return;
  inflight = true;
  try {
    const res = await fetch(FEED_URL, { credentials: 'include', cache: 'no-store' });
    if (!res.ok) {
      // 401/403 (signed out, plan lapsed) or a blip: keep what we have.
      snapshot = { data: snapshot.data, loading: false };
      emit();
      return;
    }
    const data = (await res.json()) as WallAlertFeedResponse;
    const entries = Array.isArray(data.entries) ? data.entries : [];
    const newest = entries.reduce((m, e) => Math.max(m, e.id), 0);
    if (baselineId !== null) {
      const fresh = entries.filter((e) => e.id > (baselineId as number) && !e.read);
      if (fresh.length > 0) {
        // Oldest first, so toasts stack in the order the alerts fired.
        const ordered = [...fresh].sort((a, b) => a.id - b.id);
        for (const l of arrivalListeners) l(ordered);
      }
    }
    baselineId = Math.max(baselineId ?? 0, newest);
    snapshot = { data: { ...data, entries }, loading: false };
    emit();
  } catch {
    snapshot = { data: snapshot.data, loading: false };
    emit();
  } finally {
    inflight = false;
    schedule();
  }
}

function onVisibility(): void {
  if (document.visibilityState === 'visible' && listeners.size > 0) void poll();
  else schedule();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (!visibilityBound && typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', onVisibility);
    visibilityBound = true;
  }
  if (listeners.size === 1) void poll();
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      if (timer) clearTimeout(timer);
      timer = null;
    }
  };
}

const noopSubscribe = () => () => {};
const getSnapshot = (): FeedSnapshot => snapshot;
const getServerSnapshot = (): FeedSnapshot => SERVER_SNAPSHOT;
const getDisabledSnapshot = (): FeedSnapshot => SERVER_SNAPSHOT;

/** Subscribe to arrivals (the toaster). Returns the unsubscribe. */
export function onNewWallAlerts(listener: (entries: WallAlertFeedEntry[]) => void): () => void {
  arrivalListeners.add(listener);
  return () => {
    arrivalListeners.delete(listener);
  };
}

/** Mark every in-app alert read, optimistically, then confirm from the server. */
export async function markAllWallAlertsRead(): Promise<void> {
  if (snapshot.data) {
    snapshot = {
      data: { ...snapshot.data, unread: 0, entries: snapshot.data.entries.map((e) => ({ ...e, read: true })) },
      loading: false,
    };
    emit();
  }
  try {
    await fetch('/api/alerts/walls/feed/read', {
      method: 'POST',
      credentials: 'include',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
  } finally {
    void poll();
  }
}

/** The shared feed. Pass ``enabled=false`` for members without wall alerts: no requests. */
export function useWallAlertsFeed(enabled: boolean) {
  const current = useSyncExternalStore(
    enabled ? subscribe : noopSubscribe,
    enabled ? getSnapshot : getDisabledSnapshot,
    getServerSnapshot,
  );
  const refresh = useCallback(() => void poll(), []);
  return { data: enabled ? current.data : null, loading: enabled && current.loading, refresh };
}
