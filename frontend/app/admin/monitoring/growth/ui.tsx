'use client';

import { useId, useState, type ReactNode } from 'react';

// The page's shared furniture. Everything on Growth is one of five things: a
// headline number, a stage in a funnel, a proportion, a ranked table, or a
// disclosure hiding detail until it is asked for. Building those five once is
// what keeps the page from becoming another wall of differently-shaped cards.

export function Panel({
  title,
  subtitle,
  right,
  children,
  className = '',
}: {
  title?: string;
  subtitle?: ReactNode;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-lg p-4 md:p-5 ${className}`}
      style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
    >
      {(title || right) && (
        <div className="flex items-baseline justify-between gap-3 flex-wrap mb-1">
          {title && <h3 className="zg-h3">{title}</h3>}
          {right}
        </div>
      )}
      {subtitle && (
        <p className="text-xs mb-3" style={{ color: 'var(--color-text-secondary)' }}>{subtitle}</p>
      )}
      {children}
    </section>
  );
}

/**
 * A folded section. Everything below the fold on this page lives in one of
 * these: the summary line has to say what is inside well enough that the
 * operator can decide not to open it.
 */
export function Disclosure({
  title,
  summary,
  children,
  defaultOpen = false,
}: {
  title: string;
  summary: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();
  return (
    <section
      className="rounded-lg overflow-hidden"
      style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
    >
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-controls={panelId}
        className="w-full flex items-baseline gap-3 px-4 md:px-5 py-3.5 text-left"
      >
        <span
          aria-hidden
          className="text-xs leading-none translate-y-px transition-transform"
          style={{ color: 'var(--color-text-secondary)', transform: open ? 'rotate(90deg)' : 'none' }}
        >
          ▶
        </span>
        <span className="zg-h4">{title}</span>
        <span className="text-xs flex-1 min-w-0" style={{ color: 'var(--color-text-secondary)' }}>{summary}</span>
      </button>
      {open && (
        <div id={panelId} className="px-4 md:px-5 pb-5 pt-1 space-y-4" style={{ borderTop: '1px solid var(--color-border)' }}>
          {children}
        </div>
      )}
    </section>
  );
}

/**
 * One number with its name and, when there is one, the qualifier that stops it
 * being read as more certain than it is.
 */
export function StatTile({
  label,
  value,
  hint,
  tone,
  onClick,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: string;
  onClick?: () => void;
}) {
  const body = (
    <>
      <div className="text-2xl font-semibold tabular-nums leading-none" style={{ color: tone ?? 'var(--color-text-primary)' }}>
        {value}
      </div>
      <div className="mt-1.5 text-xs font-semibold">{label}</div>
      {hint && <div className="mt-0.5 text-xs" style={{ color: 'var(--color-text-secondary)' }}>{hint}</div>}
    </>
  );
  const style = { border: '1px solid var(--color-border)' };
  return onClick
    ? <button type="button" onClick={onClick} className="rounded-lg p-3 text-left hover:opacity-80" style={style}>{body}</button>
    : <div className="rounded-lg p-3" style={style}>{body}</div>;
}

/**
 * A proportion split into named parts. The 2px gaps are load-bearing: they are
 * the secondary encoding that keeps two adjacent segments apart for a reader who
 * cannot separate the hues.
 */
export function ProportionBar({
  parts,
  total,
}: {
  parts: Array<{ key: string; label: string; value: number; color: string }>;
  total: number;
}) {
  const shown = parts.filter((part) => part.value > 0);
  return (
    <div>
      <div className="flex h-2.5 gap-0.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--color-border)' }}>
        {shown.map((part) => (
          <div
            key={part.key}
            className="h-full first:rounded-l-full last:rounded-r-full"
            style={{ width: `${total > 0 ? (part.value / total) * 100 : 0}%`, backgroundColor: part.color }}
          />
        ))}
      </div>
      <ul className="mt-3 space-y-1.5">
        {parts.map((part) => (
          <li key={part.key} className="flex items-baseline gap-2 text-sm">
            <span aria-hidden className="h-2 w-2 rounded-full shrink-0 translate-y-px" style={{ backgroundColor: part.color }} />
            <span className="flex-1 min-w-0">{part.label}</span>
            <span className="tabular-nums font-semibold">{part.value.toLocaleString()}</span>
            <span className="tabular-nums text-xs w-12 text-right" style={{ color: 'var(--color-text-secondary)' }}>
              {total > 0 ? `${Math.round((part.value / total) * 100)}%` : '—'}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** A labeled magnitude bar for a ranked list. One hue; length is the value. */
export function RankBar({ value, max, color }: { value: number; max: number; color: string }) {
  return (
    <div className="h-1.5 rounded-full" style={{ backgroundColor: 'var(--color-border)' }}>
      <div
        className="h-full rounded-full"
        style={{ width: `${max > 0 ? Math.max(value > 0 ? 2 : 0, (value / max) * 100) : 0}%`, backgroundColor: color }}
      />
    </div>
  );
}

export function Sentence({ children, lead = false }: { children: ReactNode; lead?: boolean }) {
  return (
    <p
      className={lead ? 'text-base md:text-lg' : 'text-sm'}
      style={{ color: lead ? 'var(--color-text-primary)' : 'var(--color-text-secondary)' }}
    >
      {children}
    </p>
  );
}

/** A row of mutually exclusive choices. Used for the window and cadence filters. */
export function ChoiceRow<T extends string | number | null>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: Array<{ value: T; label: string }>;
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap" role="group" aria-label={label}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={String(option.value)}
            type="button"
            onClick={() => onChange(option.value)}
            aria-pressed={active}
            className="px-2.5 py-1 text-xs font-semibold rounded"
            style={{
              color: active ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
              border: `1px solid ${active ? 'var(--color-warning)' : 'var(--color-border)'}`,
            }}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
