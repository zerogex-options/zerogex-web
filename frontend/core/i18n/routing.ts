// URL <-> locale mapping for the localized-URL SEO scheme.
//
// English is the default locale and is served on the EXISTING unprefixed URLs
// (`/education/foo`), so it never carries a path prefix. The other four locales
// are served under a locale path prefix (`/it/education/foo`, `/de/...`). This
// module is the single source of truth for that mapping, shared by:
//   - proxy.ts        (detect locale, rewrite `/it/x` -> `/x`, gate auth)
//   - localizedMetadata.ts (canonical + hreflang alternates)
//   - LanguageContext / LocalizedLink / localeHref (locale-aware navigation)
//
// Keeping it framework-free (no next/* imports) means it runs unchanged in the
// middleware, on the server, and in the browser.

import type { Metadata } from 'next';
import { DEFAULT_LOCALE, LOCALES, isLocale, type Locale } from './locales';

// Request headers the proxy (middleware) sets on the rewritten request so the
// downstream server render can recover the URL locale and the un-prefixed path
// without re-parsing. Read via next/headers on the server (see
// core/localizedMetadata.ts). Named with a vendor prefix to avoid collision.
export const LOCALE_HEADER = 'x-zgx-locale';
export const INVARIANT_PATH_HEADER = 'x-zgx-invariant-path';

// The locales that appear as a URL path prefix — everything except the default
// (English), which is unprefixed by construction. Order follows LOCALES.
export const PREFIXED_LOCALES: readonly Locale[] = LOCALES.filter(
  (l): l is Locale => l !== DEFAULT_LOCALE,
);

// True when the first path segment is a non-default locale prefix (`/it/...`).
function prefixLocale(pathname: string): Locale | null {
  const seg = pathname.split('/', 2)[1]?.toLowerCase();
  if (seg && isLocale(seg) && seg !== DEFAULT_LOCALE) return seg;
  return null;
}

// The locale a pathname resolves to. A `/it`, `/de`, `/es`, `/fr` prefix wins;
// anything else (including a bare `/`, an `/en/...` path, or a normal English
// route) resolves to the default locale.
export function localeFromPathname(pathname: string): Locale {
  return prefixLocale(pathname) ?? DEFAULT_LOCALE;
}

// Strip a leading locale prefix, returning the "invariant" path that the
// physical Next route tree actually serves (always English-shaped):
//   `/it/education/foo` -> `/education/foo`
//   `/it`               -> `/`
//   `/education/foo`    -> `/education/foo` (unchanged)
// Query strings and hashes are preserved because only the first segment is
// examined. Idempotent: calling it on an already-stripped path is a no-op.
export function stripLocalePrefix(pathname: string): string {
  const locale = prefixLocale(pathname);
  if (!locale) return pathname;
  const rest = pathname.slice(locale.length + 1); // drop "/it"
  return rest.startsWith('/') ? rest : `/${rest}`;
}

// Parse an Accept-Language header and return the visitor's top-preference
// SUPPORTED locale, or null when English (the default) ranks first or nothing
// matches. Used only as the last fallback when choosing where to redirect the
// bare homepage (URL prefix -> `lang` cookie -> Accept-Language), never to
// override an explicit choice and never on a deep link.
export function preferredLocaleFromAcceptLanguage(
  header: string | null | undefined,
): Locale | null {
  if (!header) return null;
  const ranked = header
    .split(',')
    .map((part) => {
      const [tag, ...params] = part.trim().split(';');
      const qParam = params.find((p) => p.trim().startsWith('q='));
      const q = qParam ? Number.parseFloat(qParam.split('=')[1]) : 1;
      return { code: tag.split('-')[0].toLowerCase(), q: Number.isFinite(q) ? q : 0 };
    })
    .sort((a, b) => b.q - a.q);
  for (const { code } of ranked) {
    if (!isLocale(code)) continue; // skip unsupported languages, keep scanning
    return code === DEFAULT_LOCALE ? null : code; // first supported wins
  }
  return null;
}

// Build the public URL for an invariant path in a given locale. English returns
// the path unchanged (unprefixed); other locales get a `/xx` prefix. Only
// root-relative internal paths are rewritten — external URLs, protocol-relative
// URLs, anchors, and `mailto:`/`tel:` hrefs pass through untouched so this is
// safe to apply blanketly at link sites. Any existing locale prefix on the
// input is normalized first, so re-localizing a link is always correct.
export function localeHref(locale: Locale, href: string): string {
  if (!href.startsWith('/') || href.startsWith('//')) return href;
  const invariant = stripLocalePrefix(href);
  if (locale === DEFAULT_LOCALE) return invariant;
  return invariant === '/' ? `/${locale}` : `/${locale}${invariant}`;
}

// Build the `alternates` block (self-referencing canonical + hreflang languages)
// for a page, given its un-prefixed path and the locale being rendered. Paths
// are left RELATIVE — Next resolves them against `metadataBase`
// (https://zerogex.io, set in app/layout.tsx) — matching the existing
// `alternates: { canonical }` convention. Pure (no next/* runtime imports) so it
// runs in both client- and server-imported modules:
//   - canonical -> the current locale's own URL (self-referencing)
//   - languages -> every locale's URL + an `x-default` pointing at English
export function buildAlternates(
  invariantPath: string,
  locale: Locale = DEFAULT_LOCALE,
): NonNullable<Metadata['alternates']> {
  const languages: Record<string, string> = {};
  for (const l of LOCALES) {
    languages[l] = localeHref(l, invariantPath);
  }
  languages['x-default'] = localeHref(DEFAULT_LOCALE, invariantPath);

  return {
    canonical: localeHref(locale, invariantPath),
    languages,
  };
}
