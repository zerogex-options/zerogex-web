'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

type Theme = 'light' | 'dark';
export type Palette = 'walnut' | 'california' | 'pacific' | 'deluxe';

const PALETTES: Palette[] = ['walnut', 'california', 'pacific', 'deluxe'];

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  palette: Palette;
  setPalette: (palette: Palette) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

function getInitialTheme(): Theme {
  if (typeof window === 'undefined') return 'dark';
  const saved = localStorage.getItem('theme');
  return saved === 'light' || saved === 'dark' ? saved : 'dark';
}

function getInitialPalette(): Palette {
  if (typeof window === 'undefined') return 'walnut';
  const saved = localStorage.getItem('palette');
  return PALETTES.includes(saved as Palette) ? (saved as Palette) : 'walnut';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(getInitialTheme);
  const [palette, setPalette] = useState<Palette>(getInitialPalette);

  useEffect(() => {
    localStorage.setItem('theme', theme);
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('palette', palette);
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
