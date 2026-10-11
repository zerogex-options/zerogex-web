// The arithmetic behind scripts/search-console-report.mts: which two date
// windows to compare, and how one page's queries moved between them.
//
// Written for decisions like the SPX title test (docs/seo/2026-10-11-
// organic-acquisition-workstream.md, backlog item 2): "compare the 28 days
// before a change with the 28 days after it, for the queries containing
// 'net gex', on /spx-gamma-levels". Search Console's UI can do that, but only
// one filter at a time and with no before/after table; this prints both
// windows side by side.
//
// Pure: no network, no env, so node --test can import it. Relative imports
// only, for the same reason core/searchConsole.ts uses them.

const DAY_MS = 86_400_000;

export type DayWindow = { start: string; end: string };

function shiftDay(day: string, days: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

function isDay(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

/**
 * The two windows to compare, each `days` long and inclusive.
 *
 * With `split` (the day a change shipped): "before" is the `days` ending the
 * day before it, and "after" is the `days` starting on it, cut off at
 * `latestDay` so it never asks for days Google has not reported yet. Without
 * `split`: the trailing `days` ending `latestDay`, against the `days` before.
 */
export function comparisonWindows(
  days: number,
  latestDay: string,
  split?: string,
): { before: DayWindow; after: DayWindow } {
  if (!isDay(latestDay)) throw new Error(`latest day ${latestDay} is not YYYY-MM-DD`);
  const span = Math.max(1, Math.floor(days));
  if (split !== undefined) {
    if (!isDay(split)) throw new Error(`SPLIT=${split} is not YYYY-MM-DD`);
    if (split > latestDay) throw new Error(`SPLIT=${split} is after the newest reported day, ${latestDay}`);
    const afterEnd = shiftDay(split, span - 1);
    return {
      before: { start: shiftDay(split, -span), end: shiftDay(split, -1) },
      after: { start: split, end: afterEnd < latestDay ? afterEnd : latestDay },
    };
  }
  const afterStart = shiftDay(latestDay, -(span - 1));
  return {
    before: { start: shiftDay(afterStart, -span), end: shiftDay(afterStart, -1) },
    after: { start: afterStart, end: latestDay },
  };
}

/** Days in an inclusive window. */
export function windowLength(w: DayWindow): number {
  return Math.round((Date.parse(`${w.end}T00:00:00Z`) - Date.parse(`${w.start}T00:00:00Z`)) / DAY_MS) + 1;
}

/** The full URL Search Console reports for `path` on this property. */
export function pageUrlFor(siteUrl: string, path: string): string {
  const clean = path.startsWith('/') ? path : `/${path}`;
  if (siteUrl.startsWith('sc-domain:')) return `https://${siteUrl.slice('sc-domain:'.length)}${clean}`;
  return `${siteUrl.replace(/\/+$/, '')}${clean}`;
}

export type QueryStats = { clicks: number; impressions: number; position: number };

function num(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

/** API rows keyed by their first dimension (the query, or the page). */
export function rowsByKey(
  rows: ReadonlyArray<{ keys?: unknown; clicks?: unknown; impressions?: unknown; position?: unknown }>,
): Map<string, QueryStats> {
  const out = new Map<string, QueryStats>();
  for (const row of rows) {
    const key = Array.isArray(row.keys) && typeof row.keys[0] === 'string' ? row.keys[0] : null;
    if (key === null) continue;
    out.set(key, { clicks: num(row.clicks), impressions: num(row.impressions), position: num(row.position) });
  }
  return out;
}

/**
 * Totals for a window. Position is impression-weighted, which is how Search
 * Console averages it across queries; CTR is clicks over impressions.
 */
export function totals(stats: Iterable<QueryStats>): QueryStats & { ctr: number } {
  let clicks = 0;
  let impressions = 0;
  let weighted = 0;
  for (const s of stats) {
    clicks += s.clicks;
    impressions += s.impressions;
    weighted += s.position * s.impressions;
  }
  return {
    clicks,
    impressions,
    position: impressions > 0 ? weighted / impressions : 0,
    ctr: impressions > 0 ? clicks / impressions : 0,
  };
}

export type QueryComparison = { key: string; before: QueryStats | null; after: QueryStats | null };

/** Every key seen in either window, busiest first (impressions across both). */
export function compareWindows(
  before: Map<string, QueryStats>,
  after: Map<string, QueryStats>,
): QueryComparison[] {
  const keys = new Set([...before.keys(), ...after.keys()]);
  return [...keys]
    .map((key) => ({ key, before: before.get(key) ?? null, after: after.get(key) ?? null }))
    .sort((a, b) => {
      const ia = (a.before?.impressions ?? 0) + (a.after?.impressions ?? 0);
      const ib = (b.before?.impressions ?? 0) + (b.after?.impressions ?? 0);
      return ib - ia || a.key.localeCompare(b.key);
    });
}
