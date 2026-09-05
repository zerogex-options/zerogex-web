// Shared symbol constants + parser. Kept in a plain (non 'use client')
// module so both server components (which resolve ?symbol=X in searchParams)
// and the client-side SymbolPicker can import from the same source of truth
// without dragging server code across the RSC boundary.

// ES / NQ are the CME futures. They are NOT separately ingested: their dealer
// levels are the SPX / NDX option-derived levels carried onto the futures
// price axis by the backend (see src/jobs/futures_projection.py in
// zerogex-oa), while their price series comes from the futures feed itself.
// To the frontend they are ordinary symbols — the API answers /gex/*,
// /v1/levels/* and the rest for them like any other underlying.
export const SYMBOLS = ['SPY', 'QQQ', 'SPX', 'NDX', 'ES', 'NQ'] as const;
export type PickerSymbol = (typeof SYMBOLS)[number];
export const DEFAULT_SYMBOL: PickerSymbol = 'SPY';

export function resolveSymbol(raw: string | undefined | null): PickerSymbol {
  const upper = (raw || '').toUpperCase();
  return (SYMBOLS as readonly string[]).includes(upper)
    ? (upper as PickerSymbol)
    : DEFAULT_SYMBOL;
}

/**
 * Build the per-symbol href map the SymbolPicker consumes.  Given a
 * function that maps a symbol to its target URL, produce an object keyed
 * by every valid symbol — saves each page an ~identical three-line
 * reduce.  Example:
 *
 *   const hrefs = buildSymbolHrefs((s) => `/forecast/${s}/${date}`);
 */
export function buildSymbolHrefs(
  hrefFor: (symbol: PickerSymbol) => string,
): Record<PickerSymbol, string> {
  return SYMBOLS.reduce(
    (acc, s) => {
      acc[s] = hrefFor(s);
      return acc;
    },
    {} as Record<PickerSymbol, string>,
  );
}

/** The future -> backing cash index whose options supply its levels. */
export const FUTURES_BACKING_INDEX: Readonly<Record<string, PickerSymbol>> = {
  ES: 'SPX',
  NQ: 'NDX',
};

/** True for a CME future (ES / NQ) rather than a cash index or ETF. */
export function isFuturesSymbol(symbol: string | null | undefined): boolean {
  return !!symbol && symbol.toUpperCase() in FUTURES_BACKING_INDEX;
}

/**
 * The symbol whose OPTION CHAIN answers for this one: the backing cash index
 * for a future, the symbol itself for everything else.
 *
 * Distinct from the price axis, and the distinction is the whole point. The API
 * serves ES / NQ by running the SPX / NDX handler and projecting the result
 * onto the futures price axis, but it REFUSES (400) the endpoints that
 * enumerate individual contracts — a projected strike is not a strike anyone
 * can trade, and it would no longer round-trip to the chain it came from.
 *
 * So a caller that needs to name a chain (the Flow Analysis strike /
 * expiration chips, which list the contracts that actually traded) asks for
 * SPX / NDX and keeps those values in the index's own strike space. A filter
 * built from them still applies to `?symbol=ES`, because the API rewrites the
 * symbol to the backing index before matching and only the response comes back
 * on the futures axis.
 */
export function optionChainSymbolFor(symbol: string): string {
  return FUTURES_BACKING_INDEX[(symbol || '').toUpperCase()] ?? symbol;
}

/**
 * The volatility index that pairs with a symbol.
 *
 * Nasdaq-100 exposure (QQQ / NDX / NQ) reads against VXN; everything else
 * against VIX. Centralized because this pairing is consumed by roughly a
 * dozen surfaces, and a symbol added to the picker but missed in one of them
 * silently renders the wrong vol gauge.
 */
export function volatilityIndexFor(symbol: string | null | undefined): 'VIX' | 'VXN' {
  const upper = (symbol || '').toUpperCase();
  return upper === 'QQQ' || upper === 'NDX' || upper === 'NQ' ? 'VXN' : 'VIX';
}

/**
 * The natural "compare against" partner for a symbol — its like-pair, so a
 * two-symbol surface opens on a meaningful comparison instead of a symbol
 * beside itself (SPY↔QQQ, SPX↔NDX, ES↔NQ). Shared by Pair Comparison and the
 * Gamma Terminal so both open the same way.
 */
export const LIKE_PAIR: Readonly<Record<PickerSymbol, PickerSymbol>> = {
  SPY: 'QQQ',
  QQQ: 'SPY',
  SPX: 'NDX',
  NDX: 'SPX',
  ES: 'NQ',
  NQ: 'ES',
};

/** The like-pair partner of `symbol`, falling back to QQQ (or SPY for QQQ itself). */
export function likePairFor(symbol: string): PickerSymbol {
  const upper = (symbol || '').toUpperCase() as PickerSymbol;
  const pair = LIKE_PAIR[upper];
  if (pair) return pair;
  return upper === 'QQQ' ? 'SPY' : 'QQQ';
}
