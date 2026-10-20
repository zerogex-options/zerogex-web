'use client';

import { useTimeframe } from '@/core/TimeframeContext';
import { isStockSymbol, stockBenchmarkFor } from '@/core/symbols';

/**
 * Shown on the signal pages while a single stock is the selected symbol.
 *
 * A stock's chain, levels and flow are ingested like an ETF's, but the signal
 * engine does not run on it: its models are tuned on the ETFs and indexes,
 * and its trade ideas assume an expiration every day, which a stock with only
 * Friday weeklies does not have. So every panel on these pages would come back
 * empty for the stock. Saying why, once at the top, is better than a page of
 * blank cards that reads as broken. Renders nothing for any other symbol.
 */
export default function StockSignalsNotice() {
  const { symbol, setSymbol } = useTimeframe();
  if (!isStockSymbol(symbol)) return null;
  const benchmark = stockBenchmarkFor(symbol);
  return (
    <div
      className="bg-[var(--color-surface)] rounded-lg p-4 mb-6"
      style={{ border: '1px solid var(--color-border)' }}
      role="status"
    >
      <p className="font-semibold mb-1">Signals are not available for {symbol} yet</p>
      <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
        {symbol} is a single stock. Its gamma levels, dealer positioning and options flow are live, but the
        signal models run on the ETFs and indexes only for now.
        {benchmark && (
          <>
            {' '}
            <button
              type="button"
              onClick={() => setSymbol(benchmark)}
              className="font-semibold underline"
              style={{ color: 'var(--color-text-primary)' }}
            >
              Switch to {benchmark}
            </button>{' '}
            to see this page.
          </>
        )}
      </p>
    </div>
  );
}
