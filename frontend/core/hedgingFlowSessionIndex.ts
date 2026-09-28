/**
 * Pure helpers for the paged Hedging Flow session index.
 *
 * Extracted from the page so they can be tested directly: every one of them
 * fails by rendering a page that looks fine. A cursor forwarded without
 * validation turns a mangled query string into an error page. A cursor carried
 * across a symbol switch drops the reader into the middle of another symbol's
 * history, or past its end, which reads as "this symbol has nothing stored". A
 * "next page" link inferred from a full page sends them to an empty archive.
 * None of those throw.
 *
 * Why this index pages at all when /replay and /scorecard do not: theirs read
 * tables `make db-prune` empties at DATA_RETENTION_DAYS, so a single request
 * holds their whole contents forever. This one reads hedging_flow_5min, which
 * is retention-exempt and gains a session every trading day, so any fixed
 * request eventually stops showing the oldest sessions while their permalinks
 * keep working.
 */

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export interface SessionIndexEntry {
  date: string;
}

/** What the API answers, in the shape the index depends on. */
export interface SessionIndexPage<T extends SessionIndexEntry> {
  sessions: T[];
  /** Answered from a row the API fetched and discarded, not inferred. */
  has_more?: boolean;
  /** The `before` value for the next page; null on the last one. */
  next_before?: string | null;
}

/**
 * A cursor is only ever a plain calendar date.
 *
 * Anything else resolves to null and the newest page is served instead. The
 * alternative — forwarding whatever arrived — hands the API a value it rejects
 * with a 400, so a truncated or hand-edited URL would render as a broken page
 * rather than simply the top of the archive.
 */
export function parseCursor(raw: string | undefined | null): string | null {
  if (!raw || !ISO_DATE.test(raw)) return null;
  return Number.isFinite(Date.parse(`${raw}T00:00:00Z`)) ? raw : null;
}

/**
 * The index URL for a symbol and cursor.
 *
 * SPY and the newest page are both expressed by absence, so the canonical
 * entry point stays a bare `/hedging-flow/sessions` rather than acquiring a
 * query string that means "the default".
 */
export function sessionsHref(symbol: string, before: string | null): string {
  const qs = new URLSearchParams();
  if (symbol !== 'SPY') qs.set('symbol', symbol);
  if (before) qs.set('before', before);
  const query = qs.toString();
  return query ? `/hedging-flow/sessions?${query}` : '/hedging-flow/sessions';
}

/**
 * Where "Older sessions" points, or null when this is the last page.
 *
 * Both fields are required, not just `has_more`: a true flag with no cursor
 * would build `?before=null` and serve the newest page again, which is a link
 * that silently loops.
 */
export function olderHref<T extends SessionIndexEntry>(
  symbol: string,
  page: SessionIndexPage<T> | null,
): string | null {
  if (!page?.has_more || !page.next_before) return null;
  return sessionsHref(symbol, page.next_before);
}

/** Month heading for a session date, e.g. "September 2026". */
export function monthLabel(raw: string): string {
  try {
    return new Intl.DateTimeFormat('en-US', {
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(`${raw}T12:00:00Z`));
  } catch {
    return raw.slice(0, 7);
  }
}

/**
 * Split a page into consecutive month runs, preserving the API's newest-first
 * order.
 *
 * Runs rather than a keyed map: the order the sessions arrived in IS the order
 * they are shown, and grouping by key would let a month reappear later in the
 * page if the list were ever not sorted.
 */
export function groupByMonth<T extends SessionIndexEntry>(
  sessions: T[],
): { label: string; sessions: T[] }[] {
  const groups: { label: string; sessions: T[] }[] = [];
  for (const session of sessions) {
    const label = monthLabel(session.date);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.sessions.push(session);
    else groups.push({ label, sessions: [session] });
  }
  return groups;
}
