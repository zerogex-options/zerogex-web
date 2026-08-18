import type { MarketSession } from './types';

// UTM source normalization, shared by the page-view beacon and the signup
// attribution path (zgx_src cookie -> users.signup_utm_source). Lowercased and
// restricted to a small charset so "X", "x", and "X/promo" collapse to one
// stable key, values stay index-friendly, and nothing hostile reaches SQL or
// the admin table. Returns null for anything empty/absent so callers store
// NULL (organic/direct), never "".
export function sanitizeUtmSource(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const cleaned = raw.trim().toLowerCase().replace(/[^a-z0-9._-]/g, '').slice(0, 64);
  return cleaned.length > 0 ? cleaned : null;
}

export const getMarketSession = (): MarketSession => {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now);

  const weekday = parts.find((p) => p.type === 'weekday')?.value;
  const hours = Number(parts.find((p) => p.type === 'hour')?.value ?? '0');
  const minutes = Number(parts.find((p) => p.type === 'minute')?.value ?? '0');
  const time = hours * 60 + minutes;

  if (weekday === 'Sat' || weekday === 'Sun') return 'closed-weekend';

  const marketOpen = 9 * 60 + 30;
  const marketClose = 16 * 60;
  const preMarketStart = 4 * 60;
  const afterHoursEnd = 20 * 60;

  if (time >= marketOpen && time < marketClose) return 'open';
  if (time >= preMarketStart && time < marketOpen) return 'pre-market';
  if (time >= marketClose && time < afterHoursEnd) return 'after-hours';
  return 'closed';
};

export const formatTime = (timezone: string): string => {
  return new Date().toLocaleTimeString('en-US', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
};

// Today's date in the New York calendar as a YYYY-MM-DD string.  Convenient
// reference point for lex-comparing expiration date strings (the canonical
// zero-padded YYYY-MM-DD layout sorts identically as a string and as a
// calendar date) — anything strictly less than this is a past session.
export const etTodayDateKey = (): string => {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date());
};

// The ET trading date (YYYY-MM-DD) an instant belongs to. Same calendar key as
// `etTodayDateKey`, resolved for an arbitrary timestamp rather than "now", so a
// row's session can be read straight off its own timestamp. Returns '' for a
// missing or unparseable value, which callers treat as "no date".
//
// Cached at the module level because the flow feeds call this once per row on
// hot paths and the Intl formatter is the expensive part. Bounded so a
// long-running session can't grow the map without limit.
const etDateKeyCache = new Map<string, string>();
const ET_DATE_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/New_York',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export function etDateKeyFor(ts: string | null | undefined): string {
  if (!ts) return '';
  const cached = etDateKeyCache.get(ts);
  if (cached != null) return cached;
  const d = new Date(ts);
  const key = Number.isNaN(d.getTime()) ? '' : ET_DATE_FORMATTER.format(d);
  if (etDateKeyCache.size > 20_000) etDateKeyCache.clear();
  etDateKeyCache.set(ts, key);
  return key;
}

// Label a daily ("1day") candle by its ET trading date.
//
// A daily bucket's timestamp is a DATE marker, not a wall-clock instant: the
// chart aggregators floor each bucket to UTC midnight and stamp it as that
// midnight (e.g. 2026-08-04T00:00:00Z). Because a US cash session
// (13:30–21:00 UTC) sits wholly inside one UTC calendar day, that day's UTC
// date IS the ET trading date. Rendering the marker in America/New_York would
// convert 00:00Z back 4–5h into the previous evening — 2026-08-04T00:00:00Z
// prints as "Aug 3, 20:00 ET" — labelling every daily candle a day early.
// Formatting in UTC returns the correct trading date and is DST-proof (it never
// touches the ET offset). Use this for daily bars ONLY; intraday bars are true
// instants and must still render in ET.
const ET_TRADING_DATE_FMT = new Intl.DateTimeFormat('en-US', {
  timeZone: 'UTC',
  month: 'short',
  day: 'numeric',
});
export const etTradingDateLabel = (timestamp: string | Date): string => {
  const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
  if (Number.isNaN(date.getTime())) return '';
  return ET_TRADING_DATE_FMT.format(date);
};

const etFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  weekday: 'short',
});

export const isWithinExtendedMarketHours = (timestamp: string | Date): boolean => {
  const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
  if (Number.isNaN(date.getTime())) return false;

  const parts = etFormatter.formatToParts(date);
  const weekday = parts.find((p) => p.type === 'weekday')?.value;
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? '0');
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? '0');

  if (weekday === 'Sat' || weekday === 'Sun') return false;

  const totalMinutes = hour * 60 + minute;
  return totalMinutes >= 4 * 60 && totalMinutes <= 20 * 60;
};

export const isWithinRegularMarketHours = (timestamp: string | Date): boolean => {
  const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
  if (Number.isNaN(date.getTime())) return false;

  const parts = etFormatter.formatToParts(date);
  const weekday = parts.find((p) => p.type === 'weekday')?.value;
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? '0');
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? '0');

  if (weekday === 'Sat' || weekday === 'Sun') return false;

  const totalMinutes = hour * 60 + minute;
  return totalMinutes >= 9 * 60 + 30 && totalMinutes <= 16 * 60;
};

const INDEX_SYMBOLS: ReadonlySet<string> = new Set([
  'SPX', 'NDX', 'DJX', 'RUT', 'VIX', 'XSP', 'OEX', 'COMP',
]);

export const isIndexSymbol = (symbol: string | null | undefined): boolean => {
  if (!symbol) return false;
  const normalized = symbol.toUpperCase().replace(/^\$/, '');
  return INDEX_SYMBOLS.has(normalized);
};

export const isWithinTradingHoursForSymbol = (
  timestamp: string | Date,
  symbol: string | null | undefined,
): boolean =>
  isIndexSymbol(symbol)
    ? isWithinRegularMarketHours(timestamp)
    : isWithinExtendedMarketHours(timestamp);

/**
 * Whether the session string reported by /api/market/quote indicates the
 * symbol is currently in a live, trading session.  For indexes (SPX,
 * NDX, …) the backend reports "closed" outside the cash session because
 * indexes don't trade extended hours; for stocks/ETFs (SPY, QQQ, …) it
 * reports "closed" only outside 04:00–20:00 ET.  So treating "anything
 * not in the closed family" as live correctly covers both cases.  Used
 * to gate live-quote merging onto chart tip candles so closed-market
 * stale quotes don't paint as ghost data.
 */
export const isSessionLive = (session: string | null | undefined): boolean => {
  if (session == null) return false;
  switch (session) {
    case 'open':
    case 'pre-market':
    case 'after-hours':
    // Overnight futures display: the future is actively trading, so live
    // ticks should merge onto the chart tip candle just like a live session.
    case 'futures':
      return true;
    default:
      return false;
  }
};

export const omitClosedMarketTimes = <T>(
  data: T[],
  getTimestamp: (item: T) => string | Date
): T[] => data.filter((item) => isWithinExtendedMarketHours(getTimestamp(item)));

// Whether a bar series at this bucket size should have the intraday
// market-hours filter (omitClosedMarketTimes / omitOutOfHoursForSymbol)
// applied. Daily (and coarser) bars are whole-session markers stamped at UTC
// midnight, which reads as the PRIOR evening in ET; filtering them by intraday
// ET hours wrongly drops any session whose previous ET day is a weekend or
// holiday — most visibly every Monday, whose UTC-midnight stamp lands on
// Sunday 20:00 ET. Only sub-daily series carry overnight/weekend gaps that need
// trimming, so the filter applies to those alone.
export const shouldOmitClosedMarketTimes = (bucketMinutes: number): boolean =>
  bucketMinutes < 1440;

export const omitOutOfHoursForSymbol = <T>(
  data: T[],
  getTimestamp: (item: T) => string | Date,
  symbol: string | null | undefined,
): T[] => data.filter((item) => isWithinTradingHoursForSymbol(getTimestamp(item), symbol));

/**
 * Truncate an ISO timestamp to minute precision.
 * Returns the original string if it cannot be parsed.
 */
export function normalizeToMinute(ts: string): string;
export function normalizeToMinute(ts: string | undefined): string | null;
export function normalizeToMinute(ts: string | undefined): string | null {
  if (!ts) return null;
  const ms = new Date(ts).getTime();
  if (!Number.isFinite(ms)) return ts ?? null;
  return new Date(Math.floor(ms / 60_000) * 60_000).toISOString();
}

/**
 * Generate an array of ISO timestamps for every minute of a US-equity
 * regular session (09:30–16:00 ET) on the given YYYY-MM-DD date.
 */
export function getSessionTimestamps(dateKey: string): string[] {
  const [y, m, d] = dateKey.split('-').map(Number);
  if (!y || !m || !d) return [];

  const etFmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  let startMs: number | null = null;
  for (const utcH of [13, 14]) {
    const candidate = Date.UTC(y, m - 1, d, utcH, 30);
    const parts = etFmt.formatToParts(new Date(candidate));
    const h = Number(parts.find((p) => p.type === 'hour')?.value ?? -1);
    const min = Number(parts.find((p) => p.type === 'minute')?.value ?? -1);
    if (h === 9 && min === 30) { startMs = candidate; break; }
  }

  let endMs: number | null = null;
  for (const utcH of [20, 21]) {
    const candidate = Date.UTC(y, m - 1, d, utcH, 0);
    const parts = etFmt.formatToParts(new Date(candidate));
    const h = Number(parts.find((p) => p.type === 'hour')?.value ?? -1);
    const min = Number(parts.find((p) => p.type === 'minute')?.value ?? -1);
    if (h === 16 && min === 0) { endMs = candidate; break; }
  }

  if (startMs === null || endMs === null) return [];

  const result: string[] = [];
  for (let t = startMs; t <= endMs; t += 60_000) {
    result.push(new Date(t).toISOString());
  }
  return result;
}
