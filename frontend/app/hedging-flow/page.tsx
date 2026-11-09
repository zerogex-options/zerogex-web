'use client';

import Link from 'next/link';
import { History } from 'lucide-react';

import PageShell from '@/components/layout/PageShell';
import PageHeader from '@/components/layout/PageHeader';
import { useTimeframe } from '@/core/TimeframeContext';
import { optionChainSymbolFor } from '@/core/symbols';
import HedgingFlowPanels, { ZeroDteToggle } from './HedgingFlowPanels';
import { useLiveHedgingFlow } from './useLiveHedgingFlow';

/**
 * The LIVE Hedging Flow session. The polling is useLiveHedgingFlow, which the
 * Fuseline Radar shares; everything drawn is HedgingFlowPanels, which the
 * dated permalink draws too.
 *
 * ES and NQ read their backing index. The page has no picker of its own, so
 * the header's ES / NQ reach it, and the API refuses /api/flow/hedging for a
 * future (a projected strike is not a contract anyone traded). Asking for the
 * index and saying so beats an "Error loading data" box that reads as broken.
 */
export default function HedgingFlowPage() {
  const { symbol: pickedSymbol } = useTimeframe();
  const symbol = optionChainSymbolFor(pickedSymbol);
  const { zeroDteOnly, setZeroDteOnly, panelProps } = useLiveHedgingFlow(symbol);

  return (
    <PageShell>
      <PageHeader
        title="Hedging Flow"
        sub={
          <>
            Estimated dealer hedging pressure from today&rsquo;s option trades, on
            price&rsquo;s timeline. Positive means the hedge <strong>buys</strong> stock.
          </>
        }
        tooltip="For every option that traded, the net customer position change is converted to the stock a delta-flat hedge implies: (buy - sell) x delta x 100 x spot, accumulated across the session. This is the trade-based counterpart to every open-interest surface on the site&nbsp;- Net GEX, the walls, the flip and Forced Flow all read the BOOK and ask what it would do; this reads what the tape did to that book today. The structure panel underneath shares the session window and the crosshair: flow says how hard the tape is pushing, structure says whether the book absorbs that push or amplifies it."
        actions={<ZeroDteToggle active={zeroDteOnly} onChange={setZeroDteOnly} />}
      />

      {symbol !== pickedSymbol && (
        <p className="mt-4 text-sm italic" style={{ color: 'var(--color-text-secondary)' }}>
          Hedging Flow reads option trades, and ZeroGEX tracks index options rather than options on
          futures, so for {pickedSymbol} this page shows {symbol}, the index {pickedSymbol} tracks.
          Prices here are {symbol}&rsquo;s.
        </p>
      )}

      <HedgingFlowPanels {...panelProps} />

      <div className="mt-6 flex justify-end">
        <Link
          href="/hedging-flow/sessions"
          className="inline-flex items-center gap-1.5 text-xs font-semibold"
          style={{ color: 'var(--text-secondary)' }}
        >
          <History size={13} />
          Past sessions
        </Link>
      </div>
    </PageShell>
  );
}
