'use client';

import { Info } from 'lucide-react';
import { useSessionDelta } from '@/core/SessionDeltaContext';
import TooltipWrapper from './TooltipWrapper';

const OPTIONS: { value: boolean; label: string }[] = [
  { value: true, label: 'On' },
  { value: false, label: 'Off' },
];

/**
 * Segmented pill for the ladder's "Δ since open" indicator (backed by
 * SessionDeltaContext, so it updates every gamma ladder at once and persists
 * across reloads). On overlays a small green▲/red▼ next to each strike's live
 * Net GEX showing whether dealer gamma there has built or eroded since the
 * session opened — scoped to whatever expirations are selected. Deliberately
 * mirrors StrikeFilterToggle so the pills sit together consistently.
 */
export default function SessionDeltaToggle({ showHint = true }: { showHint?: boolean }) {
  const { showSessionDelta, setShowSessionDelta } = useSessionDelta();
  return (
    <div className="inline-flex items-center gap-1.5">
      <div
        role="group"
        aria-label="Session delta indicator"
        className="inline-flex items-center rounded-full p-0.5 border"
        style={{
          borderColor: 'var(--border-subtle)',
          backgroundColor: 'var(--color-surface-subtle)',
        }}
      >
        {OPTIONS.map(({ value, label }) => {
          const active = showSessionDelta === value;
          return (
            <button
              key={label}
              type="button"
              onClick={() => setShowSessionDelta(value)}
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
        <TooltipWrapper text="Overlay a small green up / red down triangle beside each strike's live Net GEX showing whether dealer gamma there has built or eroded since the 09:30 ET open — for whatever expirations are selected. Small drifts are left unmarked so the ladder stays clean.">
          <Info size={13} style={{ color: 'var(--text-muted)' }} />
        </TooltipWrapper>
      )}
    </div>
  );
}
