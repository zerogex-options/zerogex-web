'use client';

import { Info } from 'lucide-react';
import { useStrikeFilter } from '@/core/StrikeFilterContext';
import TooltipWrapper from './TooltipWrapper';

const OPTIONS: { value: boolean; label: string }[] = [
  { value: true, label: 'Active' },
  { value: false, label: 'All' },
];

/**
 * Segmented pill for the "active strikes only" preference (backed by
 * StrikeFilterContext, so it updates every per-strike GEX view at once and
 * persists across reloads). "Active" hides strikes with no dealer positioning
 * so a high-priced chain like NDX — a fine listed grid with OI only on the
 * round strikes — doesn't read as sparse; "All" shows every listed strike.
 * Deliberately mirrors GexUnitToggle so the two sit together consistently.
 */
export default function StrikeFilterToggle({ showHint = true }: { showHint?: boolean }) {
  const { activeOnly, setActiveOnly } = useStrikeFilter();
  return (
    <div className="inline-flex items-center gap-1.5">
      <div
        role="group"
        aria-label="Strike filter"
        className="inline-flex items-center rounded-full p-0.5 border"
        style={{
          borderColor: 'var(--border-subtle)',
          backgroundColor: 'var(--color-surface-subtle)',
        }}
      >
        {OPTIONS.map(({ value, label }) => {
          const active = activeOnly === value;
          return (
            <button
              key={label}
              type="button"
              onClick={() => setActiveOnly(value)}
              aria-pressed={active}
              className="px-3 py-1 text-xs font-semibold rounded-full transition-colors"
              style={
                active
                  ? { backgroundColor: 'var(--color-info)', color: 'var(--color-surface)' }
                  : { background: 'transparent', color: 'var(--text-muted)' }
              }
            >
              {label}
            </button>
          );
        })}
      </div>
      {showHint && (
        <TooltipWrapper text="Active hides strikes with no dealer positioning (no open interest) so the ladder and table fill with real levels — high-priced chains like NDX list a fine strike grid but only accrue open interest on the round strikes. All shows every listed strike near spot.">
          <Info size={13} style={{ color: 'var(--text-muted)' }} />
        </TooltipWrapper>
      )}
    </div>
  );
}
