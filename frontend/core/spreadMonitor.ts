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
  /**
   * Sessions in the window whose chain was too thin to measure — an
   * ingestion outage, not a quiet market — and which are therefore absent
   * from `rows` rather than plotted as real days.
   *
   * Rendered rather than ignored: a gap in the chart should be explicable,
   * and a number climbing here is a data problem the reader deserves to
   * see instead of a line that quietly describes fewer sessions than it
   * appears to.
   */
  excluded_thin_sessions?: number;
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

/**
 * The expiration whose puts are quoted widest, for the panel's standfirst.
 *
 * Puts specifically, not the blended chain: the question the page is here to
 * answer is where the DOWNSIDE is expensive, and a blend would let orderly
 * calls mask a wide put wing on the same expiry.
 *
 * Expirations with no put market are skipped rather than treated as zero —
 * "no market" is not "free to cross".
 */
export function widestExpiration(
  slices: readonly ExpirationSlice[] | null | undefined,
): { dte: number; pct: number } | null {
  if (!slices) return null;
  let worst: { dte: number; pct: number } | null = null;
  for (const slice of slices) {
    const pct = slice.puts.median_relative_spread_pct;
    if (pct == null || !Number.isFinite(pct)) continue;
    if (worst == null || pct > worst.pct) worst = { dte: slice.dte, pct };
  }
  return worst;
}

/** `0` → `0DTE`; anything else → `4d`. The label traders actually use. */
export function dteLabel(dte: number): string {
  return dte === 0 ? '0DTE' : `${dte}d`;
}

/** `-5.0% to -3.0%` → `5.0–3.0% below spot`; reads better in a chart axis. */
export function moneynessAxisLabel(bucket: MoneynessBucket): string {
  const { moneyness_low_pct: low, moneyness_high_pct: high } = bucket;
  if (high <= 0) return `${Math.abs(high).toFixed(1)}–${Math.abs(low).toFixed(1)}% below`;
  if (low >= 0) return `${low.toFixed(1)}–${high.toFixed(1)}% above`;
  return 'At the money';
}

// ---------------------------------------------------------------------------
// Spread Surface vs History
// ---------------------------------------------------------------------------
//
// The rest of this file describes how wide the chain is. This part describes
// whether that width is UNUSUAL, and where across the strikes it is unusual —
// which needs a second thing the snapshot does not carry: the same measurement
// on the same symbol, in the same strike band, at the same time of day, on
// prior sessions.
//
// Every refusal in here exists because the honest answer is sometimes "we
// cannot say". A percentile computed from four days is not a percentile, a
// bucket with no stored history is a gap rather than a zero, and a session
// count has to describe the same days as the date range printed beside it.

/** One moneyness slice of the strike curve, current against its own history. */
export interface SurfacePoint {
  money_bucket: string;
  label: string;
  moneyness_low_pct: number;
  moneyness_high_pct: number;
  /** Bucket midpoint — the curve's x position. */
  center_pct: number;
  current_pct: number | null;
  historical_median_pct: number | null;
  historical_p25_pct: number | null;
  historical_p75_pct: number | null;
  /** Where today sits in this slice's own history, 0-100. */
  percentile: number | null;
  vs_normal: number | null;
  contract_count: number;
  two_sided_pct: number | null;
  /** Comparable prior sessions behind this slice, after every filter. */
  sessions: number;
}

/** One expiry bucket in the "where does it rank" view. */
export interface SurfaceDteRank {
  dte_scope: string;
  label: string;
  percentile: number | null;
  current_pct: number | null;
  historical_median_pct: number | null;
  sessions: number;
  /** True when there is not enough history to rank. Say so; draw nothing. */
  insufficient_history: boolean;
}

/** Exactly what the comparison was made against. Rendered, never buried. */
export interface SurfaceBaseline {
  sessions: number;
  earliest_date: string | null;
  latest_date: string | null;
  time_matched: boolean;
  /** e.g. `15:30-16:00 ET`. */
  time_bucket_label: string;
  fell_back_to_last_bucket: boolean;
  min_sessions: number;
}

export interface SurfaceSummary {
  current_pct: number | null;
  normal_pct: number | null;
  vs_normal: number | null;
  percentile: number | null;
  two_sided_pct: number | null;
  contract_count: number;
  sessions: number;
}

export interface SpreadSurface {
  symbol: string;
  option_type: 'C' | 'P';
  spot_price: number;
  timestamp: string;
  session_date: string;
  dte_max: number;
  dte_scope: string;
  moneyness_band_pct: number;
  basis: string;
  disclosure: string;
  baseline: SurfaceBaseline;
  summary: SurfaceSummary;
  curve: SurfacePoint[];
  by_dte: SurfaceDteRank[];
}

/**
 * The baseline sentence — how many sessions, over what dates, at what clock.
 *
 * Built from the response rather than from the request, which is the whole
 * point: the page asked for 60 days, and what came back is however many of
 * those sessions had enough of this exact scope quoted to measure. Printing
 * the request would claim history the comparison does not have.
 */
export function baselineSummary(baseline: SurfaceBaseline | null | undefined): string {
  if (!baseline || baseline.sessions === 0) {
    return 'No comparable sessions stored for this scope yet.';
  }
  const plural = baseline.sessions === 1 ? 'session' : 'sessions';
  const range =
    baseline.earliest_date && baseline.latest_date
      ? ` (${baseline.earliest_date} to ${baseline.latest_date})`
      : '';
  const clock = baseline.time_matched
    ? ` · time-matched history: ${baseline.time_bucket_label}`
    : '';
  return `${baseline.sessions} comparable ${plural}${range}${clock}`;
}

/**
 * Is the baseline thick enough to rank against?
 *
 * The API already withholds the percentile below its own floor, so this is
 * only for the page's copy — it needs to say WHY a rank is missing, and
 * "not enough history yet" is a different sentence from "this scope has no
 * rows at all".
 */
export function hasUsableBaseline(baseline: SurfaceBaseline | null | undefined): boolean {
  return !!baseline && baseline.sessions >= baseline.min_sessions;
}

/**
 * Where the deterioration is, as a sentence — the page's one interpretation.
 *
 * Rules, not prose generation: the thresholds are the same ones
 * `percentileVerdict` already uses for the rest of the page (95 / 80 / 20),
 * so the strike curve and the header cards cannot disagree about what
 * "wider than usual" means. Nothing here invents a number; it names the
 * slices the response already ranked.
 *
 * Returns null when there is no baseline. A view whose entire job is "is
 * this unusual" must be able to say nothing.
 */
export function surfaceReadout(
  surface: SpreadSurface | null | undefined,
): Verdict | null {
  if (!surface) return null;
  const { summary, baseline, curve } = surface;
  const verdict = percentileVerdict(summary.percentile, baseline.sessions);
  if (!verdict) return null;

  const side = surface.option_type === 'P' ? 'put' : 'call';
  const elevated = curve
    .filter((point) => point.percentile != null && point.percentile >= 80)
    .sort((a, b) => (b.percentile ?? 0) - (a.percentile ?? 0));
  const ranked = curve.filter((point) => point.percentile != null);

  let where: string;
  if (ranked.length === 0) {
    where = `No ${side} strike band in this scope has enough stored history to place today within it.`;
  } else if (elevated.length === 0) {
    where = `No individual strike band is above its own 80th percentile, so the ${side} reading is broad rather than concentrated in one part of the chain.`;
  } else if (elevated.length === ranked.length && ranked.length >= 3) {
    // "The whole book" is only sayable with enough bands ranked to mean it.
    // Claiming it off one or two would describe the chain from the only
    // corner of it that happens to have a baseline.
    where = `All ${ranked.length} ranked strike bands are elevated — the whole ${side} book in this scope, not one part of it.`;
  } else {
    const names = elevated.slice(0, 3).map((point) => point.label);
    const more = elevated.length > names.length ? ` and ${elevated.length - names.length} more` : '';
    where = `Concentrated in ${names.join(', ')}${more} — ${elevated.length} of ${ranked.length} ranked bands.`;
  }

  // The shared sentence is carried VERBATIM rather than spliced into a new
  // one. Reusing the thresholds but rewording the result is how two panels
  // end up saying different things about the same number — and lowercasing
  // someone else's sentence to graft it onto a clause produced "Put markets
  // in this scope are quotes are wider than...".
  return {
    label: verdict.label,
    tone: verdict.tone,
    meaning: `${verdict.meaning} ${where}`,
  };
}

/**
 * The expiry whose current reading ranks highest against its own history.
 *
 * Ranks, not widths. The widest bucket is almost always the nearest expiry
 * and says nothing — 0DTE is structurally wider than 30DTE every day of the
 * year. "Which expiry is furthest from its own normal" is the finding.
 */
export function mostElevatedExpiry(
  ranks: readonly SurfaceDteRank[] | null | undefined,
): SurfaceDteRank | null {
  if (!ranks) return null;
  let worst: SurfaceDteRank | null = null;
  for (const rank of ranks) {
    if (rank.percentile == null) continue;
    if (worst == null || rank.percentile > (worst.percentile ?? -Infinity)) worst = rank;
  }
  return worst;
}
