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

import posthog from 'posthog-js';
import type { TelemetryEventName } from './events';

const KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com';

let initialized = false;

function enabled(): boolean {
  return Boolean(KEY) && typeof window !== 'undefined';
}

/** Initialize the browser SDK once. Safe to call on every mount. */
export function initAnalytics(): void {
  if (initialized || !enabled()) return;
  try {
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
      // click — not just the ones that sign up. That lets the whole paid funnel,
      // including the anonymous top, break down by campaign in PostHog. Trade-
      // off: more person-profile events (PostHog is billed per event); switch to
      // 'identified_only' if the person-event volume becomes a cost concern.
      person_profiles: 'always',
    });
    initialized = true;
  } catch {
    // Analytics must never break app startup.
  }
}

/** Fire a funnel event with optional properties. */
export function capture(
  event: TelemetryEventName,
  properties?: Record<string, unknown>,
): void {
  if (!enabled()) return;
  try {
    posthog.capture(event, properties);
  } catch {
    /* swallow */
  }
}

/** Capture a manual pageview for the given path. */
export function capturePageview(path: string): void {
  if (!enabled()) return;
  try {
    posthog.capture('$pageview', { $current_url: path });
  } catch {
    /* swallow */
  }
}

/**
 * Associate subsequent events with a known user. ``distinctId`` must match the
 * id used server-side (the app user id) so client and webhook events stitch to
 * one person.
 */
export function identify(distinctId: string, properties?: Record<string, unknown>): void {
  if (!enabled()) return;
  try {
    posthog.identify(distinctId, properties);
  } catch {
    /* swallow */
  }
}

/** Clear identity on logout so the next visitor starts anonymous. */
export function reset(): void {
  if (!enabled()) return;
  try {
    posthog.reset();
  } catch {
    /* swallow */
  }
}
