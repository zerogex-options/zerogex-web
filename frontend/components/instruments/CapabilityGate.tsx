'use client';

// Renders its children only when `symbol` actually supports `capability` at
// runtime; otherwise shows a clear "unavailable" notice instead of a
// misleading zero or a silently-reused cash-market result (spec Phase 11).

import type { ReactNode } from 'react';

import {
  getAvailability,
  getInstrument,
  hasCapability,
  type InstrumentCapabilities,
} from '@/core/instruments/registry';
import { capabilityUnavailableMessage } from '@/core/instruments/labels';

interface Props {
  symbol: string;
  capability: keyof InstrumentCapabilities;
  children: ReactNode;
  /** Optional custom fallback; defaults to a standard unavailable notice. */
  fallback?: ReactNode;
}

export default function CapabilityGate({ symbol, capability, children, fallback }: Props) {
  if (hasCapability(symbol, capability)) return <>{children}</>;

  if (fallback !== undefined) return <>{fallback}</>;

  const inst = getInstrument(symbol);
  const isFuture = inst?.assetClass === 'future';
  const reasons = inst ? getAvailability(symbol).reasons : [];
  const message = capabilityUnavailableMessage(isFuture, reasons);

  return (
    <div
      role="status"
      style={{
        padding: '12px 16px',
        borderRadius: 10,
        border: '1px dashed var(--color-border)',
        color: 'var(--color-text-secondary)',
        fontSize: 13,
        textAlign: 'center',
      }}
    >
      {message}
    </div>
  );
}
