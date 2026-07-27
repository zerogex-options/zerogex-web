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
   * displayPrice is `current_session_close` — a stable 4 PM print that the
   * header row-1 and the metric cards pair with a SEPARATE live extended-hours
   * row. Surfaces that draw the live extended-hours tape inline (the Gamma
   * Chart) have no such second row, so a frozen headline visibly diverges from
   * the candles moving beside it. Set this true there and the headline follows
   * the live quote close. The change baseline stays `prior_session_close`, so
   * the value is continuous with the regular-session day-change across 16:00 —
   * it doesn't jump when the session flips.
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

  const isClosed = typedSession === 'closed' || typedSession === 'closed-weekend';

  // In extended hours, opt-in surfaces (the Gamma Chart) track the live quote
  // close so the headline stays in step with the tape drawn beside it; every
  // other caller keeps the stable regular-session close. `closed` is never
  // "live" — nothing is trading, so it always falls back to the 4 PM close.
  const trackLiveExtended = preferLiveExtendedHours && isExtendedHours && quoteClose != null;

  const displayPrice = trackLiveExtended
    ? quoteClose
    : (isExtendedHours || isClosed)
      ? (sessionCloses?.current_session_close ?? null)
      : (quoteClose ?? null);

  const baseClose = typedSession === 'open'
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
