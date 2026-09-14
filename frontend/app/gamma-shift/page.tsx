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
import PageHeader from '@/components/layout/PageHeader';
import { FilterBar, FilterChip, FilterGroup } from '@/components/controls/Filters';
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
      <PageHeader
        title="Gamma Shift"
        beta
        sub={
          <>
            Not where dealer gamma sits, but how it <strong>changed</strong> — a book{' '}
            <span style={{ color: 'var(--color-bull)' }}>firming</span> or{' '}
            <span style={{ color: 'var(--color-bear)' }}>deteriorating</span>.
          </>
        }
        tooltip="Every other GEX surface is a photograph of the book right now. This is the difference between two photographs: pick a comparison window and read what dealer gamma did across it, split into the part that came from new positioning and the part that is just the same contracts re-pricing as spot moved. Also shows how much of the current book expires at the next close — gamma that will simply stop existing rather than being traded away — and where today's shift sits against recent sessions. A large shift with price unchanged is positioning; a large shift with price moved may be nothing but re-pricing."
        actions={
          <FilterBar>
            <FilterGroup label="Compare">
              {LOOKBACK_ORDER.map((key) => (
                <FilterChip
                  key={key}
                  active={key === lookback}
                  onClick={() => setLookback(key)}
                >
                  {LOOKBACK_LABEL[key]}
                </FilterChip>
              ))}
            </FilterGroup>
          </FilterBar>
        }
      />

      {/* One control bar for every surface below. */}
      <FilterBar className="mb-5 gap-x-3">
        <ExpirationMultiSelect
          options={available}
          selected={selection}
          onChange={setSelection}
          label="Expiry"
          disabled={available.length === 0}
          zeroDte={zeroDte}
        />
        <FilterGroup label="GEX unit">
          <GexUnitToggle showHint={false} />
        </FilterGroup>
        <FilterGroup label="Strikes">
          <StrikeFilterToggle showHint={false} />
        </FilterGroup>
      </FilterBar>

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
