// IndexNow: telling Bing, and the other engines that share IndexNow
// submissions, which zerogex.io pages changed, the day they change.
//
// WHY. The pages that earn the site's non-brand search traffic change every
// trading day: the six /<ticker>-gamma-levels pages, /gex-levels, /chart and
// the receipt indexes, plus a new set of dated /replay, /forecast, /scorecard
// and /hedging-flow permalinks after every session. A search engine learns
// about that only when it next recrawls the sitemap. IndexNow is the push
// version: one POST listing the changed URLs. Bing runs it (Bing's index also
// serves Copilot, Yahoo and DuckDuckGo), and a submission to the shared
// endpoint is passed on to every participating engine (Amazon, Naver, Seznam,
// Yandex, Yep). Google does not take part; the sitemaps stay its signal.
//
// ONLY WHAT CHANGED. The protocol asks sites not to resubmit unchanged URLs, so
// the job remembers what it sent (IndexNowState, kept by the systemd unit's
// StateDirectory) and sends, per run:
//   1. the static-sitemap pages marked changefreq "daily" (their content is
//      rebuilt every session, which is why the sitemap says daily), once per
//      session, so not again on an exchange holiday;
//   2. every other static-sitemap page whose lastmod differs from the one last
//      sent (an article whose dateModified moved, a new page after a deploy);
//   3. every dated permalink from the last DATED_LOOKBACK_DAYS not sent before,
//      whichever session list it comes from, so a list that lags at run time
//      is picked up on the next run instead of being skipped for good.
// The first run, with nothing remembered, sends every static page and the last
// week of permalinks: the introduction.
//
// THE KEY. IndexNow proves a site owns the URLs it submits with a key file
// served from the site itself: https://zerogex.io/<key>.txt, whose body is the
// key. The key is public by design (anyone can read the file), so it is a
// constant here and a committed file in public/, not a secret in .env.local.
// The worst a third party can do with it is ask the engines to recrawl our own
// pages. tests/indexNow.test.ts keeps the file and this constant in step.
//
// Pure module, no '@/' imports, so node --test and the ping script can load it.

export const SITE_URL = 'https://zerogex.io';
export const INDEXNOW_HOST = 'zerogex.io';

/** 32 hex characters. IndexNow accepts 8-128 of [a-zA-Z0-9-]. */
export const INDEXNOW_KEY = '3c7b20a675c020ed1044107b6397cec2';

/** Where the key file is served. At the root, so every URL on the host is in scope. */
export const INDEXNOW_KEY_URL = `${SITE_URL}/${INDEXNOW_KEY}.txt`;

/** The shared endpoint; a submission here is forwarded to every participating engine. */
export const INDEXNOW_ENDPOINT = 'https://api.indexnow.org/indexnow';

/** The protocol's per-request limit. */
export const INDEXNOW_MAX_URLS = 10_000;

/** Dated permalinks this recent are sent if they have not been sent yet. */
export const DATED_LOOKBACK_DAYS = 7;

/** Sent permalinks are remembered this long, comfortably past the lookback. */
export const DATED_MEMORY_DAYS = 21;

export type SitemapEntry = { loc: string; lastmod?: string; changefreq?: string };

/** What the job has already sent. */
export type IndexNowState = {
  /** Static-sitemap page -> the lastmod it had when it was last sent. */
  static: Record<string, string>;
  /** Dated permalink -> the ET day it was sent. */
  dated: Record<string, string>;
  /** The ET day the daily pages were last sent. */
  dailyOn?: string;
};

export const EMPTY_STATE: IndexNowState = { static: {}, dated: {} };

function unescapeXml(value: string): string {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

/**
 * The <url> entries of a sitemap: what next-sitemap writes to
 * public/sitemap-0.xml and what app/sitemap-dated.xml/route.ts serves. A
 * <sitemapindex> has no <url> blocks and parses to an empty list.
 */
export function parseSitemap(xml: string): SitemapEntry[] {
  const out: SitemapEntry[] = [];
  for (const block of xml.matchAll(/<url>([\s\S]*?)<\/url>/g)) {
    const field = (name: string) => {
      const m = new RegExp(`<${name}>\\s*([^<]*?)\\s*</${name}>`).exec(block[1]);
      return m ? unescapeXml(m[1]) : undefined;
    };
    const loc = field('loc');
    if (!loc) continue;
    out.push({ loc, lastmod: field('lastmod'), changefreq: field('changefreq') });
  }
  return out;
}

/** Only absolute https URLs on this host: the endpoint rejects a batch with any other (HTTP 422). */
export function isOwnUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && u.host === INDEXNOW_HOST;
  } catch {
    return false;
  }
}

/**
 * A page, not a file: no dot in the last path segment. The built sitemap has
 * carried /icon.png and /apple-icon.png (next-sitemap listed the app/ icon
 * routes as if they were pages), and an image is not what these submissions
 * are for.
 */
export function isPageUrl(url: string): boolean {
  try {
    const last = new URL(url).pathname.split('/').pop() ?? '';
    return !last.includes('.');
  } catch {
    return false;
  }
}

const submittable = (url: string) => isOwnUrl(url) && isPageUrl(url);

function dedupe(urls: string[]): string[] {
  return [...new Set(urls.filter(submittable))];
}

/** The calendar date in New York (YYYY-MM-DD), which is what "today" means for a session. */
export function etDate(now: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/** Days from `from` to `to`, both YYYY-MM-DD. */
function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86_400_000);
}

/**
 * A NYSE session day: a weekday that is not in the operator's holiday list
 * (NEXT_PUBLIC_NYSE_HOLIDAYS, comma-separated YYYY-MM-DD, the same list the
 * daily levels email and the header badge read).
 */
export function isTradingDay(isoDate: string, holidaysCsv: string | undefined): boolean {
  const weekday = new Date(`${isoDate}T12:00:00Z`).getUTCDay();
  if (weekday === 0 || weekday === 6) return false;
  const holidays = new Set((holidaysCsv ?? '').split(',').map((s) => s.trim()).filter(Boolean));
  return !holidays.has(isoDate);
}

/** When a session's closing pages are done: the 4:15 PM ET scorecard. */
const SESSION_DONE_MINUTES_ET = 16 * 60 + 15;

/**
 * The most recent session whose closing pages exist: today after 4:15 PM ET on
 * a trading day, otherwise the trading day before. The daily pages are sent
 * once per session, keyed on this, so a run that catches up the next morning
 * (Persistent=true after the box was down) sends the session that closed, and
 * that evening's run still sends the new one.
 */
export function lastClosedSession(now: Date, holidaysCsv: string | undefined): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  );
  const minutes = Number(parts.hour) * 60 + Number(parts.minute);
  let day = etDate(now);
  if (isTradingDay(day, holidaysCsv) && minutes >= SESSION_DONE_MINUTES_ET) return day;
  do {
    const d = new Date(`${day}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() - 1);
    day = d.toISOString().slice(0, 10);
  } while (!isTradingDay(day, holidaysCsv));
  return day;
}

export type Selection = { urls: string[]; next: IndexNowState };

/**
 * What changed since the last run; see the header for the three rules.
 * `session` is lastClosedSession(): the daily pages go out once per session.
 */
export function selectChanged(
  staticEntries: SitemapEntry[],
  datedEntries: SitemapEntry[],
  state: IndexNowState,
  now: Date,
  session: string,
): Selection {
  const today = etDate(now);
  const pages = staticEntries.filter((e) => submittable(e.loc));
  const daily = pages.filter((e) => e.changefreq === 'daily');
  const sendDaily = state.dailyOn !== session;

  const changedStatic = pages.filter(
    (e) => e.changefreq !== 'daily' && (state.static[e.loc] === undefined || state.static[e.loc] !== (e.lastmod ?? '')),
  );

  const newDated = datedEntries.filter((e) => {
    const day = e.lastmod?.slice(0, 10);
    if (!submittable(e.loc) || !day || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
    const age = daysBetween(day, today);
    return age >= 0 && age <= DATED_LOOKBACK_DAYS && state.dated[e.loc] === undefined;
  });

  const urls = dedupe([
    ...(sendDaily ? daily.map((e) => e.loc) : []),
    ...newDated.map((e) => e.loc),
    ...changedStatic.map((e) => e.loc),
  ]).slice(0, INDEXNOW_MAX_URLS);

  const sent = new Set(urls);
  const next: IndexNowState = {
    static: { ...state.static },
    dated: {},
    dailyOn: sendDaily ? session : state.dailyOn,
  };
  for (const e of changedStatic) if (sent.has(e.loc)) next.static[e.loc] = e.lastmod ?? '';
  for (const [url, day] of Object.entries(state.dated)) {
    if (daysBetween(day, today) <= DATED_MEMORY_DAYS) next.dated[url] = day;
  }
  for (const e of newDated) if (sent.has(e.loc)) next.dated[e.loc] = today;
  return { urls, next };
}

/**
 * Every page in both sitemaps (`make indexnow ALL=1`): the full introduction,
 * including the older permalinks the daily run never looks back to. Records
 * all of it, so the next daily run sends only what changes after this.
 */
export function selectAll(
  staticEntries: SitemapEntry[],
  datedEntries: SitemapEntry[],
  state: IndexNowState,
  now: Date,
  session: string,
): Selection {
  const today = etDate(now);
  const urls = dedupe([...staticEntries, ...datedEntries].map((e) => e.loc)).slice(0, INDEXNOW_MAX_URLS);
  const sent = new Set(urls);
  const next: IndexNowState = {
    static: { ...state.static },
    dated: { ...state.dated },
    dailyOn: session,
  };
  for (const e of staticEntries) if (sent.has(e.loc) && e.changefreq !== 'daily') next.static[e.loc] = e.lastmod ?? '';
  for (const e of datedEntries) if (sent.has(e.loc)) next.dated[e.loc] = today;
  return { urls, next };
}

/** A state file that is missing, empty or unreadable is a first run, not an error. */
export function parseState(raw: string | null | undefined): IndexNowState {
  if (!raw) return { static: {}, dated: {} };
  try {
    const parsed = JSON.parse(raw) as Partial<IndexNowState>;
    return {
      static: parsed.static && typeof parsed.static === 'object' ? parsed.static : {},
      dated: parsed.dated && typeof parsed.dated === 'object' ? parsed.dated : {},
      dailyOn: typeof parsed.dailyOn === 'string' ? parsed.dailyOn : undefined,
    };
  } catch {
    return { static: {}, dated: {} };
  }
}

export type IndexNowPayload = { host: string; key: string; keyLocation: string; urlList: string[] };

export function buildPayload(urls: string[]): IndexNowPayload {
  return { host: INDEXNOW_HOST, key: INDEXNOW_KEY, keyLocation: INDEXNOW_KEY_URL, urlList: urls };
}

/**
 * What an IndexNow status code means, and what the job does about it.
 *
 * `ok` (200, 202): sent; remember it.
 * `config` (400, 403): our side is wrong and stays wrong until fixed (a
 *   malformed request, or a key the engine could not verify against the key
 *   file), so the unit fails and its alert email goes out.
 * `rejected` (422): the documentation gives "URLs not on the host, or a key
 *   that does not match"; the FAQ also gives "the same URL submitted
 *   repeatedly without changes". The job checks the key file and the host
 *   before sending, so the second reading is the likely one: log it, remember
 *   the batch so it is not sent again, and do not page anyone.
 * `transient` (429, 5xx): try again on a later run; 429 asks for at least ten
 *   minutes before resubmitting, so it is not retried inside this run.
 */
export function classifyResponse(status: number): {
  kind: 'ok' | 'config' | 'rejected' | 'transient';
  retryNow: boolean;
  meaning: string;
} {
  switch (status) {
    case 200:
      return { kind: 'ok', retryNow: false, meaning: 'accepted' };
    case 202:
      return { kind: 'ok', retryNow: false, meaning: 'received; key validation pending' };
    case 400:
      return { kind: 'config', retryNow: false, meaning: 'bad request (invalid format)' };
    case 403:
      return { kind: 'config', retryNow: false, meaning: `key not valid: is ${INDEXNOW_KEY_URL} live and serving the key?` };
    case 422:
      return { kind: 'rejected', retryNow: false, meaning: 'unprocessable: URLs already sent unchanged, or not this host' };
    case 429:
      return { kind: 'transient', retryNow: false, meaning: 'too many requests; the next run tries again' };
    default:
      return status >= 500
        ? { kind: 'transient', retryNow: true, meaning: `endpoint error ${status}` }
        : { kind: 'config', retryNow: false, meaning: `unexpected status ${status}` };
  }
}
