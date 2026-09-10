/**
 * Spread Monitor — the pure half: types, formatting, and the readouts.
 *
 * Kept out of the page component so the judgements below can be tested
 * without a browser, and so the page is left doing layout rather than
 * deciding what a number means.
 *
 * The one rule everything here follows: a verdict is only rendered when
 * there is something to base it on. Quoted width has no universal
 * threshold — SPX puts are structurally wider than SPY puts on the calmest
 * day of the year, and a "wide" line drawn at some invented percentage
 * would be wrong for one of them at all times. So "is this bad?" is
 * answered ONLY against the symbol's own trailing sessions, and when that
 * history is missing the page shows the measurement with no verdict
 * attached rather than inventing one.
 */

export interface SpreadAggregate {
  contract_count: number;
  tradable_count: number;
  /** Share of contracts with a real two-sided market. */
  two_sided_pct: number;
  /** Share quoted with an offer and no bid — no market, at any price. */
  zero_bid_pct: number;
  crossed_or_locked_pct: number;
  no_quote_pct: number;
  median_spread: number | null;
  /** 100 * (ask - bid) / mid. The headline width. */
  median_relative_spread_pct: number | null;
  p90_relative_spread_pct: number | null;
  /** 10,000 * (ask - bid) / spot. The only cross-symbol comparable width. */
  median_spread_bps_underlying: number | null;
  p90_spread_bps_underlying: number | null;
  total_open_interest: number;
  total_volume: number;
}

export interface MoneynessBucket extends SpreadAggregate {
  moneyness_low_pct: number;
  moneyness_high_pct: number;
  label: string;
}

export interface ExpirationSlice {
  expiration: string;
  dte: number;
  calls: SpreadAggregate;
  puts: SpreadAggregate;
  all: SpreadAggregate;
}

export interface HistoryContext {
  sessions: number;
  calls_percentile: number | null;
  puts_percentile: number | null;
  all_percentile: number | null;
  puts_median_over_window: number | null;
  calls_median_over_window: number | null;
  puts_vs_window_ratio: number | null;
}

export interface SpreadSnapshot {
  symbol: string;
  spot_price: number;
  timestamp: string;
  session_date: string;
  basis: string;
  /** Authored server-side. Render it — see the note on `Disclosure` below. */
  disclosure: string;
  scope: {
    dte_max: number;
    moneyness_band_pct: number;
    strike_low: number;
    strike_high: number;
    contract_count: number;
  };
  calls: SpreadAggregate;
  puts: SpreadAggregate;
  all: SpreadAggregate;
  put_call_width_ratio: number | null;
  history: HistoryContext | null;
  calls_by_moneyness: MoneynessBucket[];
  puts_by_moneyness: MoneynessBucket[];
  by_expiration: ExpirationSlice[];
}

export interface SpreadSeriesBar {
  bucket_start: string;
  anchor_ts: string;
  spot: number;
  calls: SpreadAggregate | null;
  puts: SpreadAggregate | null;
}

export interface SpreadSeries {
  symbol: string;
  session: string;
  bucket_minutes: number;
  dte_max: number;
  moneyness_band_pct: number;
  disclosure: string;
  bars: SpreadSeriesBar[];
}

export interface CompareRow {
  symbol: string;
  spot_price: number | null;
  timestamp: string | null;
  calls: SpreadAggregate | null;
  puts: SpreadAggregate | null;
  put_call_width_ratio: number | null;
  puts_percentile: number | null;
  /** Set when the chain could not be read. Render the reason, not a blank. */
  unavailable: string | null;
}

export interface SpreadCompare {
  symbols: string[];
  dte_max: number;
  moneyness_band_pct: number;
  disclosure: string;
  rows: CompareRow[];
}

export interface SpreadHistoryRow {
  trading_date: string;
  option_type: string;
  spot_price: number;
  contract_count: number;
  tradable_count: number;
  two_sided_pct: number;
  zero_bid_pct: number;
  crossed_or_locked_pct: number;
  median_spread: number | null;
  median_relative_spread_pct: number | null;
  p90_relative_spread_pct: number | null;
  median_spread_bps_underlying: number | null;
  p90_spread_bps_underlying: number | null;
}

export interface SpreadHistory {
  symbol: string;
  option_type: string;
  dte_max: number;
  moneyness_band_pct: number;
  disclosure: string;
  rows: SpreadHistoryRow[];
}

/** The symbols with an option chain of their own. ES / NQ have none here. */
export const SPREAD_SYMBOLS = ['SPX', 'NDX', 'SPY', 'QQQ'] as const;

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

/** An em dash for null — never "0", which would read as "perfectly tight". */
export const EMPTY = '—';

export function formatPct(value: number | null | undefined, digits = 2): string {
  if (value == null || !Number.isFinite(value)) return EMPTY;
  return `${value.toFixed(digits)}%`;
}

export function formatBps(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return EMPTY;
  return `${value.toFixed(1)} bps`;
}

export function formatSpread(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return EMPTY;
  return `$${value.toFixed(2)}`;
}

/**
 * The per-contract cost of crossing, which is the number a trader actually
 * pays. Quoted width is per share; an option contract is 100 of them.
 */
export function formatCrossCost(width: number | null | undefined): string {
  if (width == null || !Number.isFinite(width)) return EMPTY;
  return `$${(width * 100).toFixed(0)}`;
}

export function formatMultiple(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return EMPTY;
  return `${value.toFixed(2)}×`;
}

// ---------------------------------------------------------------------------
// Readouts
// ---------------------------------------------------------------------------

export type Tone = 'bullish' | 'bearish' | 'neutral';

export interface Verdict {
  label: string;
  tone: Tone;
  meaning: string;
}

/**
 * Where a reading sits in the symbol's own trailing sessions.
 *
 * `tone` is keyed to TRADEABILITY, not to market direction: tight is
 * "bullish" because it is the good outcome for the person reading this
 * page. Returns null when there is no percentile, which is the state the
 * page must render as "no baseline yet" rather than as an ordinary day.
 *
 * The bands are quantiles of the symbol's own history, so they carry no
 * assumption about what a "normal" spread costs — the thing that cannot be
 * stated universally.
 */
export function percentileVerdict(
  percentile: number | null | undefined,
  sessions: number,
): Verdict | null {
  if (percentile == null || !Number.isFinite(percentile) || sessions <= 0) return null;
  const window = `${sessions} session${sessions === 1 ? '' : 's'}`;

  if (percentile >= 95) {
    return {
      label: 'Widest 5% of sessions',
      tone: 'bearish',
      meaning: `Quotes are wider than on 95% of the last ${window}. Execution is the constraint right now, not the setup.`,
    };
  }
  if (percentile >= 80) {
    return {
      label: 'Wider than usual',
      tone: 'bearish',
      meaning: `Wider than roughly ${Math.round(percentile)}% of the last ${window}. Size down or work the order rather than paying the offer.`,
    };
  }
  if (percentile >= 20) {
    return {
      label: 'Normal range',
      tone: 'neutral',
      meaning: `In line with the last ${window}. Nothing unusual about execution conditions.`,
    };
  }
  return {
    label: 'Tighter than usual',
    tone: 'bullish',
    meaning: `Tighter than roughly ${100 - Math.round(percentile)}% of the last ${window}. As good as this chain gets.`,
  };
}

/**
 * Which side of the book is the expensive one to trade.
 *
 * This is the shape the "index put spreads have gone bonkers" complaint
 * describes: not that everything got wider, but that the puts did. The
 * 1.25x threshold is a rounding allowance rather than a claim — inside it
 * the two sides are quoted the same and saying otherwise would be reading
 * noise.
 */
export function putCallReadout(ratio: number | null | undefined): Verdict | null {
  if (ratio == null || !Number.isFinite(ratio) || ratio <= 0) return null;
  if (ratio >= 1.25) {
    return {
      label: 'Puts are the expensive side',
      tone: 'bearish',
      meaning: `Put markets are quoted ${ratio.toFixed(2)}× as wide as calls. Downside protection costs more to get into and out of than the same-distance upside.`,
    };
  }
  if (ratio <= 0.8) {
    return {
      label: 'Calls are the expensive side',
      tone: 'bearish',
      meaning: `Call markets are quoted ${(1 / ratio).toFixed(2)}× as wide as puts — the less common direction, and usually an upside-chase rather than a hedging bid.`,
    };
  }
  return {
    label: 'Both sides quoted alike',
    tone: 'neutral',
    meaning: 'Puts and calls are quoted at similar widths. No one-sided liquidity pressure in this chain.',
  };
}

/**
 * How much of the chain has no market at all.
 *
 * Separate from every width readout on purpose: these contracts have no
 * width to report, and a chain can hold its median while a fifth of it
 * quietly goes no-bid. Thresholds are structural rather than statistical —
 * "one contract in five cannot be sold" is a fact about the chain, not a
 * quantile of anything.
 */
export function coverageReadout(aggregate: SpreadAggregate | null | undefined): Verdict | null {
  if (!aggregate || aggregate.contract_count === 0) return null;
  const dead = aggregate.zero_bid_pct + aggregate.crossed_or_locked_pct;
  if (dead >= 20) {
    return {
      label: 'Large dead zone',
      tone: 'bearish',
      meaning: `${dead.toFixed(0)}% of contracts in range have no usable two-sided market — quoted with no bid, locked, or crossed. There is nothing to sell those into at any price.`,
    };
  }
  if (dead >= 5) {
    return {
      label: 'Patchy coverage',
      tone: 'neutral',
      meaning: `${dead.toFixed(0)}% of contracts in range have no usable two-sided market. Check the strike you want before you plan around it.`,
    };
  }
  return {
    label: 'Fully quoted',
    tone: 'bullish',
    meaning: `${aggregate.two_sided_pct.toFixed(0)}% of contracts in range carry a real two-sided market.`,
  };
}

/**
 * The session's own move: latest reading against the session's first.
 *
 * Always available, unlike the trailing percentile, and it answers a
 * different question — "has this got worse since the open?" rather than
 * "is this a wide day?". Both matter, and neither substitutes for the
 * other: a chain can be wide all day (bad percentile, flat ratio) or start
 * fine and deteriorate into the close (ordinary percentile, ratio of 3).
 */
export function sessionDrift(
  bars: readonly SpreadSeriesBar[] | null | undefined,
  side: 'puts' | 'calls' = 'puts',
): { open: number; latest: number; ratio: number } | null {
  if (!bars || bars.length < 2) return null;
  const values = bars
    .map((bar) => bar[side]?.median_relative_spread_pct)
    .filter((v): v is number => v != null && Number.isFinite(v) && v > 0);
  if (values.length < 2) return null;
  const open = values[0];
  const latest = values[values.length - 1];
  return { open, latest, ratio: latest / open };
}

/**
 * The widest moneyness bucket that still has a real sample.
 *
 * "Widest" is meaningless from a bucket holding two contracts, so buckets
 * below `minContracts` are ignored rather than allowed to win on a sample
 * of one.
 */
export function widestBucket(
  buckets: readonly MoneynessBucket[] | null | undefined,
  minContracts = 3,
): MoneynessBucket | null {
  if (!buckets || buckets.length === 0) return null;
  let worst: MoneynessBucket | null = null;
  for (const bucket of buckets) {
    if (bucket.tradable_count < minContracts) continue;
    if (bucket.median_relative_spread_pct == null) continue;
    if (
      worst == null ||
      bucket.median_relative_spread_pct > (worst.median_relative_spread_pct ?? -Infinity)
    ) {
      worst = bucket;
    }
  }
  return worst;
}

/** `-5.0% to -3.0%` → `5.0–3.0% below spot`; reads better in a chart axis. */
export function moneynessAxisLabel(bucket: MoneynessBucket): string {
  const { moneyness_low_pct: low, moneyness_high_pct: high } = bucket;
  if (high <= 0) return `${Math.abs(high).toFixed(1)}–${Math.abs(low).toFixed(1)}% below`;
  if (low >= 0) return `${low.toFixed(1)}–${high.toFixed(1)}% above`;
  return 'At the money';
}
