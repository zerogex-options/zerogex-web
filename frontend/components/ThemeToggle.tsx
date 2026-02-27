'use client';
import { Moon, Sun } from 'lucide-react';
import { Theme } from '@/core/types';
import { colors } from '@/core/colors';

interface ThemeToggleProps {
  theme: Theme;
  onToggle: () => void;
}

export default function ThemeToggle({ theme, onToggle }: ThemeToggleProps) {
  return (
    <button
      onClick={onToggle}
      className="group"
      style={{
        position: 'fixed',
        bottom: '2rem',
        right: '2rem',
        zIndex: 9999,
        width: '64px',
        height: '32px',
        borderRadius: '9999px',
        backgroundColor: 'transparent',
        border: `2px solid ${colors.muted}`,
        padding: '2px',
        cursor: 'pointer',
        transition: 'all 0.3s ease',
        boxShadow: theme === 'dark' ? '0 4px 16px rgba(0, 0, 0, 0.4)' : '0 4px 16px rgba(0, 0, 0, 0.15)',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'scale(1.05)';
        e.currentTarget.style.boxShadow = theme === 'dark' ? '0 6px 20px rgba(0, 0, 0, 0.5)' : '0 6px 20px rgba(0, 0, 0, 0.2)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'scale(1)';
        e.currentTarget.style.boxShadow = theme === 'dark' ? '0 4px 16px rgba(0, 0, 0, 0.4)' : '0 4px 16px rgba(0, 0, 0, 0.15)';
      }}
      aria-label="Toggle theme"
    >
      {/* Slider */}
      <div
        style={{
          width: '24px',
          height: '24px',
          borderRadius: '50%',
          backgroundColor: 'transparent',
          border: `2px solid ${colors.muted}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transform: theme === 'dark' ? 'translateX(32px)' : 'translateX(0px)',
          transition: 'transform 0.3s ease',
        }}
      >
        {theme === 'dark' ? (
          <Moon size={14} color={colors.muted} />
        ) : (
          <Sun size={14} color={colors.muted} />
        )}
      </div>
    </button>
  );
}
