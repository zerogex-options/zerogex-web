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
   * Surfaces that draw the live extended-hours tape inline (the Gamma Chart)
   * have no second row, so a frozen headline visibly diverges from the candles
   * moving beside it. Set this true there and the headline follows the live
   * quote close, measured against the most recent COMPLETED regular close so the
   * day-change is continuous across both the 09:30 and 16:00 session flips. That
   * close lives in a different field on each side of 16:00: `current_session_close`
   * during pre-market (today hasn't closed yet), `prior_session_close` during
   * after-hours (today's close has already rolled into current) — see baseClose.
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
