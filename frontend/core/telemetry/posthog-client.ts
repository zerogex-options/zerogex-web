'use client';

// Browser-side PostHog wrapper. Every export is a no-op unless
// NEXT_PUBLIC_POSTHOG_KEY is set, so merging this changes nothing until the
// key is configured — and a missing/misbehaving analytics layer can never
// throw into the app (all calls are guarded + swallow errors).
//
// Privacy-conservative defaults for a financial app: autocapture and session
// recording are OFF, so we only ever send the explicit funnel events and
// pageviews defined in this codebase — never raw clicks, form contents, or
// screen recordings.
//
// The SDK is loaded with a dynamic import, not a static one. Statically it
// landed in every page's first-load JavaScript (about 66 KB gzipped) whether
// or not a key was configured, because the bundler cannot know at build time
// that `enabled()` will be false. With the import behind that check, a build
// with no key never ships the SDK at all, and a build with one fetches it as a
// separate chunk after the page is interactive.

import type { TelemetryEventName } from './events';

const KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com';

let initialized = false;

// One in-flight load, shared by every call. Callbacks chained on one promise
// run in the order they were attached, so a capture() made after
// initAnalytics() still runs after init() even while the chunk is downloading.
// That keeps the ordering the static import had; it matters because posthog-js
// does not queue a call made before init(), it logs an error and drops it.
// TelemetryProvider (which calls initAnalytics) is the first child under the
// providers in app/layout.tsx, so its effect runs before any other mount-time
// capture in the tree.
let sdk: Promise<typeof import('posthog-js')['default']> | null = null;
function load() {
  return (sdk ??= import('posthog-js').then((m) => m.default));
}

function enabled(): boolean {
  return Boolean(KEY) && typeof window !== 'undefined';
}

/** Initialize the browser SDK once. Safe to call on every mount. */
export function initAnalytics(): void {
  if (initialized || !enabled()) return;
  // Set before the chunk arrives so a second mount during the download does
  // not start a second init.
  initialized = true;
  void load()
    .then((posthog) => {
      posthog.init(KEY as string, {
        api_host: HOST,
        // We capture pageviews manually on route change (App Router client-side
        // navigations don't trigger the SDK's automatic capture reliably).
        capture_pageview: false,
        capture_pageleave: true,
        // Conservative: no automatic click/input capture, no session replay.
        autocapture: false,
        disable_session_recording: true,
        persistence: 'localStorage+cookie',
        // Create person profiles for anonymous visitors too, so first-touch UTM
        // (utm_source/campaign/…) is recorded as a person property on every paid
        // click - not just the ones that sign up. That lets the whole paid funnel,
        // including the anonymous top, break down by campaign in PostHog. Trade-
        // off: more person-profile events (PostHog is billed per event); switch to
        // 'identified_only' if the person-event volume becomes a cost concern.
        person_profiles: 'always',
      });
    })
    .catch(() => {
      // Analytics must never break app startup.
    });
}

/** Fire a funnel event with optional properties. */
export function capture(
  event: TelemetryEventName,
  properties?: Record<string, unknown>,
): void {
  if (!enabled()) return;
  void load()
    .then((posthog) => posthog.capture(event, properties))
    .catch(() => {
      /* swallow */
    });
}

/** Capture a manual pageview for the given path. */
export function capturePageview(path: string): void {
  if (!enabled()) return;
  void load()
    .then((posthog) => posthog.capture('$pageview', { $current_url: path }))
    .catch(() => {
      /* swallow */
    });
}

/**
 * Associate subsequent events with a known user. ``distinctId`` must match the
 * id used server-side (the app user id) so client and webhook events stitch to
 * one person.
 */
export function identify(distinctId: string, properties?: Record<string, unknown>): void {
  if (!enabled()) return;
  void load()
    .then((posthog) => posthog.identify(distinctId, properties))
    .catch(() => {
      /* swallow */
    });
}

/** Clear identity on logout so the next visitor starts anonymous. */
export function reset(): void {
  if (!enabled()) return;
  void load()
    .then((posthog) => posthog.reset())
    .catch(() => {
      /* swallow */
    });
}
