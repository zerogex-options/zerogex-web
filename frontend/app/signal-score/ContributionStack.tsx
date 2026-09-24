'use client';

import { memo, useMemo } from 'react';
import { COMPONENT_KEYS, ComponentEntry, getComponentLabel } from './data';

interface Props {
  components: ComponentEntry[];
  composite: number | null;
}

const POSITIVE = 'var(--color-bull)';
const NEGATIVE = 'var(--color-bear)';

function ContributionStackImpl({ components, composite }: Props) {
  // Order strictly matches the spec: net_gex → gamma_anchor → PCR → vol → flow → delta.
  const ordered = useMemo(() => {
    const byKey = new Map(components.map((c) => [c.key, c]));
    return COMPONENT_KEYS.map((k) => byKey.get(k)).filter(Boolean) as ComponentEntry[];
  }, [components]);

  // 100 score units = 100% width. Each segment is |contribution| / 100 of width.
  // Negatives stack right-to-left from the 50% line; positives stack left-to-right from 50%.
  const rawNegativeSegs = ordered
    .filter((c) => (c.contribution ?? 0) < 0)
    .map((c) => ({ entry: c, width: Math.min(50, Math.abs(c.contribution ?? 0)) }));
  const rawPositiveSegs = ordered
    .filter((c) => (c.contribution ?? 0) > 0)
    .map((c) => ({ entry: c, width: Math.min(50, Math.abs(c.contribution ?? 0)) }));

  // Components are independent — several can push to near-max on the same
  // side while the other side only partially cancels them in the composite,
  // so Σ|contributions| on one side can exceed the 50% half. When that
  // happens, scale all segments proportionally so the longer side ends
  // exactly at the bar's edge. This preserves relative proportions and keeps
  // every segment label inside the bar instead of being clipped against it.
  const posTotal = rawPositiveSegs.reduce((sum, s) => sum + s.width, 0);
  const negTotal = rawNegativeSegs.reduce((sum, s) => sum + s.width, 0);
  const maxSide = Math.max(posTotal, negTotal);
  const widthScale = maxSide > 50 ? 50 / maxSide : 1;
  const negativeSegs = rawNegativeSegs.map((s) => ({ ...s, width: s.width * widthScale }));
  const positiveSegs = rawPositiveSegs.map((s) => ({ ...s, width: s.width * widthScale }));

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
      <div>
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
      </div>
      {/* Phone key. A 330px bar gives each segment ~10–30px, too narrow for
          its in-bar label, and the per-segment detail lives in a hover title
          a finger cannot reach — so the pushers are listed under the bar in
          the same left / right arrangement as the bar itself. */}
      <PhoneKey negatives={negativeLayout.map((l) => l.entry)} positives={positiveLayout.map((l) => l.entry)} />
    </div>
  );
}

function PhoneKey({ negatives, positives }: { negatives: ComponentEntry[]; positives: ComponentEntry[] }) {
  if (negatives.length === 0 && positives.length === 0) return null;
  const item = (entry: ComponentEntry) => {
    const c = entry.contribution ?? 0;
    return (
      <li key={entry.key} className="flex items-start gap-2 text-[12px] leading-tight">
        <span aria-hidden className="mt-0.5 h-3 w-1 shrink-0 rounded-sm" style={{ background: c >= 0 ? POSITIVE : NEGATIVE }} />
        <span className="min-w-0 flex-1 text-[var(--color-text-primary)]">{getComponentLabel(entry.key).title}</span>
        <span className="font-mono tabular-nums" style={{ color: c >= 0 ? POSITIVE : NEGATIVE }}>
          {c >= 0 ? '+' : ''}{c.toFixed(1)}
        </span>
      </li>
    );
  };
  return (
    <div className="mt-3 grid grid-cols-2 gap-x-4 sm:hidden">
      <div>
        <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide" style={{ color: NEGATIVE }}>← Chop / reversal</div>
        <ul className="space-y-1.5">{negatives.map(item)}</ul>
      </div>
      <div>
        <div className="mb-1.5 text-right text-[10px] font-semibold uppercase tracking-wide" style={{ color: POSITIVE }}>Trend / expansion →</div>
        <ul className="space-y-1.5">{positives.map(item)}</ul>
      </div>
    </div>
  );
}

const ContributionStack = memo(ContributionStackImpl);
export default ContributionStack;
