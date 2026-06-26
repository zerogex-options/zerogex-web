'use client';

import { Info } from 'lucide-react';
import { GexUnit, useGexUnit } from '@/core/GexUnitContext';
import TooltipWrapper from './TooltipWrapper';

const OPTIONS: { value: GexUnit; label: string }[] = [
  { value: 'percent', label: '1%' },
  { value: 'point', label: '1pt' },
];

/**
 * Sleek segmented pill for the per-1%-move ⇄ per-1-point GEX unit
 * preference (backed by GexUnitContext, so it updates every GEX view at
 * once). The full explanation lives in the info tooltip rather than inline.
 */
export default function GexUnitToggle({ showHint = true }: { showHint?: boolean }) {
  const { gexUnit, setGexUnit } = useGexUnit();
  return (
    <div className="inline-flex items-center gap-1.5">
      <div
        role="group"
        aria-label="GEX unit"
        className="inline-flex items-center rounded-full p-0.5 border"
        style={{
          borderColor: 'var(--border-subtle)',
          backgroundColor: 'var(--color-surface-subtle)',
        }}
      >
        {OPTIONS.map(({ value, label }) => {
          const active = gexUnit === value;
          return (
            <button
              key={value}
              type="button"
              onClick={() => setGexUnit(value)}
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
        <TooltipWrapper text="Dollar GEX unit. 1% = $ gamma per 1% spot move (γ·OI·100·S²·0.01); 1pt = per 1 point (÷ spot × 0.01). Same exposure, different unit.">
          <Info size={13} style={{ color: 'var(--text-muted)' }} />
        </TooltipWrapper>
      )}
    </div>
  );
}
