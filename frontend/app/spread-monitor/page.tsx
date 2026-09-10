'use client';

import { useMemo, useState } from 'react';

import PageShell from '@/components/layout/PageShell';
import PanelSurface from '@/components/layout/Panel';
import SectionHead from '@/components/layout/SectionHead';
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
import MoneynessCurve from './MoneynessCurve';
import SpreadHistoryChart from './SpreadHistoryChart';
import SpreadSessionChart from './SpreadSessionChart';

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
 *   4. Is today unusual for this symbol?        (daily record)
 *   5. Is another index any better?             (cross-symbol table)
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

function dteLabel(dte: number): string {
  if (dte === 0) return '0DTE only';
  if (dte === 1) return 'Through 1DTE';
  return `Through ${dte}DTE`;
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full border px-3 py-1 text-xs font-semibold transition"
      style={{
        borderColor: active ? 'var(--color-warning)' : 'var(--border-default)',
        backgroundColor: active ? 'var(--color-warning-soft)' : 'transparent',
        color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
      }}
    >
      {children}
    </button>
  );
}

function Panel({
  title,
  tooltip,
  sub,
  children,
}: {
  title: string;
  tooltip?: string;
  sub?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <PanelSurface className="mt-6">
      <SectionHead title={title} titleClassName="zg-h3" tooltip={tooltip} sub={sub} />
      {children}
    </PanelSurface>
  );
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
  const { data: history } = useSpreadHistory(symbol, 'P', HISTORY_DAYS, !futures);
  const { data: compare } = useSpreadCompare(SPREAD_SYMBOLS, scope);

  const putVerdict = percentileVerdict(
    data?.history?.puts_percentile,
    data?.history?.sessions ?? 0,
  );
  const sideVerdict = putCallReadout(data?.put_call_width_ratio);
  const coverage = coverageReadout(data?.all);
  const drift = sessionDrift(series?.bars, 'puts');
  const worstPutBucket = widestBucket(data?.puts_by_moneyness);

  if (futures) {
    return (
      <PageShell>
        <SectionHead
          eyebrow="Execution Quality"
          title="Spread Monitor"
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
      <SectionHead
        eyebrow="Execution Quality"
        title="Spread Monitor"
        sub={
          <>
            How wide the option market is quoted, and how much of the chain has a market at
            all. Everything else on this site reads the book to say what it means; this says
            whether you can get filled in it.
          </>
        }
        tooltip="Quoted (NBBO) spreads, not effective spreads: the width market makers are showing, not what trades filled at. The feed carries no sizes, so a tight quote for one contract and a tight quote for a thousand look identical here."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {DTE_CHOICES.map((choice) => (
              <Chip key={choice} active={dteMax === choice} onClick={() => setDteMax(choice)}>
                {dteLabel(choice)}
              </Chip>
            ))}
            <span className="mx-1 opacity-40">|</span>
            {BAND_CHOICES.map((choice) => (
              <Chip key={choice} active={bandPct === choice} onClick={() => setBandPct(choice)}>
                ±{choice}%
              </Chip>
            ))}
          </div>
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
            <PanelSurface>
              <h3 className="zg-eyebrow mb-2">Against this symbol&rsquo;s own history</h3>
              {putVerdict ? (
                <>
                  <div
                    className="zg-metric text-2xl"
                    style={{
                      color:
                        putVerdict.tone === 'bearish'
                          ? 'var(--color-bear)'
                          : putVerdict.tone === 'bullish'
                            ? 'var(--color-bull)'
                            : 'var(--text-primary)',
                    }}
                  >
                    {putVerdict.label}
                  </div>
                  <p
                    className="mt-2 text-[11px] leading-relaxed"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    {putVerdict.meaning}
                    {data.history?.puts_vs_window_ratio != null && (
                      <>
                        {' '}
                        Put markets are{' '}
                        <strong>{formatMultiple(data.history.puts_vs_window_ratio)}</strong> the
                        median width of that window.
                      </>
                    )}
                  </p>
                </>
              ) : (
                <>
                  <div className="zg-metric text-2xl" style={{ color: 'var(--text-secondary)' }}>
                    No baseline yet
                  </div>
                  <p
                    className="mt-2 text-[11px] leading-relaxed"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    There is no universal &ldquo;wide&rdquo; for a quoted spread — an SPX put is
                    structurally wider than an SPY put on the calmest day of the year. So this
                    page only calls a reading unusual against the same symbol&rsquo;s own past
                    sessions, and stays quiet until it has them.
                  </p>
                </>
              )}
            </PanelSurface>

            <PanelSurface>
              <h3 className="zg-eyebrow mb-2">Since the open</h3>
              {drift ? (
                <>
                  <div
                    className="zg-metric text-2xl"
                    style={{
                      color:
                        drift.ratio >= 1.5
                          ? 'var(--color-bear)'
                          : drift.ratio <= 0.75
                            ? 'var(--color-bull)'
                            : 'var(--text-primary)',
                    }}
                  >
                    {formatMultiple(drift.ratio)}
                  </div>
                  <p
                    className="mt-2 text-[11px] leading-relaxed"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    Put markets opened at {formatPct(drift.open)} and are now{' '}
                    {formatPct(drift.latest)}. This is a different question from the one on the
                    left: a chain can be wide all day, or start orderly and deteriorate into
                    the close, and only one of those shows up here.
                  </p>
                </>
              ) : (
                <>
                  <div className="zg-metric text-2xl" style={{ color: 'var(--text-secondary)' }}>
                    {EMPTY}
                  </div>
                  <p
                    className="mt-2 text-[11px] leading-relaxed"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    Needs at least two readings in the session to compare.
                  </p>
                </>
              )}
            </PanelSurface>
          </div>

          <Panel
            title="Through the session"
            tooltip="One reading per 15-minute bucket, taken at the last chain snapshot inside it. Puts and calls are plotted separately because a blended median reports about half of a one-sided move."
            sub="Quoted width through today, puts against calls, with the share of puts carrying no market at all shaded underneath."
          >
            {series ? <SpreadSessionChart series={series} /> : <LoadingSpinner size="sm" />}
          </Panel>

          <Panel
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
          </Panel>

          <Panel
            title="By expiration"
            tooltip="Per-expiration rather than per-DTE-bucket. A range like '2-7 DTE' blends Wednesday's expiry with Friday's, and those routinely differ by more than the change worth noticing."
            sub="Nearest expiry first — quotes go first where time does."
          >
            <div className="overflow-x-auto">
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
          </Panel>

          <Panel
            title={`Daily record — last ${HISTORY_DAYS} sessions`}
            tooltip="One row per trading day, written from the same reduction as the live reading above so the two are directly comparable. The band is the gap between the typical contract and the worst tenth."
            sub="Put markets by session. When both the line and the band rise the whole chain got worse; when only the band rises, the wings blew out while the money stayed orderly."
          >
            {history ? (
              <SpreadHistoryChart rows={history.rows} />
            ) : (
              <LoadingSpinner size="sm" />
            )}
          </Panel>

          <Panel
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
          </Panel>

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
