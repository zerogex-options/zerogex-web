'use client';

import { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { getCsrfToken } from '@/core/csrfClient';
import {
  DEFAULT_PALETTE,
  DEFAULT_THEME,
  PALETTES,
  normalizePalette,
  normalizeTheme,
  type PaletteId,
  type Theme,
} from '@/core/appearance';

// Vocabulary lives in core/appearance so the server layout and this provider
// validate against one list. `Palette` is re-exported because callers across
// the app import it from here.
export type Palette = PaletteId;
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

// Guarded localStorage read. Accessing `localStorage` can THROW (not just on
// write) — Safari with "Block all cookies" enabled, some privacy/lockdown
// modes, and partitioned third-party contexts raise SecurityError on the
// property access itself. Theme and palette are already persisted to cookies
// (the SSR source of truth), so a storage failure safely falls back to the
// cookie value / default. This must never throw: ThemeProvider is the
// outermost provider in the root layout, so an unguarded throw here escapes
// hydration with no error boundary above it and white-screens every page.
function readStoredValue(name: string): string | null {
  try {
    return localStorage.getItem(name);
  } catch {
    return null;
  }
}

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  palette: Palette;
  setPalette: (palette: Palette) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);



export function ThemeProvider({
  children,
  // What the SERVER read from the cookies, so the provider's first render
  // matches the markup the server sent. Seeding this from the cookie on the
  // client instead (the old getInitialTheme/getInitialPalette path) meant the
  // server always assumed the dark default while the client knew better, so
  // every page load in the light theme was a hydration mismatch — measured at
  // 6 loads in 6 before this, 0 after. Dark was unaffected, which is why it
  // went unnoticed.
  initialTheme = DEFAULT_THEME,
  initialPalette = DEFAULT_PALETTE,
}: {
  children: ReactNode;
  initialTheme?: Theme;
  initialPalette?: Palette;
}) {
  const [theme, setTheme] = useState<Theme>(initialTheme);
  const [palette, setPalette] = useState<Palette>(initialPalette);

  // Adopt a preference that only ever reached localStorage — someone who last
  // set their theme before it moved to a cookie. Nothing has written
  // localStorage here for some time, so this is legacy support, and the
  // effects below put the value in the cookie straight after: it runs once,
  // and that member is on the server-rendered path from their next load on.
  //
  // Deferred a microtask rather than set during the effect: the adoption is
  // rare and one-shot, and there is no reason for it to force a second render
  // pass synchronously inside the commit for the overwhelming majority of
  // loads that have a cookie and skip it entirely.
  useEffect(() => {
    const storedTheme = readCookie('theme') === null ? readStoredValue('theme') : null;
    const storedPalette = readCookie('palette') === null ? readStoredValue('palette') : null;
    if (!storedTheme && !storedPalette) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      if (storedTheme) setTheme(normalizeTheme(storedTheme));
      if (storedPalette) setPalette(normalizePalette(storedPalette));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    writeCookie('theme', theme);
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  useEffect(() => {
    writeCookie('palette', palette);
    const root = document.documentElement;
    PALETTES.forEach((p) => root.classList.toggle(`palette-${p}`, p === palette));
  }, [palette]);

  // Mirror the choice onto the account, so it survives this browser. The
  // cookie above is still what paints the page; this is what puts the same
  // look on a second device, and what brings it back when the cookie is
  // cleared or expired early (Safari's ITP and Brave's shields both cut
  // script-written cookies short). Signed-out visitors get a 401 and keep the
  // cookie-only behaviour — nothing is surfaced either way, because a
  // preference that did not sync is not worth interrupting anyone over.
  const savedRef = useRef<string | null>(null);
  useEffect(() => {
    const desired = `${theme}:${palette}`;
    // Skip the write triggered by simply loading the page in whatever the
    // cookie already said; only an actual change is worth a request.
    if (savedRef.current === null) {
      savedRef.current = desired;
      return;
    }
    if (savedRef.current === desired) return;
    savedRef.current = desired;

    let cancelled = false;
    void (async () => {
      try {
        const csrf = await getCsrfToken();
        if (cancelled || !csrf) return;
        await fetch('/api/account/appearance', {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-csrf-token': csrf },
          body: JSON.stringify({ theme, palette }),
          credentials: 'same-origin',
          cache: 'no-store',
        });
      } catch {
        // Offline, signed out, or the request was refused — the cookie still
        // holds the choice for this browser.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [theme, palette]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, palette, setPalette }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}
