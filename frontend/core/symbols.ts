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
 * The short label every ES / NQ levels surface carries: "Implied from SPX".
 *
 * The levels on a futures view are the backing index's levels carried onto the
 * futures price axis at the theoretical cost of carry, not at a basis measured
 * off CME prints (zerogex-oa FUTURES_BASIS_CARRY_ONLY, on by default since
 * 2026-09-23 for licensing reasons). Carry is fair value, so the backend's rule
 * is that anything published from it says it is implied from the index rather
 * than presenting it as the future's own. Null for a cash symbol.
 */
export function futuresLevelsLabel(symbol: string | null | undefined): string | null {
  const index = symbol ? FUTURES_BACKING_INDEX[symbol.toUpperCase()] : undefined;
  return index ? `Implied from ${index}` : null;
}

/** The sentence behind that label, for its tooltip. Null for a cash symbol. */
export function futuresLevelsExplainer(symbol: string | null | undefined): string | null {
  const future = (symbol || '').toUpperCase();
  const index = FUTURES_BACKING_INDEX[future];
  if (!index) return null;
  return (
    `${future} has no options book of its own. These levels are the ${index} option levels ` +
    `carried onto the ${future} price axis at fair value (the cost of carry to the contract's ` +
    `expiry); the ${future} price itself is ${future}'s own. When ${future} trades rich or cheap ` +
    `to fair value, the levels can sit slightly off.`
  );
}

/**
 * The replay counterpart of futuresLevelsExplainer, and the difference is the
 * price. A replay is rebuilt from stored data, so /api/replay carries the
 * backing index's own candles onto the futures axis on the same fair-value
 * ratio as the levels. The live sentence ("the ES price itself is ES's own")
 * would be false on a replay: nothing there is a traded futures price.
 */
export function futuresReplayExplainer(symbol: string | null | undefined): string | null {
  const future = (symbol || '').toUpperCase();
  const index = FUTURES_BACKING_INDEX[future];
  if (!index) return null;
  return (
    `${future} replay is rebuilt from ${index}. The price candles and the levels are both ` +
    `${index} values carried onto the ${future} price axis at fair value (the cost of carry to ` +
    `the contract's expiry), not ${future}'s traded prices, so they can differ from an ` +
    `${future} chart by however far ${future} traded from fair value.`
  );
}

/**
 * The symbols a PER-CONTRACT option-flow surface can actually answer for.
 *
 * ES / NQ are served everywhere else by running the SPX / NDX handler and
 * projecting onto the futures price axis, but the backend's futures middleware
 * REFUSES the per-contract flow endpoints outright (400): an SPX contract with
 * its strike scaled by the basis is not a contract anyone can trade, and there
 * is no ES chain to substitute. `/api/flow/hedging` is one of those.
 *
 * So a picker on one of those surfaces should not offer them. Offering a
 * choice that resolves to an error is worse than not offering it — the reader
 * cannot tell a refused symbol from a broken page.
 */
export const CASH_SYMBOLS = SYMBOLS.filter((s) => !isFuturesSymbol(s)) as readonly PickerSymbol[];

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

/**
 * The counterpart instrument on the SAME index — the other book on the same
 * underlying rather than the cross-index like-pair: the ETF against its cash
 * index (SPY↔SPX, QQQ↔NDX) and a future against the cash index whose chain
 * supplies its levels (ES→SPX, NQ→NDX).
 *
 * This is deliberately not an involution. A future's counterpart is its backing
 * index, but an index's counterpart is its ETF, because the two ETF/index books
 * are separately ingested and genuinely differ (strike spacing, contract size,
 * who trades them), while a future's levels are the index's own projected onto
 * the futures price axis — pairing SPX back to ES would put the same book in
 * both columns.
 *
 * Used by the Gamma Terminal, whose second ladder opens on this counterpart so
 * the page starts on one underlying seen through two books.
 */
export const SAME_INDEX_PAIR: Readonly<Record<PickerSymbol, PickerSymbol>> = {
  SPY: 'SPX',
  SPX: 'SPY',
  ES: 'SPX',
  QQQ: 'NDX',
  NDX: 'QQQ',
  NQ: 'NDX',
};

/** The same-index counterpart of `symbol`, falling back to its like-pair. */
export function sameIndexPairFor(symbol: string): PickerSymbol {
  const upper = (symbol || '').toUpperCase() as PickerSymbol;
  const pair = SAME_INDEX_PAIR[upper];
  if (pair) return pair;
  return likePairFor(upper);
}
