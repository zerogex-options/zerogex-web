'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useTransition } from 'react';

import { DEFAULT_SYMBOL, SYMBOLS, type PickerSymbol } from '@/core/symbols';

// useSearchParams() forces its subtree out of static rendering, so the
// component that reads it must live inside a Suspense boundary — same
// pattern app/pricing/Client.tsx uses. The outer default export supplies
// the Suspense wrapper; the inner reader does the work.
function PickerInner({ current }: { current: PickerSymbol }) {
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
    const target = pathname ?? '/';
    start(() => router.push(qs ? `${target}?${qs}` : target));
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

// Fallback matches the picker's outer footprint (3 buttons, ~120px wide)
// so headers don't reflow when Suspense resolves.
function PickerFallback() {
  return (
    <div className="flex items-center gap-2" aria-hidden>
      {SYMBOLS.map((s) => (
        <div
          key={s}
          className="px-3 py-1.5 rounded-lg text-xs font-bold tracking-wider uppercase"
          style={{
            background: 'transparent',
            border: '1px solid var(--color-border)',
            color: 'var(--color-text-secondary)',
          }}
        >
          {s}
        </div>
      ))}
    </div>
  );
}

export default function SymbolPicker(props: { current: PickerSymbol }) {
  return (
    <Suspense fallback={<PickerFallback />}>
      <PickerInner {...props} />
    </Suspense>
  );
}
