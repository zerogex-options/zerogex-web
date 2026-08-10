'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

type Theme = 'light' | 'dark';
export type Palette =
  | 'zerogex-og'
  | 'mars'
  | 'california'
  | 'kyoto'
  | 'wallstreet'
  | 'london'
  | 'zurich'
  | 'maldives'
  | 'tulum'
  | 'vinyl-topanga'
  | 'monochrome-madison'
  | 'palm-springs';

const PALETTES: Palette[] = [
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
const DEFAULT_PALETTE: Palette = 'zerogex-og';
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

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  palette: Palette;
  setPalette: (palette: Palette) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

function getInitialTheme(): Theme {
  if (typeof document === 'undefined') return 'dark';
  const saved = readCookie('theme') ?? localStorage.getItem('theme');
  return saved === 'light' || saved === 'dark' ? saved : 'dark';
}

function getInitialPalette(): Palette {
  if (typeof document === 'undefined') return DEFAULT_PALETTE;
  const saved = readCookie('palette') ?? localStorage.getItem('palette');
  // Migrate legacy/retired IDs to a valid palette so an old saved preference
  // never resolves to nothing (walnut/pacific/deluxe were earlier renames;
  // miami/monaco/amalfi were retired in favor of the three newer themes).
  const legacyMap: Record<string, Palette> = {
    walnut: 'kyoto',
    deluxe: 'wallstreet',
    pacific: 'palm-springs',
    miami: 'palm-springs',
    monaco: 'monochrome-madison',
    amalfi: 'palm-springs',
  };
  const normalized = saved && legacyMap[saved] ? legacyMap[saved] : saved;
  return PALETTES.includes(normalized as Palette) ? (normalized as Palette) : DEFAULT_PALETTE;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(getInitialTheme);
  const [palette, setPalette] = useState<Palette>(getInitialPalette);

  useEffect(() => {
    writeCookie('theme', theme);
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  useEffect(() => {
    writeCookie('palette', palette);
    const root = document.documentElement;
    PALETTES.forEach((p) => root.classList.toggle(`palette-${p}`, p === palette));
  }, [palette]);

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
