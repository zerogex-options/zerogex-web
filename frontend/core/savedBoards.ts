/**
 * Rules for named boards on My Dashboard — the parts that are pure.
 *
 * Kept out of core/serverAuth so they can be tested directly: that module
 * imports next/headers and cannot be loaded outside a Next runtime, which
 * would leave this logic covered only through a live session.
 */

/** How many boards one account may keep. Generous, but not unbounded. */
export const MAX_SAVED_LAYOUTS = 25;

/** Longest board name stored: descriptive enough to be useful, short enough to render. */
export const MAX_LAYOUT_NAME_LENGTH = 60;

/**
 * Ceiling on a stored board blob. A board holding every widget serializes to a
 * few KB; this sits far above that and exists so a malformed or hostile payload
 * cannot be used to fill the table.
 */
export const MAX_LAYOUT_BYTES = 64 * 1024;

/**
 * Collapse runs of whitespace and trim.
 *
 * A board name is what the member picks it out by in the switcher, so two
 * boards that LOOK identically named have to collide rather than sit next to
 * each other indistinguishable. UNIQUE(user_id, name) only catches exact
 * duplicates, so " Morning  Read " has to become "Morning Read" before it
 * reaches the database or the constraint never fires.
 *
 * Case is deliberately preserved: renaming "morning read" to "Morning Read" is
 * a real change a member may want, and normalizing it away would silently
 * reject it.
 */
export function normalizeLayoutName(raw: unknown): string {
  return typeof raw === 'string' ? raw.replace(/\s+/g, ' ').trim() : '';
}
