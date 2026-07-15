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
    subtitle: 'Sunset coral, pacific teal, vintage gold',
    swatch: ['#171B24', '#E1785B', '#3E9C9B', '#D7A84B'],
  },
  {
    id: 'wallstreet',
    name: 'Wall Street',
    subtitle: 'Banker navy, old gold, burgundy tie',
    swatch: ['#0E1116', '#164E6B', '#C5A05A', '#9A2638'],
  },
  {
    id: 'kyoto',
    name: 'Kyoto Zen',
    subtitle: 'Bonsai green, shrine red, blossom pink',
    swatch: ['#171B16', '#A5B875', '#C94B3F', '#E0A7A0'],
  },
  {
    id: 'miami',
    name: 'Miami Beach',
    subtitle: 'Hot pink, neon cyan, cabana yellow',
    swatch: ['#0B1026', '#FF3CAC', '#00E5FF', '#FFE156'],
  },
  {
    id: 'london',
    name: 'London Fog',
    subtitle: 'Racing green, polished brass, weathered stone',
    swatch: ['#14171A', '#D6A94E', '#4FA080', '#D66A5E'],
  },
  {
    id: 'monaco',
    name: 'Monaco Riviera',
    subtitle: 'Riviera navy, Mediterranean blue, roulette gold',
    swatch: ['#0C1622', '#E0BE5A', '#4F92D8', '#E0685E'],
  },
  {
    id: 'zurich',
    name: 'Zürich Vault',
    subtitle: 'Graphite steel, vault gold, alpine snow',
    swatch: ['#131518', '#DCC066', '#7E8B98', '#E0574C'],
  },
  {
    id: 'amalfi',
    name: 'Amalfi Lemon',
    subtitle: 'Mediterranean blue, citrus yellow, limewash',
    swatch: ['#0C1620', '#F0D24E', '#4F9BD8', '#E85C7E'],
  },
  {
    id: 'maldives',
    name: 'Maldives Lagoon',
    subtitle: 'Turquoise lagoon, coral, deep-ocean blue',
    swatch: ['#08181C', '#2FD0D0', '#F0987A', '#F0C46A'],
  },
  {
    id: 'tulum',
    name: 'Tulum Jungle',
    subtitle: 'Cenote jade, terracotta, Caribbean turquoise',
    swatch: ['#0C1512', '#E89A5E', '#35C4A0', '#E0B85A'],
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
