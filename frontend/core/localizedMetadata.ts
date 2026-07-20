import 'server-only';
import { cookies } from 'next/headers';
import { DEFAULT_LOCALE, normalizeLocale, type Locale } from '@/core/i18n/locales';

// Locale of the current request, read from the `lang` cookie. Used by
// generateMetadata() so page <title>/description match the reader's language.
// Reading the cookie opts the route into dynamic rendering — so this is used
// on routes that are already dynamic (article/content/marketing pages), not on
// the force-static SEO landing pages.
//
// NOTE: search crawlers send no cookie, so they receive the default-locale
// metadata. This localizes the browser tab / share preview for signed-in
// readers; it is NOT a substitute for real multilingual SEO (localized URLs +
// hreflang), which would be a separate routing change.
export async function getRequestLocale(): Promise<Locale> {
  try {
    const store = await cookies();
    return normalizeLocale(store.get('lang')?.value);
  } catch {
    return DEFAULT_LOCALE;
  }
}

// Pick the current-locale value from an { en, … } record, falling back to en.
export async function pickLocalized<T>(
  byLocale: { en: T } & Partial<Record<Locale, T>>,
): Promise<T> {
  const locale = await getRequestLocale();
  return byLocale[locale] ?? byLocale.en;
}
