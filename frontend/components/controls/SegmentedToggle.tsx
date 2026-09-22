'use client';

import { Info } from 'lucide-react';

import TooltipWrapper from '@/components/TooltipWrapper';
import { FilterChip } from './Filters';

/**
 * A two-or-three-way preference, as a row of the page's own filter chips.
 *
 * GexUnitToggle, StrikeFilterToggle and SessionDeltaToggle were three
 * byte-identical copies of the same markup, all filling the active segment with
 * `--color-info` — a blue that belongs to nothing else on these pages and that
 * put two different filter looks side by side wherever one of them sat next to
 * a page's own chips. They now share this, so a preference toggle and a scope
 * filter read as the same control at the same weight.
 *
 * The `hint` is the long read, on the same Info glyph every other explainer on
 * the page uses.
 */
export default function SegmentedToggle<T>({
  ariaLabel,
  value,
  onChange,
  options,
  hint,
  showHint = true,
  label,
}: {
  ariaLabel: string;
  value: T;
  onChange: (next: T) => void;
  options: ReadonlyArray<{ value: T; label: string }>;
  hint?: string;
  showHint?: boolean;
  /** Optional eyebrow printed before the chips, e.g. "GEX unit". */
  label?: string;
}) {
  return (
    <div className="inline-flex items-center gap-1.5">
      {label ? (
        <span className="zg-eyebrow" style={{ fontSize: 10 }}>
          {label}
        </span>
      ) : null}
      <div role="group" aria-label={ariaLabel} className="inline-flex items-center gap-1">
        {options.map((option) => (
          <FilterChip
            key={option.label}
            active={value === option.value}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </FilterChip>
        ))}
      </div>
      {showHint && hint ? (
        <TooltipWrapper text={hint}>
          <Info size={13} style={{ color: 'var(--text-muted)' }} />
        </TooltipWrapper>
      ) : null}
    </div>
  );
}
