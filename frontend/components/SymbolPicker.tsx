'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';

import { SYMBOLS, type PickerSymbol } from '@/core/symbols';

interface PickerProps {
  current: PickerSymbol;
  /** Pre-computed per-symbol targets. The picker itself is a client
   *  component, so it can't build URLs — the caller (a server component
   *  or landing page) constructs the map so the target can be either a
   *  path segment swap (/forecast/QQQ/2026-07-01) or a query change
   *  (/forecast?symbol=QQQ) depending on the surface. */
  hrefs: Record<PickerSymbol, string>;
  /**
   * The symbols to offer. Defaults to all of them; pass a narrower list on a
   * surface the backend cannot answer for every symbol, so the picker never
   * shows a choice that resolves to an error.
   */
  symbols?: readonly PickerSymbol[];
}

export default function SymbolPicker({ current, hrefs, symbols = SYMBOLS }: PickerProps) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function pick(next: PickerSymbol) {
    if (next === current) return;
    start(() => router.push(hrefs[next]));
  }

  return (
    // Wraps rather than overflowing: six symbols need ~330px, more than is left
    // beside a page title on a phone. Callers stack it under the title there.
    <div className="flex flex-wrap items-center gap-2" aria-label="Symbol">
      {symbols.map((s) => {
        const active = s === current;
        return (
          <button
            key={s}
            type="button"
            onClick={() => pick(s)}
            disabled={pending}
            aria-pressed={active}
            className="px-3 py-1.5 pointer-coarse:py-2 rounded-lg text-xs font-bold tracking-wider uppercase transition-colors disabled:opacity-60"
            style={{
              background: active ? 'var(--color-warning-soft)' : 'transparent',
              border: `1px solid ${active ? 'var(--color-warning)' : 'var(--color-border)'}`,
              color: active ? 'var(--color-warning)' : 'var(--color-text-secondary)',
            }}
          >
            {s}
          </button>
        );
      })}
    </div>
  );
}
