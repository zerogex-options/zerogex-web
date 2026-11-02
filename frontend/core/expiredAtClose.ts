/**
 * The book after the close.
 *
 * After the 4:00 PM ET close the analytics engine keeps a cash-index session's
 * last snapshot (SPX, NDX, and ES / NQ projected from them) as the newest one
 * until the next open, and that snapshot still counts the day's expiring
 * contracts, priced in their final minutes. The API now leaves them out of
 * every read of the CURRENT book (the newest strike-profile bucket, the latest
 * by-strike rows, the summary's walls and Net GEX totals, the profile's walls)
 * and names the dates it removed in `expired_excluded`. Earlier buckets are
 * history and keep them.
 *
 * These helpers turn that field into the one-line note the strike panel, the
 * gamma ladders and the free gamma-levels pages show, so all three say the
 * same thing in the same words.
 */

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** The expirations a bucket (or summary) says were left out: unique ISO dates,
 *  ascending. Empty during the session, on history, and on anything that
 *  predates the field. */
export function expiredExcludedDates(source: { expired_excluded?: unknown } | null | undefined): string[] {
  const raw = source?.expired_excluded;
  if (!Array.isArray(raw)) return [];
  const dates = raw.filter((d): d is string => typeof d === 'string' && ISO_DATE.test(d));
  return [...new Set(dates)].sort();
}

// Noon UTC lands on the same calendar day in every US time zone, so the label
// never drifts a day for a reader west of New York.
function fmtDay(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-US', {
    timeZone: 'UTC',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

export interface ExpiredAtCloseNote {
  /** Short enough for a ladder column or the strike panel's header. */
  label: string;
  /** The tooltip: which day's options, and what the numbers show instead. */
  detail: string;
}

/**
 * Max Pain and the Pin Strike each describe ONE expiration. After the close
 * the API rolls both to the expiration that settles next and names it in
 * `rolled_to_expiration`; this is the line the level cards show for it, or
 * null during the session (when both describe the same-day expiration).
 */
export function rolledExpiryNote(iso: string | null | undefined): string | null {
  if (typeof iso !== 'string' || !ISO_DATE.test(iso)) return null;
  return `For the ${fmtDay(iso)} expiry`;
}

/** The note for a book the API rebuilt after the close, or null when it
 *  removed nothing (the session is open, or this is history). */
export function expiredAtCloseNote(dates: readonly string[]): ExpiredAtCloseNote | null {
  if (dates.length === 0) return null;
  const days = dates.map(fmtDay);
  const list = days.length === 1 ? days[0] : `${days.slice(0, -1).join(', ')} and ${days[days.length - 1]}`;
  return {
    label: 'Expired options removed',
    detail:
      `Options that expired at the close (${list}) are no longer counted. ` +
      'The bars and walls show the positioning that carries into the next session.',
  };
}
