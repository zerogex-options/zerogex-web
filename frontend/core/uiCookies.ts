/**
 * Cookies for UI chrome state that the SERVER has to know about.
 *
 * localStorage is invisible to the server, so anything stored there can only
 * be applied after hydration — which means the server renders the default,
 * the browser paints it, and the page visibly rearranges itself a moment
 * later. Cookies ride along with the request, so the server can render the
 * right chrome first time. This is the same reason theme and palette are
 * cookies (see core/ThemeContext and the reads in app/layout.tsx).
 *
 * Those two providers each carry their own private copy of these helpers.
 * They are deliberately left alone here; new code should use this module, and
 * they can adopt it whenever they are next touched.
 */

// A year. These are preferences, not sessions.
const MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

export function readUiCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
}

export function writeUiCookie(name: string, value: string): void {
  if (typeof document === 'undefined') return;
  // SameSite=Lax so the cookie is present on top-level navigations, which is
  // exactly when the server needs it. Not HttpOnly: the client reads it too.
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${MAX_AGE_SECONDS}; SameSite=Lax`;
}

/** Cookie names shared by the client writers and the server-side reads. */
export const UI_COOKIE = {
  headerCollapsed: 'headerCollapsed',
  sidebarVisible: 'sidebarVisible',
} as const;

/** Width of the open sidebar. */
export const SIDEBAR_WIDTH = 272;

/**
 * Gutter reserved for the collapsed "Menu" tab. Navigation measures the real
 * tab after mount (its label is translated) and corrects this, but the server
 * has to commit to a number, and being a few pixels out beats being 203 out.
 */
export const MENU_TAB_WIDTH = 74;

/**
 * Horizontal space the nav occupies, given the sidebar state. The server
 * stamps this on <html> as --zgx-nav-width so the very first paint already
 * reserves the right gutter; Navigation keeps it in sync from there.
 */
export function navWidthFor(sidebarVisible: boolean): number {
  return sidebarVisible ? SIDEBAR_WIDTH : MENU_TAB_WIDTH;
}

/** Parse a cookie value written by usePersistedFlag. */
export function flagFromCookie(raw: string | undefined, fallback: boolean): boolean {
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  return fallback;
}
