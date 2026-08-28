import type { MarketSession } from '@/core/types';
import type { SessionClosesData } from '@/hooks/useApiData';

export interface PriceChangeSummary {
  displayPrice: number | null;
  change: number | null;
  changePercent: number | null;
  isPositive: boolean;
}

interface PriceChangeParams {
  quoteClose?: number | null;
  quoteSession?: string | null;
  sessionCloses?: SessionClosesData | null;
  /** 'futures' when the futures display swap is active (quote.display_source). */
  displaySource?: string | null;
  /** The future's last price (quote.futures_close) — shown instead of the index. */
  futuresClose?: number | null;
  /** Futures session-open baseline (quote.futures_reference_close). */
  futuresReferenceClose?: number | null;
  /**
   * Track the live tape through pre-market / after-hours instead of freezing
   * the headline on the regular-session close.
   *
   * The default (false) is the "official close" reading: in extended hours the
   * displayPrice is `current_session_close`, the stable last 4 PM print. The
   * header pairs that row-1 with a SEPARATE live extended-hours row; the metric
   * cards show it on its own as the last-regular-close reading. Either way the
   * frozen close is what those surfaces want.
   *
   * Surfaces that anchor a live price MARKER to the extended-hours tape (the
   * Gamma Chart's `tape` reading — the candle marker + regime line) instead need
   * the displayPrice to follow the live quote close, or the marker sits away from
   * the candles moving beside it. Set this true there. The user-facing live
   * extended-hours delta is a SEPARATE row (getExtendedHoursRow, always vs
   * current_session_close); this flag is about the price the marker rides.
   *
   * When a caller also reads this reading's change, the baseline is the most
   * recent COMPLETED regular close so the day-change is continuous across both
   * the 09:30 and 16:00 flips — and that close lives in a different field on each
   * side of 16:00: `current_session_close` during pre-market (today hasn't closed
   * yet), `prior_session_close` during after-hours (today's close has already
   * rolled into current). See baseClose.
   */
  preferLiveExtendedHours?: boolean;
}

/**
 * Shared with header row-1 display logic so cards/pages can mirror the same
 * "price and change from previous" calculation.
 */
export function getPrimaryPriceChangeSummary({
  quoteClose,
  quoteSession,
  sessionCloses,
  displaySource,
  futuresClose,
  futuresReferenceClose,
  preferLiveExtendedHours = false,
}: PriceChangeParams): PriceChangeSummary {
  // Overnight futures display swap: the headline is the FUTURE's last price
  // (futures_close) and the change is measured futures-vs-futures (last minus
  // the future's 16:00 ET cash-close print, futures_reference_close). Anchoring
  // to the future's own 16:00 level — not the cash index's close — keeps the
  // index↔future basis out of the change number.
  if (displaySource === 'futures' && futuresClose != null) {
    const displayPrice = futuresClose;
    const baseClose = futuresReferenceClose ?? null;
    const change = baseClose !== null ? displayPrice - baseClose : null;
    const changePercent = change !== null && baseClose ? (change / baseClose) * 100 : null;
    return {
      displayPrice,
      change,
      changePercent,
      isPositive: change !== null ? change >= 0 : false,
    };
  }

  const typedSession = quoteSession as MarketSession | null;
  const isExtendedHours = typedSession === 'pre-market' || typedSession === 'after-hours';

  // Every fully-closed state (overnight, weekend, holiday) shows the last
  // regular close, matching the frozen candles on those days.
  const isClosed =
    typedSession === 'closed' ||
    typedSession === 'closed-weekend' ||
    typedSession === 'closed-holiday';

  // In extended hours, opt-in surfaces (the Gamma Chart) track the live quote
  // close so the headline stays in step with the tape drawn beside it; every
  // other caller keeps the stable regular-session close. Guarded on a FINITE
  // quote so a missing / NaN tick falls back to the close instead of rendering
  // NaN. Closed / weekend / holiday are never "live" — nothing is trading — so
  // they always fall back to the last 4 PM close.
  const trackLiveExtended =
    preferLiveExtendedHours && isExtendedHours && quoteClose != null && Number.isFinite(quoteClose);

  const displayPrice = trackLiveExtended
    ? quoteClose
    : (isExtendedHours || isClosed)
      ? (sessionCloses?.current_session_close ?? null)
      : (quoteClose ?? null);

  // Change baseline — the most recent COMPLETED regular-session close.
  //   • open (default) → current_session_close (yesterday's close intraday)
  //   • otherwise      → prior_session_close (header row-1 / card convention)
  // The live extended-hours headline must sit against that same "most recent
  // completed close", but which field holds it flips at 16:00: during pre-market
  // today hasn't closed, so current_session_close IS it (prior is two sessions
  // back — the off-by-one that flipped the pre-market change sign); during
  // after-hours today's close has already rolled into current, so the one before
  // it, prior_session_close, is the right baseline (and keeps 16:00 continuous).
  const useCurrentAsBase = trackLiveExtended
    ? typedSession === 'pre-market'
    : typedSession === 'open';
  const baseClose = useCurrentAsBase
    ? (sessionCloses?.current_session_close ?? null)
    : (sessionCloses?.prior_session_close ?? null);

  const change = displayPrice !== null && baseClose !== null ? displayPrice - baseClose : null;
  const changePercent = change !== null && baseClose ? (change / baseClose) * 100 : null;

  return {
    displayPrice,
    change,
    changePercent,
    isPositive: change !== null ? change >= 0 : false,
  };
}

export interface SpotPriorCloseChange {
  changePercent: number | null;
  isPositive: boolean;
}

/**
 * Day-change % for a LIVE displayed spot against the previous regular-session
 * close — the plain "% vs prior close" reading everyone expects next to a
 * price. Used by the gamma ladder header, where the big number is the
 * analytics spot (gex_summary.spot_price): the badge must describe THAT
 * number, so no frozen-close display swap and no futures-basis change ever
 * applies here — just (spot − previous close) / previous close.
 *
 * Which field holds "the previous close" flips at 16:00 (see SessionClosesData):
 * while today hasn't closed (open, pre-market — and an unknown session, the
 * common live case) it's `current_session_close`; once today's close has
 * rolled in (after-hours and every closed state) it's `prior_session_close`,
 * which keeps the badge reading as the familiar day change instead of a
 * near-zero "since 16:00" drift.
 */
export function getSpotPriorCloseChange(
  spot: number | null | undefined,
  quoteSession: string | null | undefined,
  sessionCloses: SessionClosesData | null | undefined,
): SpotPriorCloseChange {
  const session = quoteSession as MarketSession | null;
  const todayHasClosed = !(session == null || session === 'open' || session === 'pre-market');
  const base = todayHasClosed
    ? (sessionCloses?.prior_session_close ?? null)
    : (sessionCloses?.current_session_close ?? null);
  if (spot == null || !Number.isFinite(spot) || base == null || !Number.isFinite(base) || base === 0) {
    return { changePercent: null, isPositive: false };
  }
  const changePercent = ((spot - base) / base) * 100;
  return { changePercent, isPositive: changePercent >= 0 };
}

export interface ExtendedHoursRow {
  price: number | null;
  change: number | null;
  changePercent: number | null;
  isPositive: boolean;
}

/**
 * The secondary "extended-hours" readout shown BELOW the regular quote for
 * ETFs/stocks during pre-market and after-hours: the live extended-hours price
 * and its change measured against the MOST-RECENT cash-session close
 * (`current_session_close`). This is TradingView's pre/post-market change basis
 * — always the previous regular-session close, never the day-before.
 *
 * Shared by the header row-2 and the Gamma Chart's extended-hours line so the
 * two read identically. Returns nulls when either input is missing (the caller
 * hides the row); indexes never get an extended row (they don't trade the ETH
 * tape — outside the cash session they fall back to futures or "closed").
 */
export function getExtendedHoursRow(
  quoteClose: number | null | undefined,
  currentSessionClose: number | null | undefined,
): ExtendedHoursRow {
  const price = quoteClose ?? null;
  const base = currentSessionClose ?? null;
  const change = price !== null && base !== null ? price - base : null;
  const changePercent = change !== null && base ? (change / base) * 100 : null;
  return {
    price,
    change,
    changePercent,
    isPositive: change !== null ? change >= 0 : false,
  };
}
