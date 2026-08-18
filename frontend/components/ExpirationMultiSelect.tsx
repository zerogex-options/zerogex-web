'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';

interface ExpirationMultiSelectProps {
  /** Available expirations, ascending (YYYY-MM-DD). */
  options: string[];
  /**
   * Currently-selected expirations.  An EMPTY array means "All" — the
   * aggregate across every expiration — matching the convention the charts
   * and the strike-profile-timeseries endpoint use (empty / 'all' → no
   * filter).  A non-empty array aggregates the gamma surface, walls and
   * flip across exactly those expirations.
   */
  selected: string[];
  onChange: (next: string[]) => void;
  /** Field label rendered before the trigger (e.g. "Expiration"). */
  label?: string;
  disabled?: boolean;
  /**
   * Optional third state offered above "All expirations", for callers where a
   * selection can also be INHERITED rather than made here — the split "My
   * Dashboard" board, whose two halves each either follow the page-wide
   * selection or pin their own. Omitted everywhere else, leaving the control
   * exactly as it was: All, or an explicit set.
   */
  inheritOption?: {
    label: string;
    /** True while the caller is inheriting — shown checked and as the summary. */
    active: boolean;
    onSelect: () => void;
  };
}

/**
 * Compact multi-select for expirations, shared by the "Gamma Exposure by
 * Strike" and "Open Interest by Strike" charts.  Replaces the
 * single-select ``<select>`` those charts used so the user can aggregate
 * several expirations at once.  "All expirations" clears the set; each row
 * toggles one expiration in/out, and the popover stays open across toggles
 * so a set can be built in a single interaction.
 */
export default function ExpirationMultiSelect({
  options,
  selected,
  onChange,
  label = 'Expiration',
  disabled = false,
  inheritOption,
}: ExpirationMultiSelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const summary = inheritOption?.active
    ? inheritOption.label
    : selected.length === 0
      ? 'All'
      : selected.length === 1
        ? selected[0]
        : `${selected.length} exps`;

  // "All" is only the active row when nothing is being inherited — otherwise the
  // inherit row owns the checkmark.
  const allActive = selected.length === 0 && !inheritOption?.active;

  const toggle = (exp: string) =>
    onChange(selected.includes(exp) ? selected.filter((v) => v !== exp) : [...selected, exp]);

  return (
    <div ref={ref} className="relative inline-flex items-center">
      <span className="text-xs mr-2" style={{ color: 'var(--text-primary)' }}>
        {label}
      </span>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={disabled}
        title="Filter by expiration (select one or more to aggregate)"
        className="inline-flex items-center justify-between gap-1 rounded px-2 py-1 text-xs disabled:opacity-50 disabled:cursor-not-allowed"
        style={{
          backgroundColor: 'var(--color-surface-subtle)',
          color: 'var(--color-text-primary)',
          border: `1px solid var(--color-border)`,
          // Wide enough for the longest summary (a full YYYY-MM-DD) so the
          // trigger keeps one width whatever is selected. Otherwise picking a
          // date grows the control, which can rewrap the toolbar it sits in —
          // on a split "My Dashboard" board that pushed one half's chart down
          // and knocked the two sides out of alignment.
          minWidth: 104,
        }}
      >
        <span>{summary}</span>
        <ChevronDown size={12} />
      </button>
      {open && (
        <div
          className="absolute top-full right-0 mt-1 rounded-md py-1 z-30"
          style={{
            backgroundColor: 'var(--color-chart-tooltip-bg)',
            border: `1px solid var(--color-border)`,
            boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
            minWidth: 180,
            maxHeight: 280,
            overflowY: 'auto',
          }}
        >
          {inheritOption && (
            <button
              type="button"
              onClick={inheritOption.onSelect}
              className="w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 hover:bg-[color:var(--color-info-soft)]"
              style={{
                color: inheritOption.active
                  ? 'var(--color-text-primary)'
                  : 'var(--color-text-secondary)',
                fontWeight: inheritOption.active ? 600 : 400,
              }}
            >
              <span className="inline-flex w-3 justify-center">{inheritOption.active ? '✓' : ''}</span>
              {inheritOption.label}
            </button>
          )}
          <button
            type="button"
            onClick={() => onChange([])}
            className="w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 hover:bg-[color:var(--color-info-soft)]"
            style={{
              color: allActive ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
              fontWeight: allActive ? 600 : 400,
            }}
          >
            <span className="inline-flex w-3 justify-center">{allActive ? '✓' : ''}</span>
            All expirations
          </button>
          {options.map((exp) => {
            const checked = !inheritOption?.active && selected.includes(exp);
            return (
              <button
                key={exp}
                type="button"
                onClick={() => toggle(exp)}
                className="w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 hover:bg-[color:var(--color-info-soft)]"
                style={{
                  color: checked ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                  fontWeight: checked ? 600 : 400,
                }}
              >
                <span className="inline-flex w-3 justify-center">{checked ? '✓' : ''}</span>
                {exp}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
