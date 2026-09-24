/**
 * Where an Action Card's "Daily Scorecard" back link goes: the Scorecard day
 * page for that card's symbol and date, where the card is listed.
 *
 * The day is the card's Eastern calendar date, because the Scorecard's window
 * runs midnight to midnight ET. Using the UTC date would send any card stamped
 * after 8:00 PM EDT (00:00Z) to the next day's page.
 *
 * Only the picker symbols have day pages; the Scorecard reads anything else as
 * SPY. Those cards, and any card without a usable timestamp, go to the landing
 * page as before.
 */
import { resolveSymbol } from './symbols.ts';
import { etDateKeyFor } from './utils.ts';

export function scorecardHrefForCard(
  underlying: string | null | undefined,
  timestamp: string | null | undefined,
): string {
  const symbol = (underlying || 'SPY').toUpperCase();
  const scorecardSymbol = resolveSymbol(symbol);
  const day = etDateKeyFor(timestamp);
  if (scorecardSymbol === symbol && day) return `/scorecard/${symbol}/${day}`;
  return scorecardSymbol === 'SPY' ? '/scorecard' : `/scorecard?symbol=${scorecardSymbol}`;
}
