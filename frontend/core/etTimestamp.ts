/**
 * Eastern wall-clock labels for UTC instants, with the UTC offset spelled out.
 *
 * The engine stamps everything in UTC, and a raw ISO string makes the reader
 * do the conversion in their head. An Action Card issued at
 * 2026-09-23T08:00:00Z was a 4:00 AM pre-market call, and the ISO form hid
 * that. The offset is printed next to the zone because it moves: UTC−4 under
 * daylight time, UTC−5 in winter.
 *
 * Pure and dependency-free so the node test runner can import it directly.
 */

const ET_TIMESTAMP_FMT = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
  timeZoneName: 'short',
});

const ET_TIME_FMT = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
});

// "GMT-4" / "GMT-5" for the same instant; reshaped to "UTC−4" below.
const ET_OFFSET_FMT = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  timeZoneName: 'shortOffset',
});

function parseInstant(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** "UTC−4" (daylight time) or "UTC−5" (standard time) at that instant. */
export function etUtcOffsetLabel(d: Date): string {
  const raw = ET_OFFSET_FMT.formatToParts(d).find((p) => p.type === 'timeZoneName')?.value ?? '';
  // ICU spells a zero offset as a bare "GMT". Typographic minus, matching the
  // "−0.31%" style the scorecard copy already uses.
  const offset = raw.replace(/^GMT/, '').replace('-', '−');
  return `UTC${offset}`;
}

/** "Sep 23, 2026, 4:00 AM EDT (UTC−4)", or null when the input is not a date. */
export function formatEtTimestamp(iso: string | null | undefined): string | null {
  const d = parseInstant(iso);
  if (!d) return null;
  return `${ET_TIMESTAMP_FMT.format(d)} (${etUtcOffsetLabel(d)})`;
}

/** "4:00 AM" in Eastern time, for rows under a heading that already names the day. */
export function formatEtTime(iso: string | null | undefined): string | null {
  const d = parseInstant(iso);
  return d ? ET_TIME_FMT.format(d) : null;
}
