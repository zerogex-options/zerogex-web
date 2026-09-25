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
 * the tape) instead of jumping backward a session, and it drops the extended-hours row,
 * whose baseline — today's close — is precisely what is not known yet. The moment the
 * endpoint rolls, the session reverts to 'after-hours' and the frozen-close reading with
 * its separate extended row comes back.
 *
 * Cash indexes (SPX, NDX) never enter after-hours — they go straight to 'closed' — so
 * the same repair covers them there, judged from the last print rather than the clock
 * (see sessionClosesLagBehind). For an index the "live quote close" is the frozen last
 * print, so the headline reads today's close against yesterday's the moment the bell
 * rings, whether or not the payload has caught up.
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

// Minutes past midnight ET, for the one question the 'closed' branch below asks of a
// print: was it made at or after the 09:30 open? h23 so midnight reads 00, not 24.
const ET_CLOCK = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

const CASH_OPEN_MINUTE = 9 * 60 + 30;

function etMinuteOfDay(ts: string | null | undefined): number | null {
  if (!ts) return null;
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return null;
  let hour = NaN;
  let minute = NaN;
  for (const part of ET_CLOCK.formatToParts(d)) {
    if (part.type === 'hour') hour = Number(part.value);
    else if (part.type === 'minute') minute = Number(part.value);
  }
  return Number.isFinite(hour) && Number.isFinite(minute) ? hour * 60 + minute : null;
}

/**
 * True when the served closes have not yet advanced past the 16:00 ET flip.
 *
 * Deliberately narrow: two sessions are judged, each by the one test that cannot
 * mistake an ordinary state for a late one.
 *
 * After-hours runs 16:00–20:00 ET, so the close it must carry is stamped the SAME ET
 * day, and an earlier date can only mean the roll has not happened. There
 * `referenceTimestamp` is the server-stamped quote time when the caller has one, so
 * the comparison does not rest on the viewer's clock; it falls back to the client's
 * ET date.
 *
 * 'closed' is where a cash index goes instead. SPX and NDX have no after-hours tape,
 * so the quote endpoint takes them from 'open' straight to 'closed' at 16:00:30 ET,
 * and a lagging pair used to render a whole session late on exactly the symbols
 * whose close traders check first: at 16:05 on 2026-09-25 the SPX header read
 * "$7,704.23 −2.16", Thursday's close carrying Thursday's change, against a real
 * close of 7,739.23 (+0.46%). The clock cannot judge 'closed' (it spans midnight and
 * weekends, where an earlier close is expected), but the tape can: the quote IS the
 * last print. A print made at or after the 09:30 open of a LATER ET day than the
 * close on offer means that day's session traded and its close is missing. Overnight,
 * weekends and holidays leave the last print on the close's own day, and a print
 * before 09:30 (an overnight ETF bar) is no session that owes a close. There is no
 * wall-clock fallback here: without the print there is nothing to judge by.
 *
 * Pre-market legitimately carries a prior day's close and is never flagged.
 */
export function sessionClosesLagBehind(
  quoteSession: string | null | undefined,
  currentSessionCloseTs: string | null | undefined,
  referenceTimestamp?: string | null,
): boolean {
  if (quoteSession !== 'after-hours' && quoteSession !== 'closed') return false;
  const closeDate = etDateKey(currentSessionCloseTs);
  if (!closeDate) return false;
  if (quoteSession === 'closed') {
    const printDate = etDateKey(referenceTimestamp);
    const printMinute = etMinuteOfDay(referenceTimestamp);
    if (!printDate || printMinute === null) return false;
    return closeDate < printDate && printMinute >= CASH_OPEN_MINUTE;
  }
  const nowDate = etDateKey(referenceTimestamp) || ET_DATE.format(new Date());
  if (!nowDate) return false;
  // Zero-padded YYYY-MM-DD lex-sorts as a calendar date. Strictly-earlier only: a
  // close stamped ahead of the reference is clock skew, not a stale payload.
  return closeDate < nowDate;
}

/**
 * The session the price/change calcs should be read with — the live session, except
 * that a lagging after-hours or closed payload is read as 'open' (see the module note
 * and sessionClosesLagBehind).
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
