import 'server-only';

// Server-side PostHog wrapper for the conversion events that must fire where
// truth lands rather than in the browser (the Stripe webhook). Keyed off the
// same app user id as the client SDK so a person's client events (signup,
// checkout_started) and server events (trial_started, subscription_paid,
// subscription_cancelled) stitch into one funnel.
//
// No-op unless a key is configured (POSTHOG_KEY, or NEXT_PUBLIC_POSTHOG_KEY as
// a fallback so a single project key works for both sides). Every call is
// guarded and swallows errors — analytics must never break or fail a webhook.
//
// The website runs as a persistent Node process (PM2), so a singleton client
// is appropriate. Subscription events are low-volume and delivery-critical, so
// captureServer flushes immediately rather than relying on background batching.

import { PostHog } from 'posthog-node';
import type { AnalyticsEventName } from './events';

const KEY = process.env.POSTHOG_KEY ?? process.env.NEXT_PUBLIC_POSTHOG_KEY;
const HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com';

let client: PostHog | null = null;

function getClient(): PostHog | null {
  if (!KEY) return null;
  if (!client) {
    // flushAt:1 + flushInterval:0 → effectively send-on-capture; we also await
    // flush() below for delivery certainty on these rare, important events.
    client = new PostHog(KEY, { host: HOST, flushAt: 1, flushInterval: 0 });
  }
  return client;
}

/**
 * Capture a server-side funnel event for ``distinctId`` (the app user id) and
 * flush it. Best-effort: any failure is swallowed so the caller (a webhook
 * handler) is never affected.
 */
export async function captureServer(
  distinctId: string,
  event: AnalyticsEventName,
  properties?: Record<string, unknown>,
): Promise<void> {
  const c = getClient();
  if (!c) return;
  try {
    c.capture({ distinctId, event, properties });
    await c.flush();
  } catch {
    // Analytics must never break the webhook.
  }
}
