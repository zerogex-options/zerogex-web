'use client';

import SegmentedToggle from './controls/SegmentedToggle';
import { useLadderBasis } from '@/core/LadderBasisContext';
import type { LadderBasis } from '@/core/ladderBasis';

const OPTIONS: { value: LadderBasis; label: string }[] = [
  { value: 'oi', label: 'OI' },
  { value: 'volume', label: 'Volume' },
];

/**
 * What the gamma ladders weight each strike's gamma by (backed by
 * LadderBasisContext, so it switches every ladder at once and persists across
 * reloads). OI is the dealer book; Volume is where the session's gamma is
 * trading. Live only: rewind and replay show the open-interest book.
 */
export default function LadderBasisToggle({ showHint = true }: { showHint?: boolean }) {
  const { ladderBasis, setLadderBasis } = useLadderBasis();
  return (
    <SegmentedToggle
      ariaLabel="Gamma ladder basis"
      value={ladderBasis}
      onChange={setLadderBasis}
      options={OPTIONS}
      showHint={showHint}
      hint="OI weights each strike's gamma by open interest: the dealer book, published once a day. Volume weights the same gamma by the contracts traded this session, so it shows where today's gamma is trading, including positions open interest can't see yet. Volume can't tell an opening trade from a closing one, so read it as activity, not positioning. The regime and the levels stay on the open-interest book. Live only."
    />
  );
}
