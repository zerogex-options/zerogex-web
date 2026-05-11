/**
 * Module-scope cache for the /api/max-pain/current option chain payload that
 * powers the Strategy Builder leg pickers. The chain is the slowest call on
 * /options-calculator (potentially many expirations × many strikes computed
 * server-side), and useApiData resets state on every mount, so without a
 * cache here every navigation back to the page paid the full network +
 * server cost. The page hydrates state from this map synchronously on
 * remount, and OptionChainPrewarm warms it for the common tickers as soon
 * as the app shell mounts.
 *
 * Types live alongside the cache because (a) only this file and the page
 * use them and (b) the prewarm needs them to type the response.
 */

export interface MaxPainPoint {
  settlement_price: number;
}

export interface MaxPainExpiration {
  expiration: string;
  strikes: MaxPainPoint[];
}

export interface MaxPainCurrentResponse {
  expirations: MaxPainExpiration[];
}

// 200 strikes is plenty for any real strategy — even an Iron Condor or Box
// Spread covers a much narrower range than that. The previous default of
// 500 dramatically inflated the server query time and the JSON payload
// without giving users anything they could meaningfully use.
export const STRIKE_LIMIT = 200;

const cache = new Map<string, MaxPainCurrentResponse>();
const inflight = new Map<string, Promise<void>>();

export function getCachedOptionChain(symbol: string): MaxPainCurrentResponse | null {
  return cache.get(symbol) ?? null;
}

export function setCachedOptionChain(symbol: string, data: MaxPainCurrentResponse): void {
  cache.set(symbol, data);
}

export function buildOptionChainUrl(symbol: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';
  const sym = encodeURIComponent(symbol);
  return `${baseUrl}/api/max-pain/current?symbol=${sym}&underlying=${sym}&strike_limit=${STRIKE_LIMIT}`;
}

/**
 * Fire-and-forget fetch that populates the cache for `symbol`. Skips if the
 * cache already has it or if a fetch for this symbol is already in flight.
 * Errors are swallowed — a prewarm failure must never break the host page;
 * the worst case is the user's eventual navigation hits the same uncached
 * load path it would have hit without prewarm.
 */
export function prewarmOptionChain(symbol: string): void {
  if (cache.has(symbol) || inflight.has(symbol)) return;
  const promise = fetch(buildOptionChainUrl(symbol))
    .then((r) => (r.ok ? r.json() : null))
    .then((data: MaxPainCurrentResponse | null) => {
      if (data) cache.set(symbol, data);
    })
    .catch(() => {
      /* swallow — prewarm is best-effort */
    })
    .finally(() => {
      inflight.delete(symbol);
    });
  inflight.set(symbol, promise);
}
