'use client';

import { GexUnit, GEX_UNIT_LABEL, useGexUnit } from '@/core/GexUnitContext';

/**
 * Shared control for the per-1%-move ⇄ per-1-point GEX unit preference.
 * Backed by GexUnitContext so flipping it here updates every GEX view
 * (summary cards, profile chart, heatmaps) at once.
 */
export default function GexUnitToggle({ showHint = true }: { showHint?: boolean }) {
  const { gexUnit, setGexUnit } = useGexUnit();
  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="text-sm text-[var(--text-muted)]">GEX unit:</span>
      <div className="inline-flex rounded-lg border border-[var(--border-subtle)] overflow-hidden">
        {(['percent', 'point'] as GexUnit[]).map((unit) => (
          <button
            key={unit}
            type="button"
            onClick={() => setGexUnit(unit)}
            aria-pressed={gexUnit === unit}
            className={`px-3 py-1.5 text-sm font-semibold transition-colors ${
              gexUnit === unit
                ? 'bg-[var(--color-info-soft)] text-[var(--text-primary)]'
                : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            }`}
          >
            {GEX_UNIT_LABEL[unit]}
          </button>
        ))}
      </div>
      {showHint && (
        <span className="text-xs text-[var(--text-muted)]">
          Per-point = per-1% ÷ (spot × 0.01). Same exposure, different unit.
        </span>
      )}
    </div>
  );
}
