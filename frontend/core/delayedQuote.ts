import type { MarketSession } from '@/core/types';

/**
 * Repairs the price readout for the public, ~15-minute-delayed /chart snapshot.
 *
 * The delayed view assembles its headline from a SEPARATELY ISR-cached
 * /api/market/quote. Just after the 09:30 open (and around any session flip)
 * that cached quote can still carry `session: 'closed'` with the prior day's
 * 4 PM close, while the delayed BARS are already showing today's tape. Left
 * unrepaired, `getPrimaryPriceChangeSummary` then takes its "closed → show
 * current_session_close" branch and the headline freezes on yesterday's close
 * with yesterday's whole-day change (e.g. "SPY 747.39 −0.93 (−0.12%)" at
 * 09:47 ET) — even though the candles beside it are current.
 *
 * The fix: while the market is actually in its cash session now, anchor the
 * delayed readout to the freshest delayed bar (its close is today's delayed
 * price; its timestamp is the honest "as of"). Outside the cash session — nights,
 * weekends, and the overnight index→future display swap — the served quote is
 * the correct source and is passed through untouched.
 */
export interface DelayedQuoteInputs {
  /** Served /api/market/quote close (may be a stale prior-session print). */
  quoteClose: number | null;
  /** Served /api/market/quote session flag (may lag the real clock). */
  quoteSession: string | null;
  /** Served /api/market/quote timestamp (ISO), or null. */
  quoteTimestamp: string | null;
  /** 'futures' when the overnight index→future display swap is active. */
  displaySource: string | null;
  /** Close of the freshest delayed bar — ground truth for today's delayed price. */
  lastBarClose: number | null;
  /** Timestamp (ISO) of the freshest delayed bar. */
  lastBarTimestamp: string | null;
  /** The real market session at render time (from getMarketSession()). */
  marketNow: MarketSession;
}

export interface DelayedQuoteResult {
  close: number | null;
  session: string | null;
  /** ISO timestamp the delayed quote is "as of" — always the source of `close`. */
  timestamp: string | null;
}

export function resolveDelayedQuote({
  quoteClose,
  quoteSession,
  quoteTimestamp,
  displaySource,
  lastBarClose,
  lastBarTimestamp,
  marketNow,
}: DelayedQuoteInputs): DelayedQuoteResult {
  const cashSessionNow = marketNow === 'open';
  const futuresSwap = displaySource === 'futures';

  // Cash session in progress: trust the delayed TAPE, not the cached quote.
  // Keep price and timestamp from the same source so the "as of" line always
  // describes the number shown next to it.
  if (cashSessionNow && !futuresSwap && lastBarClose != null) {
    return {
      close: lastBarClose,
      session: 'open',
      timestamp: lastBarTimestamp ?? quoteTimestamp,
    };
  }

  // Outside the cash session the served quote is authoritative (after-hours /
  // pre-market closes and the overnight futures swap all live here).
  return {
    close: quoteClose ?? lastBarClose,
    session: quoteSession,
    timestamp: quoteTimestamp ?? lastBarTimestamp,
  };
}
