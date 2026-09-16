'use client';

import { useMemo, useState } from 'react';

import PageShell from '@/components/layout/PageShell';
import PageHeader from '@/components/layout/PageHeader';
import ChartPanel from '@/components/layout/ChartPanel';
import ReadoutTile from '@/components/layout/ReadoutTile';
import { FilterBar, FilterChip, FilterDivider } from '@/components/controls/Filters';
import ErrorMessage from '@/components/ErrorMessage';
import LoadingSpinner from '@/components/LoadingSpinner';
import MetricCard from '@/components/MetricCard';
import FuturesUnsupportedPanel from '@/components/FuturesUnsupportedPanel';
import { useTimeframe } from '@/core/TimeframeContext';
import { isFuturesSymbol } from '@/core/symbols';
import {
  EMPTY,
  coverageReadout,
  formatBps,
  formatCrossCost,
  formatMultiple,
  formatPct,
  percentileVerdict,
  putCallReadout,
  sessionDrift,
  widestBucket,
  widestExpiration,
  dteLabel,
  SPREAD_SYMBOLS,
  type Verdict,
} from '@/core/spreadMonitor';
import {
  useSpreadCompare,
  useSpreadHistory,
  useSpreadSeries,
  useSpreadSnapshot,
} from '@/hooks/useSpreadMonitor';

import CrossSymbolTable from './CrossSymbolTable';
import ExpirationCurve from './ExpirationCurve';
import MoneynessCurve from './MoneynessCurve';
import SpreadHistoryChart from './SpreadHistoryChart';
import SpreadSessionChart from './SpreadSessionChart';
import SurfaceSection from './SurfaceSection';

/**
 * Spread Monitor — can you actually get filled in this chain?
 *
 * Every other Metrics page reads the option book to say what it MEANS:
 * where dealer gamma sits, which strike pins, how the surface shifted. None
 * of them say whether the market is tradeable, and a gamma wall three
 * points away is worth nothing to a trader whose put is quoted 12.40 x
 * 15.80. This page answers the execution half.
 *
 * The layout follows the order the question gets asked:
 *
 *   1. How wide is it right now, and which side is worse?
 *   2. Has it got worse THROUGH today?          (session chart)
 *   3. WHERE in the chain?                      (moneyness curve, expiries)
 *   4. Is today unusual for this symbol?        (surface vs history)
 *   5. And how has that run over time?          (daily record)
 *   6. Is another index any better?             (cross-symbol table)
 *
 * The one rule the whole page follows: no invented thresholds. Quoted
 * width has no universal "wide" line — SPX puts are structurally wider
 * than SPY puts on the calmest day of the year, so any fixed percentage
 * would be wrong for one of them at all times. Every verdict here is
 * either a comparison against the symbol's OWN history or a structural
 * statement of fact ("one contract in five has no bid"). When the history
 * is missing, the page shows the measurement and withholds the verdict.
 */

const HISTORY_DAYS = 60;

/** Half-width of the strike band, in percent of spot. */
const BAND_CHOICES = [2, 5, 10] as const;
/** Days to expiration included. 0 isolates the 0DTE book. */
const DTE_CHOICES = [0, 1, 7, 30] as const;

/** The scope CHIP label ("Through 7DTE"), distinct from core's `dteLabel`,
 *  which names a single expiry on a chart axis ("7d"). */
function scopeChipLabel(dte: number): string {
  if (dte === 0) return '0DTE only';
  if (dte === 1) return 'Through 1DTE';
  return `Through ${dte}DTE`;
}

function Readout({ verdict }: { verdict: Verdict | null }) {
  if (!verdict) return null;
  const color =
    verdict.tone === 'bearish'
      ? 'var(--color-bear)'
      : verdict.tone === 'bullish'
        ? 'var(--color-bull)'
        : 'var(--text-primary)';
  return (
    <p className="mt-3 text-[11px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
      <span className="font-semibold" style={{ color }}>
        {verdict.label}.
      </span>{' '}
      {verdict.meaning}
    </p>
  );
}

export default function SpreadMonitorPage() {
  const { symbol, setSymbol } = useTimeframe();
  const [dteMax, setDteMax] = useState<number>(7);
  const [bandPct, setBandPct] = useState<number>(5);

  // ES / NQ carry no option chain here, so the API answers 400. That is a
  // state the page can recognise before asking, so it does not ask: every
  // hook below is disabled rather than firing four requests whose answers
  // would never be rendered.
  const futures = isFuturesSymbol(symbol);
  const scope = useMemo(
    () => ({ dteMax, moneynessBandPct: bandPct, enabled: !futures }),
    [dteMax, bandPct, futures],
  );

  const { data, loading, error, refetch } = useSpreadSnapshot(symbol, scope);
  const { data: series } = useSpreadSeries(symbol, { ...scope, bucketMinutes: 15 });
  // Both sides of the book, so the daily record can show the put/call cut
  // rather than the puts alone. Separate requests because the rollup stores
  // one row per option type — medians do not combine.
  const { data: history } = useSpreadHistory(symbol, 'P', HISTORY_DAYS, !futures);
  const { data: callHistory } = useSpreadHistory(symbol, 'C', HISTORY_DAYS, !futures);
  const { data: compare } = useSpreadCompare(SPREAD_SYMBOLS, scope);

  const putVerdict = percentileVerdict(
    data?.history?.puts_percentile,
    data?.history?.sessions ?? 0,
  );
  const sideVerdict = putCallReadout(data?.put_call_width_ratio);
  const coverage = coverageReadout(data?.all);
  const drift = sessionDrift(series?.bars, 'puts');
  const worstPutBucket = widestBucket(data?.puts_by_moneyness);
  const worstExpiry = widestExpiration(data?.by_expiration);

  if (futures) {
    return (
      <PageShell>
        <PageHeader
          title="Spread Monitor"
          beta
          sub="Quoted bid/ask width and liquidity across the option chain."
        />
        <FuturesUnsupportedPanel symbol={symbol} surface="Spread Monitor" />
        <p className="mt-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
          A quoted spread is a width a market maker is actually showing on a real contract.
          Scaling an SPX quote by the futures basis would invent a market nobody published —
          in answer to the one question this page exists to answer honestly.
        </p>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PageHeader
        title="Spread Monitor"
        beta
        sub="How wide the chain is quoted, and how much of it has a market at all — whether you can get filled."
        tooltip="Quoted (NBBO) spreads, not effective spreads: the width market makers are showing, not what trades filled at. Everything else on this site reads the book to say what it means; this says whether the market is tradeable. Read every verdict as a comparison against this symbol's own history — there is no universal 'wide', since an SPX put is structurally wider than an SPY put on the calmest day of the year. The feed carries no sizes, so a tight quote for one contract and a tight quote for a thousand look identical here."
        actions={
          <FilterBar>
            {DTE_CHOICES.map((choice) => (
              <FilterChip key={choice} active={dteMax === choice} onClick={() => setDteMax(choice)}>
                {scopeChipLabel(choice)}
              </FilterChip>
            ))}
            <FilterDivider />
            {BAND_CHOICES.map((choice) => (
              <FilterChip key={choice} active={bandPct === choice} onClick={() => setBandPct(choice)}>
                ±{choice}%
              </FilterChip>
            ))}
          </FilterBar>
        }
      />

      {error && <ErrorMessage message={error} onRetry={refetch} />}
      {loading && !data && <LoadingSpinner />}

      {data && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              title="Put spread"
              value={formatPct(data.puts.median_relative_spread_pct)}
              subtitle={
                data.puts.median_spread != null
                  ? `${formatCrossCost(data.puts.median_spread)} per contract to cross`
                  : 'No two-sided put market'
              }
              tooltip="Median quoted width on the puts in range, as a share of the option's own mid. This is the fraction of your premium that crossing the spread costs."
              trend={putVerdict?.tone ?? 'neutral'}
            />
            <MetricCard
              title="Call spread"
              value={formatPct(data.calls.median_relative_spread_pct)}
              subtitle={
                data.calls.median_spread != null
                  ? `${formatCrossCost(data.calls.median_spread)} per contract to cross`
                  : 'No two-sided call market'
              }
              tooltip="The same measure on the calls. Read it next to the put figure rather than on its own — the difference between them is the reading."
            />
            <MetricCard
              title="Put / call width"
              value={formatMultiple(data.put_call_width_ratio)}
              subtitle={sideVerdict?.label ?? 'Not enough quotes to compare'}
              tooltip="Put width divided by call width. Above 1 means the downside is the expensive side to trade — a hedging bid rather than a broad liquidity problem."
              trend={sideVerdict?.tone ?? 'neutral'}
            />
            <MetricCard
              title="No market at all"
              value={formatPct(
                data.all.zero_bid_pct + data.all.crossed_or_locked_pct,
                1,
              )}
              subtitle={`${data.all.tradable_count} of ${data.all.contract_count} contracts two-sided`}
              tooltip="Share of contracts in range quoted with no bid, locked or crossed. These have no width by construction and are excluded from every median above — which is why a chain can hold its median while part of it goes untradeable."
              trend={coverage?.tone ?? 'neutral'}
            />
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <ReadoutTile
              title={<>Against this symbol&rsquo;s own history</>}
              value={putVerdict ? putVerdict.label : 'No baseline yet'}
              tone={putVerdict ? putVerdict.tone : 'muted'}
            >
              {putVerdict ? (
                <>
                  {putVerdict.meaning}
                  {data.history?.puts_vs_window_ratio != null && (
                    <>
                      {' '}
                      Put markets are{' '}
                      <strong>{formatMultiple(data.history.puts_vs_window_ratio)}</strong> the
                      median width of that window.
                    </>
                  )}
                </>
              ) : (
                <>
                  There is no universal &ldquo;wide&rdquo; for a quoted spread — an SPX put is
                  structurally wider than an SPY put on the calmest day of the year. So this
                  page only calls a reading unusual against the same symbol&rsquo;s own past
                  sessions, and stays quiet until it has them.
                </>
              )}
            </ReadoutTile>

            <ReadoutTile
              title="Since the open"
              value={drift ? formatMultiple(drift.ratio) : EMPTY}
              tone={
                !drift
                  ? 'muted'
                  : drift.ratio >= 1.5
                    ? 'bearish'
                    : drift.ratio <= 0.75
                      ? 'bullish'
                      : 'neutral'
              }
            >
              {drift ? (
                <>
                  Put markets opened at {formatPct(drift.open)} and are now{' '}
                  {formatPct(drift.latest)}. This is a different question from the one on the
                  left: a chain can be wide all day, or start orderly and deteriorate into
                  the close, and only one of those shows up here.
                </>
              ) : (
                'Needs at least two readings in the session to compare.'
              )}
            </ReadoutTile>
          </div>

          <ChartPanel
            title="Through the session"
            tooltip="One reading per 15-minute bucket, taken at the last chain snapshot inside it. Puts and calls are plotted separately because a blended median reports about half of a one-sided move."
            sub="Quoted width through today, puts against calls, with the share of puts carrying no market at all shaded underneath."
          >
            {series ? <SpreadSessionChart series={series} /> : <LoadingSpinner size="sm" />}
          </ChartPanel>

          <ChartPanel
            title="Where the chain thins"
            tooltip="Median quoted width by strike distance from spot, signed — downside strikes left, upside right. Bucketing by unsigned distance would fold the two wings together and average away exactly the asymmetry this shows."
            sub={
              worstPutBucket ? (
                <>
                  Widest put market is the <strong>{worstPutBucket.label}</strong> band at{' '}
                  {formatPct(worstPutBucket.median_relative_spread_pct)} of premium.
                </>
              ) : (
                'Median quoted width by distance from spot.'
              )
            }
          >
            <MoneynessCurve
              puts={data.puts_by_moneyness}
              calls={data.calls_by_moneyness}
            />
            <Readout verdict={coverage} />
          </ChartPanel>

          <ChartPanel
            title="By expiration"
            tooltip="Per-expiration rather than per-DTE-bucket. A range like '2-7 DTE' blends Wednesday's expiry with Friday's, and those routinely differ by more than the change worth noticing."
            sub={
              worstExpiry ? (
                <>
                  Widest puts are <strong>{dteLabel(worstExpiry.dte)}</strong> at{' '}
                  {formatPct(worstExpiry.pct)} of premium. Nearest expiry first —
                  quotes go first where time does.
                </>
              ) : (
                'Nearest expiry first — quotes go first where time does.'
              )
            }
          >
            <ExpirationCurve slices={data.by_expiration} />
            {/* The table is not redundant with the chart above it. The chart
                carries the shape — which expiry is worst, and by how much
                against the other side of the book. The table carries the
                exact values and the two columns the chart deliberately does
                not put on a second y-scale: width against the index, and
                what share has no bid at all. */}
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr
                    className="border-b"
                    style={{
                      borderColor: 'var(--border-default)',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    <th className="px-3 py-2 text-left font-semibold">Expiration</th>
                    <th className="px-3 py-2 text-left font-semibold">Put spread</th>
                    <th className="px-3 py-2 text-left font-semibold">Call spread</th>
                    <th className="px-3 py-2 text-left font-semibold">Put width vs index</th>
                    <th className="px-3 py-2 text-left font-semibold">No bid</th>
                    <th className="px-3 py-2 text-left font-semibold">Contracts</th>
                  </tr>
                </thead>
                <tbody>
                  {data.by_expiration.map((slice) => (
                    <tr
                      key={slice.expiration}
                      className="border-b last:border-b-0"
                      style={{ borderColor: 'var(--border-default)' }}
                    >
                      <th scope="row" className="px-3 py-2 text-left font-semibold whitespace-nowrap">
                        {slice.expiration}
                        <span
                          className="ml-2 text-xs font-normal"
                          style={{ color: 'var(--text-secondary)' }}
                        >
                          {slice.dte === 0 ? '0DTE' : `${slice.dte}d`}
                        </span>
                      </th>
                      <td className="px-3 py-2 tabular-nums">
                        {formatPct(slice.puts.median_relative_spread_pct)}
                      </td>
                      <td className="px-3 py-2 tabular-nums">
                        {formatPct(slice.calls.median_relative_spread_pct)}
                      </td>
                      <td className="px-3 py-2 tabular-nums">
                        {formatBps(slice.puts.median_spread_bps_underlying)}
                      </td>
                      <td className="px-3 py-2 tabular-nums">
                        {formatPct(slice.puts.zero_bid_pct, 1)}
                      </td>
                      <td className="px-3 py-2 tabular-nums">{slice.all.contract_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ChartPanel>

          {/* The readout at the top ranks the chain as one number; this ranks
              it strike by strike and expiry by expiry, which is the cut that
              separates "everything is wide" from "the front-month put wing
              is wide". It carries its own scope pills because a percentile is
              only meaningful inside a scope history was stored for, and the
              page filters above are free to take values the rollup never
              wrote. */}
          <SurfaceSection symbol={symbol} enabled={!futures} historyDays={HISTORY_DAYS} />

          <ChartPanel
            title={`Daily record — last ${HISTORY_DAYS} sessions`}
            tooltip="One row per trading day, written from the same reduction as the live reading above so the two are directly comparable. The band is the gap between the typical contract and the worst tenth."
            sub="Put markets by session. When both the line and the band rise the whole chain got worse; when only the band rises, the wings blew out while the money stayed orderly."
          >
            {history ? (
              <>
                <SpreadHistoryChart
                  putRows={history.rows}
                  callRows={callHistory?.rows ?? []}
                />
                {(history.excluded_thin_sessions ?? 0) > 0 && (
                  <p
                    className="mt-2 text-[11px] leading-relaxed"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    {history.excluded_thin_sessions} session
                    {history.excluded_thin_sessions === 1 ? '' : 's'} in this window
                    had too little of the chain quoted to measure and {history.excluded_thin_sessions === 1 ? 'is' : 'are'}{' '}
                    left out rather than drawn. That is a gap in the data, not a
                    quiet market — a session nobody could price is not the same as
                    one nobody traded.
                  </p>
                )}
              </>
            ) : (
              <LoadingSpinner size="sm" />
            )}
          </ChartPanel>

          <ChartPanel
            title="Across symbols"
            tooltip="The same reading on every index with an option chain of its own. ES and NQ are absent because they have none here — their levels are SPX/NDX derived, and there is no futures quote to measure a width from."
            sub="Click a row to switch the page to that symbol."
          >
            {compare ? (
              <CrossSymbolTable
                rows={compare.rows}
                activeSymbol={symbol}
                onSelect={(next) => setSymbol(next as typeof symbol)}
              />
            ) : (
              <LoadingSpinner size="sm" />
            )}
          </ChartPanel>

          <p
            className="mt-6 text-[11px] leading-relaxed"
            style={{ color: 'var(--text-secondary)' }}
          >
            {data.disclosure} Measured across {data.scope.contract_count} contracts struck
            between {data.scope.strike_low.toFixed(0)} and {data.scope.strike_high.toFixed(0)}{' '}
            ({data.scope.moneyness_band_pct}% either side of spot), expiring within{' '}
            {data.scope.dte_max} day{data.scope.dte_max === 1 ? '' : 's'}.
          </p>
        </>
      )}
    </PageShell>
  );
}
