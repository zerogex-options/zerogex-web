'use client';

import { useMemo, useState } from 'react';

import PageShell from '@/components/layout/PageShell';
import SectionHead from '@/components/layout/SectionHead';
import ErrorMessage from '@/components/ErrorMessage';
import LoadingSpinner from '@/components/LoadingSpinner';
import MetricCard from '@/components/MetricCard';
import HedgingFlowChart from '@/components/HedgingFlowChart';
import GammaRegimeChart from '@/components/GammaRegimeChart';
import { useTimeframe } from '@/core/TimeframeContext';
import {
  latestRateFlip,
  latestRealBar,
  useHedgingFlow,
} from '@/hooks/useHedgingFlow';
import {
  latestRegimeBar,
  regimeLabel,
  useGammaRegimeSeries,
} from '@/hooks/useGammaRegimeSeries';
import { etTodayDateKey } from '@/core/utils';
import { safeTimeLabel } from '@/core/flowSeriesCharts';

/**
 * Hedging Flow — the observed counterpart to every OI-derived surface on the
 * site. Net GEX, the walls, the flip and Forced Flow all read the BOOK and ask
 * what it would do; this reads what the tape did to that book today.
 *
 * The 0DTE toggle is the expirations filter carrying today's date, which is
 * also why it can honestly report "no 0DTE today": when today is not an expiry
 * the filter resolves to nothing rather than silently substituting Friday.
 *
 * The structure panel underneath is the other half of the same instrument.
 * Flow says how hard the tape is pushing; structure says whether the book
 * absorbs that push or amplifies it. They share a session window, a 5-minute
 * grid, a view toggle and a Recharts syncId, so hovering either crosshairs the
 * same bar on both — one timeline, not two pictures.
 *
 * The structure series is materialised by the Analytics Engine, so an empty
 * response on a live session means "not written yet", not "unavailable". The
 * panel says exactly that rather than rendering an error.
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

export default function HedgingFlowPage() {
  const { symbol } = useTimeframe();
  const [zeroDteOnly, setZeroDteOnly] = useState(false);
  // One toggle drives both panels. Two that could disagree would let a reader
  // compare a 30-minute flow rate against a since-the-open structure change
  // and believe they lined up.
  const [mode, setMode] = useState<'rate' | 'cumulative'>('rate');

  const expirations = useMemo(
    () => (zeroDteOnly ? [etTodayDateKey()] : undefined),
    [zeroDteOnly],
  );

  const { data, loading, error, refetch } = useHedgingFlow(symbol, { expirations });
  // Deliberately unfiltered by expiration: dealer gamma structure is a
  // property of the whole book, and scoping it to 0DTE would answer a
  // different question than the flow panel above it appears to be asking.
  const { data: regime, loading: regimeLoading } = useGammaRegimeSeries(symbol);

  const latest = latestRealBar(data);
  const flip = latestRateFlip(data);
  const regimeBar = latestRegimeBar(regime);
  const read = regimeLabel(
    mode === 'rate' ? regimeBar?.rolling_stability : regimeBar?.anchored_stability,
    mode === 'rate' ? regimeBar?.rolling_lean : regimeBar?.anchored_lean,
  );

  const leaning = latest == null ? null : latest.cum_net_usd >= 0 ? 'Buying' : 'Selling';

  return (
    <PageShell>
      <SectionHead
        eyebrow="Options Flow"
        title="Hedging Flow"
        sub={
          <>
            Estimated dealer hedging pressure created by today&rsquo;s option trades, on the same
            timeline as price. Positive means the delta-flat hedge <strong>buys</strong> stock.
          </>
        }
        tooltip="For every option that traded, the net customer position change is converted to the stock a delta-flat hedge implies: (buy - sell) x delta x 100 x spot, accumulated across the session."
        actions={
          <label
            className="flex cursor-pointer items-center gap-2 text-xs"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            <input
              type="checkbox"
              checked={zeroDteOnly}
              onChange={(e) => setZeroDteOnly(e.target.checked)}
            />
            0DTE only
          </label>
        }
      />

      {error && <ErrorMessage message={error} onRetry={refetch} />}

      {loading && !data && <LoadingSpinner />}

      {data && (
        <>
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              title="Session pressure"
              value={latest ? USD(latest.cum_net_usd) : '—'}
              subtitle={leaning ? `Net dealer ${leaning.toLowerCase()}` : undefined}
              tooltip="Total stock the delta-flat hedge implies against every option traded so far today. Positive means dealers are estimated net buyers of the underlying."
              trend={latest == null ? 'neutral' : latest.cum_net_usd >= 0 ? 'bullish' : 'bearish'}
            />
            <MetricCard
              title="Call-driven"
              value={latest ? USD(latest.cum_call_usd) : '—'}
              subtitle="Pressure from call activity"
              tooltip="The share of today's pressure produced by call trades. Split by which book produced it, not by direction: customers selling calls push this negative." 
            />
            <MetricCard
              title="Put-driven"
              value={latest ? USD(latest.cum_put_usd) : '—'}
              subtitle="Pressure from put activity"
              tooltip="The share of today's pressure produced by put trades. Put activity is not automatically bearish: customers selling puts force dealers to BUY stock, which shows here as positive." 
            />
            <MetricCard
              title="Last flip"
              value={
                flip
                  ? `${flip.direction === 'to_buying' ? 'To buying' : 'To selling'}`
                  : 'None today'
              }
              subtitle={flip ? safeTimeLabel(flip.bar_start) : 'No reversal yet'}
              tooltip="The last time the smoothed pressure rate changed sign — the immediate push reversing. Read off the rate rather than the session total, which crosses zero rarely and late." 
            />
          </div>

          {zeroDteOnly && data.bars.length === 0 && (
            <p
              className="mt-6 text-sm italic"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              No 0DTE contracts traded this session — today may not be an expiry for {symbol}.
            </p>
          )}

          <div
            className="mt-6 rounded-2xl border p-5"
            style={{
              borderColor: 'var(--color-border)',
              backgroundColor: 'var(--color-surface)',
            }}
          >
            {/* The stack shares one time axis, on the structure panel below. */}
            <HedgingFlowChart
              payload={data}
              mode={mode}
              onModeChange={setMode}
              syncId={SYNC_ID}
              hideTimeAxis
            />

            <div
              className="mt-5 border-t pt-5"
              style={{ borderColor: 'var(--color-border)' }}
            >
              <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                  Dealer gamma structure
                </h3>
                {read && (
                  <span
                    className="text-xs font-semibold"
                    style={{ color: 'var(--color-text-secondary)' }}
                    title={read.meaning}
                  >
                    {read.title}
                  </span>
                )}
              </div>

              {regimeLoading && !regime && <LoadingSpinner />}

              {regime && regime.bars.length > 0 && (
                <GammaRegimeChart payload={regime} mode={mode} syncId={SYNC_ID} />
              )}

              {regime && regime.bars.length === 0 && (
                <p className="py-4 text-sm italic" style={{ color: 'var(--color-text-secondary)' }}>
                  No structure reading for this session yet — the series is written once per
                  analytics cycle, so it fills in as the session runs.
                </p>
              )}

              {read && (
                <p
                  className="mt-2 text-[11px] leading-relaxed"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  {read.meaning}
                </p>
              )}
            </div>
          </div>
        </>
      )}
    </PageShell>
  );
}
