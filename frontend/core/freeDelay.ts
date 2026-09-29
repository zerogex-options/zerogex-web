// How far behind live the free, no-login surfaces run, in one place.
//
// The gamma-levels pages, the embed widget and card, llms.txt, /mcp, the
// education page's reading, the thinkorswim pre-fill and the public /chart all
// say their data is delayed about 15 minutes. That delay used to be nothing but
// a 900-second fetch cache, so a visitor saw data anywhere from a few seconds
// to fifteen minutes old, never the "at least fifteen minutes" the pages state.
// The backend now enforces it: every read these surfaces make carries
// `delay_minutes`, and the API answers with the newest data at least that old
// (zerogex-oa src/api/delayed_read.py). The cache is only load-shedding now, so
// it is short enough to keep the data close to the 15 minutes the labels say.
//
// Alias-free with no 'server-only', so the node --experimental-strip-types
// tests and the pure MCP shaping module can import it.

/** The free tier's delay. Every free read asks the backend for data this old. */
export const FREE_DELAY_MINUTES = 15;

export const FREE_DELAY_SECONDS = FREE_DELAY_MINUTES * 60;

/**
 * How long a delayed read is cached (the Next fetch cache and the free pages'
 * ISR). The backend's ceiling is one minute bucket behind the delay, so data
 * reaches a visitor 15 to 17 minutes old: "delayed ~15 minutes" stays true.
 */
export const FREE_REVALIDATE_SECONDS = 60;

/** A backend path with the free tier's delay applied. */
export function delayedPath(path: string): string {
  return `${path}${path.includes('?') ? '&' : '?'}delay_minutes=${FREE_DELAY_MINUTES}`;
}

/**
 * The instant delayed data is as of: the backend's ceiling, which sits one
 * one-minute bucket behind the delay. What the market session was THEN is what
 * a delayed read describes, not what it is now.
 */
export function delayedNow(now: Date = new Date()): Date {
  return new Date(now.getTime() - (FREE_DELAY_SECONDS + 60) * 1000);
}
