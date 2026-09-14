import type { ReactNode } from 'react';

import Panel from './Panel';

export type Tone = 'bullish' | 'bearish' | 'neutral' | 'muted';

export const TONE_COLOR: Record<Tone, string> = {
  bullish: 'var(--color-bull)',
  bearish: 'var(--color-bear)',
  neutral: 'var(--text-primary)',
  muted: 'var(--text-secondary)',
};

/**
 * A verdict tile: eyebrow, one large mono value, and the sentence that says
 * what the value means.
 *
 * The difference from MetricCard is which way round the weight sits. MetricCard
 * is a number with a caption — four across the top of a page, scanned. This is
 * a READING with a number attached, so the prose gets room and the tile gets
 * half a row. The Spread Monitor's "Against this symbol's own history" and
 * "Since the open" pair is the shape; Max Pain, Market Tide and Volatility each
 * hand-rolled their own near-miss of it.
 */
export default function ReadoutTile({
  title,
  value,
  tone = 'neutral',
  className = '',
  children,
}: {
  title: ReactNode;
  value: ReactNode;
  tone?: Tone;
  className?: string;
  /** The reading — one short paragraph on what the value is telling you. */
  children?: ReactNode;
}) {
  return (
    <Panel className={className}>
      <h3 className="zg-eyebrow mb-2">{title}</h3>
      <div className="zg-metric text-2xl" style={{ color: TONE_COLOR[tone] }}>
        {value}
      </div>
      {children ? (
        <p
          className="mt-2 text-[11px] leading-relaxed"
          style={{ color: 'var(--text-secondary)' }}
        >
          {children}
        </p>
      ) : null}
    </Panel>
  );
}
