// Shared symbol constants + parser. Kept in a plain (non 'use client')
// module so both server components (which resolve ?symbol=X in searchParams)
// and the client-side SymbolPicker can import from the same source of truth
// without dragging server code across the RSC boundary.

// The picker's symbols, by asset class. Each class is its own list so a symbol
// is classified in exactly one place, and SYMBOLS (the picker order) is just
// the four lists end to end.
//
// ETFs and stocks are both listed securities: their own share price and volume,
// their own option chain, extended-hours trading. A stock behaves like an ETF
// on the live surfaces. Where it differs is spelled out below: the ETF it is
// compared against (STOCK_LISTING), no price range projected from VIX / VXN
// (volIndexPricesSymbol), and no levels page or models yet
// (LEVELS_PAGE_SYMBOLS, MODELED_SYMBOLS).
//
// Indexes are cash indexes: no share volume, and a price only in the cash
// session.
//
// ES / NQ are the CME futures. They are NOT separately ingested: their dealer
// levels are the SPX / NDX option-derived levels carried onto the futures
// price axis by the backend (see src/jobs/futures_projection.py in
// zerogex-oa), while their price series comes from the futures feed itself.
// To the frontend they are ordinary symbols — the API answers /gex/*,
// /v1/levels/* and the rest for them like any other underlying.
export const ETF_SYMBOLS = ['SPY', 'QQQ'] as const;
export const INDEX_SYMBOLS = ['SPX', 'NDX'] as const;
export const FUTURES_SYMBOLS = ['ES', 'NQ'] as const;
export const STOCK_SYMBOLS = ['NVDA'] as const;

export const SYMBOLS = [...ETF_SYMBOLS, ...INDEX_SYMBOLS, ...FUTURES_SYMBOLS, ...STOCK_SYMBOLS] as const;
export type PickerSymbol = (typeof SYMBOLS)[number];
export type EtfSymbol = (typeof ETF_SYMBOLS)[number];
export type StockSymbol = (typeof STOCK_SYMBOLS)[number];
export const DEFAULT_SYMBOL: PickerSymbol = 'SPY';

export type AssetClass = 'etf' | 'index' | 'future' | 'stock';

/**
 * The symbols with a free /<sym>-gamma-levels landing page. The public levels
 * product hangs off that page: the embed widget links back to it, llms.txt
 * lists it, and the daily levels email links its reader's ticker to it. So
 * those surfaces offer only these symbols. Stocks have no landing page yet and
 * live in the app only; a stock joins this list in the same change that adds
 * its page (tests/embedWidget.test.ts checks that each one has a page).
 */
export const LEVELS_PAGE_SYMBOLS = [...ETF_SYMBOLS, ...INDEX_SYMBOLS, ...FUTURES_SYMBOLS] as const;
export type LevelsPageSymbol = (typeof LEVELS_PAGE_SYMBOLS)[number];

/**
 * The symbols the signal engine and the forecast models run on. A stock's
 * chain, levels and flow are ingested like an ETF's, but those models are tuned
 * on the ETFs and indexes and assume an expiration every day, so they leave
 * stocks out for now. The signal scorecard and forecast pages offer only these,
 * and the signal pages say why a stock has nothing (StockSignalsNotice).
 */
export const MODELED_SYMBOLS = [...ETF_SYMBOLS, ...INDEX_SYMBOLS, ...FUTURES_SYMBOLS] as const;

/**
 * The picker's symbols grouped by asset class, in picker order, for a dropdown
 * that heads each group (components/SymbolOptions). A group with no symbols is
 * left out.
 */
export const SYMBOL_GROUPS: ReadonlyArray<{
  assetClass: AssetClass;
  symbols: readonly PickerSymbol[];
}> = [
  { assetClass: 'etf' as const, symbols: ETF_SYMBOLS },
  { assetClass: 'index' as const, symbols: INDEX_SYMBOLS },
  { assetClass: 'future' as const, symbols: FUTURES_SYMBOLS },
  { assetClass: 'stock' as const, symbols: STOCK_SYMBOLS },
].filter((g) => g.symbols.length > 0);

/** The asset class of a picker symbol, or null for anything else. */
export function assetClassOf(symbol: string | null | undefined): AssetClass | null {
  const upper = (symbol || '').toUpperCase();
  for (const group of SYMBOL_GROUPS) {
    if ((group.symbols as readonly string[]).includes(upper)) return group.assetClass;
  }
  return null;
}

/** True for an individual stock (NVDA) rather than an ETF, index or future. */
export function isStockSymbol(symbol: string | null | undefined): symbol is StockSymbol {
  return assetClassOf(symbol) === 'stock';
}

/**
 * Where each stock lists. It decides the stock's benchmark ETF: a
 * Nasdaq-listed stock is compared against QQQ, anything else against SPY.
 * Keyed by StockSymbol, so adding a stock without its listing fails to compile.
 */
export const STOCK_LISTING: Readonly<Record<StockSymbol, 'NASDAQ' | 'NYSE'>> = {
  NVDA: 'NASDAQ',
};

/** A stock's benchmark ETF (QQQ for Nasdaq listings, SPY otherwise); null for a non-stock. */
export function stockBenchmarkFor(symbol: string | null | undefined): EtfSymbol | null {
  const upper = (symbol || '').toUpperCase();
  if (!isStockSymbol(upper)) return null;
  return STOCK_LISTING[upper] === 'NASDAQ' ? 'QQQ' : 'SPY';
}

/** Every stock paired with its benchmark ETF, for the pair maps below. */
const STOCK_BENCHMARK_PAIRS = Object.fromEntries(
  STOCK_SYMBOLS.map((s) => [s, stockBenchmarkFor(s) as EtfSymbol]),
) as Record<StockSymbol, EtfSymbol>;

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
 * against VIX. A stock reads against its benchmark ETF's index, so a
 * Nasdaq-listed stock gets VXN. Centralized because this pairing is consumed
 * by roughly a dozen surfaces, and a symbol added to the picker but missed in
 * one of them silently renders the wrong vol gauge.
 */
export function volatilityIndexFor(symbol: string | null | undefined): 'VIX' | 'VXN' {
  const upper = stockBenchmarkFor(symbol) ?? (symbol || '').toUpperCase();
  return upper === 'QQQ' || upper === 'NDX' || upper === 'NQ' ? 'VXN' : 'VIX';
}

/**
 * Whether the volatility index can stand in for the symbol's OWN implied vol,
 * i.e. whether a price range may be projected from it (the chart's Expected
 * Range band, the Bulletin's expected move).
 *
 * True for the ETFs, indexes and futures, which ARE the market VIX / VXN
 * measure. False for a single stock: NVDA's implied vol runs around twice
 * VXN's, so a range built from VXN would be about half as wide as the
 * options are pricing. The index is still fine as market context beside a
 * stock (the vol gauge, IV rank); it just must not be used to price one.
 */
export function volIndexPricesSymbol(symbol: string | null | undefined): boolean {
  return !isStockSymbol((symbol || '').toUpperCase());
}

/**
 * The natural "compare against" partner for a symbol — its like-pair, so a
 * two-symbol surface opens on a meaningful comparison instead of a symbol
 * beside itself (SPY↔QQQ, SPX↔NDX, ES↔NQ). A stock pairs with its benchmark
 * ETF (NVDA→QQQ); that is one-way, since QQQ keeps SPY as its own partner.
 * Used by Pair Comparison.
 */
export const LIKE_PAIR: Readonly<Record<PickerSymbol, PickerSymbol>> = {
  SPY: 'QQQ',
  QQQ: 'SPY',
  SPX: 'NDX',
  NDX: 'SPX',
  ES: 'NQ',
  NQ: 'ES',
  ...STOCK_BENCHMARK_PAIRS,
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
 * A stock has no other book on the same underlying, so it opens on its
 * benchmark ETF (NVDA→QQQ), the same as its like-pair.
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
  ...STOCK_BENCHMARK_PAIRS,
};

/** The same-index counterpart of `symbol`, falling back to its like-pair. */
export function sameIndexPairFor(symbol: string): PickerSymbol {
  const upper = (symbol || '').toUpperCase() as PickerSymbol;
  const pair = SAME_INDEX_PAIR[upper];
  if (pair) return pair;
  return likePairFor(upper);
}
