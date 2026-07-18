'use client';

import { SignalTrend } from '@/core/signalHelpers';

// The signed bias on one scale: -100 (bearish, left) → 0 (neutral, center) →
// +100 (bullish, right). A single number instead of six labels; the marker
// position and its color carry the read.
export default function BiasTape({
  biasScore,
  trend,
}: {
  biasScore: number | null;
  trend: SignalTrend;
}) {
  const clamped = biasScore == null ? null : Math.max(-100, Math.min(100, biasScore));
  const leftPct = clamped == null ? 50 : ((clamped + 100) / 200) * 100;
  const markerColor =
    trend === 'bullish'
      ? 'var(--color-bull)'
      : trend === 'bearish'
        ? 'var(--color-bear)'
        : 'var(--color-warning)';

  return (
    <div className="w-full">
      <div
        className="relative h-11 rounded-lg overflow-hidden border"
        style={{
          borderColor: 'var(--color-border)',
          background:
            'linear-gradient(90deg, var(--color-bear) 0%, color-mix(in srgb, var(--color-bear) 28%, var(--color-surface)) 34%, var(--color-surface-subtle) 50%, color-mix(in srgb, var(--color-bull) 28%, var(--color-surface)) 66%, var(--color-bull) 100%)',
        }}
        role="img"
        aria-label={
          clamped == null
            ? 'Bias unavailable'
            : `Bias ${clamped >= 0 ? '+' : ''}${clamped.toFixed(0)} of 100`
        }
      >
        {/* center (neutral) line */}
        <div
          className="absolute top-0 bottom-0"
          style={{ left: '50%', width: 1, background: 'color-mix(in srgb, var(--color-text-primary) 40%, transparent)' }}
        />
        {clamped != null && (
          <div
            className="absolute -top-0.5 -bottom-0.5 rounded"
            style={{
              left: `${leftPct}%`,
              width: 3,
              transform: 'translateX(-50%)',
              background: markerColor,
              boxShadow: '0 0 0 3px var(--color-surface)',
              transition: 'left 400ms ease-out',
            }}
          />
        )}
      </div>
      <div className="mt-1.5 flex justify-between text-[11px] font-mono text-[var(--color-text-secondary)]" style={{ fontVariantNumeric: 'tabular-nums' }}>
        <span>−100 · Bearish</span>
        <span>0 · Neutral</span>
        <span>+100 · Bullish</span>
      </div>
    </div>
  );
}
