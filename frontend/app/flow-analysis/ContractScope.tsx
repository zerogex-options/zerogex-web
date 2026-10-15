'use client';

/**
 * Which contracts the Flow Analysis page reads: every one by default, or the
 * strikes and expirations picked here. A pick narrows the whole page (the
 * read, the bought/sold board, the chart and the logs) rather than one chart
 * on it, so the numbers on the page always describe the same contracts.
 *
 * Expirations are the tab-wide shared selection (hooks/useSharedExpirations),
 * the same one the gamma charts filter by; strikes are this page's own.
 */

import { X } from 'lucide-react';
import FadeScrollRow from '@/components/FadeScrollRow';
import { FilterChip } from '@/components/controls/Filters';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "2026-10-15" → "Oct 15". */
export function expiryLabel(dateKey: string): string {
  const [, m, d] = dateKey.split('-').map(Number);
  return m && d ? `${MONTHS[m - 1]} ${d}` : dateKey;
}

/**
 * One line for the control: "All contracts", "0DTE", "2 strikes · Oct 16".
 * `sessionKey` is the ET date of the session on the page: its same-day
 * expiration is the 0DTE, today's or a past session's.
 */
export function scopeSummary(strikes: readonly string[], expirations: readonly string[], sessionKey: string): string {
  const parts: string[] = [];
  if (strikes.length === 1) parts.push(`${strikes[0]} strike`);
  else if (strikes.length > 1) parts.push(`${strikes.length} strikes`);
  if (expirations.length === 1) parts.push(expirations[0] === sessionKey ? '0DTE' : expiryLabel(expirations[0]));
  else if (expirations.length > 1) parts.push(`${expirations.length} expirations`);
  return parts.length ? parts.join(' · ') : 'All contracts';
}

export function ContractScopeButton({
  summary,
  active,
  open,
  onToggle,
  onClear,
}: {
  summary: string;
  active: boolean;
  open: boolean;
  onToggle: () => void;
  onClear: () => void;
}) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <span className="zg-eyebrow" style={{ fontSize: 10 }}>
        Contracts
      </span>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls="flow-contract-scope"
        className="border px-2.5 py-1 pointer-coarse:py-1.5 text-xs font-semibold"
        style={{
          borderRadius: 'var(--radius-control)',
          borderColor: active ? 'var(--color-warning)' : 'var(--border-default)',
          backgroundColor: active ? 'var(--color-warning-soft)' : 'var(--bg-subtle)',
          color: 'var(--text-primary)',
          cursor: 'pointer',
        }}
      >
        {summary} {open ? '▴' : '▾'}
      </button>
      {active && (
        <button type="button" onClick={onClear} aria-label="Show all contracts" title="Show all contracts" className="zg-icon-btn zg-icon-btn--sm">
          <X size={14} aria-hidden />
        </button>
      )}
    </span>
  );
}

function ChipRow({
  label,
  options,
  selected,
  render,
  onToggle,
  onClear,
  loading,
  error,
}: {
  label: string;
  options: readonly string[];
  selected: ReadonlySet<string>;
  render: (v: string) => string;
  onToggle: (v: string) => void;
  onClear: () => void;
  loading: boolean;
  error: string | null;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
      <span className="zg-label" style={{ width: 92, flex: 'none' }}>
        {label}
      </span>
      <FadeScrollRow className="flex gap-1.5 overflow-x-auto flex-1 min-w-0 py-0.5" style={{ scrollbarWidth: 'thin' }} desktopFade>
        <FilterChip active={selected.size === 0} onClick={onClear}>
          All
        </FilterChip>
        {options.length === 0 ? (
          <span className="zg-caption" style={{ alignSelf: 'center', whiteSpace: 'nowrap' }}>
            {error ? `Could not load: ${error}` : loading ? 'Loading…' : 'None traded yet'}
          </span>
        ) : (
          options.map((o) => (
            <FilterChip key={o} active={selected.has(o)} onClick={() => onToggle(o)}>
              {render(o)}
            </FilterChip>
          ))
        )}
      </FadeScrollRow>
    </div>
  );
}

export function ContractScopePanel({
  strikeOptions,
  expirationOptions,
  selectedStrikes,
  selectedExpirations,
  onToggleStrike,
  onToggleExpiration,
  onClearStrikes,
  onClearExpirations,
  sessionKey,
  loading,
  error,
  note,
}: {
  strikeOptions: readonly string[];
  expirationOptions: readonly string[];
  selectedStrikes: ReadonlySet<string>;
  selectedExpirations: ReadonlySet<string>;
  onToggleStrike: (v: string) => void;
  onToggleExpiration: (v: string) => void;
  onClearStrikes: () => void;
  onClearExpirations: () => void;
  /** The session's ET date, whose same-day expiration is labeled 0DTE. */
  sessionKey: string;
  loading: boolean;
  error: string | null;
  /** Whose contracts these are, when that is not the symbol on the page. */
  note: string | null;
}) {
  return (
    <section id="flow-contract-scope" aria-label="Contracts" className="zg-panel" style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      {note && (
        <p className="zg-caption" style={{ margin: 0 }}>
          {note}
        </p>
      )}
      <ChipRow
        label="Expiration"
        options={expirationOptions}
        selected={selectedExpirations}
        render={(v) => (v === sessionKey ? `0DTE · ${expiryLabel(v)}` : expiryLabel(v))}
        onToggle={onToggleExpiration}
        onClear={onClearExpirations}
        loading={loading}
        error={error}
      />
      <ChipRow
        label="Strike"
        options={strikeOptions}
        selected={selectedStrikes}
        render={(v) => v}
        onToggle={onToggleStrike}
        onClear={onClearStrikes}
        loading={loading}
        error={error}
      />
      <p className="zg-caption" style={{ margin: 0 }}>
        Picks narrow everything on this page. Expiration picks are shared with the gamma charts in this tab.
      </p>
    </section>
  );
}
