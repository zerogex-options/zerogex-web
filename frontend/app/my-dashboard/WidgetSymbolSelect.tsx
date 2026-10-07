'use client';

/**
 * The per-tile underlying picker: the board's default, or any symbol for this
 * one tile. Styled like the ladder header's SymbolSelect (components/
 * SymbolSelect), which it stands in for on the dashboard, plus the one option
 * a page-level picker has no use for — following the board.
 *
 * Renders nothing outside a dashboard tile, so a caller can mount it
 * unconditionally.
 */

import { ChevronDown } from 'lucide-react';
import { SYMBOLS } from '@/core/symbols';
import type { UnderlyingSymbol } from '@/core/symbolPersistence';
import { usePageT } from '@/core/LanguageContext';
import { useWidgetInstance } from './widgetInstance';
import { dict } from './WidgetSymbolSelect.i18n';

const FOLLOW = '';

export default function WidgetSymbolSelect({ scale = 1 }: { scale?: number }) {
  const t = usePageT(dict);
  const instance = useWidgetInstance();
  if (!instance) return null;
  const { pinnedSymbol, defaultSymbol, setSymbol } = instance;
  return (
    <div className="relative inline-flex max-w-full items-center">
      <select
        value={pinnedSymbol ?? FOLLOW}
        onChange={(e) => setSymbol(e.target.value === FOLLOW ? null : (e.target.value as UnderlyingSymbol))}
        aria-label={t('ariaLabel')}
        title={t('title')}
        className="max-w-full appearance-none truncate font-mono font-bold"
        style={{
          fontSize: 14 * scale,
          letterSpacing: '0.04em',
          // A pinned tile reads in the warning tone the split board's pinned
          // halves use, so it is clear at a glance which tiles have left the
          // board's symbol.
          color: pinnedSymbol ? 'var(--color-warning)' : 'var(--text-primary)',
          background: 'var(--bg-card)',
          border: `1px solid ${pinnedSymbol ? 'var(--color-warning)' : 'var(--border-default)'}`,
          borderRadius: 'var(--radius-control)',
          padding: `${3 * scale}px ${22 * scale}px ${3 * scale}px ${8 * scale}px`,
          cursor: 'pointer',
        }}
      >
        <option value={FOLLOW}>{t('followBoard', { symbol: defaultSymbol })}</option>
        {SYMBOLS.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
      <ChevronDown
        size={13 * scale}
        style={{ position: 'absolute', right: 5 * scale, pointerEvents: 'none', color: 'var(--text-secondary)' }}
      />
    </div>
  );
}
