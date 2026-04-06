'use client';

import SignalScorePanel from '@/components/SignalScorePanel';
import { useTimeframe } from '@/core/TimeframeContext';

export default function SignalScorePage() {
  const { symbol } = useTimeframe();

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-2">Signal Score</h1>
      <p className="text-[var(--color-text-secondary)] mb-8">
        UnifiedSignalEngine composite scoring with full spectrum and component diagnostics.
      </p>

      <SignalScorePanel symbol={symbol} />
    </div>
  );
}
