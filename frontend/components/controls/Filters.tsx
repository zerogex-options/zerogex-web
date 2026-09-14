'use client';

import type { ReactNode } from 'react';

/**
 * The ONE filter vocabulary for instrument pages.
 *
 * Before this, the Metrics section spoke four dialects at once: rounded-full
 * gold pills on the Spread Monitor, rounded-lg gold buttons on Forced Flow, a
 * rounded-xl segmented group with a brand-primary fill on Market Tide, and bare
 * native <select>s on Smart Money and Flow Analysis — plus an unstyled
 * checkbox on Hedging Flow. Same job, five looks.
 *
 * The Spread Monitor's pill won because it is the one that survives density:
 * hairline, transparent until chosen, and gold only on the active member, so a
 * row of eight choices reads as one control instead of eight buttons competing
 * for the eye.
 *
 *   <FilterBar>
 *     <FilterGroup label="Expiry">
 *       <FilterChip active={dte === 0} onClick={...}>0DTE only</FilterChip>
 *     </FilterGroup>
 *     <FilterDivider />
 *     <FilterToggle active={zeroDte} onChange={setZeroDte}>0DTE only</FilterToggle>
 *   </FilterBar>
 *
 * Everything here is a leaf: no surface, no border of its own, so it drops into
 * a SectionHead's `actions` slot without adding a second box to the page.
 */

const CHIP_CLASS =
  'rounded-full border px-3 py-1 text-xs font-semibold transition-colors ' +
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2';

function chipStyle(active: boolean) {
  return {
    borderColor: active ? 'var(--color-warning)' : 'var(--border-default)',
    backgroundColor: active ? 'var(--color-warning-soft)' : 'transparent',
    color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
    outlineColor: 'var(--color-warning)',
  } as const;
}

/** One member of a mutually-exclusive set. */
export function FilterChip({
  active,
  onClick,
  disabled = false,
  title,
  children,
}: {
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      title={title}
      className={CHIP_CLASS}
      style={{ ...chipStyle(active), opacity: disabled ? 0.45 : 1 }}
    >
      {children}
    </button>
  );
}

/**
 * A boolean, wearing the same pill. Replaces the raw `<input type="checkbox">`
 * the Hedging Flow shipped with: a native checkbox is the one control on these
 * pages the theme cannot reach, so it read as browser chrome that had wandered
 * into an instrument.
 */
export function FilterToggle({
  active,
  onChange,
  title,
  children,
}: {
  active: boolean;
  onChange: (next: boolean) => void;
  title?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={active}
      onClick={() => onChange(!active)}
      title={title}
      className={CHIP_CLASS}
      style={chipStyle(active)}
    >
      {children}
    </button>
  );
}

/** The row filters sit in. Wraps rather than overflowing on a phone. */
export function FilterBar({
  className = '',
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>{children}</div>
  );
}

/** A labelled cluster of chips. The label is the eyebrow unit, not a heading. */
export function FilterGroup({
  label,
  children,
}: {
  label?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {label ? (
        <span className="zg-eyebrow" style={{ fontSize: 10 }}>
          {label}
        </span>
      ) : null}
      {children}
    </div>
  );
}

/** Separates two chip clusters inside one bar. */
export function FilterDivider() {
  return (
    <span aria-hidden className="mx-1 opacity-40">
      |
    </span>
  );
}

/**
 * A native select in the page's own clothes, for choices too many or too long
 * to be chips (an expiration list, a 6-way threshold). Keyboard and mobile
 * behaviour stay native; only the box is ours.
 */
export function FilterSelect<T extends string>({
  label,
  value,
  onChange,
  options,
  ariaLabel,
}: {
  label?: ReactNode;
  value: T;
  onChange: (next: T) => void;
  options: ReadonlyArray<{ value: T; label: string }>;
  ariaLabel?: string;
}) {
  return (
    <label className="flex items-center gap-2">
      {label ? (
        <span className="zg-eyebrow" style={{ fontSize: 10 }}>
          {label}
        </span>
      ) : null}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
        aria-label={ariaLabel ?? (typeof label === 'string' ? label : undefined)}
        className="cursor-pointer border px-2.5 py-1 text-xs font-semibold focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
        style={{
          borderRadius: 'var(--radius-control)',
          borderColor: 'var(--border-default)',
          backgroundColor: 'var(--bg-subtle)',
          color: 'var(--text-primary)',
          outlineColor: 'var(--color-warning)',
        }}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
