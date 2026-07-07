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
}: PriceChangeParams): PriceChangeSummary {
  // Overnight futures display swap: the headline is the FUTURE's last price
  // (futures_close) and the change is measured futures-vs-futures (last minus
  // tonight's 18:00 ET session-open print, futures_reference_close). We never
  // fall back to the cash index's session close here — that would inject the
  // index↔future basis into the change.
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

  const displayPrice = (isExtendedHours || isClosed)
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
