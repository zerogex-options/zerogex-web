/**
 * Market Maker Exposures Page
 * Realtime view that combines the underlying candlestick chart with dealer
 * GEX-by-strike and open-interest positioning panels.
 */

'use client';

import MarketMakerExposures from '@/components/MarketMakerExposures';

export default function MarketMakerExposuresPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <MarketMakerExposures />
    </div>
  );
}
