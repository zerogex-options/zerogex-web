'use client';

import { useState } from 'react';

import PanelSurface from '@/components/layout/Panel';
import { FilterToggle } from '@/components/controls/Filters';
import ErrorMessage from '@/components/ErrorMessage';
import LoadingSpinner from '@/components/LoadingSpinner';
import MetricCard from '@/components/MetricCard';
import HedgingFlowChart from '@/components/HedgingFlowChart';
import GammaRegimeChart from '@/components/GammaRegimeChart';
import GammaWeatherStrip from '@/components/GammaWeatherStrip';
import {
  latestRateFlip,
  latestRealBar,
  type HedgingFlowPayload,
} from '@/hooks/useHedgingFlow';
import {
  latestRegimeBar,
  regimeLabel,
  type GammaRegimeSeriesPayload,
} from '@/hooks/useGammaRegimeSeries';
import type { GammaWeatherPayload } from '@/hooks/useGammaWeather';
import { safeTimeLabel } from '@/core/flowSeriesCharts';

/**
 * Hedging Flow, rendered — the observed counterpart to every OI-derived
 * surface on the site. Net GEX, the walls, the flip and Forced Flow all read
 * the BOOK and ask what it would do; this reads what the tape did to that
 * book.
 *
 * ONE component, two routes, and it owns no data on purpose. `/hedging-flow`
 * feeds it from polling hooks; the dated permalink feeds it from payloads its
 * server component already fetched. Keeping the rendering in one place is the
 * point — a historical session that drifted from the live one would be a
 * receipt for a chart nobody can reproduce, and the drift would be invisible
 * until someone compared them side by side.
 *
 * The 0DTE toggle is controlled from outside for the same reason the data is.
 * Live, flipping it re-queries with the session's date as an expirations
 * filter; dated, it swaps between two payloads already in hand. Same control,
 * same meaning, two ways of answering it.
 *
 * The structure panel underneath is the other half of the same instrument.
 * Flow says how hard the tape is pushing; structure says whether the book
 * absorbs that push or amplifies it. They share a session window, a 5-minute
 * grid, a view toggle and a Recharts syncId, so hovering either crosshairs the
 * same bar on both — one timeline, not two pictures.
 */

// Recharts syncs tooltips across charts sharing this id, which is what makes
// the flow and structure panels one instrument rather than two stacked images.
const SYNC_ID = 'zgx-hedging-session';

const USD = (value: number): string => {
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(0)}K`;
  return `${sign}$${abs.toFixed(0)}`;
};

export interface HedgingFlowPanelsProps {
  symbol: string;
  /** The session's own ET date. On the live page, today. */
  sessionDateKey: string;
  /** True for a finished session, which changes several strings from "yet" to "never". */
  historical?: boolean;
  data: HedgingFlowPayload | null;
  regime: GammaRegimeSeriesPayload | null;
  weather: GammaWeatherPayload | null;
  /** The weather read exists but no bar carried both series. */
  weatherNotReady?: boolean;
  /** Only to word the "no 0DTE traded" line; the control itself lives in the
   *  page header, which is where the two routes answer it differently. */
  zeroDteOnly: boolean;
  loading?: boolean;
  regimeLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

export default function HedgingFlowPanels({
  symbol,
  sessionDateKey,
  historical = false,
  data,
  regime,
  weather,
  weatherNotReady = false,
  zeroDteOnly,
  loading = false,
  regimeLoading = false,
  error = null,
  onRetry,
}: HedgingFlowPanelsProps) {
  // One toggle drives both panels. Two that could disagree would let a reader
  // compare a 30-minute flow rate against a since-the-open structure change
  // and believe they lined up.
  const [mode, setMode] = useState<'rate' | 'cumulative'>('rate');
  // Lifted for the same reason as mode: only the chart under the mouse gets
  // mouse events, so without sharing it the other panel's readout would sit
  // blank while its cursor line tracked along.
  const [hovered, setHovered] = useState<string | null>(null);

  const latest = latestRealBar(data);
  const flip = latestRateFlip(data);
  const regimeBar = latestRegimeBar(regime);
  const read = regimeLabel(
    mode === 'rate' ? regimeBar?.rolling_stability : regimeBar?.anchored_stability,
    mode === 'rate' ? regimeBar?.rolling_lean : regimeBar?.anchored_lean,
  );

  const leaning = latest == null ? null : latest.cum_net_usd >= 0 ? 'Buying' : 'Selling';

  return (
    <>
      {error && <ErrorMessage message={error} onRetry={onRetry} />}

      {loading && !data && <LoadingSpinner />}

      {data && (
        <>
          {weather && (
            <div className="mt-6">
              <GammaWeatherStrip
                payload={weather}
                flow={data}
                regime={regime}
                symbol={symbol}
                date={historical ? sessionDateKey : null}
              />
            </div>
          )}

          {!weather && weatherNotReady && (
            <p className="mt-6 text-sm italic" style={{ color: 'var(--color-text-secondary)' }}>
              Gamma Weather needs one bar carrying both hedging flow and gamma structure.{' '}
              {historical
                ? 'This session never produced one.'
                : 'It appears once the session has produced one.'}
            </p>
          )}

          {/* Four short numbers: a 2×2 block on a phone, not a tower. */}
          <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            <MetricCard
              title="Session pressure"
              value={latest ? USD(latest.cum_net_usd) : '—'}
              subtitle={leaning ? `Net dealer ${leaning.toLowerCase()}` : undefined}
              tooltip="Total stock the delta-flat hedge implies against every option traded in this session. Positive means dealers are estimated net buyers of the underlying."
              trend={latest == null ? 'neutral' : latest.cum_net_usd >= 0 ? 'bullish' : 'bearish'}
            />
            <MetricCard
              title="Call-driven"
              value={latest ? USD(latest.cum_call_usd) : '—'}
              subtitle="Pressure from call activity"
              tooltip="The share of this session's pressure produced by call trades. Split by which book produced it, not by direction: customers selling calls push this negative."
            />
            <MetricCard
              title="Put-driven"
              value={latest ? USD(latest.cum_put_usd) : '—'}
              subtitle="Pressure from put activity"
              tooltip="The share of this session's pressure produced by put trades. Put activity is not automatically bearish: customers selling puts force dealers to BUY stock, which shows here as positive."
            />
            <MetricCard
              title="Last flip"
              value={
                flip
                  ? `${flip.direction === 'to_buying' ? 'To buying' : 'To selling'}`
                  : historical
                    ? 'None'
                    : 'None today'
              }
              subtitle={flip ? safeTimeLabel(flip.bar_start) : 'No reversal'}
              tooltip="The last time the smoothed pressure rate changed sign&nbsp;- the immediate push reversing. Read off the rate rather than the session total, which crosses zero rarely and late."
            />
          </div>

          {zeroDteOnly && data.bars.length === 0 && (
            <p className="mt-6 text-sm italic" style={{ color: 'var(--text-secondary)' }}>
              No 0DTE contracts traded this session&nbsp;- {sessionDateKey}{' '}
              {historical ? 'was not' : 'may not be'} an expiry for {symbol}.
            </p>
          )}

          <PanelSurface className="mt-6">
            {/* The stack shares one time axis, on the structure panel below. */}
            <HedgingFlowChart
              payload={data}
              mode={mode}
              onModeChange={setMode}
              syncId={SYNC_ID}
              hideTimeAxis
              hoveredLabel={hovered}
              onHoverChange={setHovered}
            />

            <div className="mt-5 border-t pt-5" style={{ borderColor: 'var(--border-default)' }}>
              <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="zg-h3">Dealer gamma structure</h3>
                {read && (
                  <span
                    className="text-xs font-semibold"
                    style={{ color: 'var(--text-secondary)' }}
                    title={read.meaning}
                  >
                    {read.title}
                  </span>
                )}
              </div>

              {regimeLoading && !regime && <LoadingSpinner />}

              {regime && regime.bars.length > 0 && (
                <GammaRegimeChart
                  payload={regime}
                  mode={mode}
                  syncId={SYNC_ID}
                  hoveredLabel={hovered}
                  onHoverChange={setHovered}
                />
              )}

              {regime && regime.bars.length === 0 && (
                <p className="py-4 text-sm italic" style={{ color: 'var(--text-secondary)' }}>
                  {historical
                    ? 'No structure reading was written for this session\u00a0- the series began after it, or the engine was cold that day.'
                    : 'No structure reading for this session yet\u00a0- the series is written once per analytics cycle, so it fills in as the session runs.'}
                </p>
              )}

              {read && (
                <p
                  className="mt-2 text-[11px] leading-relaxed"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  {read.meaning}
                </p>
              )}
            </div>
          </PanelSurface>
        </>
      )}
    </>
  );
}

/** The shared 0DTE control, so both routes label and describe it identically. */
export function ZeroDteToggle({
  active,
  onChange,
  disabled = false,
}: {
  active: boolean;
  onChange: (next: boolean) => void;
  /** No 0DTE rows exist for this session, so the control has nothing to show. */
  disabled?: boolean;
}) {
  if (disabled) return null;
  return (
    <FilterToggle
      active={active}
      onChange={onChange}
      title="Scope the flow panel to contracts expiring on this session's date"
    >
      0DTE only
    </FilterToggle>
  );
}
