/**
 * The site's appearance vocabulary — theme and palette — in one place.
 *
 * These lists were previously written out twice: once in app/layout.tsx, which
 * validates the cookie before stamping the class on <html>, and once in
 * core/ThemeContext, which owns the live value. Two copies of a list that has
 * to agree is a standing bug: a palette added to one and not the other paints
 * on the client and then fails validation on the server, or the reverse.
 *
 * Plain module, no 'use client' — the server layout and the client provider
 * both import it.
 */

export type Theme = 'light' | 'dark';

export const THEMES: readonly Theme[] = ['light', 'dark'] as const;
export const DEFAULT_THEME: Theme = 'dark';

export type PaletteId =
  | 'zerogex-og'
  | 'mars'
  | 'california'
  | 'wallstreet'
  | 'kyoto'
  | 'london'
  | 'zurich'
  | 'maldives'
  | 'tulum'
  | 'vinyl-topanga'
  | 'monochrome-madison'
  | 'palm-springs';

export const PALETTES: PaletteId[] = [
  'zerogex-og',
  'mars',
  'california',
  'wallstreet',
  'kyoto',
  'london',
  'zurich',
  'maldives',
  'tulum',
  'vinyl-topanga',
  'monochrome-madison',
  'palm-springs',
];

export const DEFAULT_PALETTE: PaletteId = 'zerogex-og';

/**
 * Retired palette ids map to their nearest successor so a preference saved
 * under an old name never resolves to nothing. walnut/pacific/deluxe were
 * earlier renames; miami/monaco/amalfi were retired for the three newer
 * themes.
 */
export const LEGACY_PALETTE_MAP: Record<string, PaletteId> = {
  walnut: 'kyoto',
  deluxe: 'wallstreet',
  pacific: 'palm-springs',
  miami: 'palm-springs',
  monaco: 'monochrome-madison',
  amalfi: 'palm-springs',
};

/** Resolve any stored/received palette id, including retired ones. */
export function normalizePalette(raw: string | null | undefined): PaletteId {
  if (!raw) return DEFAULT_PALETTE;
  const mapped = LEGACY_PALETTE_MAP[raw] ?? raw;
  return PALETTES.includes(mapped as PaletteId) ? (mapped as PaletteId) : DEFAULT_PALETTE;
}

/** Resolve any stored/received theme value. */
export function normalizeTheme(raw: string | null | undefined): Theme {
  return raw === 'light' || raw === 'dark' ? raw : DEFAULT_THEME;
}

/** Cookie names. The server reads these to paint the first response correctly. */
export const THEME_COOKIE = 'theme';
export const PALETTE_COOKIE = 'palette';

/**
 * Set by the client when the member changes their look, and cleared once the
 * account confirms it saved the change. While it is present, this browser holds
 * the newest choice anywhere, so it must not be overruled by the account copy.
 */
export const APPEARANCE_PENDING_COOKIE = 'appearance_pending';

/** The theme and palette stored on a member's account; null where never saved. */
export type AccountAppearance = { theme: string | null; palette: string | null };

export type ResolvedAppearance = {
  theme: Theme;
  palette: PaletteId;
  /** Painted from the account rather than from this browser's cookies. */
  fromAccount: boolean;
  /** Ask the client to save what it paints to the account. */
  syncToAccount: boolean;
};

/**
 * Decide which theme and palette a request paints.
 *
 * The cookies paint the page, but browsers drop them: Brave's shields, Safari's
 * ITP and a cleared cache all do. Once the page has painted the default, the
 * client writes the default back into the cookie, so the loss becomes
 * permanent unless something puts the member's choice back. For a signed-in
 * member that something is the account: its copy wins whenever it holds a
 * value, which also carries a change made on another device over to this one.
 *
 * The one exception is a change made in this browser that the account has not
 * confirmed yet (`pending`). That change is the newest choice anywhere, so it
 * stands, and the client is asked to save it again.
 *
 * An account with nothing saved belongs to a member who picked their look
 * before it moved onto the account. Their browser's choice stands and is
 * copied up, unless it is the untouched default, which needs no saving.
 *
 * `account` is null for signed-out visitors, whose cookies are all there is.
 */
export function resolveAppearance(input: {
  cookieTheme?: string | null;
  cookiePalette?: string | null;
  pending?: boolean;
  account?: AccountAppearance | null;
}): ResolvedAppearance {
  const theme = normalizeTheme(input.cookieTheme);
  const palette = normalizePalette(input.cookiePalette);
  const account = input.account ?? null;

  if (!account) return { theme, palette, fromAccount: false, syncToAccount: false };
  if (input.pending) return { theme, palette, fromAccount: false, syncToAccount: true };

  if (account.theme || account.palette) {
    return {
      theme: account.theme ? normalizeTheme(account.theme) : theme,
      palette: account.palette ? normalizePalette(account.palette) : palette,
      fromAccount: true,
      syncToAccount: false,
    };
  }

  return {
    theme,
    palette,
    fromAccount: false,
    syncToAccount: theme !== DEFAULT_THEME || palette !== DEFAULT_PALETTE,
  };
}
