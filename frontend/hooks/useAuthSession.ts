'use client';

import { useCallback, useSyncExternalStore } from 'react';
import { TierId } from '@/core/auth';

type SessionUser = {
  id: string;
  email: string;
  tier: TierId;
  // True iff the user has a Stripe subscription on file (stripe_subscription_id
  // is non-null). Distinct from `tier` so the UI can tell grandfathered users
  // (tier=basic|pro without a Stripe sub) apart from real subscribers; only
  // real subscribers can use the billing portal.
  hasActiveSubscription?: boolean;
  // True iff the account has ever held a paid subscription. Checkout suppresses
  // the free trial for these users, so the pricing UI shows "Subscribe" copy
  // rather than promising a trial they won't get.
  hasPriorPaid?: boolean;
  // True iff users.email_verified_at is set. Gates /api/billing/checkout
  // server-side; the pricing/founding clients show a "verify your email"
  // banner when false so the user can resend the link.
  emailVerified?: boolean;
  disclaimerAcknowledgedAt?: string | null;
  disclaimerVersionAcknowledged?: string | null;
  foundingEligible?: boolean;
  foundingLockinDismissedAt?: string | null;
};

type SessionResponse = {
  authenticated: boolean;
  user?: SessionUser;
  expiresAt?: string;
};

// ── Shared session store ─────────────────────────────────────────────────────
// One module-level cache backs every useAuthSession() consumer. A page that
// renders the header, nav, layout, and a gated body used to fire one
// /api/auth/session request PER hook instance (3–4 identical requests on every
// load); now they share a SINGLE request. And because state is shared, a
// refresh() after an auth transition (login, logout, checkout return)
// propagates to every consumer at once instead of updating one component's
// private copy.
//
// SSR-safe via useSyncExternalStore (server snapshot is a stable "loading"
// value) so there's no hydration mismatch and no synchronous setState-in-effect.

type SessionSnapshot = { data: SessionResponse | null; loading: boolean };

// Live snapshot (reassigned to a NEW object on every change so useSyncExternalStore's
// Object.is check re-renders subscribers) and a stable server snapshot.
let snapshot: SessionSnapshot = { data: null, loading: true };
const SERVER_SNAPSHOT: SessionSnapshot = { data: null, loading: true };
let inflight: AbortController | null = null;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

async function runFetch(): Promise<void> {
  const controller = new AbortController();
  inflight = controller;
  try {
    // Don't short-circuit on NEXT_PUBLIC_AUTH_ENABLED here: that env var is
    // inlined into the client bundle at build time, so it can drift from the
    // server's runtime value. Always ask the server; if auth is disabled at
    // runtime the proxy 404s /api/auth/* and we fall through to unauthenticated.
    const response = await fetch('/api/auth/session', {
      credentials: 'include',
      signal: controller.signal,
    });
    if (controller.signal.aborted) return;
    const next: SessionResponse = response.ok
      ? ((await response.json()) as SessionResponse)
      : { authenticated: false };
    if (controller.signal.aborted) return;
    snapshot = { data: next, loading: false };
    emit();
  } catch (err) {
    if (controller.signal.aborted || (err instanceof DOMException && err.name === 'AbortError')) {
      return;
    }
    snapshot = { data: { authenticated: false }, loading: false };
    emit();
  } finally {
    if (inflight === controller) inflight = null;
  }
}

// Deduped fetch: concurrent callers (header/nav/layout/page all mounting
// together) share one in-flight request instead of each firing their own.
// Intentionally does NOT flip `loading` back to true on a background refetch,
// so re-reads on navigation update `data` silently without a spinner flash.
function fetchDeduped(): void {
  if (inflight) return;
  void runFetch();
}

// Forced refresh: abort any in-flight request and fetch fresh. Used after an
// auth transition (login/logout) and the post-checkout poll, where piggybacking
// a request that started before the change would return stale state.
async function forceRefresh(): Promise<void> {
  if (inflight) inflight.abort();
  inflight = null;
  await runFetch();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  // (Re)mount triggers a deduped refresh so navigation still reflects the
  // current session — matching the old per-instance fetch-on-mount, but shared.
  fetchDeduped();
  return () => {
    listeners.delete(listener);
  };
}

const getSnapshot = (): SessionSnapshot => snapshot;
const getServerSnapshot = (): SessionSnapshot => SERVER_SNAPSHOT;

export function useAuthSession() {
  const current = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const refresh = useCallback(() => forceRefresh(), []);
  return { data: current.data, loading: current.loading, refresh };
}
