'use client';

/**
 * Shared primitives and type scale for the Gamma Shift page.
 *
 * These exist because the first cut of this page invented its own sizes per
 * component and drifted well below the app's floor — 196 text nodes rendered
 * under 12px, some as small as 7px, while `.zg-label` (the house micro-label)
 * is 11px. Everything on the page now comes from the scale below, so a size
 * is a decision made once rather than a literal typed in three files.
 *
 * The scale, and what each step is for:
 *
 *   ZONE  11px mono, uppercase, tracked — a zone's name inside a panel.
 *         Matches `.zg-label`; nothing on this page goes smaller.
 *   NOTE  12px — captions, legends, disclosure lines.
 *   BODY  13-14px — prose a reader actually reads.
 *   STAT  20px mono — a level's current value. These are the numbers the
 *         page exists to show, so they are sized like it.
 *   HERO  40px — the state, the one thing readable across a desk.
 *
 * Composition rule, from components/layout/Panel.tsx: "one border deep —
 * never nest a Panel inside another Panel; group leaf tiles inside a single
 * Panel and separate them with rules." The first cut nested bordered boxes
 * inside bordered panels, which both violated that and spent ~26px of
 * horizontal padding per nested box. Zones here are separated by hairline
 * rules instead, which is why `Zone` draws a top border rather than a box.
 */

import type { ReactNode } from 'react';
import { Info } from 'lucide-react';
import TooltipWrapper from './TooltipWrapper';

export type Tone = 'bull' | 'bear' | 'warning' | 'info' | 'muted';

export function toneColor(tone: Tone): string {
  switch (tone) {
    case 'bull':
      return 'var(--color-bull)';
    case 'bear':
      return 'var(--color-bear)';
    case 'warning':
      return 'var(--color-warning)';
    case 'info':
      return 'var(--color-info)';
    default:
      return 'var(--text-muted)';
  }
}

export function toneSoft(tone: Tone): string {
  switch (tone) {
    case 'bull':
      return 'var(--color-bull-soft)';
    case 'bear':
      return 'var(--color-bear-soft)';
    case 'warning':
      return 'var(--color-warning-soft)';
    case 'info':
      return 'var(--color-info-soft)';
    default:
      return 'var(--bg-subtle)';
  }
}

/** A panel's title row: name, an optional explainer, and right-aligned controls. */
export function PanelHeader({
  title,
  tooltip,
  right,
}: {
  title: string;
  tooltip?: string;
  right?: ReactNode;
}) {
  return (
    <div
      className="flex flex-wrap items-center gap-2 border-b px-5 py-3.5"
      style={{ borderColor: 'var(--border-subtle)' }}
    >
      <h3 className="zg-h3" style={{ color: 'var(--text-primary)' }}>
        {title}
      </h3>
      {tooltip && (
        <TooltipWrapper text={tooltip}>
          <Info size={15} />
        </TooltipWrapper>
      )}
      {right && <div className="ml-auto flex flex-wrap items-center gap-2">{right}</div>}
    </div>
  );
}

/**
 * One zone inside a panel, separated from the previous by a rule.
 *
 * `flush` drops the rule for the first zone under a PanelHeader, which
 * already draws one.
 */
export function Zone({
  label,
  right,
  flush = false,
  padded = true,
  children,
}: {
  label?: string;
  right?: ReactNode;
  flush?: boolean;
  padded?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={`${padded ? 'px-5 py-4' : ''} ${flush ? '' : 'border-t'}`}
      style={flush ? undefined : { borderColor: 'var(--border-subtle)' }}
    >
      {(label || right) && (
        <div className={`mb-3 flex items-center justify-between gap-3 ${padded ? '' : 'px-5 pt-4'}`}>
          {label && <span className="zg-label">{label}</span>}
          {right && (
            <span className="font-mono text-[12px]" style={{ color: 'var(--text-muted)' }}>
              {right}
            </span>
          )}
        </div>
      )}
      {children}
    </div>
  );
}

/**
 * One level's before → after, as a tile in a horizontal row.
 *
 * The vertical list this replaces used about half the width it was given and
 * left ~100px dead underneath. A row of tiles fills the panel, and — more to
 * the point — lets the value be 20px instead of 13px, which is the right size
 * for the thing a trader is actually here to read.
 *
 * `direction` drives the glyph, `sense` drives the color. They are separate
 * because a gamma flip dropping is a falling number and a bullish event; bind
 * them to one field and every flip-crossing tile renders the wrong color.
 */
export function LevelTile({
  label,
  before,
  after,
  glyph,
  color,
  note,
}: {
  label: string;
  before?: string;
  after: string;
  glyph: string;
  color: string;
  note?: string;
}) {
  return (
    <div className="min-w-0 flex-1 basis-[150px] px-1">
      <div className="zg-label mb-1.5 truncate">{label}</div>
      <div className="flex items-baseline gap-1.5">
        {before ? (
          <>
            <span
              className="whitespace-nowrap font-mono text-[14px] tabular-nums line-through"
              style={{ color: 'var(--text-muted)' }}
            >
              {before}
            </span>
            <span className="font-mono text-[13px]" style={{ color }}>
              {glyph}
            </span>
          </>
        ) : null}
        <span className="whitespace-nowrap font-mono text-[20px] font-bold tabular-nums" style={{ color }}>
          {after}
        </span>
      </div>
      {note && (
        <div className="mt-1 truncate text-[12px]" style={{ color: 'var(--text-muted)' }} title={note}>
          {note}
        </div>
      )}
    </div>
  );
}

/** A big headline stat — the number a panel is named after. */
export function HeroStat({
  eyebrow,
  value,
  caption,
  tone,
}: {
  eyebrow: string;
  value: string;
  caption: string;
  tone: Tone;
}) {
  const color = toneColor(tone);
  return (
    <div
      className="min-w-[168px] shrink-0 rounded-lg px-4 py-3"
      style={{ background: toneSoft(tone), border: `1px solid ${color}`, color }}
    >
      <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] opacity-80">
        {eyebrow}
      </div>
      <div className="mt-1 text-[40px] font-bold leading-[1.05] tracking-tight">{value}</div>
      <div className="mt-0.5 font-mono text-[12px] opacity-90">{caption}</div>
    </div>
  );
}

/** A small labeled reading, e.g. "stabilizing +2.6σ". */
export function Chip({ label, value }: { label: string; value?: string }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-semibold"
      style={{
        background: 'var(--bg-subtle)',
        border: '1px solid var(--border-subtle)',
        color: 'var(--text-secondary)',
      }}
    >
      {label}
      {value && <span className="font-mono tabular-nums opacity-85">{value}</span>}
    </span>
  );
}

/** A disclosure / caveat line. Warning-toned when it qualifies a claim. */
export function Note({
  children,
  tone = 'muted',
}: {
  children: ReactNode;
  tone?: 'muted' | 'warning';
}) {
  return (
    <p
      className="text-[12px] leading-relaxed"
      style={{ color: tone === 'warning' ? 'var(--color-warning)' : 'var(--text-muted)' }}
    >
      {children}
    </p>
  );
}

/** Centered placeholder for a panel's loading / empty / error states. */
export function PanelMessage({
  children,
  tone = 'secondary',
  height = 200,
}: {
  children: ReactNode;
  tone?: 'secondary' | 'bear';
  height?: number;
}) {
  return (
    <div
      className="flex items-center justify-center px-6 text-center text-[14px]"
      style={{
        minHeight: height,
        color: tone === 'bear' ? 'var(--color-bear)' : 'var(--text-secondary)',
      }}
    >
      {children}
    </div>
  );
}
