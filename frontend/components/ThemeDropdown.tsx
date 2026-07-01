'use client';

import { useEffect, useRef, useState } from 'react';
import { useTheme, Palette } from '@/core/ThemeContext';

interface PaletteMeta {
  id: Palette;
  name: string;
  swatch: string[]; // 4 hex colors for the mini swatch
  subtitle?: string;
}

const PALETTES: PaletteMeta[] = [
  {
    id: 'walnut',
    name: 'Terminal Walnut',
    subtitle: 'Default · clean warm neutral',
    swatch: ['#14100A', '#C48338', '#F0CE6C', '#E67F5C'],
  },
  {
    id: 'california',
    name: 'California Sunset',
    subtitle: 'Warm dusk · coral & gold',
    swatch: ['#120817', '#EB5F3E', '#FFDA57', '#4FA3E8'],
  },
  {
    id: 'pacific',
    name: 'Pacific Northwest',
    subtitle: 'Cool forest · emerald & sky',
    swatch: ['#050C09', '#4FE8A0', '#4FBFF0', '#E8C24C'],
  },
  {
    id: 'deluxe',
    name: 'Terminal Deluxe',
    subtitle: 'Pro · high-contrast Bloomberg',
    swatch: ['#0A0E13', '#FFB020', '#4FE8A8', '#FF6E6E'],
  },
];

export default function ThemeDropdown() {
  const { palette, setPalette } = useTheme();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const current = PALETTES.find((p) => p.id === palette) ?? PALETTES[0];

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Theme palette: ${current.name}`}
        title={current.name}
        className="inline-flex items-center rounded-md transition-colors"
        style={{
          border: '1px solid var(--border-default)',
          background: 'transparent',
          padding: '6px',
          cursor: 'pointer',
        }}
      >
        <span
          aria-hidden
          className="inline-flex overflow-hidden rounded-sm"
          style={{ width: '48px', height: '16px' }}
        >
          {current.swatch.map((c, i) => (
            <span key={i} style={{ flex: 1, background: c }} />
          ))}
        </span>
      </button>

      {open && (
        <div
          role="listbox"
          aria-label="Theme palettes"
          className="absolute right-0 mt-2 z-50"
          style={{
            minWidth: '260px',
            padding: '6px',
            background: 'var(--bg-card)',
            border: '1px solid var(--border-default)',
            borderRadius: '8px',
            boxShadow: '0 20px 40px -10px rgba(0,0,0,0.25)',
          }}
        >
          {PALETTES.map((p) => {
            const selected = p.id === palette;
            return (
              <button
                key={p.id}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => {
                  setPalette(p.id);
                  setOpen(false);
                }}
                className="w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors"
                style={{
                  background: selected ? 'var(--color-accent-soft)' : 'transparent',
                  color: selected ? 'var(--color-accent-hot)' : 'var(--text-primary)',
                  border: 0,
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => {
                  if (!selected) e.currentTarget.style.background = 'var(--bg-hover)';
                }}
                onMouseLeave={(e) => {
                  if (!selected) e.currentTarget.style.background = 'transparent';
                }}
              >
                <span
                  aria-hidden
                  className="inline-flex overflow-hidden rounded-sm shrink-0"
                  style={{ width: '36px', height: '14px', border: '1px solid var(--border-default)' }}
                >
                  {p.swatch.map((c, i) => (
                    <span key={i} style={{ flex: 1, background: c }} />
                  ))}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-medium tracking-tight">{p.name}</span>
                  {p.subtitle && (
                    <span className="block text-[11px]" style={{ color: 'var(--text-muted)' }}>
                      {p.subtitle}
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
