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
