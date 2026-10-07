'use client';

/**
 * A tile's own underlying picker, for the dashboard tiles that read one
 * symbol (the Gamma Ladder). It lists the symbols with the tile's current one
 * selected — the board's, until another is picked. Picking another pins this
 * tile alone; picking the board's symbol again puts the tile back to following
 * the page (see WidgetInstanceValue.selectSymbol).
 *
 * Styled like the ladder header's SymbolSelect (components/SymbolSelect),
 * drawn at the tile's text size, with a pinned tile's picker in the warning
 * tone the split board uses for a pinned half — so it is clear at a glance
 * which tiles have left the page's symbol. Renders nothing outside a tile.
 */

import { ChevronDown } from 'lucide-react';
import { SYMBOLS } from '@/core/symbols';
import type { UnderlyingSymbol } from '@/core/symbolPersistence';
import { usePageT } from '@/core/LanguageContext';
import { useWidgetInstance } from './widgetInstance';
import { dict } from './WidgetSymbolSelect.i18n';

export default function WidgetSymbolSelect({ scale = 1 }: { scale?: number }) {
  const t = usePageT(dict);
  const instance = useWidgetInstance();
  if (!instance) return null;
  const { symbol, pinnedSymbol, selectSymbol } = instance;
  const pinned = pinnedSymbol !== null;
  return (
    <div className="relative inline-flex max-w-full items-center">
      <select
        value={symbol}
        onChange={(e) => selectSymbol(e.target.value as UnderlyingSymbol)}
        aria-label={t('ariaLabel')}
        title={pinned ? t('titlePinned') : t('titleFollowing')}
        className="max-w-full appearance-none truncate font-mono font-bold"
        style={{
          fontSize: 14 * scale,
          letterSpacing: '0.04em',
          color: pinned ? 'var(--color-warning)' : 'var(--text-primary)',
          background: 'var(--bg-card)',
          border: `1px solid ${pinned ? 'var(--color-warning)' : 'var(--border-default)'}`,
          borderRadius: 'var(--radius-control)',
          padding: `${3 * scale}px ${22 * scale}px ${3 * scale}px ${8 * scale}px`,
          cursor: 'pointer',
        }}
      >
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
