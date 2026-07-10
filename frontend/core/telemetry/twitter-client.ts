'use client';

// Browser-side X (Twitter) Ads pixel wrapper. Mirrors posthog-client.ts:
// every export is a no-op unless NEXT_PUBLIC_TWITTER_PIXEL_ID is set, so
// merging this changes nothing until the id is configured — and a missing or
// misbehaving pixel can never throw into the app (all calls are guarded +
// swallow errors).
//
// The base pixel fires a single PageView when configured. Explicit conversion
// events (ViewFreeLevels, TrialStart, …) are wired separately through the
// shared telemetry call sites — see trackTwitter() below.

const PIXEL_ID = process.env.NEXT_PUBLIC_TWITTER_PIXEL_ID;

// X's Universal Website Tag global (`twq`). Typed minimally so we avoid `any`
// while modelling the queueing stub the loader installs (version/queue/exe).
type TwqFn = ((...args: unknown[]) => void) & {
  version?: string;
  queue?: unknown[][];
  exe?: (...args: unknown[]) => void;
};

declare global {
  interface Window {
    twq?: TwqFn;
  }
}

let initialized = false;

function enabled(): boolean {
  return Boolean(PIXEL_ID) && typeof window !== 'undefined';
}

/**
 * Load the X Universal Website Tag once and configure the pixel. Safe to call
 * on every mount. No-op unless NEXT_PUBLIC_TWITTER_PIXEL_ID is set.
 */
export function initTwitterPixel(): void {
  if (initialized || !enabled()) return;
  try {
    if (!window.twq) {
      // Readable form of X's official uwt.js loader: install a queueing stub
      // that buffers calls until the real tag loads and swaps in `exe`.
      const stub = function (...args: unknown[]): void {
        if (stub.exe) {
          stub.exe(...args);
        } else {
          stub.queue?.push(args);
        }
      } as TwqFn;
      stub.version = '1.1';
      stub.queue = [];
      window.twq = stub;

      const script = document.createElement('script');
      script.async = true;
      script.src = 'https://static.ads-twitter.com/uwt.js';
      const first = document.getElementsByTagName('script')[0];
      first?.parentNode?.insertBefore(script, first);
    }
    // `config` registers the pixel and fires the initial PageView.
    window.twq?.('config', PIXEL_ID as string);
    initialized = true;
  } catch {
    // Analytics must never break app startup.
  }
}

/**
 * Fire an X pixel conversion event. No-op unless the pixel is configured.
 * Exported for the funnel-event wiring (ViewFreeLevels, TrialStart, …); not
 * yet called anywhere.
 */
export function trackTwitter(event: string, params?: Record<string, unknown>): void {
  if (!enabled()) return;
  try {
    window.twq?.('event', event, params ?? {});
  } catch {
    /* swallow */
  }
}
