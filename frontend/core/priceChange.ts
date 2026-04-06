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
}

/**
 * Shared with header row-1 display logic so cards/pages can mirror the same
 * "price and change from previous" calculation.
 */
export function getPrimaryPriceChangeSummary({
  quoteClose,
  quoteSession,
  sessionCloses,
}: PriceChangeParams): PriceChangeSummary {
  const typedSession = quoteSession as MarketSession | null;
  const isExtendedHours = typedSession === 'pre-market' || typedSession === 'after-hours';

  const displayPrice = (isExtendedHours || typedSession === 'closed')
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
