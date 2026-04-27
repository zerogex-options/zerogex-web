'use client';

import { useMemo } from 'react';
import MobileScrollableChart from '@/components/MobileScrollableChart';
import { COMPONENT_KEYS, ComponentEntry, getComponentLabel } from './data';

interface Props {
  components: ComponentEntry[];
  composite: number | null;
}

const POSITIVE = '#16A34A';
const NEGATIVE = '#DC2626';

export default function ContributionStack({ components, composite }: Props) {
  // Order strictly matches the spec: net_gex → gamma_anchor → PCR → vol → flow → delta.
  const ordered = useMemo(() => {
    const byKey = new Map(components.map((c) => [c.key, c]));
    return COMPONENT_KEYS.map((k) => byKey.get(k)).filter(Boolean) as ComponentEntry[];
  }, [components]);

  // 100 score units = 100% width. Each segment is |contribution| / 100 of width.
  // Negatives stack right-to-left from the 50% line; positives stack left-to-right from 50%.
  const negativeSegs = ordered
    .filter((c) => (c.contribution ?? 0) < 0)
    .map((c) => ({ entry: c, width: Math.min(50, Math.abs(c.contribution ?? 0)) }));
  const positiveSegs = ordered
    .filter((c) => (c.contribution ?? 0) > 0)
    .map((c) => ({ entry: c, width: Math.min(50, Math.abs(c.contribution ?? 0)) }));

  const negativeLayout: Array<{ entry: ComponentEntry; width: number; left: number }> = [];
  let negCursor = 50;
  for (const seg of negativeSegs) {
    const left = negCursor - seg.width;
    negativeLayout.push({ ...seg, left });
    negCursor = left;
  }
  const positiveLayout: Array<{ entry: ComponentEntry; width: number; left: number }> = [];
  let posCursor = 50;
  for (const seg of positiveSegs) {
    positiveLayout.push({ ...seg, left: posCursor });
    posCursor += seg.width;
  }

  const compositeAria = composite != null ? composite.toFixed(2) : 'unknown';

  return (
    <div
      role="img"
      aria-label={`Component contribution stack. Composite ${compositeAria}.`}
    >
      <div className="flex items-baseline justify-end mb-3">
        <div className="text-xs text-[var(--color-text-secondary)] font-mono" style={{ fontVariantNumeric: 'tabular-nums' }}>
          50 + Σ contrib ≈ {composite != null ? composite.toFixed(2) : '—'}
        </div>
      </div>
      <MobileScrollableChart minWidthClass="min-w-[720px]" initialScroll="center">
        <div className="relative h-10 w-full overflow-hidden rounded-md border" style={{ background: 'var(--color-surface-subtle)', borderColor: 'var(--color-border)' }}>
          {[...negativeLayout, ...positiveLayout].map(({ entry, width, left }) => {
            if (width <= 0) return null;
            const positive = (entry.contribution ?? 0) >= 0;
            const label = getComponentLabel(entry.key);
            const showLabel = width >= 6; // ~6% width ≈ 60px on a 1000px bar
            const weightPct = entry.maxPoints > 0 ? Math.round((Math.abs(entry.contribution ?? 0) / entry.maxPoints) * 100) : 0;
            const tooltip = `${label.title} • score ${entry.score?.toFixed(3) ?? '—'} • contrib ${(entry.contribution ?? 0) >= 0 ? '+' : ''}${(entry.contribution ?? 0).toFixed(2)} • max ${entry.maxPoints} (${weightPct}% of weight)`;
            return (
              <div
                key={entry.key}
                role="button"
                tabIndex={0}
                title={tooltip}
                aria-label={tooltip}
                className="absolute top-0 bottom-0 flex items-center justify-center text-[11px] font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
                style={{
                  left: `${left}%`,
                  width: `${width}%`,
                  background: positive ? POSITIVE : NEGATIVE,
                  color: '#fff',
                  borderLeft: '1px solid rgba(255,255,255,0.25)',
                  borderRight: '1px solid rgba(255,255,255,0.25)',
                  fontVariantNumeric: 'tabular-nums',
                  transition: 'left 250ms ease-out, width 250ms ease-out',
                }}
              >
                {showLabel ? `${label.title} ${(entry.contribution ?? 0) >= 0 ? '+' : ''}${(entry.contribution ?? 0).toFixed(1)}` : ''}
              </div>
            );
          })}
          {/* Center 50-line marker */}
          <div
            className="absolute top-0 bottom-0"
            style={{ left: '50%', width: 2, background: 'var(--color-text-primary)', opacity: 0.85, transform: 'translateX(-1px)' }}
            aria-hidden
          />
        </div>
        <div className="mt-2 flex justify-between text-[10px] font-mono text-[var(--color-text-secondary)]">
          <span>0</span>
          <span>50 (Neutral)</span>
          <span>100</span>
        </div>
      </MobileScrollableChart>
    </div>
  );
}
