'use client';

import SegmentedToggle from './controls/SegmentedToggle';
import { GexUnit, useGexUnit } from '@/core/GexUnitContext';

const OPTIONS: { value: GexUnit; label: string }[] = [
  { value: 'percent', label: '1%' },
  { value: 'point', label: '1pt' },
];

/**
 * The per-1%-move ⇄ per-1-point GEX unit preference (backed by GexUnitContext,
 * so it updates every GEX view at once). The full explanation lives in the info
 * tooltip rather than inline.
 */
export default function GexUnitToggle({ showHint = true }: { showHint?: boolean }) {
  const { gexUnit, setGexUnit } = useGexUnit();
  return (
    <SegmentedToggle
      ariaLabel="GEX unit"
      value={gexUnit}
      onChange={setGexUnit}
      options={OPTIONS}
      showHint={showHint}
      hint="Dollar GEX unit. 1% = $ gamma per 1% spot move (γ·OI·100·S²·0.01); 1pt = per 1 point (÷ spot × 0.01). Same exposure, different unit."
    />
  );
}
