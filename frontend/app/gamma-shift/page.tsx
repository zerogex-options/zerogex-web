'use client';

/**
 * Gamma Shift — the change in the dealer-gamma surface, read three ways.
 *
 * The page is ordered by how long a reader has to spend before they get
 * something, not by how the data is produced:
 *
 *   1. **Gamma Regime Shift** — the one-second read. What changed, how much
 *      against this symbol's own history, and what that means.
 *   2. **Gamma Trend** — the same change as a series rather than a verdict:
 *      dealer gamma plotted across the session, and the spot↔flip cushion
 *      plotted under it. The card above says what changed; this says which
 *      way it has been going, which is the question a level cannot answer.
 *   3. **Expiry Roll-off** — what disappears at the next expiration, and
 *      whether that is a lot. This is also the reason the card above can
 *      compare two sessions honestly: it excludes the tranche that expired
 *      in between, and this panel is where that tranche is accounted for.
 *   4. **Session History** — what every recent session read as, so today has
 *      a context to sit in.
 *   5. **Strike-by-strike ladder** — the original view, kept intact as the
 *      receipt. It stops being the headline and becomes the evidence.
 *
 * Controls live in ONE bar at the top rather than repeating per panel: the
 * lookback, the expiry filter and the display toggles all scope every surface
 * below, so scattering them made the page look busier while giving the reader
 * more places to check. Likewise there is one ChartCaption at the foot of the
 * page, not one per panel.
 *
 * The ladder keeps its own presets because it reads a different feed (the
 * intraday bucket timeseries) and its finer-grained A/B scrubbing is
 * genuinely useful on its own terms.
 */

import { useState } from 'react';
import PageShell from '@/components/layout/PageShell';
import GammaRegimeShiftCard from '@/components/GammaRegimeShiftCard';
import GammaTrendPanel from '@/components/GammaTrendPanel';
import ExpiryRolloffPanel from '@/components/ExpiryRolloffPanel';
import RegimeSessionHistory from '@/components/RegimeSessionHistory';
import GammaShiftLadder from '@/components/GammaShiftLadder';
import GexUnitToggle from '@/components/GexUnitToggle';
import StrikeFilterToggle from '@/components/StrikeFilterToggle';
import ExpirationMultiSelect from '@/components/ExpirationMultiSelect';
import ChartCaption from '@/components/ChartCaption';
import Collapsible from '@/components/Collapsible';
import { useTimeframe } from '@/core/TimeframeContext';
import { useChartExpirations } from '@/hooks/useChartExpirations';
import { useZeroDteOption } from '@/hooks/useZeroDteOption';
import { etTodayDateKey } from '@/core/utils';
import {
  useExpiryRolloff,
  useRegimeHistory,
  useRegimeShift,
} from '@/hooks/useRegimeShift';
import { LOOKBACK_LABEL, LOOKBACK_ORDER, type Lens, type Lookback } from '@/core/regimeShift';

export default function GammaShiftPage() {
  const { symbol } = useTimeframe();
  const { available, selection, setSelection } = useChartExpirations(symbol, true);
  const zeroDte = useZeroDteOption(available, etTodayDateKey());
  const [lookback, setLookback] = useState<Lookback>('session');
  const [lens, setLens] = useState<Lens>('net');

  const shift = useRegimeShift(symbol, lookback, { expirations: selection, lens });
  const rolloff = useExpiryRolloff(symbol);
  const history = useRegimeHistory(symbol, 30);

  return (
    <PageShell>
      <div className="mb-5">
        <h1 className="text-3xl font-bold">Gamma Shift</h1>
        <p className="mt-2 max-w-3xl text-[15px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
          Everyone else shows where dealer gamma sits <em>right now</em>. This shows how it{' '}
          <strong>changed</strong> — whether the book is{' '}
          <span style={{ color: 'var(--color-bull)' }}>firming</span> or{' '}
          <span style={{ color: 'var(--color-bear)' }}>deteriorating</span>, how much of it
          expires at the next close, and how today compares to every recent session.
        </p>
      </div>

      {/* One control bar for every surface below. */}
      <div
        className="zg-panel mb-5 flex flex-wrap items-center gap-x-5 gap-y-3 px-5 py-3"
      >
        <div className="flex items-center gap-2">
          <span className="zg-label">Compare</span>
          <div className="flex flex-wrap gap-1">
            {LOOKBACK_ORDER.map((key) => {
              const active = key === lookback;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setLookback(key)}
                  aria-pressed={active}
                  className="rounded-md px-3 py-1.5 font-mono text-[12px] transition-colors"
                  style={{
                    background: active ? 'var(--color-warning-soft)' : 'transparent',
                    border: `1px solid ${active ? 'var(--color-warning)' : 'var(--border-default)'}`,
                    color: active ? 'var(--color-warning)' : 'var(--text-secondary)',
                    fontWeight: active ? 600 : 500,
                  }}
                >
                  {LOOKBACK_LABEL[key]}
                </button>
              );
            })}
          </div>
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-3">
          <ExpirationMultiSelect
            options={available}
            selected={selection}
            onChange={setSelection}
            label="Expiry"
            disabled={available.length === 0}
            zeroDte={zeroDte}
          />
          <GexUnitToggle />
          <StrikeFilterToggle />
        </div>
      </div>

      <div className="flex flex-col gap-5">
        <GammaRegimeShiftCard
          payload={shift.data}
          loading={shift.loading}
          error={shift.error}
          lens={lens}
          onLensChange={setLens}
          symbol={symbol}
        />

        <GammaTrendPanel symbol={symbol} />

        <ExpiryRolloffPanel
          payload={rolloff.data}
          loading={rolloff.loading}
          error={rolloff.error}
          symbol={symbol}
        />

        <RegimeSessionHistory
          payload={history.data}
          loading={history.loading}
          error={history.error}
          symbol={symbol}
        />
      </div>

      {/* The receipt. Collapsed by default: a reader who accepted the read
          above does not need 27 rows of per-strike bars, and one who did not
          can open it and check the work. */}
      <div className="mt-5">
        <Collapsible
          title="Strike-by-strike detail"
          subtitle="Every strike's change between two times, with the positioning / re-pricing split and open-interest deltas."
        >
          <GammaShiftLadder />
        </Collapsible>
      </div>

      <div className="mb-8">
        <ChartCaption />
      </div>
    </PageShell>
  );
}
