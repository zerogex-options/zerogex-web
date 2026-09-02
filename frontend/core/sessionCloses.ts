import type { SessionClosesData } from '@/hooks/useApiData';

/**
 * Repairs the price readout across the 16:00 ET flip, while /api/market/session-closes
 * is still a session behind.
 *
 * `current_session_close` means "the most recent COMPLETED regular close", and the
 * calendar day it points at rolls forward at 16:00: yesterday's close during the cash
 * session, TODAY's close once the bell rings. Every price surface reads that convention
 * (see core/priceChange.ts) — in after-hours the headline shows `current_session_close`
 * as today's official close and measures it against `prior_session_close`, while the
 * second row shows the live extended print against `current_session_close`.
 *
 * The served payload does not always roll on time: today's 16:00 close only lands once
 * the closing auction has printed and settled upstream, so for the first minutes of
 * after-hours the endpoint still answers with the PRE-flip pair. Read with the
 * after-hours convention, that pair renders a full session late — at 16:04 the SPY
 * header showed yesterday's close as today's price with yesterday's whole-day change
 * ("$761.65 −5.30 (−0.69%)") while the live after-hours row beside it, measuring against
 * that same stale close, published the day change ("+3.64") as the after-hours move.
 *
 * The repair: while the payload lags, read it with the convention it actually matches.
 * A lagging payload IS the open-session shape — `current_session_close` is the previous
 * close, `prior_session_close` the one before it — so price surfaces render it as the
 * cash session does: live quote close vs `current_session_close`. That keeps the day
 * change continuous through 16:00 (it is the same reading shown at 15:59, still tracking
 * the tape) instead of jumping backwards a session, and it drops the extended-hours row,
 * whose baseline — today's close — is precisely what is not known yet. The moment the
 * endpoint rolls, the session reverts to 'after-hours' and the frozen-close reading with
 * its separate extended row comes back.
 */

// The ET calendar day (YYYY-MM-DD) an instant falls on. core/utils exports the same
// thing, but the price-calc modules are deliberately free of runtime imports so
// `node --experimental-strip-types` can run their tests straight against the source
// (priceChange.ts and delayedQuote.ts carry type-only imports for the same reason).
// Six lines is the cheaper half of that trade.
const ET_DATE = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/New_York',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

function etDateKey(ts: string | null | undefined): string {
  if (!ts) return '';
  const d = new Date(ts);
  return Number.isNaN(d.getTime()) ? '' : ET_DATE.format(d);
}

/**
 * True when the served closes have not yet advanced past the 16:00 ET flip.
 *
 * Deliberately narrow. Only after-hours can be judged from the calendar alone: it runs
 * 16:00–20:00 ET, so the close it must carry is stamped the SAME ET day, and an earlier
 * date can only mean the roll has not happened. Pre-market legitimately carries a prior
 * day's close, and the overnight 'closed' state crosses midnight (where an earlier date
 * is expected, not late) — neither is decidable this way, so neither is flagged.
 *
 * `referenceTimestamp` is the server-stamped quote time when the caller has one, so the
 * comparison does not rest on the viewer's clock; it falls back to the client's ET date.
 */
export function sessionClosesLagBehind(
  quoteSession: string | null | undefined,
  currentSessionCloseTs: string | null | undefined,
  referenceTimestamp?: string | null,
): boolean {
  if (quoteSession !== 'after-hours') return false;
  const closeDate = etDateKey(currentSessionCloseTs);
  if (!closeDate) return false;
  const nowDate = etDateKey(referenceTimestamp) || ET_DATE.format(new Date());
  if (!nowDate) return false;
  // Zero-padded YYYY-MM-DD lex-sorts as a calendar date. Strictly-earlier only: a
  // close stamped ahead of the reference is clock skew, not a stale payload.
  return closeDate < nowDate;
}

/**
 * The session the price/change calcs should be read with — the live session, except
 * that a lagging after-hours payload is read as 'open' (see the module note).
 *
 * This is a PRICE-calculation session, not the market's state: badges, session labels
 * and the pre-market/after-hours icon must keep reading the real `quote.session`, which
 * is correct — it is the closes that are late, not the clock.
 */
export function resolvePriceSession(
  quoteSession: string | null | undefined,
  sessionCloses: SessionClosesData | null | undefined,
  referenceTimestamp?: string | null,
): string | null {
  return sessionClosesLagBehind(quoteSession, sessionCloses?.current_session_close_ts, referenceTimestamp)
    ? 'open'
    : quoteSession ?? null;
}
