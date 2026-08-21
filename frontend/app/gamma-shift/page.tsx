'use client';

/**
 * Gamma Shift — the change in the dealer-gamma surface, read three ways.
 *
 * The page is ordered by how long a reader has to spend before they get
 * something, not by how the data is produced:
 *
 *   1. **Gamma Regime Shift** — the one-second read. What changed, how much
 *      against this symbol's own history, and what that means.
 *   2. **Expiry Roll-off** — what disappears at the next expiration, and
 *      whether that is a lot. This is also the reason the card above can
 *      compare two sessions honestly: it excludes the tranche that expired
 *      in between, and this panel is where that tranche is accounted for.
 *   3. **Session History** — what every recent session read as, so today has
 *      a context to sit in.
 *   4. **Strike-by-strike ladder** — the original view, kept intact as the
 *      receipt. It stops being the headline and becomes the evidence.
 *
 * The lookback and the expiry filter are page-level state so all four
 * surfaces describe the same window; the ladder keeps its own presets because
 * it reads a different feed (the intraday bucket timeseries) and its
 * finer-grained A/B scrubbing is genuinely useful on its own terms.
 */

import { useState } from 'react';
import PageShell from '@/components/layout/PageShell';
import GammaRegimeShiftCard from '@/components/GammaRegimeShiftCard';
import ExpiryRolloffPanel from '@/components/ExpiryRolloffPanel';
import RegimeSessionHistory from '@/components/RegimeSessionHistory';
import GammaShiftLadder from '@/components/GammaShiftLadder';
import GexUnitToggle from '@/components/GexUnitToggle';
import StrikeFilterToggle from '@/components/StrikeFilterToggle';
import ExpirationMultiSelect from '@/components/ExpirationMultiSelect';
import Collapsible from '@/components/Collapsible';
import { useTimeframe } from '@/core/TimeframeContext';
import { useChartExpirations } from '@/hooks/useChartExpirations';
import {
  useExpiryRolloff,
  useRegimeHistory,
  useRegimeShift,
} from '@/hooks/useRegimeShift';
import type { Lens, Lookback } from '@/core/regimeShift';

export default function GammaShiftPage() {
  const { symbol } = useTimeframe();
  const { available, selection, setSelection } = useChartExpirations(symbol, true);
  const [lookback, setLookback] = useState<Lookback>('session');
  const [lens, setLens] = useState<Lens>('net');

  const shift = useRegimeShift(symbol, lookback, { expirations: selection, lens });
  const rolloff = useExpiryRolloff(symbol);
  const history = useRegimeHistory(symbol, 30);

  const expiryControl = (
    <ExpirationMultiSelect
      options={available}
      selected={selection}
      onChange={setSelection}
      label="Expiry"
      disabled={available.length === 0}
    />
  );

  return (
    <PageShell>
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Gamma Shift</h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
          Everyone else shows where dealer gamma sits <em>right now</em>. This shows how it{' '}
          <strong>changed</strong> — whether the book is{' '}
          <span style={{ color: 'var(--color-bull)' }}>firming</span> or{' '}
          <span style={{ color: 'var(--color-bear)' }}>deteriorating</span>, how much of it
          expires at the next close, and how today compares to every recent session.
        </p>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <GexUnitToggle />
        <StrikeFilterToggle />
      </div>

      <section className="mb-6">
        <GammaRegimeShiftCard
          payload={shift.data}
          loading={shift.loading}
          error={shift.error}
          lookback={lookback}
          onLookbackChange={setLookback}
          lens={lens}
          onLensChange={setLens}
          symbol={symbol}
          control={expiryControl}
        />
      </section>

      <section className="mb-6">
        <ExpiryRolloffPanel
          payload={rolloff.data}
          loading={rolloff.loading}
          error={rolloff.error}
          symbol={symbol}
        />
      </section>

      <section className="mb-6">
        <RegimeSessionHistory
          payload={history.data}
          loading={history.loading}
          error={history.error}
          symbol={symbol}
        />
      </section>

      {/* The receipt. Collapsed by default: a reader who accepted the read
          above does not need 27 rows of per-strike bars, and one who did not
          can open it and check the work. */}
      <section className="mb-8">
        <Collapsible
          title="Strike-by-strike detail"
          subtitle="Every strike's change between two times, with the positioning / re-pricing split and open-interest deltas."
        >
          <GammaShiftLadder />
        </Collapsible>
      </section>
    </PageShell>
  );
}
