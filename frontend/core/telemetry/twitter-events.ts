// Canonical X (Twitter) Ads conversion event IDs, created in X Ads Manager →
// Conversion tracking (Setup method "Define with code"). The SAME id is used by
// both the browser pixel (twq('event', id)) and the Conversions API (event_id),
// so this is the single source of truth shared by client and server — mirrors
// events.ts. Not secret: the browser pixel exposes these ids anyway.
//
// Environment-agnostic (no 'use client', no node imports) so it imports cleanly
// into both browser components and server route handlers.

export const TwitterEvent = {
  /** Top of the paid funnel — free gamma-levels page view (browser pixel). */
  freeLevelsView: 'tw-rdk7i-rdmre',
  /** Pricing / trial page view (browser pixel). */
  pricingView: 'tw-rdk7i-rdmrc',
  /** Free trial started — authoritative, fired server-side from the Stripe
   *  webhook via the Conversions API. */
  trialStart: 'tw-rdk7i-rdmr9',
  /** First paid activation (incl. trial→paid) — Conversions API from webhook. */
  purchase: 'tw-rdk7i-rdmrb',
} as const;

export type TwitterEventId = (typeof TwitterEvent)[keyof typeof TwitterEvent];
