'use client';

import SegmentedToggle from './controls/SegmentedToggle';
import { useSessionDelta } from '@/core/SessionDeltaContext';

const OPTIONS: { value: boolean; label: string }[] = [
  { value: true, label: 'On' },
  { value: false, label: 'Off' },
];

/**
 * The ladder's "Δ since open" indicator (backed by SessionDeltaContext, so it
 * updates every gamma ladder at once and persists across reloads). On overlays
 * a small green▲/red▼ next to each strike's live Net GEX showing whether dealer
 * gamma there has built or eroded since the session opened — scoped to whatever
 * expirations are selected.
 */
export default function SessionDeltaToggle({ showHint = true }: { showHint?: boolean }) {
  const { showSessionDelta, setShowSessionDelta } = useSessionDelta();
  return (
    <SegmentedToggle
      ariaLabel="Session delta indicator"
      value={showSessionDelta}
      onChange={setShowSessionDelta}
      options={OPTIONS}
      showHint={showHint}
      hint="Overlay a small green up / red down triangle beside each strike's live Net GEX showing whether dealer gamma there has built or eroded since the 09:30 ET open&nbsp;- for whatever expirations are selected. Small drifts are left unmarked so the ladder stays clean."
    />
  );
}
