'use client';

// First-party per-page engagement tracker. Sibling to TelemetryProvider (which
// feeds PostHog); this one feeds ZeroGEX's own SQLite-backed admin dashboard at
// /admin/analytics via /api/analytics/page-view. Rendered once from the root
// layout so it observes every client route change.
//
// It measures *active* time — only while the tab is actually visible — so a
// backgrounded tab left open for hours doesn't count as engagement. Each visit
// reports twice: an "enter" the moment the page opens (so the access is counted
// even if the browser drops the final beacon) and an "exit" carrying the
// accumulated active milliseconds. Exits fire on SPA navigation away, when the
// tab is hidden (a checkpoint, since a tab can be closed while hidden), and on
// pagehide. The server keys everything on a per-visit id and keeps the largest
// duration, so the repeated exits are idempotent.

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { sanitizeUtmSource } from '@/core/utils';

const ENDPOINT = '/api/analytics/page-view';
// First-touch acquisition cookie, mirrored server-side at signup into
// users.signup_utm_source (see the register route + OAuth callback). Lasts 30
// days and is NOT overwritten once set, so the campaign that first brought the
// visitor wins even if they browse around before creating an account.
const SOURCE_COOKIE = 'zgx_src';
const SOURCE_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

type Visit = {
  visitId: string;
  path: string;
  /** Accumulated visible/active time (ms). */
  activeMs: number;
  /** Timestamp the current visible stretch began, or null while hidden. */
  lastVisibleAt: number | null;
  /** Sanitized ?utm_source= from this visit's landing URL, or null. */
  utmSource: string | null;
};

function makeVisitId(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
  } catch {
    // fall through to the manual id
  }
  return `v${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
}

function isVisible(): boolean {
  return typeof document === 'undefined' || document.visibilityState === 'visible';
}

// Read + sanitize ?utm_source= off the current URL (the value the beacon stamps
// on this visit's landing row).
function readUtmSource(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return sanitizeUtmSource(new URLSearchParams(window.location.search).get('utm_source'));
  } catch {
    return null;
  }
}

// First-touch: drop the zgx_src cookie only if one isn't already set, so the
// earliest attributed source is the one carried to signup. Best-effort.
function rememberSource(source: string): void {
  try {
    if (typeof document === 'undefined') return;
    if (new RegExp(`(?:^|;\\s*)${SOURCE_COOKIE}=`).test(document.cookie)) return;
    document.cookie = `${SOURCE_COOKIE}=${encodeURIComponent(source)}; path=/; max-age=${SOURCE_COOKIE_MAX_AGE}; SameSite=Lax`;
  } catch {
    // Attribution cookie is best-effort; never break a page over it.
  }
}

// Close out the current visible stretch, folding it into activeMs exactly once.
function accumulate(visit: Visit): void {
  if (visit.lastVisibleAt != null) {
    visit.activeMs += Math.max(0, Date.now() - visit.lastVisibleAt);
    visit.lastVisibleAt = null;
  }
}

function post(payload: Record<string, unknown>): void {
  let body: string;
  try {
    body = JSON.stringify(payload);
  } catch {
    return;
  }
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      // A Blob lets us tag the content type; same-origin so no CORS preflight.
      const blob = new Blob([body], { type: 'application/json' });
      if (navigator.sendBeacon(ENDPOINT, blob)) return;
    }
  } catch {
    // sendBeacon can throw if the queue is full; fall back to fetch.
  }
  try {
    void fetch(ENDPOINT, {
      method: 'POST',
      body,
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
      credentials: 'same-origin',
      cache: 'no-store',
    }).catch(() => {});
  } catch {
    // Ignore — analytics is strictly best-effort.
  }
}

export default function PageAnalytics() {
  const pathname = usePathname();
  const visitRef = useRef<Visit | null>(null);

  // Global visibility/unload listeners, attached once. They read whatever the
  // current visit is via the ref, so they don't need to re-bind per route.
  useEffect(() => {
    const sendExit = (visit: Visit) => {
      post({ phase: 'exit', visitId: visit.visitId, path: visit.path, durationMs: visit.activeMs, utmSource: visit.utmSource ?? undefined });
    };
    const onVisibility = () => {
      const visit = visitRef.current;
      if (!visit) return;
      if (document.visibilityState === 'hidden') {
        accumulate(visit);
        sendExit(visit); // checkpoint: the tab may never come back
      } else {
        visit.lastVisibleAt = Date.now();
      }
    };
    const onPageHide = () => {
      const visit = visitRef.current;
      if (!visit) return;
      accumulate(visit);
      sendExit(visit);
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', onPageHide);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', onPageHide);
    };
  }, []);

  // One effect per route: open a visit on entry, close it on the way out (SPA
  // navigation triggers the cleanup, which finalizes and reports the duration).
  useEffect(() => {
    if (!pathname) return;
    const utmSource = readUtmSource();
    if (utmSource) rememberSource(utmSource);
    const visit: Visit = {
      visitId: makeVisitId(),
      path: pathname,
      activeMs: 0,
      lastVisibleAt: isVisible() ? Date.now() : null,
      utmSource,
    };
    visitRef.current = visit;
    // utmSource ?? undefined so JSON.stringify omits it entirely on the vast
    // majority of (organic) page views — the beacon stays byte-for-byte what it
    // was before for anything without a campaign string.
    post({ phase: 'enter', visitId: visit.visitId, path: visit.path, utmSource: visit.utmSource ?? undefined });

    return () => {
      accumulate(visit);
      post({ phase: 'exit', visitId: visit.visitId, path: visit.path, durationMs: visit.activeMs, utmSource: visit.utmSource ?? undefined });
      if (visitRef.current === visit) visitRef.current = null;
    };
  }, [pathname]);

  return null;
}
