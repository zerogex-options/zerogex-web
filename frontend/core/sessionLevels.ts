import type { SessionClosesData, SessionLevelsData } from '@/hooks/useApiData';

/**
 * The prior-day and pre-market reference levels the Gamma Chart prints in its
 * top row and, when the reader asks, draws on the tape: PDH / PDL / PDC (the
 * previous regular session's high, low and close) and PMH / PML (the
 * pre-market high and low of the day being traded).
 *
 * Highs and lows come from /api/market/session-levels. That endpoint carries
 * no close, so PDC is read off /api/market/session-closes, and the close used
 * is the one whose ET date IS the session the high and low describe. Matching
 * on the date rather than picking a field matters because the two endpoints
 * roll at different times: session-levels rolls at 04:00 ET, session-closes at
 * the 16:00 close. Through after-hours, PDH and PDL still describe yesterday
 * while `current_session_close` is already today's, so "the current close"
 * would put today's close beside yesterday's range and call it the prior day.
 *
 * Cash indexes have no pre-market and the endpoint serves them nothing; ES and
 * NQ trade nearly around the clock, so "pre-market" and "the prior day" are not
 * the same windows there. The chart only asks for ETFs.
 *
 * Deliberately free of runtime imports, like core/sessionCloses.ts, so the
 * tests can run straight against the source.
 */

export type SessionLevelKey = 'pdh' | 'pdl' | 'pdc' | 'pmh' | 'pml';

export interface SessionLevel {
  key: SessionLevelKey;
  /** The short code printed on the chart (PDH, PMH, …). */
  label: string;
  /** What the code stands for, for tooltips and screen readers. */
  name: string;
  value: number;
}

const DEFS: ReadonlyArray<{ key: SessionLevelKey; label: string; name: string }> = [
  { key: 'pdh', label: 'PDH', name: 'Previous day high' },
  { key: 'pdl', label: 'PDL', name: 'Previous day low' },
  { key: 'pdc', label: 'PDC', name: 'Previous day close' },
  { key: 'pmh', label: 'PMH', name: 'Pre-market high' },
  { key: 'pml', label: 'PML', name: 'Pre-market low' },
];

const ET_DATE = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/New_York',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const ET_CLOCK = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

const CASH_OPEN_MINUTE = 9 * 60 + 30;

function toDate(t: string | number | null | undefined): Date | null {
  if (t == null || t === '') return null;
  const d = new Date(t);
  return Number.isNaN(d.getTime()) ? null : d;
}

function etDateKey(t: string | number | null | undefined): string {
  const d = toDate(t);
  return d ? ET_DATE.format(d) : '';
}

function etMinuteOfDay(t: string | number): number | null {
  const d = toDate(t);
  if (!d) return null;
  let hour = NaN;
  let minute = NaN;
  for (const part of ET_CLOCK.formatToParts(d)) {
    if (part.type === 'hour') hour = Number(part.value);
    else if (part.type === 'minute') minute = Number(part.value);
  }
  return Number.isFinite(hour) && Number.isFinite(minute) ? hour * 60 + minute : null;
}

// A usable price, or null. A zero or negative price is a missing value that
// was serialized as a number, and would draw a line at the bottom of the axis.
function price(value: unknown): number | null {
  if (value == null || value === '') return null;
  const n = typeof value === 'string' ? Number(value) : (value as number);
  return typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * The regular-session close dated `sessionDate` (YYYY-MM-DD, ET), from
 * whichever of the two closes session-closes carries falls on that date, or
 * null when neither does.
 */
export function closeForSession(
  closes: SessionClosesData | null | undefined,
  sessionDate: string | null | undefined,
): number | null {
  if (!closes || !sessionDate) return null;
  if (etDateKey(closes.current_session_close_ts) === sessionDate) return price(closes.current_session_close);
  if (etDateKey(closes.prior_session_close_ts) === sessionDate) return price(closes.prior_session_close);
  return null;
}

/**
 * The levels to show, in display order (PDH, PDL, PDC, PMH, PML), leaving out
 * any the data does not support.
 *
 * `asOf` is the rewind clock (ms or an ISO string), or null for the live
 * chart. A rewound chart may only show what was known at that moment:
 *   • nothing at all unless the moment falls on the trading day these levels
 *     belong to. Rewound into yesterday, today's "previous day" is that same
 *     day's own range, which had not finished printing yet.
 *   • no pre-market levels before 09:30 ET, while the pre-market whose high
 *     and low they are was still being made.
 */
export function chartSessionLevels({
  levels,
  closes,
  asOf = null,
}: {
  levels: SessionLevelsData | null | undefined;
  closes: SessionClosesData | null | undefined;
  asOf?: string | number | null;
}): SessionLevel[] {
  if (!levels || levels.is_index) return [];
  let showPm = true;
  if (asOf != null) {
    if (!levels.trading_date || etDateKey(asOf) !== levels.trading_date) return [];
    const minute = etMinuteOfDay(asOf);
    showPm = minute != null && minute >= CASH_OPEN_MINUTE;
  }
  const values: Record<SessionLevelKey, number | null> = {
    pdh: price(levels.prev_session_high),
    pdl: price(levels.prev_session_low),
    pdc: closeForSession(closes, levels.prev_session_date),
    pmh: showPm ? price(levels.premarket_high) : null,
    pml: showPm ? price(levels.premarket_low) : null,
  };
  const out: SessionLevel[] = [];
  for (const d of DEFS) {
    const value = values[d.key];
    if (value != null) out.push({ key: d.key, label: d.label, name: d.name, value });
  }
  return out;
}
