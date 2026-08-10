import 'server-only';
import { cookies, headers } from 'next/headers';
import type { Metadata } from 'next';
import { DEFAULT_LOCALE, normalizeLocale, type Locale } from '@/core/i18n/locales';
import {
  INVARIANT_PATH_HEADER,
  LOCALE_HEADER,
  buildAlternates,
  stripLocalePrefix,
} from '@/core/i18n/routing';
import { articleMetadata } from '@/core/articleRegistry';

// Re-export the pure alternates builder so pages/helpers can pull canonical +
// hreflang from one import alongside the request-locale resolver.
export { buildAlternates };

// Server-side locale resolution for the localized-URL scheme.
//
// The proxy (middleware) is the single source of truth: it reads the locale
// from the URL path prefix and forwards it on the rewritten request as the
// `x-zgx-locale` header (plus the un-prefixed path as `x-zgx-invariant-path`).
// Everything server-rendered — content resolvers, `<html lang>`, and
// `generateMetadata` — reads the locale from here so the whole render agrees
// with the URL, not with the old `lang` cookie. The cookie survives only as a
// fallback (e.g. a request that somehow bypassed the proxy) and as the redirect
// hint on `/`.

// The URL locale for the current request. Header first (set by the proxy from
// the path), then the legacy `lang` cookie, then English. Safe outside a
// request scope (static generation) — returns the default.
export async function getRequestLocale(): Promise<Locale> {
  try {
    const headerStore = await headers();
    const fromHeader = headerStore.get(LOCALE_HEADER);
    if (fromHeader) return normalizeLocale(fromHeader);
  } catch {
    // Not in a request scope (or headers unavailable) — fall through.
  }
  try {
    const cookieStore = await cookies();
    return normalizeLocale(cookieStore.get('lang')?.value);
  } catch {
    return DEFAULT_LOCALE;
  }
}

// The un-prefixed ("invariant") path for the current request, e.g.
// `/education/foo` even when the browser URL is `/it/education/foo`. Used to
// build canonical + hreflang alternates. Falls back to `/` when unknown.
export async function getInvariantPath(): Promise<string> {
  try {
    const headerStore = await headers();
    const fromHeader = headerStore.get(INVARIANT_PATH_HEADER);
    if (fromHeader) return stripLocalePrefix(fromHeader);
  } catch {
    // Not in a request scope — fall through.
  }
  return '/';
}

// Choose a value from a locale-keyed record for the current locale, falling
// back to the English entry (then undefined). Handy for the occasional
// server-side string that has a small inline translation table.
export function pickLocalized<T>(
  table: Partial<Record<Locale, T>>,
  locale: Locale,
): T | undefined {
  return table[locale] ?? table[DEFAULT_LOCALE];
}

// Convenience: resolve both the locale and the alternates block in one call for
// a `generateMetadata` that just needs hreflang on the current route. Pass the
// route's un-prefixed path (usually a literal, e.g. '/pricing').
export async function alternatesForPath(
  invariantPath: string,
): Promise<NonNullable<Metadata['alternates']>> {
  const locale = await getRequestLocale();
  return buildAlternates(invariantPath, locale);
}

// Locale-aware article metadata for a `generateMetadata` export. Resolves the
// URL locale (so the canonical + OG url point at the current-language page) and
// delegates the rest to the registry helper. Lets a registered article/landing
// page swap `export const metadata = articleMetadata('slug')` for
// `export const generateMetadata = () => articleMetadataLocalized('slug')`.
export async function articleMetadataLocalized(slug: string): Promise<Metadata> {
  return articleMetadata(slug, await getRequestLocale());
}
