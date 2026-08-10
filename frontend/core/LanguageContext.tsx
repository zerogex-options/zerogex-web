'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { DEFAULT_LOCALE, type Locale } from '@/core/i18n/locales';
import { localeFromPathname, localeHref, stripLocalePrefix } from '@/core/i18n/routing';
import { translate, type TranslationKey } from '@/core/i18n';

// The language now lives in the URL path prefix (/it, /de, …); English is the
// unprefixed default. This provider derives the active locale from the URL so
// every translated client page (usePageT) tracks the page it's actually on,
// which is what makes a cookieless crawler see the right language. The `lang`
// cookie survives only as a hint the proxy uses to redirect the bare homepage.
const COOKIE_NAME = 'lang';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

function writeCookie(name: string, value: string) {
  if (typeof document === 'undefined') return;
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`;
}

interface LanguageContextType {
  locale: Locale;
  /** Switch language by NAVIGATING to the same page on the target locale's URL. */
  setLocale: (locale: Locale) => void;
  /** Translate a key in the active locale (with optional {name} interpolation). */
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({
  children,
  initialLocale = DEFAULT_LOCALE,
}: {
  children: ReactNode;
  // Server-seeded from the URL (the proxy's locale header) so SSR and the first
  // client render agree — used as the authoritative first-paint value.
  initialLocale?: Locale;
}) {
  const pathname = usePathname();
  const router = useRouter();

  // The URL is the source of truth. We seed from `initialLocale` (which the
  // server derived from the same URL) so the first client render matches SSR
  // exactly — no hydration flip on translated text — then reconcile to the
  // URL-derived locale on mount and on every client-side navigation.
  const [locale, setLocaleState] = useState<Locale>(initialLocale);

  useEffect(() => {
    const fromPath = localeFromPathname(pathname ?? '/');
    if (fromPath !== locale) setLocaleState(fromPath);
  }, [pathname, locale]);

  // Keep <html lang> in sync (server already set the correct value; this only
  // matters after a client-side language switch or soft navigation).
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = locale;
    }
  }, [locale]);

  const setLocale = useCallback(
    (next: Locale) => {
      // Persist the explicit choice as a hint (used only to redirect the bare
      // homepage to the localized one) and navigate to the current page on the
      // target locale's URL. The URL is authoritative, so `locale` updates when
      // the navigation lands.
      writeCookie(COOKIE_NAME, next);
      try {
        localStorage.setItem(COOKIE_NAME, next);
      } catch {
        // localStorage can throw in private mode; the cookie is the hint of
        // record, so a failure here is non-fatal.
      }
      const basePath = stripLocalePrefix(pathname ?? '/');
      const suffix =
        typeof window !== 'undefined' ? window.location.search + window.location.hash : '';
      router.push(`${localeHref(next, basePath)}${suffix}`);
    },
    [pathname, router],
  );

  const t = useCallback(
    (key: TranslationKey, vars?: Record<string, string | number>) => translate(locale, key, vars),
    [locale],
  );

  const value = useMemo<LanguageContextType>(() => ({ locale, setLocale, t }), [locale, setLocale, t]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }
  return context;
}

// Per-page dictionary: English is required (the fallback + key shape); the
// other locales are optional so a page can ship partially translated.
export type PageDictionary = { en: Record<string, string> } & Partial<
  Record<Locale, Record<string, string>>
>;

// Scoped translator for a single page/component. Each page imports its OWN
// co-located dictionary and calls usePageT(dict) — nothing is registered in a
// shared file, so any number of pages (and the agents that build them) can be
// worked on in parallel without ever touching the same module. Missing keys
// fall back to English, then to the raw key. Reads the active locale from the
// provider (URL-derived), so a localized URL renders the matching translation.
export function usePageT(dict: PageDictionary) {
  const { locale } = useLanguage();
  return useCallback(
    (key: string, vars?: Record<string, string | number>) => {
      const table = dict[locale] ?? dict.en;
      let value: string = table[key] ?? dict.en[key] ?? key;
      if (vars) {
        for (const [name, replacement] of Object.entries(vars)) {
          value = value.replace(new RegExp(`\\{${name}\\}`, 'g'), String(replacement));
        }
      }
      return value;
    },
    [dict, locale],
  );
}
