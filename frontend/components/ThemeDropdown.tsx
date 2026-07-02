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
    id: 'california',
    name: 'California Sunset',
    subtitle: 'Coral, teal, gold — vintage Hollywood',
    swatch: ['#150C1D', '#FF6A48', '#FFDF64', '#2FDCC0'],
  },
  {
    id: 'kyoto',
    name: 'Kyoto Zen',
    subtitle: 'Pine, cedar, sand — quiet Swiss modernism',
    swatch: ['#0F0E0A', '#6BAF7E', '#C57A32', '#E8C078'],
  },
  {
    id: 'miami',
    name: 'Miami Beach',
    subtitle: 'Neon pink, aqua, night sky — 80s loud',
    swatch: ['#060A16', '#FF4FA0', '#4CE5F7', '#00E5C9'],
  },
  {
    id: 'wallstreet',
    name: 'Wall Street',
    subtitle: 'Gold, money-green, ticker red — trading floor',
    swatch: ['#0A0E13', '#FFB020', '#1BAA5C', '#E63946'],
  },
];

export default function ThemeDropdown() {
  const { palette, setPalette } = useTheme();
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<'left' | 'right'>('right');
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  // Choose whether the dropdown anchors to the trigger's left or right edge,
  // based on the trigger's position in the viewport. Sidebar-mounted triggers
  // (far left) anchor left so the panel opens rightward; header-mounted
  // triggers (far right) anchor right so it opens leftward.
  const handleToggle = () => {
    if (!open && wrapRef.current) {
      const rect = wrapRef.current.getBoundingClientRect();
      const dropdownWidth = 260;
      const spaceRight = window.innerWidth - rect.left;
      setAnchor(spaceRight >= dropdownWidth + 16 ? 'left' : 'right');
    }
    setOpen((v) => !v);
  };

  const current = PALETTES.find((p) => p.id === palette) ?? PALETTES[0];

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={handleToggle}
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
          className="absolute mt-2 z-50"
          style={{
            [anchor]: 0,
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
