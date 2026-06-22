'use client';

import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, Moon, Sun } from 'lucide-react';
import { useTheme } from '@/core/ThemeContext';

const C = {
  bgDark: 'var(--color-bg)',
  card: 'var(--color-surface)',
  amber: 'var(--color-brand-primary)',
  border: 'var(--border-default)',
  muted: 'var(--color-text-secondary)',
};

export default function Header() {
  const { theme, setTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-[100] flex items-center justify-between px-4 sm:px-8 h-14 sm:h-16"
      style={{
        background: `${isDark ? C.bgDark : 'var(--color-bg)'}ee`,
        borderBottom: `1px solid ${C.border}`,
        backdropFilter: 'blur(20px)',
      }}
    >
      <Link
        href="/"
        className="h-full flex items-center overflow-hidden flex-shrink-0"
        style={{ textDecoration: 'none', padding: 0, margin: 0, lineHeight: 0 }}
      >
        <Image
          src="/title.svg"
          alt="ZeroGEX"
          width={300}
          height={60}
          priority
          className="h-[130%] sm:h-[150%] w-auto block"
          style={{
            maxHeight: 'none',
            maxWidth: 'none',
            objectFit: 'contain',
            objectPosition: 'center',
            margin: 0,
            padding: 0,
          }}
        />
      </Link>
      <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
        <button
          onClick={() => setTheme(isDark ? 'light' : 'dark')}
          className="w-8 h-8 sm:w-[38px] sm:h-[38px] flex items-center justify-center rounded-[10px]"
          style={{
            background: isDark ? `${C.card}cc` : 'var(--bg-hover)',
            border: `1px solid ${C.border}`,
            cursor: 'pointer',
            color: C.muted,
          }}
          aria-label="Toggle theme"
        >
          {isDark ? <Sun size={14} /> : <Moon size={14} />}
        </button>
        <Link href="/education" className="hidden sm:block" style={{ textDecoration: 'none' }}>
          <button
            style={{
              background: isDark ? `${C.card}cc` : 'var(--bg-hover)',
              border: `1px solid ${C.border}`,
              borderRadius: 10,
              padding: '8px 14px',
              fontSize: 13,
              fontWeight: 700,
              color: 'var(--color-text-primary)',
              cursor: 'pointer',
            }}
          >
            Education
          </button>
        </Link>
        <Link href="/pricing" className="hidden sm:block" style={{ textDecoration: 'none' }}>
          <button
            style={{
              background: isDark ? `${C.card}cc` : 'var(--bg-hover)',
              border: `1px solid ${C.border}`,
              borderRadius: 10,
              padding: '8px 14px',
              fontSize: 13,
              fontWeight: 700,
              color: 'var(--color-text-primary)',
              cursor: 'pointer',
            }}
          >
            Pricing
          </button>
        </Link>
        <Link href="/dashboard" style={{ textDecoration: 'none' }}>
          <button
            className="flex items-center gap-1.5 px-3 py-2 sm:px-[18px] sm:py-2 text-xs sm:text-[13px] font-bold rounded-[10px]"
            style={{
              background: `linear-gradient(135deg, ${C.amber}, var(--heat-mid))`,
              border: 'none',
              color: 'var(--text-inverse)',
              cursor: 'pointer',
              boxShadow: `0 4px 16px ${C.amber}50`,
            }}
          >
            Launch App <ArrowRight size={14} />
          </button>
        </Link>
      </div>
    </nav>
  );
}
