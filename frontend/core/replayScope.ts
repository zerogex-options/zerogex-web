/**
 * Expiration scope for the Daily Replay — which expirations a replayed session
 * is built from, and how that choice travels through the URL and the API.
 *
 * Two scopes, because they answer two different questions about the same
 * minute. "All" is the whole-chain dealer book: every expiration's gamma summed
 * into one surface, which is what structural levels (the ones that hold for
 * days) are made of. "0DTE" is only the contracts that settle that afternoon —
 * the book that actually has to be hedged before the bell, and the reason
 * same-day traders watch a replay at all.
 *
 * The scope is a fact about the SESSION being replayed, not about today: on
 * /replay/SPY/2026-09-15, 0DTE means the 2026-09-15 expiry forever. That is
 * what makes a shared 0DTE link keep meaning what it meant — unlike the live
 * charts' rolling 0DTE token, which is supposed to roll (see
 * core/expirationPersistence).
 *
 * Pure (no React / no window) so it unit-tests directly.
 */

export type ReplayScope = 'all' | '0dte';

/** The scope a replay opens in when the URL says nothing. */
export const DEFAULT_REPLAY_SCOPE: ReplayScope = 'all';

/** Every scope, in the order the toggle renders them (widest book first). */
export const REPLAY_SCOPES: readonly ReplayScope[] = ['all', '0dte'];

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
  const value = Array.isArray(raw) ? raw[0] : raw;
  return (value ?? '').trim().toLowerCase() === '0dte' ? '0dte' : DEFAULT_REPLAY_SCOPE;
}

/**
 * The scope's `expirations` argument for /api/replay/range. The API resolves
 * the literal `0dte` token against the requested session date, so the client
 * never has to know the chain to ask for it.
 */
export function replayScopeParam(scope: ReplayScope): string {
  return scope === '0dte' ? '0dte' : 'all';
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
  if (opts.scope !== 'all') params.set('expirations', replayScopeParam(opts.scope));
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

/** Short label for the scope toggle. */
export function replayScopeLabel(scope: ReplayScope): string {
  return scope === '0dte' ? '0DTE' : 'All exps';
}

/**
 * What the scope means, in one sentence, for a tooltip.
 */
export function replayScopeTitle(scope: ReplayScope, sessionDate: string): string {
  return scope === '0dte'
    ? `Only contracts expiring ${sessionDate}\u00a0- the book that had to be hedged before the bell`
    : 'Every expiration in the chain, aggregated\u00a0- the whole-chain dealer book';
}
