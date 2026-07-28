'use client';

// A small badge that states, honestly and unmissably, WHICH analytics source
// a surface is showing: real CME futures options, cash-index/ETF OPRA options,
// or SPX-derived ES reference levels. This is the UI half of the spec rule that
// SPX-derived levels must never be presented as actual ES futures-options GEX.

import { getAvailability, getInstrument } from '@/core/instruments/registry';
import { analyticsSourceLabel, type LabelTone } from '@/core/instruments/labels';

const TONE_STYLES: Record<LabelTone, { bg: string; border: string; color: string }> = {
  neutral: {
    bg: 'transparent',
    border: 'var(--color-border)',
    color: 'var(--color-text-secondary)',
  },
  info: {
    bg: 'var(--color-info-soft, transparent)',
    border: 'var(--color-info, var(--color-border))',
    color: 'var(--color-info, var(--color-text-secondary))',
  },
  warning: {
    bg: 'var(--color-warning-soft, transparent)',
    border: 'var(--color-warning)',
    color: 'var(--color-warning)',
  },
};

interface Props {
  symbol: string;
  /** Force reference-mode labeling; defaults to the instrument's runtime availability. */
  referenceMode?: boolean;
  className?: string;
}

export default function AnalyticsSourceBadge({ symbol, referenceMode, className }: Props) {
  const inst = getInstrument(symbol);
  if (!inst) return null;
  const isReference =
    referenceMode ?? (inst.assetClass === 'future' && getAvailability(symbol).referenceMode);
  const label = analyticsSourceLabel(inst.analyticsSource, {
    referenceMode: isReference,
    targetSymbol: inst.symbol,
    sourceSymbol: inst.referenceSourceSymbol ?? undefined,
  });
  const tone = TONE_STYLES[label.tone];

  return (
    <span
      className={className}
      title={label.subtitle ?? label.title}
      style={{
        display: 'inline-flex',
        flexDirection: 'column',
        gap: 1,
        padding: '2px 8px',
        borderRadius: 8,
        border: `1px solid ${tone.border}`,
        background: tone.bg,
        color: tone.color,
        fontSize: 11,
        lineHeight: 1.2,
      }}
    >
      <span style={{ fontWeight: 700, letterSpacing: '0.02em' }}>{label.title}</span>
      {label.subtitle ? (
        <span style={{ opacity: 0.85, fontWeight: 500 }}>{label.subtitle}</span>
      ) : null}
    </span>
  );
}
