import { DEFAULT_LOCALE, type Locale } from './locales';
import { en, type Dictionary, type TranslationKey } from './dictionaries/en';
import { it } from './dictionaries/it';
import { de } from './dictionaries/de';
import { es } from './dictionaries/es';
import { fr } from './dictionaries/fr';

export type { Dictionary, TranslationKey };
export {
  DEFAULT_LOCALE,
  LOCALES,
  LOCALE_META,
  localeMeta,
  isLocale,
  normalizeLocale,
  type Locale,
  type LocaleMeta,
} from './locales';

const DICTIONARIES: Record<Locale, Dictionary> = { en, it, de, es, fr };

export function getDictionary(locale: Locale): Dictionary {
  return DICTIONARIES[locale] ?? DICTIONARIES[DEFAULT_LOCALE];
}

// Look up a key in the given locale, falling back to English (then the raw key)
// if it's somehow missing. `vars` does simple {name} interpolation so a single
// string can carry a dynamic value without string concatenation at call sites.
export function translate(
  locale: Locale,
  key: TranslationKey,
  vars?: Record<string, string | number>,
): string {
  const dict = getDictionary(locale);
  let value: string = dict[key] ?? en[key] ?? key;
  if (vars) {
    for (const [name, replacement] of Object.entries(vars)) {
      value = value.replace(new RegExp(`\\{${name}\\}`, 'g'), String(replacement));
    }
  }
  return value;
}
