// Pure, environment-agnostic helpers for the API-key UI: deriving a key's base
// label, taming the label the user types, and phrasing "last used".
// Kept out of core/apiKeys.ts (which is `server-only`) so they can be
// unit-tested and used from client components without pulling in the
// server-only key client.

/** Longest device label we keep. The backend accepts 128 and may append a
 *  "-<N>" suffix; this shorter cap is what reads well in the account UI. */
export const MAX_KEY_LABEL_LENGTH = 40;

/**
 * The base label for a user's key: the local-part of their email (everything
 * before the first `@`), lower-cased and trimmed. The backend appends an
 * incrementing suffix on collision (`alice` → `alice-1` → …), so this only
 * needs to be a stable, human-recognisable base. Falls back to `key` for a
 * pathological empty local-part.
 */
export function emailLocalPart(email: string): string {
  const local = (email.split('@')[0] ?? '').trim().toLowerCase();
  return local || 'key';
}

/**
 * Normalise the device label the user typed ("desktop", "NinjaTrader").
 * Control characters go, whitespace runs collapse, and the result is capped.
 * Returns `''` when nothing usable remains, so callers can fall back rather
 * than sending junk — see {@link resolveKeyLabel}.
 *
 * Case is deliberately preserved: this is the user's own name for their
 * machine, and "NinjaTrader" should come back as they typed it.
 */
export function sanitizeKeyLabel(raw: string): string {
  const printable = raw.replace(/[\u0000-\u001F\u007F-\u009F]/g, ' ');
  return printable.trim().replace(/\s+/g, ' ').slice(0, MAX_KEY_LABEL_LENGTH).trim();
}

/**
 * The label to send when minting: what the user typed, or their email
 * local-part when they left the field empty (preserving the pre-label naming
 * for anyone who doesn't care to name their machines).
 */
export function resolveKeyLabel(email: string, raw: string | null | undefined): string {
  return sanitizeKeyLabel(raw ?? '') || emailLocalPart(email);
}

// Largest unit first; each entry is [seconds in one unit, singular noun].
const RELATIVE_UNITS: ReadonlyArray<readonly [number, string]> = [
  [365 * 24 * 3600, 'year'],
  [30 * 24 * 3600, 'month'],
  [24 * 3600, 'day'],
  [3600, 'hour'],
  [60, 'minute'],
];

/**
 * Phrase a key's `last_used_at` for the account UI.
 *
 * This is the most useful signal on the page: a user who can't remember
 * whether a key is still live can read the answer here instead of
 * regenerating to find out — which, under the old one-key rule, is precisely
 * what turned a working key into a dead one.
 *
 * Deliberately relative and locale-free ("last used 2 minutes ago") rather
 * than a formatted date, so it stays pure and testable and reads as a
 * liveness signal rather than a log entry. A `null` timestamp — a key that has
 * never authenticated — is reported plainly as `never used`.
 */
export function formatLastUsed(iso: string | null | undefined, nowMs: number): string {
  if (!iso) return 'never used';
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return 'never used';

  // Clamp: clock skew between the API host and the browser must not produce
  // "last used in 3 seconds".
  const seconds = Math.max(0, Math.floor((nowMs - then) / 1000));
  for (const [unitSeconds, noun] of RELATIVE_UNITS) {
    const n = Math.floor(seconds / unitSeconds);
    if (n >= 1) return `last used ${n} ${noun}${n === 1 ? '' : 's'} ago`;
  }
  return 'last used just now';
}
