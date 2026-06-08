/**
 * Underlying Price Action Page
 * Candlestick chart for the selected underlying symbol.
 */

'use client';

import UnderlyingCandlesChart from '@/components/UnderlyingCandlesChart';

export default function UnderlyingPriceActionPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Underlying Price Action</h1>
      <section className="mb-8">
        <UnderlyingCandlesChart />
      </section>
    </div>
  );
}
