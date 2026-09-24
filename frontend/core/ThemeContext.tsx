'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { getCsrfToken } from '@/core/csrfClient';
import {
  APPEARANCE_PENDING_COOKIE,
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

function clearCookie(name: string) {
  if (typeof document === 'undefined') return;
  document.cookie = `${name}=; path=/; max-age=0; SameSite=Lax`;
}

type Look = { theme: Theme; palette: Palette };

const lookKey = (look: Look) => `${look.theme}:${look.palette}`;

/**
 * Save the look to the account. True once the account holds it, or once it is
 * clear there is no account to save to (signed out): either way this browser
 * no longer carries an unsaved change. False when the save should be retried.
 */
async function saveLookToAccount(look: Look): Promise<boolean> {
  try {
    const csrf = await getCsrfToken();
    if (!csrf) return false;
    const res = await fetch('/api/account/appearance', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-csrf-token': csrf },
      body: JSON.stringify(look),
      credentials: 'same-origin',
      cache: 'no-store',
    });
    return res.ok || res.status === 401;
  } catch {
    return false;
  }
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
  // The server painted the member's account copy, not this browser's cookies
  // (see resolveAppearance). An older browser-only value must not replace it.
  fromAccount = false,
  // The server found a look the account should hold but does not: one picked
  // before it moved onto the account, or a change whose save never landed.
  syncToAccount = false,
}: {
  children: ReactNode;
  initialTheme?: Theme;
  initialPalette?: Palette;
  fromAccount?: boolean;
  syncToAccount?: boolean;
}) {
  const [theme, setTheme] = useState<Theme>(initialTheme);
  const [palette, setPalette] = useState<Palette>(initialPalette);

  // Adopt a preference that only ever reached localStorage — someone who last
  // set their theme before it moved to a cookie. Nothing has written
  // localStorage here for some time, so this is legacy support, and the
  // effects below put the value in the cookie straight after: it runs once,
  // and that member is on the server-rendered path from their next load on.
  // Skipped when the page painted the account's copy: that is the member's
  // current choice, and a years-old browser value must not overwrite it.
  //
  // Deferred a microtask rather than set during the effect: the adoption is
  // rare and one-shot, and there is no reason for it to force a second render
  // pass synchronously inside the commit for the overwhelming majority of
  // loads that have a cookie and skip it entirely.
  useEffect(() => {
    if (fromAccount) return;
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
  }, [fromAccount]);

  useEffect(() => {
    writeCookie('theme', theme);
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  useEffect(() => {
    writeCookie('palette', palette);
    const root = document.documentElement;
    PALETTES.forEach((p) => root.classList.toggle(`palette-${p}`, p === palette));
  }, [palette]);

  // Tint the phone browser's own chrome — Android Chrome's address bar, the
  // iOS status-bar area — with the page ground, so the app does not sit under
  // a white bar in a dark theme. Read back from the resolved CSS rather than a
  // table of hex values, so it follows every palette (and any palette added
  // later) without a second copy of the colours. Declared after the two class
  // effects above, so the classes it depends on are already applied.
  useEffect(() => {
    const color = getComputedStyle(document.documentElement).getPropertyValue('--bg-main').trim();
    if (!color) return;
    let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'theme-color';
      document.head.appendChild(meta);
    }
    meta.content = color;
  }, [theme, palette]);

  // Mirror the choice onto the account, so it survives this browser. The
  // cookie above paints the page, but for a signed-in member the server
  // paints from the account copy (see resolveAppearance), which is what puts
  // the same look on a second device and brings it back when the cookie is
  // cleared or expired early (Safari's ITP and Brave's shields both cut
  // script-written cookies short). Signed-out visitors get a 401 and keep the
  // cookie-only behaviour — nothing is surfaced either way, because a
  // preference that did not sync is not worth interrupting anyone over.
  //
  // Saves run one at a time and each sends the latest choice, so two quick
  // changes cannot land out of order and leave the account on the older one.
  const latestRef = useRef<Look>({ theme: initialTheme, palette: initialPalette });
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const queueSave = useCallback(() => {
    saveQueueRef.current = saveQueueRef.current.then(async () => {
      const sent = latestRef.current;
      const saved = await saveLookToAccount(sent);
      // Clear the unsaved mark only if nothing newer was picked meanwhile;
      // a failed save keeps it, and the next page load tries again.
      if (saved && lookKey(latestRef.current) === lookKey(sent)) {
        clearCookie(APPEARANCE_PENDING_COOKIE);
      }
    });
  }, []);

  const savedRef = useRef<string | null>(null);
  useEffect(() => {
    latestRef.current = { theme, palette };
    const desired = lookKey({ theme, palette });
    // Skip the write triggered by simply loading the page in whatever the
    // account or cookie already said; only an actual change is worth a request.
    if (savedRef.current === null) {
      savedRef.current = desired;
      return;
    }
    if (savedRef.current === desired) return;
    savedRef.current = desired;

    // Marked unsaved until the account confirms it. While marked, the server
    // paints this browser's choice over the account's older copy, so a reload
    // before the save lands, or a save that failed, cannot undo the change.
    writeCookie(APPEARANCE_PENDING_COOKIE, '1');
    queueSave();
  }, [theme, palette, queueSave]);

  // Once per page load: finish a save that never landed, or copy a look up
  // that the account has never held (see syncToAccount above).
  const loadSyncRef = useRef(false);
  useEffect(() => {
    if (loadSyncRef.current) return;
    loadSyncRef.current = true;
    if (syncToAccount || readCookie(APPEARANCE_PENDING_COOKIE) === '1') queueSave();
  }, [syncToAccount, queueSave]);

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
