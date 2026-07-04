import { createHash, randomUUID } from 'crypto';
import type { NextRequest, NextResponse } from 'next/server';

// Opaque UUID stored in a first-party cookie to join today's broker CTA
// click to a subscription conversion months later. HttpOnly so page JS
// can't read it — the server sets it, reads it in the click API, and
// stamps it on Stripe checkout rows (see api/billing/checkout/route.ts).
export const ATTRIBUTION_COOKIE_NAME = 'zgx_attr';

// Two years. Matches roughly the outer edge of "someone still remembers
// which site referred them to this broker," and comfortably outlives any
// realistic conversion window for signup → paid ZeroGEX subscriber.
const ATTRIBUTION_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365 * 2;

// The six broker keys the /brokers page and BrokerCTA component knows
// about. Plus `compare` for the "Compare brokers" button that routes to
// /brokers rather than to a specific broker. Kept in sync with the env
// var suffix set (NEXT_PUBLIC_BROKER_URL_<KEY>).
export const BROKER_SLUGS = [
  'tastytrade',
  'tradestation',
  'ibkr',
  'tradezero',
  'webull',
  'public',
  'compare',
] as const;
export type BrokerSlug = (typeof BROKER_SLUGS)[number];

// Public CTA surfaces the component can render on. `brokers-page` is
// used for clicks originating on /brokers itself so the row still tells
// us where the click came from without conflating with off-page
// surfaces. Kept as string literals for zero-config zod-free validation.
export const CTA_SURFACES = [
  'card',
  'scorecard',
  'forecast',
  'replay',
  'live-bulletin',
  'spx-gamma-levels',
  'brokers-page',
] as const;
export type CtaSurface = (typeof CTA_SURFACES)[number];

export function isBrokerSlug(value: unknown): value is BrokerSlug {
  return typeof value === 'string' && (BROKER_SLUGS as readonly string[]).includes(value);
}

export function isCtaSurface(value: unknown): value is CtaSurface {
  return typeof value === 'string' && (CTA_SURFACES as readonly string[]).includes(value);
}

// Read the attribution cookie value off a request. Returns null when the
// cookie is absent — caller decides whether to mint a new id.
export function readAttributionId(request: NextRequest): string | null {
  return request.cookies.get(ATTRIBUTION_COOKIE_NAME)?.value ?? null;
}

// Mint a fresh opaque id. Uses randomUUID rather than any user-tied
// value so the cookie really is anonymous — no way to invert it back
// to a session or email.
export function mintAttributionId(): string {
  return randomUUID();
}

// Stamp the cookie onto a response. Idempotent-shaped so the middleware
// can call it unconditionally when the cookie is missing without
// worrying about existing values getting stomped. HttpOnly=true because
// only the server needs it (click API + checkout capture).
export function setAttributionCookie(response: NextResponse, id: string): void {
  response.cookies.set({
    name: ATTRIBUTION_COOKIE_NAME,
    value: id,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: ATTRIBUTION_COOKIE_MAX_AGE_SECONDS,
  });
}

// Hash the client IP with a rotating pepper so a raw IP never lands in
// the DB. Purely for the rate limiter + downstream dedup — the raw IP is
// not needed after this hop and never persisted.
//
// Pepper unset ⇒ we still hash (the DB column is defensive-defense) but
// the value is join-able across peppers, which is fine for its only use
// (per-attribution-id rate limit). Rotating the pepper harmlessly resets
// the joinability domain, which is arguably a feature.
export function hashClientIp(ip: string | null | undefined): string | null {
  if (!ip) return null;
  const pepper = process.env.ATTRIBUTION_IP_PEPPER ?? '';
  return createHash('sha256').update(`${pepper}::${ip}`).digest('hex');
}
