'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { DEFAULT_LOCALE, normalizeLocale, type Locale } from '@/core/i18n/locales';
import { translate, type TranslationKey } from '@/core/i18n';

// The persisted-language cookie. Read server-side in app/layout.tsx so the
// first HTML paint is already in the user's language (and matches this
// provider's first client render — no hydration mismatch on translated text).
const COOKIE_NAME = 'lang';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie
    .split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
}

function writeCookie(name: string, value: string) {
  if (typeof document === 'undefined') return;
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`;
}

interface LanguageContextType {
  locale: Locale;
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
  // Seeded from the server-read cookie so SSR and the first client render agree.
  initialLocale?: Locale;
}) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    writeCookie(COOKIE_NAME, next);
    try {
      localStorage.setItem(COOKIE_NAME, next);
    } catch {
      // localStorage can throw in private mode; the cookie is the source of
      // truth for SSR, so a failure here is non-fatal.
    }
    if (typeof document !== 'undefined') {
      document.documentElement.lang = next;
    }
  }, []);

  // Keep <html lang> in sync on client-side navigation / initial mount. The
  // server already set the correct value from the cookie, so this is a no-op
  // on the common path and only matters after setLocale or a soft nav.
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = locale;
    }
  }, [locale]);

  // Self-heal: if the SSR cookie was absent/expired but the user previously
  // chose a language (mirrored to localStorage), adopt it now and restore the
  // cookie so future paints match. Guarded on a missing cookie, so the common
  // case (cookie present) never triggers a post-hydration text flip.
  useEffect(() => {
    try {
      if (readCookie(COOKIE_NAME)) return;
      const stored = localStorage.getItem(COOKIE_NAME);
      if (!stored) return;
      const normalized = normalizeLocale(stored);
      if (normalized !== locale) {
        setLocale(normalized);
      } else {
        writeCookie(COOKIE_NAME, normalized);
      }
    } catch {
      // No storage access — nothing to reconcile.
    }
    // Run once on mount; setLocale is stable and locale is only the seed here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const t = useCallback(
    (key: TranslationKey, vars?: Record<string, string | number>) => translate(locale, key, vars),
    [locale],
  );

  return (
    <LanguageContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }
  return context;
}
