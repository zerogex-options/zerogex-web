'use client';

import SegmentedToggle from './controls/SegmentedToggle';
import { useStrikeFilter } from '@/core/StrikeFilterContext';

const OPTIONS: { value: boolean; label: string }[] = [
  { value: true, label: 'Active' },
  { value: false, label: 'All' },
];

/**
 * The "active strikes only" preference (backed by StrikeFilterContext, so it
 * updates every per-strike GEX view at once and persists across reloads).
 * "Active" hides strikes with no dealer positioning so a high-priced chain like
 * NDX — a fine listed grid with OI only on the round strikes — doesn't read as
 * sparse; "All" shows every listed strike.
 */
export default function StrikeFilterToggle({ showHint = true }: { showHint?: boolean }) {
  const { activeOnly, setActiveOnly } = useStrikeFilter();
  return (
    <SegmentedToggle
      ariaLabel="Strike filter"
      value={activeOnly}
      onChange={setActiveOnly}
      options={OPTIONS}
      showHint={showHint}
      hint="Active hides strikes with no dealer positioning (no open interest) so the ladder and table fill with real levels&nbsp;- high-priced chains like NDX list a fine strike grid but only accrue open interest on the round strikes. All shows every listed strike near spot."
    />
  );
}
