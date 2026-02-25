'use client';

import { Moon, Sun } from 'lucide-react';
import { Theme } from '@/lib/types';
import { colors } from '@/lib/colors';

interface ThemeToggleProps {
  theme: Theme;
  onToggle: () => void;
}

export default function ThemeToggle({ theme, onToggle }: ThemeToggleProps) {
  return (
    <button
      onClick={onToggle}
      className="p-2 rounded-lg hover:scale-105 transition-all duration-200"
      style={{
        backgroundColor: theme === 'dark' ? colors.cardDark : colors.cardLight,
        border: `1px solid ${colors.muted}`,
      }}
      aria-label="Toggle theme"
    >
      {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}
