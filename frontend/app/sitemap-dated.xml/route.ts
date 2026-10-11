// https://zerogex.io/sitemap-dated.xml: the dated, public receipt pages.
//
// WHY. /replay/<SYM>/<date>, /forecast/<SYM>/<date>, /scorecard/<SYM>/<date>
// and /hedging-flow/<SYM>/<date> are indexable and self-canonical, and they are
// the only pages that can answer "spx gamma flip call wall put wall <date>"
// searches. The main sitemap (next-sitemap, written once at deploy) lists only
// their four index pages, so Google learned about a new session's pages only by
// re-crawling an index, and for every symbol but SPY the index link it found
// was a ?symbol= variant canonicalized back to the bare index. This lists each
// dated URL directly, with the session date as its lastmod.
//
// It reads the same session-list endpoints, with the same limits, as the four
// index pages, so it shares their fetch-cache entries and adds no new kind of
// backend read. Every list is fetched independently and a failed one is
// skipped: a backend hiccup drops that section from this response, never the
// whole sitemap.

import { serverApiGet } from '@/core/api/serverFetch';
import { CASH_SYMBOLS, SYMBOLS } from '@/core/symbols';

// Rendered per request like /llms.txt (no build-time backend call); the
// upstream reads are cached by the fetch layer and the response by the CDN.
export const dynamic = 'force-dynamic';

const SITE_URL = 'https://zerogex.io';
const LIST_REVALIDATE_SECONDS = 3600;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
// A list that has not answered in this long is treated as failed for this
// response. Failed reads are not cached, so without a cap a hung backend would
// hold every sitemap request open for as long as the socket allows.
const LIST_TIMEOUT_MS = 5000;

function withTimeout<T>(work: Promise<T>, ms: number): Promise<T | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), ms);
    work.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      () => {
        clearTimeout(timer);
        resolve(null);
      },
    );
  });
}

type DatedList<K extends string> = { [key in K]?: { date: string }[] };

interface Section<K extends string> {
  /** URL prefix of the dated permalinks, e.g. '/replay'. */
  prefix: string;
  symbols: readonly string[];
  /** The endpoint the section's index page reads, for one symbol. */
  path: (symbol: string) => string;
  /** The array in the response that carries `{ date }` rows. */
  key: K;
}

const SECTIONS = [
  {
    prefix: '/replay',
    symbols: SYMBOLS,
    path: (s: string) => `/api/replay/sessions?symbol=${s}&limit=60`,
    key: 'sessions',
  } satisfies Section<'sessions'>,
  {
    prefix: '/forecast',
    symbols: SYMBOLS,
    path: (s: string) => `/api/forecast/available-dates?symbol=${s}&limit=60`,
    key: 'dates',
  } satisfies Section<'dates'>,
  {
    prefix: '/scorecard',
    symbols: SYMBOLS,
    path: (s: string) => `/api/scorecard/sessions?symbol=${s}&limit=60`,
    key: 'sessions',
  } satisfies Section<'sessions'>,
  {
    // The Hedging Flow archive covers the cash symbols only.
    prefix: '/hedging-flow',
    symbols: CASH_SYMBOLS,
    path: (s: string) => `/api/flow/hedging/sessions?symbol=${s}&limit=80`,
    key: 'sessions',
  } satisfies Section<'sessions'>,
];

type Entry = { loc: string; lastmod: string };

async function sectionEntries(section: (typeof SECTIONS)[number]): Promise<Entry[]> {
  const lists = await Promise.all(
    section.symbols.map(async (symbol) => {
      try {
        const data = await withTimeout(
          serverApiGet<DatedList<typeof section.key>>(section.path(symbol), LIST_REVALIDATE_SECONDS),
          LIST_TIMEOUT_MS,
        );
        const rows = data?.[section.key];
        if (!Array.isArray(rows)) return [];
        return rows
          .map((row) => row?.date)
          .filter((date): date is string => typeof date === 'string' && ISO_DATE.test(date))
          .map((date) => ({ loc: `${SITE_URL}${section.prefix}/${symbol}/${date}`, lastmod: date }));
      } catch {
        return [];
      }
    }),
  );
  return lists.flat();
}

function xmlEscape(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export async function GET(): Promise<Response> {
  const sections = await Promise.all(SECTIONS.map((section) => sectionEntries(section)));
  const seen = new Set<string>();
  const entries = sections
    .flat()
    .filter((entry) => (seen.has(entry.loc) ? false : (seen.add(entry.loc), true)));
  // Nothing answered: a sitemap must hold at least one <url>, and an empty one
  // cached for an hour tells a crawler there is nothing here. A 503 with a
  // retry hint tells it to come back instead, and is never cached.
  if (entries.length === 0) {
    return new Response('Dated sitemap temporarily unavailable.\n', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Retry-After': '3600', 'Cache-Control': 'no-store' },
    });
  }
  const urls = entries
    .map((entry) => `  <url><loc>${xmlEscape(entry.loc)}</loc><lastmod>${entry.lastmod}</lastmod></url>`)
    .join('\n');
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
  return new Response(body, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
    },
  });
}
