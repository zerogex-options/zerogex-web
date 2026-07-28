// Centralized instrument registry — the single source of truth for what an
// instrument IS (asset class, family, exchange, analytics source, calendar,
// contract economics) and what it can currently DO (capabilities × runtime
// availability). Mirrors the backend registry (src/instruments.py); the two
// are reconciled at runtime via GET /api/instruments.
//
// Kept as a plain, React-free, RSC-safe module (like core/symbols.ts) so both
// server components and the client picker import one source of truth, and so
// it is exercisable under the Node test runner (tests/instruments.test.ts).
//
// Design rules honored here (see the futures-support spec):
//  * SPY/SPX/QQQ/NDX keep the exact metadata they behave with today.
//  * ES/NQ are always DEFINED (so the UI can describe them) but their
//    analytics/reference availability is feature-flag gated — an unavailable
//    future never looks fully operational.
//  * Capabilities are metadata, not scattered `symbol === 'ES'` conditionals.

export type AssetClass = 'etf' | 'index' | 'future';

export type AnalyticsSource =
  | 'opra_equity_options'
  | 'cme_futures_options'
  | 'cash_index_projection';

export type MarketCalendarId = 'us_equities' | 'us_cash_index' | 'cme_equity_index';

export type InstrumentFamily = 'sp500' | 'nasdaq100';

// The always-on equity/index core (unchanged product).
export type EquitySymbol = 'SPY' | 'SPX' | 'QQQ' | 'NDX';
// The CME futures added by this work.
export type FuturesSymbol = 'ES' | 'NQ';
// Every registered instrument.
export type InstrumentSymbol = EquitySymbol | FuturesSymbol;

export interface InstrumentCapabilities {
  quotes: boolean;
  historicalQuotes: boolean;
  gex: boolean;
  optionFlow: boolean;
  vannaCharm: boolean;
  maxPain: boolean;
  signals: boolean;
  replay: boolean;
  backtesting: boolean;
  strategyBuilder: boolean;
  futuresReferenceMode: boolean;
}

export interface InstrumentDefinition {
  symbol: InstrumentSymbol;
  displaySymbol: string;
  name: string;
  family: InstrumentFamily;
  assetClass: AssetClass;
  exchange: string;
  currency: 'USD';
  analyticsSource: AnalyticsSource;
  marketCalendar: MarketCalendarId;
  /** Options contract multiplier / point value: 100 equity, 50 ES, 20 NQ. */
  contractMultiplier: number;
  /** Underlying minimum price increment (0.25 for ES/NQ). */
  priceIncrement?: number;
  /** Decimal places used to render prices. */
  pricePrecision: number;
  /** Cash-index whose option levels seed reference mode (SPX for ES). */
  referenceSourceSymbol?: EquitySymbol | null;
  /** Volatility-index ticker for this instrument's family (VIX / VXN). */
  volatilityIndex: 'VIX' | 'VXN';
  capability: InstrumentCapabilities;
}

const EQUITY_CAPS: InstrumentCapabilities = {
  quotes: true,
  historicalQuotes: true,
  gex: true,
  optionFlow: true,
  vannaCharm: true,
  maxPain: true,
  signals: true,
  replay: true,
  backtesting: true,
  strategyBuilder: true,
  futuresReferenceMode: false,
};

// Futures capability *surfaces* (what's meaningful), gated by availability
// below. strategyBuilder stays false (assumes equity symbology); signals stay
// false (not recalibrated for CME).
const FUTURE_CAPS: InstrumentCapabilities = {
  quotes: true,
  historicalQuotes: true,
  gex: true,
  optionFlow: true,
  vannaCharm: true,
  maxPain: true,
  signals: false,
  replay: true,
  backtesting: true,
  strategyBuilder: false,
  futuresReferenceMode: true,
};

export const INSTRUMENTS: Record<InstrumentSymbol, InstrumentDefinition> = {
  SPY: {
    symbol: 'SPY', displaySymbol: 'SPY', name: 'SPDR S&P 500 ETF Trust',
    family: 'sp500', assetClass: 'etf', exchange: 'ARCA', currency: 'USD',
    analyticsSource: 'opra_equity_options', marketCalendar: 'us_equities',
    contractMultiplier: 100, pricePrecision: 2, volatilityIndex: 'VIX',
    capability: EQUITY_CAPS,
  },
  SPX: {
    symbol: 'SPX', displaySymbol: 'SPX', name: 'S&P 500 Index',
    family: 'sp500', assetClass: 'index', exchange: 'CBOE', currency: 'USD',
    analyticsSource: 'opra_equity_options', marketCalendar: 'us_cash_index',
    contractMultiplier: 100, pricePrecision: 2, volatilityIndex: 'VIX',
    capability: EQUITY_CAPS,
  },
  QQQ: {
    symbol: 'QQQ', displaySymbol: 'QQQ', name: 'Invesco QQQ Trust',
    family: 'nasdaq100', assetClass: 'etf', exchange: 'NASDAQ', currency: 'USD',
    analyticsSource: 'opra_equity_options', marketCalendar: 'us_equities',
    contractMultiplier: 100, pricePrecision: 2, volatilityIndex: 'VXN',
    capability: EQUITY_CAPS,
  },
  NDX: {
    symbol: 'NDX', displaySymbol: 'NDX', name: 'Nasdaq-100 Index',
    family: 'nasdaq100', assetClass: 'index', exchange: 'NASDAQ', currency: 'USD',
    analyticsSource: 'opra_equity_options', marketCalendar: 'us_cash_index',
    contractMultiplier: 100, pricePrecision: 2, volatilityIndex: 'VXN',
    capability: EQUITY_CAPS,
  },
  ES: {
    symbol: 'ES', displaySymbol: 'ES', name: 'E-mini S&P 500 Futures',
    family: 'sp500', assetClass: 'future', exchange: 'CME', currency: 'USD',
    analyticsSource: 'cme_futures_options', marketCalendar: 'cme_equity_index',
    contractMultiplier: 50, priceIncrement: 0.25, pricePrecision: 2,
    referenceSourceSymbol: 'SPX', volatilityIndex: 'VIX', capability: FUTURE_CAPS,
  },
  NQ: {
    symbol: 'NQ', displaySymbol: 'NQ', name: 'E-mini Nasdaq-100 Futures',
    family: 'nasdaq100', assetClass: 'future', exchange: 'CME', currency: 'USD',
    analyticsSource: 'cme_futures_options', marketCalendar: 'cme_equity_index',
    contractMultiplier: 20, priceIncrement: 0.25, pricePrecision: 2,
    // No wired cash-index source — a naive QQQ->NQ mapping is disallowed.
    referenceSourceSymbol: null, volatilityIndex: 'VXN', capability: FUTURE_CAPS,
  },
};

// Order the equity core exactly as it ships today, then futures.
export const EQUITY_SYMBOLS: readonly EquitySymbol[] = ['SPY', 'SPX', 'QQQ', 'NDX'];
export const FUTURES_SYMBOLS: readonly FuturesSymbol[] = ['ES', 'NQ'];
export const ALL_INSTRUMENT_SYMBOLS: readonly InstrumentSymbol[] = [
  ...EQUITY_SYMBOLS,
  ...FUTURES_SYMBOLS,
];

export function isInstrumentSymbol(value: unknown): value is InstrumentSymbol {
  return typeof value === 'string' && value.toUpperCase() in INSTRUMENTS;
}

export function isFuturesSymbol(value: unknown): value is FuturesSymbol {
  return value === 'ES' || value === 'NQ';
}

export function getInstrument(symbol: string | null | undefined): InstrumentDefinition | null {
  if (!symbol) return null;
  const key = symbol.toUpperCase();
  return (INSTRUMENTS as Record<string, InstrumentDefinition>)[key] ?? null;
}

// ---------------------------------------------------------------------------
// Runtime availability — NEXT_PUBLIC_* feature flags, reconcilable with the
// server's /api/instruments response.
// ---------------------------------------------------------------------------

export interface InstrumentAvailability {
  symbol: InstrumentSymbol;
  available: boolean;
  trueAnalytics: boolean;
  referenceMode: boolean;
  reasons: string[];
}

function flag(name: string): boolean {
  // NEXT_PUBLIC_* vars are inlined at build; read defensively for tests.
  const raw = (typeof process !== 'undefined' ? process.env?.[name] : undefined) ?? '';
  return ['1', 'true', 'yes', 'on'].includes(String(raw).toLowerCase());
}

// Optional server-provided availability (from GET /api/instruments), which
// takes precedence when set so the UI reflects true backend state.
let _serverOverride: Partial<Record<InstrumentSymbol, Partial<InstrumentAvailability>>> = {};

export function setServerAvailability(
  overrides: Partial<Record<InstrumentSymbol, Partial<InstrumentAvailability>>>,
): void {
  _serverOverride = overrides || {};
}

export function getAvailability(symbol: string): InstrumentAvailability {
  const inst = getInstrument(symbol);
  if (!inst) {
    return {
      symbol: (symbol || '').toUpperCase() as InstrumentSymbol,
      available: false, trueAnalytics: false, referenceMode: false,
      reasons: ['unknown instrument'],
    };
  }
  if (inst.assetClass !== 'future') {
    return { symbol: inst.symbol, available: true, trueAnalytics: true, referenceMode: false, reasons: [] };
  }

  const override = _serverOverride[inst.symbol];
  if (override && typeof override.available === 'boolean') {
    return {
      symbol: inst.symbol,
      available: override.available,
      trueAnalytics: override.trueAnalytics ?? false,
      referenceMode: override.referenceMode ?? false,
      reasons: override.reasons ?? [],
    };
  }

  const reasons: string[] = [];
  const analyticsFlag =
    flag('NEXT_PUBLIC_ENABLE_FUTURES_ANALYTICS') ||
    flag(`NEXT_PUBLIC_ENABLE_${inst.symbol}_ANALYTICS`);
  const trueAnalytics = analyticsFlag;

  let referenceMode = false;
  if (inst.symbol === 'ES') {
    referenceMode = flag('NEXT_PUBLIC_ENABLE_ES_REFERENCE_MODE') && inst.referenceSourceSymbol != null;
  } else if (inst.symbol === 'NQ') {
    referenceMode = flag('NEXT_PUBLIC_ENABLE_NQ_REFERENCE_MODE') && inst.referenceSourceSymbol != null;
    if (flag('NEXT_PUBLIC_ENABLE_NQ_REFERENCE_MODE') && inst.referenceSourceSymbol == null) {
      reasons.push('NQ reference mode unavailable (no NDX source wired; naive QQQ→NQ disallowed)');
    }
  }
  if (!trueAnalytics) reasons.push('CME futures-options analytics not enabled');

  return {
    symbol: inst.symbol,
    available: trueAnalytics || referenceMode,
    trueAnalytics,
    referenceMode,
    reasons,
  };
}

/** Symbols a user may currently select — equities always, futures when available. */
export function enabledSymbols(): InstrumentSymbol[] {
  return ALL_INSTRUMENT_SYMBOLS.filter(
    (s) => getInstrument(s)!.assetClass !== 'future' || getAvailability(s).available,
  );
}

/** Capabilities intersected with runtime availability (what the UI should gate on). */
export function getEffectiveCapabilities(symbol: string): InstrumentCapabilities | null {
  const inst = getInstrument(symbol);
  if (!inst) return null;
  const caps = inst.capability;
  if (inst.assetClass !== 'future') return { ...caps };
  const avail = getAvailability(symbol);
  return {
    quotes: caps.quotes && avail.trueAnalytics,
    historicalQuotes: caps.historicalQuotes && avail.trueAnalytics,
    gex: caps.gex && avail.trueAnalytics,
    optionFlow: caps.optionFlow && avail.trueAnalytics,
    vannaCharm: caps.vannaCharm && avail.trueAnalytics,
    maxPain: caps.maxPain && avail.trueAnalytics,
    signals: caps.signals && avail.trueAnalytics,
    replay: caps.replay && avail.trueAnalytics,
    backtesting: caps.backtesting && avail.trueAnalytics,
    strategyBuilder: caps.strategyBuilder && avail.trueAnalytics,
    futuresReferenceMode: caps.futuresReferenceMode && avail.referenceMode,
  };
}

export function hasCapability(symbol: string, capability: keyof InstrumentCapabilities): boolean {
  return getEffectiveCapabilities(symbol)?.[capability] ?? false;
}
