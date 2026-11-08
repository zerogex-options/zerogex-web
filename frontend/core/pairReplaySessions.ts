// Pair Comparison's replay sessions: which trading days the two columns can
// replay together, and which one is on screen.
//
// Pure (no React, no fetch) so tests/pairReplaySessions.test.ts can pin it
// down; hooks/usePairReplay.ts feeds it the two session lists and the page
// holds the member's pick.
//
// Three facts shape it.
//
// 1. Both columns replay the SAME day. One playhead drives them by clock time,
//    so a column on another day would show that day's nearest minute. The two
//    symbols' lists can differ (ES follows SPX and NQ follows NDX, and NDX
//    history starts later than SPX's), so only days BOTH sides list are offered.
//
// 2. /api/replay/sessions lists days from gex_summary, which is never pruned,
//    but the per-strike rows the ladders are built from (gex_by_strike) are
//    deleted after DATA_RETENTION_DAYS: 60 in production, by zerogex-oa's
//    `make db-prune` at 02:00 ET daily (DELETE ... WHERE timestamp < NOW() - 60
//    days). A day past that still lists, and its frames come back with empty
//    ladders, so it is left out. The API says which days those are: each
//    session carries `has_strikes`, read here by the same rule as the /replay
//    pages (strikesAgedOut: only an explicit false). A day either symbol's
//    session flags false is left out, whatever its date.
//
//    The date cutoff is only the fallback for a session with no verdict:
//    `has_strikes: null` (the API couldn't check) or no field at all (an API
//    from before it). There the picker behaves exactly as it did before the
//    flag. The cutoff mirrors the backend setting: because the prune runs
//    before the open, a session is kept or deleted whole, and on Nov 7 the
//    first day still kept is Sep 8, which is exactly what the cutoff says.
//    Between midnight and the prune one more day survives, which the cutoff
//    leaves off: the safe side to err on. A session flagged true is not held
//    to the cutoff: the API checked, and the mirror goes stale the day
//    DATA_RETENTION_DAYS changes.
//
// 3. The newest shared day is the default, and it is what Replay opened on
//    before the picker existed. It is always offered, even in the unlikely case
//    it is older than the window or flagged, so choosing it never shows less
//    than before.
//
// Neither the flag nor the cutoff looks at the frames themselves, so the page
// also checks what actually came back: a day whose frames carry no strike rows
// at all says so under the transport (sessionLacksStrikes) rather than showing
// blank ladders.

import { strikesAgedOut } from './replaySessions.ts';

/**
 * How long production keeps per-strike rows (zerogex-oa DATA_RETENTION_DAYS).
 * A mirror, so the picker uses it only as the fallback for a session without
 * a has_strikes verdict.
 */
export const STRIKE_RETENTION_DAYS = 60;

/**
 * How many sessions to list per symbol. 60 trading sessions span about 84
 * calendar days, more than the window above, so the oldest kept day is always
 * in the list. The API allows up to 180.
 */
export const SESSION_LIST_LIMIT = 60;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86_400_000;

/**
 * One symbol's session as /api/replay/sessions lists it, as far as the picker
 * reads it. `has_strikes` is false once the day's per-strike rows have aged
 * out, null when the API couldn't check, and absent on an API from before it.
 */
export interface ListedSession {
  date: string;
  has_strikes?: boolean | null;
}

/**
 * The oldest session date whose per-strike rows are still stored, as
 * YYYY-MM-DD, given today's ET date key. Empty string for an unusable key,
 * which callers read as "no cutoff".
 */
export function strikeRetentionCutoff(todayKey: string, days: number = STRIKE_RETENTION_DAYS): string {
  if (!ISO_DATE.test(todayKey)) return '';
  const today = Date.parse(`${todayKey}T00:00:00Z`);
  if (!Number.isFinite(today)) return '';
  return new Date(today - days * DAY_MS).toISOString().slice(0, 10);
}

/**
 * The sessions the picker offers, newest first: the days both symbols list
 * whose ladders still have their strike rows (2 above), and always the newest
 * of them (3).
 *
 * A side that lists nothing, or whose list could not be read, can't narrow the
 * day, so the other side's list stands in for it. Its column then replays as
 * it did before the picker existed, and the empty side shows it has nothing;
 * leaving both blank would help no one. The day is still one day for both.
 * (A list still loading is not "nothing": the hook holds the previous options
 * until both lists are in.)
 */
export function pairReplaySessionOptions(
  left: readonly ListedSession[],
  right: readonly ListedSession[],
  todayKey: string,
  days: number = STRIKE_RETENTION_DAYS,
): string[] {
  let shared: readonly ListedSession[];
  if (left.length > 0 && right.length > 0) {
    const leftDays = new Set(left.map((s) => s.date));
    const rightDays = new Set(right.map((s) => s.date));
    // Both sides' sessions for each shared day, so either one's flag counts.
    shared = [...left.filter((s) => rightDays.has(s.date)), ...right.filter((s) => leftDays.has(s.date))];
  } else {
    shared = left.length > 0 ? left : right;
  }
  const valid = shared.filter((s) => ISO_DATE.test(s.date));
  const newestFirst = Array.from(new Set(valid.map((s) => s.date)))
    .sort()
    .reverse();
  const cutoff = strikeRetentionCutoff(todayKey, days);
  const agedOut = new Set(valid.filter((s) => lacksStrikeRows(s, cutoff)).map((s) => s.date));
  return newestFirst.filter((d, i) => i === 0 || !agedOut.has(d));
}

// One side's session has lost its strike rows: the API's word when it gave
// one, the date cutoff only when it didn't (null, or an API without the field).
function lacksStrikeRows(session: ListedSession, cutoff: string): boolean {
  if (strikesAgedOut(session.has_strikes)) return true;
  if (session.has_strikes === true) return false;
  return cutoff !== '' && session.date < cutoff;
}

/**
 * The day the pair replays: the member's pick while it is still on offer,
 * otherwise the newest offered day. A pick that drops off the list (a symbol
 * change to one without that day) falls back to the newest rather than
 * leaving one column empty. Null when nothing is offered.
 */
export function resolvePairReplayDate(picked: string | null, options: readonly string[]): string | null {
  if (picked && options.includes(picked)) return picked;
  return options[0] ?? null;
}

/**
 * True when a loaded session has frames but not a single strike row in any
 * of them: the levels and candles are there, the ladder is not. That is a day
 * whose per-strike rows were pruned or never written.
 */
export function sessionLacksStrikes(
  frames: ReadonlyArray<{ strikes?: ReadonlyArray<unknown> | null }>,
): boolean {
  return frames.length > 0 && frames.every((f) => (f.strikes?.length ?? 0) === 0);
}
