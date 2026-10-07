'use client';

/**
 * A tile's own underlying picker, for the dashboard tiles that read one
 * symbol (the Gamma Ladder). It lists the symbols with the tile's current one
 * selected — the board's, until another is picked. Picking another pins this
 * tile alone; picking the board's symbol again puts the tile back to following
 * the board (see WidgetInstanceValue.selectSymbol). A pinned tile also gets a
 * small button beside the picker that does the same in one click — and is the
 * only way back when the board has since moved onto the pinned symbol, where
 * picking it again in a native select fires no change at all.
 *
 * Styled like the ladder header's SymbolSelect (components/SymbolSelect),
 * drawn at the tile's text size, with a pinned tile's picker in the warning
 * tone the split board uses for a pinned half — so it is clear at a glance
 * which tiles have left the page's symbol. Renders nothing outside a tile.
 */

import { ChevronDown, Undo2 } from 'lucide-react';
import { SYMBOLS } from '@/core/symbols';
import type { UnderlyingSymbol } from '@/core/symbolPersistence';
import { usePageT } from '@/core/LanguageContext';
import { useWidgetInstance } from './widgetInstance';
import { dict } from './WidgetSymbolSelect.i18n';

export default function WidgetSymbolSelect({ scale = 1 }: { scale?: number }) {
  const t = usePageT(dict);
  const instance = useWidgetInstance();
  if (!instance) return null;
  const { symbol, boardSymbol, pinnedSymbol, selectSymbol, followBoard } = instance;
  const pinned = pinnedSymbol !== null;
  return (
    <div className="inline-flex max-w-full items-center" style={{ gap: 4 * scale }}>
    <div className="relative inline-flex min-w-0 max-w-full items-center">
      <select
        value={symbol}
        onChange={(e) => selectSymbol(e.target.value as UnderlyingSymbol)}
        aria-label={t('ariaLabel')}
        title={pinned ? t('titlePinned', { board: boardSymbol }) : t('titleFollowing', { board: boardSymbol })}
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
    {pinned && (
      <button
        type="button"
        onClick={followBoard}
        title={t('followBoard', { board: boardSymbol })}
        aria-label={t('followBoard', { board: boardSymbol })}
        className="inline-flex flex-none items-center justify-center rounded-md"
        style={{
          width: 20 * scale,
          height: 20 * scale,
          color: 'var(--color-warning)',
          background: 'var(--color-warning-soft)',
        }}
      >
        <Undo2 size={12 * scale} />
      </button>
    )}
    </div>
  );
}
