'use client';

import { FUTURES_BACKING_INDEX } from '@/core/symbols';

/**
 * Shown on the surfaces that enumerate individual option CONTRACTS.
 *
 * ES and NQ carry no option chain in ZeroGEX — their dealer levels are SPX/NDX
 * option-derived and carried onto the futures price axis. A per-contract page
 * has nothing truthful to show for them: an SPX contract with its strike
 * multiplied by the basis is not a contract anyone can trade, and the strike
 * would no longer round-trip to the chain it came from. The API answers 400 for
 * exactly that reason, so the page has to say so rather than render an empty or
 * zero-filled table.
 */
export default function FuturesUnsupportedPanel({
  symbol,
  surface,
}: {
  symbol: string;
  surface: string;
}) {
  const ticker = symbol.toUpperCase();
  const backing = FUTURES_BACKING_INDEX[ticker] ?? 'SPX';
  return (
    <div
      className="bg-[var(--color-surface)] rounded-lg p-6"
      style={{ border: '1px solid var(--color-border)' }}
      role="status"
    >
      <p className="font-semibold mb-2">{surface} is not available for {ticker}</p>
      <p style={{ color: 'var(--color-text-secondary)' }}>
        {ticker} has no option chain of its own here. Its gamma levels are derived from{' '}
        {backing} options and converted to {ticker} prices using the live futures basis —
        which works for levels, but not for individual contracts. Switch to {backing} to see
        this page.
      </p>
    </div>
  );
}
