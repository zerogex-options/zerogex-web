/**
 * Expiration scope for the Daily Replay — which expirations a replayed session
 * is built from, and how that choice travels through the URL and the API.
 *
 * Three scopes, because they answer different questions about the same
 * minute. "All" is the whole-chain dealer book: every expiration's gamma summed
 * into one surface, which is what structural levels (the ones that hold for
 * days) are made of. "0DTE" is only the contracts that settle that afternoon —
 * the book that actually has to be hedged before the bell, and the reason
 * same-day traders watch a replay at all. "Fri" is the coming weekly: the
 * next Friday's expiry, or the Friday after when the session IS a Friday
 * (that day's own expiry is already the 0DTE scope).
 *
 * The scope is a fact about the SESSION being replayed, not about today: on
 * /replay/SPY/2026-09-15, 0DTE means the 2026-09-15 expiry and Fri means the
 * 2026-09-18 expiry forever. That is what makes a shared link keep meaning
 * what it meant — unlike the live charts' rolling 0DTE token, which is
 * supposed to roll (see core/expirationPersistence).
 *
 * Pure (no React / no window) so it unit-tests directly.
 */

import {
  buildNyseHolidayCalendar,
  parseNyseHolidays,
  type NyseHolidayCalendar,
} from './optionsCalendar.ts';

export type ReplayScope = 'all' | '0dte' | 'fri';

/** The scope a replay opens in when the URL says nothing. */
export const DEFAULT_REPLAY_SCOPE: ReplayScope = 'all';

/** Every scope, in the order the toggle renders them: the whole chain, then
 *  the single-expiry books nearest-first. */
export const REPLAY_SCOPES: readonly ReplayScope[] = ['all', '0dte', 'fri'];

/** Query-string key carrying the scope on /replay/[symbol]/[date]. */
export const REPLAY_SCOPE_PARAM = 'exp';

/**
 * Query-string key carrying the playhead minute, as the same HHMM-in-ET token
 * the /snapshot/[time] permalinks use.
 *
 * It exists because switching scope is a NAVIGATION (the replay API is
 * tier-gated at the BFF while these pages are public, so the scoped payload has
 * to be server-rendered), and a scrubber that drops you back at the closing
 * bell on every switch is one you stop switching. Carrying the minute in the
 * URL rather than in browser storage keeps the server and the client rendering
 * the same first frame — a storage read would only exist on one of them, which
 * is a hydration mismatch — and makes "here, at this minute" a link.
 */
export const REPLAY_MINUTE_PARAM = 't';

/**
 * A `?exp=` value → a scope. Anything unrecognised (including absent, an
 * array from a repeated param, or a stale token from an old link) falls back to
 * All: a replay that renders the whole chain is always a truthful page, and a
 * 404 over a query-string typo would be a worse one.
 */
export function parseReplayScope(raw: string | string[] | undefined | null): ReplayScope {
  const value = (Array.isArray(raw) ? raw[0] : raw)?.trim().toLowerCase() ?? '';
  if (value === '0dte') return '0dte';
  if (value === 'fri') return 'fri';
  return DEFAULT_REPLAY_SCOPE;
}

const DEFAULT_HOLIDAYS: NyseHolidayCalendar = buildNyseHolidayCalendar(
  parseNyseHolidays(
    typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_NYSE_HOLIDAYS : undefined,
  ),
);

/**
 * The weekly expiry the Fri scope replays, for a session date: the first
 * Friday strictly after it, so a Friday session gets the FOLLOWING Friday
 * rather than a second copy of its own 0DTE book.
 *
 * When that Friday is a NYSE holiday (Good Friday, or Christmas / New Year's
 * Day / Juneteenth / July 4th landing on one) the weekly settles the business
 * day before instead, so the date walks back to it. If the walk lands on or
 * before the session itself (a Thursday session ahead of a Friday holiday,
 * whose own expiry IS that week's weekly), the week after is used. The holiday
 * list is the operator-maintained NEXT_PUBLIC_NYSE_HOLIDAYS the options
 * calendar already reads; unset, holiday Fridays come back as-is and the page
 * says the chain had no such expiry rather than drawing the wrong one.
 *
 * Pure UTC arithmetic at noon: the input is already an ET calendar date, and
 * midday keeps any timezone reading from moving it to the adjacent day.
 * Returns null for a string that is not a date.
 */
export function nextFridayExpiration(
  sessionDate: string,
  holidays: NyseHolidayCalendar = DEFAULT_HOLIDAYS,
): string | null {
  const start = new Date(`${sessionDate}T12:00:00Z`);
  if (Number.isNaN(start.getTime())) return null;
  const sessionIso = start.toISOString().slice(0, 10);
  // Days to the next Friday, 1..7 — a Friday maps to 7, never 0.
  let offset = ((5 - start.getUTCDay() + 7) % 7) || 7;
  // Two weeks is plenty: no US market closure spans a whole week of weekdays.
  for (let week = 0; week < 2; week += 1, offset += 7) {
    for (let back = 0; back < 5; back += 1) {
      const day = new Date(start.getTime() + (offset - back) * 86_400_000);
      const iso = day.toISOString().slice(0, 10);
      if (iso <= sessionIso) break;
      if (!holidays.has(iso)) return iso;
    }
  }
  return null;
}

/**
 * The single expiry a scope is built from, or null for the whole chain. 0DTE
 * is the session's own date; Fri is {@link nextFridayExpiration}.
 */
export function replayScopeExpiration(scope: ReplayScope, sessionDate: string): string | null {
  if (scope === '0dte') return sessionDate;
  if (scope === 'fri') return nextFridayExpiration(sessionDate);
  return null;
}

/**
 * The scope's `expirations` argument for /api/replay/range. The API resolves
 * the literal `0dte` token against the requested session date, so the client
 * never has to know the chain to ask for it. Fri has no server-side token and
 * goes as the resolved date, which the endpoint already accepts.
 */
export function replayScopeParam(scope: ReplayScope, sessionDate: string): string {
  if (scope === '0dte') return '0dte';
  if (scope === 'fri') return nextFridayExpiration(sessionDate) ?? 'all';
  return 'all';
}

/**
 * The /api/replay/range query for one session in one scope.
 *
 * `includeExpirations` opts into the expiry legend (and, in the All scope, the
 * per-strike mix behind the colour gradient). It costs a second session-wide
 * scan server-side, so it stays a caller's choice.
 */
export function replayRangeQuery(opts: {
  symbol: string;
  date: string;
  scope: ReplayScope;
  includeExpirations?: boolean;
}): string {
  const params = new URLSearchParams({
    symbol: opts.symbol,
    date: opts.date,
    timeframe: '1min',
  });
  if (opts.includeExpirations) params.set('include_expirations', 'true');
  if (opts.scope !== 'all') params.set('expirations', replayScopeParam(opts.scope, opts.date));
  return params.toString();
}

/**
 * An HHMM-in-ET playhead token → itself, or null when it is not one.
 *
 * Only the shape is checked (four digits, a real wall-clock time). Whether that
 * minute exists in the session is the scrubber's business: it snaps to the
 * nearest frame it has, the same way the snapshot permalink resolves at-or-
 * before, so a minute from a half day still lands somewhere sensible.
 */
export function parseReplayMinute(raw: string | string[] | undefined | null): string | null {
  const value = (Array.isArray(raw) ? raw[0] : raw)?.trim() ?? '';
  if (!/^\d{4}$/.test(value)) return null;
  const hh = Number.parseInt(value.slice(0, 2), 10);
  const mm = Number.parseInt(value.slice(2, 4), 10);
  return hh <= 23 && mm <= 59 ? value : null;
}

/**
 * The page URL for a session in a scope, optionally at a minute. All with no
 * minute is the BARE dated path, never `?exp=all`: these dated URLs are
 * indexed, and two spellings of the same page is how a site earns duplicate-
 * content crawl budget it gets nothing for.
 */
export function replayScopeHref(
  symbol: string,
  date: string,
  scope: ReplayScope,
  minute?: string | null,
): string {
  const base = `/replay/${symbol}/${date}`;
  const params = new URLSearchParams();
  if (scope !== 'all') params.set(REPLAY_SCOPE_PARAM, scope);
  const token = parseReplayMinute(minute);
  if (token) params.set(REPLAY_MINUTE_PARAM, token);
  const query = params.toString();
  return query ? `${base}?${query}` : base;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

/** "2026-09-18" → "Fri 9/18". */
function shortExpiryLabel(iso: string): string {
  const day = new Date(`${iso}T12:00:00Z`);
  return `${WEEKDAYS[day.getUTCDay()]} ${day.getUTCMonth() + 1}/${day.getUTCDate()}`;
}

/**
 * Short label for the scope toggle. Fri shows the expiry it resolved to, so a
 * holiday week reads "Thu 12/24" instead of promising a Friday that never
 * traded.
 */
export function replayScopeLabel(scope: ReplayScope, sessionDate?: string): string {
  if (scope === '0dte') return '0DTE';
  if (scope === 'fri') {
    const expiry = sessionDate ? nextFridayExpiration(sessionDate) : null;
    return expiry ? shortExpiryLabel(expiry) : 'Next Fri';
  }
  return 'All exps';
}

/**
 * What the scope means, in one sentence, for a tooltip.
 */
export function replayScopeTitle(scope: ReplayScope, sessionDate: string): string {
  if (scope === '0dte') {
    return `Only contracts expiring ${sessionDate}\u00a0- the book that had to be hedged before the bell`;
  }
  if (scope === 'fri') {
    const expiry = nextFridayExpiration(sessionDate) ?? 'next Friday';
    return `Only contracts expiring ${expiry}\u00a0- the coming weekly expiration`;
  }
  return 'Every expiration in the chain, aggregated\u00a0- the whole-chain dealer book';
}
