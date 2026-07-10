import 'server-only';

// Server-side X (Twitter) Ads Conversions API (CAPI) wrapper for the money
// events that must fire where truth lands rather than in the browser (the
// Stripe webhook). CAPI is server-to-server, so — unlike the browser pixel —
// it survives ad-blockers, Safari ITP, and cookie loss, which matters most for
// the trial/paid conversions the campaign optimizes against.
//
// No-op unless BOTH X_ADS_PIXEL_TOKEN (a secret) and NEXT_PUBLIC_TWITTER_PIXEL_ID
// are set, so merging changes nothing until they're configured. Every call is
// guarded, time-boxed, and swallows errors — analytics must never break or
// delay a webhook.

import { createHash } from 'node:crypto';

const TOKEN = process.env.X_ADS_PIXEL_TOKEN;
const PIXEL_ID = process.env.NEXT_PUBLIC_TWITTER_PIXEL_ID;

function enabled(): boolean {
  return Boolean(TOKEN && PIXEL_ID);
}

/** SHA-256 of a normalized (trimmed, lowercased) email — X's identifier spec. */
function hashEmail(email: string): string {
  return createHash('sha256').update(email.trim().toLowerCase()).digest('hex');
}

interface TwitterConversion {
  /** The X event id, e.g. TwitterEvent.trialStart (`tw-rdk7i-…`). */
  eventId: string;
  /** Stable per-conversion id for dedup against any web-pixel event — e.g. the
   *  Stripe subscription id. */
  conversionId: string;
  /** Raw email; hashed here before it ever leaves the process. */
  email: string;
  /** ISO-8601 conversion time; defaults to now. */
  conversionTime?: string;
}

/**
 * Report a conversion to X via the Conversions API. Best-effort: any failure —
 * or a slow/hung X endpoint — is swallowed within 2.5s so the caller (a
 * delivery-critical Stripe webhook) is never blocked or broken.
 */
export async function captureTwitterConversion(conversion: TwitterConversion): Promise<void> {
  if (!enabled()) return;
  try {
    const body = {
      conversions: [
        {
          conversion_time: conversion.conversionTime ?? new Date().toISOString(),
          event_id: conversion.eventId,
          conversion_id: conversion.conversionId,
          identifiers: [{ hashed_email: hashEmail(conversion.email) }],
        },
      ],
    };
    await fetch(`https://ads-api.x.com/12/measurement/conversions/${PIXEL_ID}`, {
      method: 'POST',
      headers: {
        'X-Pixel-Token': TOKEN as string,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(2500),
    });
  } catch {
    // Analytics must never break or delay the webhook.
  }
}
