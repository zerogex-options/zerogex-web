'use client';

import { useTimeframe, type UnderlyingSymbol } from '@/core/TimeframeContext';
import PageShell from '@/components/layout/PageShell';
import PageHeader from '@/components/layout/PageHeader';
import { FilterBar, FilterChip } from '@/components/controls/Filters';
import ForcedFlowRead from '@/components/ForcedFlowRead';
import ForcedFlowRail from '@/components/ForcedFlowRail';
import ForcedFlowCurveChart from '@/components/ForcedFlowCurveChart';
import CharmIntoCloseChart from '@/components/CharmIntoCloseChart';
import VannaLadderChart from '@/components/VannaLadderChart';
import ForcedFlowSurfaceChart from '@/components/ForcedFlowSurfaceChart';
import ForcedFlowTrackRecord from '@/components/ForcedFlowTrackRecord';

// The on-page selector drives the shared TimeframeContext symbol (same source
// of truth as the global header picker), so switching here stays in lockstep
// with the rest of the app.
const SYMBOLS: UnderlyingSymbol[] = ['SPY', 'SPX', 'QQQ', 'NDX', 'ES', 'NQ'];

export default function ForcedFlowPage() {
  const { symbol, setSymbol } = useTimeframe();

  return (
    <PageShell>
      <PageHeader
        title="Forced Flow"
        beta
        sub={
          <>
            The stock dealers must trade to stay hedged if spot, time or vol moves.
            Positive means they must <strong>buy</strong>.
          </>
        }
        tooltip="Every other flow surface on the site measures what traded. This measures what the current book OBLIGES dealers to trade next, under a scenario: move spot along the reprice curve, advance the clock into the close (charm), or shift implied vol (vanna), and read off the dollars of stock a delta-flat hedge would have to buy or sell. Positive is buying pressure, negative selling. It is a projection from open interest, not an observation of the tape — pair it with Hedging Flow, which is the same question asked of today's actual trades."
        actions={
          <FilterBar>
            {SYMBOLS.map((s) => (
              <FilterChip key={s} active={s === symbol} onClick={() => setSymbol(s)}>
                {s}
              </FilterChip>
            ))}
          </FilterBar>
        }
      />

      {/* The Read: verdict-first hero. One plain-language call — regime,
          into-close forced flow, and the magnet level — off the live
          /forced-flow endpoints. Everything below it is the evidence. */}
      <div className="mb-8">
        <ForcedFlowRead symbol={symbol} />
      </div>

      {/* Evidence — the scenario views the read is built from. */}
      <div className="flex items-baseline gap-3 mb-3">
        <h2 className="zg-eyebrow">The evidence</h2>
        <span className="flex-1 h-px" style={{ background: 'var(--border-default)' }} />
      </div>

      {/* Hero row: slim regime rail beside the flagship reprice curve. */}
      <div className="grid grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)] gap-6 mb-6">
        <ForcedFlowRail symbol={symbol} />
        <ForcedFlowCurveChart symbol={symbol} />
      </div>

      {/* Charm into close + vanna ladder side by side. */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <CharmIntoCloseChart symbol={symbol} />
        <VannaLadderChart symbol={symbol} />
      </div>

      {/* Full-width spot × time surface. */}
      <div className="mb-6">
        <ForcedFlowSurfaceChart symbol={symbol} />
      </div>

      {/* Track record: does the charm-into-close forecast actually work? */}
      <ForcedFlowTrackRecord symbol={symbol} />
    </PageShell>
  );
}
