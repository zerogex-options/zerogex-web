'use client';

import { useEffect, useRef, useState } from 'react';
import { Globe, ChevronDown } from 'lucide-react';
import { useLanguage } from '@/core/LanguageContext';
import { LOCALE_META, localeMeta } from '@/core/i18n/locales';

interface LanguageDropdownProps {
  // Tighter padding for the mobile top bar / collapsed header.
  compact?: boolean;
}

export default function LanguageDropdown({ compact = false }: LanguageDropdownProps) {
  const { locale, setLocale, t } = useLanguage();
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

  // Anchor the panel to whichever edge keeps it on-screen: a trigger near the
  // right edge (the header) opens leftward; one with room to the right opens
  // rightward. Mirrors ThemeDropdown so the two pickers behave identically.
  const handleToggle = () => {
    if (!open && wrapRef.current) {
      const rect = wrapRef.current.getBoundingClientRect();
      const dropdownWidth = 240;
      const spaceRight = window.innerWidth - rect.left;
      setAnchor(spaceRight >= dropdownWidth + 16 ? 'left' : 'right');
    }
    setOpen((v) => !v);
  };

  const current = localeMeta(locale);

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={handleToggle}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`${t('language.label')}: ${current.englishName}`}
        title={`${t('language.label')}: ${current.label}`}
        className="inline-flex items-center gap-1 rounded-md transition-colors"
        style={{
          border: '1px solid var(--border-default)',
          background: 'transparent',
          padding: compact ? '5px 6px' : '6px 8px',
          cursor: 'pointer',
          color: 'var(--text-secondary)',
          lineHeight: 1,
        }}
      >
        <Globe size={compact ? 15 : 16} aria-hidden />
        <span
          aria-hidden
          className="font-semibold uppercase tracking-wide"
          style={{ fontSize: '11px' }}
        >
          {current.code}
        </span>
        <ChevronDown size={compact ? 12 : 13} aria-hidden style={{ opacity: 0.7 }} />
      </button>

      {open && (
        <div
          role="listbox"
          aria-label={t('language.select')}
          className="absolute mt-2 z-50"
          style={{
            [anchor]: 0,
            minWidth: '220px',
            maxHeight: 'calc(100dvh - 72px)',
            overflowY: 'auto',
            overscrollBehavior: 'contain',
            padding: '6px',
            background: 'var(--bg-card)',
            border: '1px solid var(--border-default)',
            borderRadius: '8px',
            boxShadow: '0 20px 40px -10px rgba(0,0,0,0.25)',
          }}
        >
          {LOCALE_META.map((l) => {
            const selected = l.code === locale;
            return (
              <button
                key={l.code}
                type="button"
                role="option"
                aria-selected={selected}
                lang={l.code}
                onClick={() => {
                  setLocale(l.code);
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
                <span aria-hidden className="text-lg leading-none shrink-0">
                  {l.flag}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-medium tracking-tight">{l.label}</span>
                  <span className="block text-[11px]" style={{ color: 'var(--text-muted)' }}>
                    {l.englishName}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
