// Supported UI languages. English is the default; the rest follow in the
// product-requested order (Italian, German, Spanish, French). Adding a
// language is a two-step change: extend LOCALES/LOCALE_META here and add a
// matching dictionary under ./dictionaries.

export const LOCALES = ['en', 'it', 'de', 'es', 'fr'] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'en';

export interface LocaleMeta {
  code: Locale;
  /** Native name (endonym) shown to the user in the picker. */
  label: string;
  /** English name, shown as a secondary line for recognition. */
  englishName: string;
  /** Flag emoji — a quick visual cue, not a substitute for the label. */
  flag: string;
}

export const LOCALE_META: LocaleMeta[] = [
  { code: 'en', label: 'English', englishName: 'English', flag: '🇺🇸' },
  { code: 'it', label: 'Italiano', englishName: 'Italian', flag: '🇮🇹' },
  { code: 'de', label: 'Deutsch', englishName: 'German', flag: '🇩🇪' },
  { code: 'es', label: 'Español', englishName: 'Spanish', flag: '🇪🇸' },
  { code: 'fr', label: 'Français', englishName: 'French', flag: '🇫🇷' },
];

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

// Accepts a bare code ("it"), a full BCP-47 tag ("it-IT"), or junk, and always
// returns a supported Locale — falling back to the default. Used when reading
// the persisted cookie/localStorage value, which is untrusted input.
export function normalizeLocale(value: string | null | undefined): Locale {
  if (!value) return DEFAULT_LOCALE;
  const lower = value.toLowerCase();
  if (isLocale(lower)) return lower;
  const base = lower.split('-')[0];
  return isLocale(base) ? base : DEFAULT_LOCALE;
}

export function localeMeta(code: Locale): LocaleMeta {
  return LOCALE_META.find((l) => l.code === code) ?? LOCALE_META[0];
}
