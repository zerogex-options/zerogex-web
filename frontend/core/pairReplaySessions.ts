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
//    ladders, so it is left out. Because the prune runs before the open, a
//    session is kept or deleted whole, and on Nov 7 the first day still kept is
//    Sep 8, which is exactly what this cutoff says. Between midnight and the
//    prune one more day survives; leaving it off is the safe side to err on.
//
// 3. The newest shared day is the default, and it is what Replay opened on
//    before the picker existed. It is always offered, even in the unlikely case
//    it is older than the window, so choosing it never shows less than before.
//
// The cutoff is a mirror of a backend setting, so the page also checks what
// actually came back: a day whose frames carry no strike rows at all says so
// under the transport (sessionLacksStrikes) rather than showing blank ladders.

/** How long production keeps per-strike rows (zerogex-oa DATA_RETENTION_DAYS). */
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
 * The sessions the picker offers, newest first: the days both symbols list,
 * inside the per-strike retention window.
 *
 * A side that lists nothing, or whose list could not be read, can't narrow the
 * day, so the other side's list stands in for it. Its column then replays as
 * it did before the picker existed, and the empty side shows it has nothing;
 * leaving both blank would help no one. The day is still one day for both.
 * (A list still loading is not "nothing": the hook holds the previous options
 * until both lists are in.)
 */
export function pairReplaySessionOptions(
  left: readonly string[],
  right: readonly string[],
  todayKey: string,
  days: number = STRIKE_RETENTION_DAYS,
): string[] {
  let shared: readonly string[];
  if (left.length > 0 && right.length > 0) {
    const rightDays = new Set(right);
    shared = left.filter((d) => rightDays.has(d));
  } else {
    shared = left.length > 0 ? left : right;
  }
  const newestFirst = Array.from(new Set(shared.filter((d) => ISO_DATE.test(d))))
    .sort()
    .reverse();
  const cutoff = strikeRetentionCutoff(todayKey, days);
  const kept = cutoff ? newestFirst.filter((d) => d >= cutoff) : newestFirst;
  return kept.length > 0 ? kept : newestFirst.slice(0, 1);
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
