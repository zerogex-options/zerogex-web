'use client';

import SignalScorePanel from '@/components/SignalScorePanel';
import { useTimeframe } from '@/core/TimeframeContext';

export default function SignalScorePage() {
  const { symbol } = useTimeframe();

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-2">Composite Score</h1>
      <p className="text-[var(--color-text-secondary)] mb-8">
        Aggregate weighted conviction of seven independent market signals. Positive = net bullish, negative = net bearish.
      </p>

      <SignalScorePanel symbol={symbol} />
    </div>
  );
}
