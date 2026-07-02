'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';

const SYMBOLS = ['SPY', 'QQQ', 'SPX'] as const;
export type PickerSymbol = (typeof SYMBOLS)[number];
export const DEFAULT_SYMBOL: PickerSymbol = 'SPY';

export function resolveSymbol(raw: string | undefined | null): PickerSymbol {
  const upper = (raw || '').toUpperCase();
  return (SYMBOLS as readonly string[]).includes(upper)
    ? (upper as PickerSymbol)
    : DEFAULT_SYMBOL;
}

// Segmented button row that mirrors the LiveBulletin picker's tokens.
// Syncs the ?symbol=X search param so both server components (which
// read searchParams) and client components (which read useSearchParams)
// see the same source of truth without extra client state.
export default function SymbolPicker({ current }: { current: PickerSymbol }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, start] = useTransition();

  function pick(next: PickerSymbol) {
    if (next === current) return;
    const params = new URLSearchParams(searchParams?.toString() ?? '');
    if (next === DEFAULT_SYMBOL) {
      params.delete('symbol');
    } else {
      params.set('symbol', next);
    }
    const qs = params.toString();
    start(() => router.push(qs ? `${pathname}?${qs}` : pathname));
  }

  return (
    <div className="flex items-center gap-2" aria-label="Symbol">
      {SYMBOLS.map((s) => {
        const active = s === current;
        return (
          <button
            key={s}
            type="button"
            onClick={() => pick(s)}
            disabled={pending}
            aria-pressed={active}
            className="px-3 py-1.5 rounded-lg text-xs font-bold tracking-wider uppercase transition-colors disabled:opacity-60"
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
