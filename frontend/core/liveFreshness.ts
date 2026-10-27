// Keeps the live price and candle polls past nginx's 5 s response cache.
//
// nginx stores every /api/ GET answer for 5 s per session, and serves the old
// copy while it refreshes (deploy/steps/050.nginx and 070.ssl). That suits
// panels that change every few seconds, but the Gamma Terminal asks for its
// price and its last candles once a second: through the cache, a once-a-second
// poll saw a new price or candle only every 5 to 6 s, and a new candle up to
// that long after its minute began.
//
// A poll that must be fresh carries `fresh=<token>` in its URL, and the BFF
// (core/api/proxy.ts) answers any request carrying it with
// `Cache-Control: no-store`, which nginx honours by never storing it. Two rules
// make that safe, both measured against this nginx config on 2026-10-27:
//
// 1. Whether an answer may be stored depends on its URL alone. A URL must
//    never switch from storable to not: nginx keeps serving its expired copy
//    while every refresh comes back unstorable, and a poll that keeps asking
//    keeps that copy alive, so the chart freezes for good. Marking answers by
//    PATH would have done exactly that to every member with a chart open
//    during the deploy. A new parameter is a new URL that was never stored.
// 2. The token is random per page load, so two tabs never share a URL. nginx
//    makes identical requests in flight wait for each other and re-checks
//    only every 500 ms, which cost one of two colliding tabs half a second.
//
// Kept free of browser and Next.js APIs so it is unit-testable under
// `node --experimental-strip-types` (tests/liveFreshness.test.ts).

export const FRESH_PARAM = 'fresh';

const PAGE_TOKEN = Math.random().toString(36).slice(2, 10) || 'x';

/** `url` with this page's `fresh` token appended. */
export function withFresh(url: string): string {
  return `${url}${url.includes('?') ? '&' : '?'}${FRESH_PARAM}=${PAGE_TOKEN}`;
}

/** Whether a proxied answer must not be stored by any cache on the way back. */
export function mustNotStore(searchParams: URLSearchParams): boolean {
  return Boolean(searchParams.get(FRESH_PARAM));
}
