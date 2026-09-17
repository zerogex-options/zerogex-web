'use client';

import { useState } from 'react';

import ChartPanel from '@/components/layout/ChartPanel';
import { FilterBar, FilterChip, FilterDivider } from '@/components/controls/Filters';
import LoadingSpinner from '@/components/LoadingSpinner';
import { TONE_COLOR } from '@/components/layout/ReadoutTile';
import {
  EMPTY,
  baselineSummary,
  formatMultiple,
  formatPct,
  hasUsableBaseline,
  mostElevatedExpiry,
  surfaceReadout,
  type SpreadSurface,
} from '@/core/spreadMonitor';
import { useSpreadSurface } from '@/hooks/useSpreadMonitor';

import ExpiryRankChart from './ExpiryRankChart';
import SurfaceCurve, { type SurfaceMetric } from './SurfaceCurve';

/**
 * Spread Surface vs History — "is this wide FOR THIS SYMBOL, and where?"
 *
 * The rest of the page measures. This section is the only part that judges,
 * and it can only judge because it has the same measurement on the same
 * symbol, in the same strike band, on prior sessions at the same time of day.
 *
 * Its filters are its own rather than the page's. The section is a
 * comparison, and a comparison is only valid inside a scope history was
 * stored for — so the DTE and moneyness choices here are exactly the ones the
 * rollup writes, and the API rejects anything else rather than ranking a
 * reading against a population that was never measured. The page's filters
 * above stay free to take any value, because nothing up there is ranked.
 *
 * Puts and calls are a toggle, never an overlay. Two ranked curves on one
 * plot is four series plus two bands, and the reading it exists to support —
 * "the puts moved and the calls did not" — is easier to see by flipping
 * between two clean charts than by unpicking six overlapping ones.
 *
 * Nothing in here writes a sentence a rule did not produce. `surfaceReadout`
 * reuses the same 95 / 80 / 20 thresholds the header cards use, and when
 * there is no baseline it returns nothing and the section says so plainly.
 */

/** The universes the rollup stores. Anything else has nothing to rank against. */
const DTE_CHOICES = [0, 1, 7, 30] as const;
const BAND_CHOICES = [2, 5, 10] as const;

function scopeLabel(dte: number): string {
  if (dte === 0) return '0DTE only';
  if (dte === 1) return 'Through 1DTE';
  return `Through ${dte}DTE`;
}

function SummaryCell({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: string;
}) {
  return (
    <div>
      <div className="zg-eyebrow mb-1">{label}</div>
      <div className="zg-metric text-lg" style={tone ? { color: tone } : undefined}>
        {value}
      </div>
      {sub && (
        <div className="mt-0.5 text-[10px]" style={{ color: 'var(--text-secondary)' }}>
          {sub}
        </div>
      )}
    </div>
  );
}

function SummaryStrip({ surface }: { surface: SpreadSurface }) {
  const { summary, baseline } = surface;
  const readout = surfaceReadout(surface);
  const percentileText =
    summary.percentile != null ? `${summary.percentile.toFixed(0)}th` : 'No rank yet';

  return (
    <div
      className="mb-4 grid grid-cols-2 gap-4 rounded-lg border p-4 sm:grid-cols-3 lg:grid-cols-6"
      style={{ borderColor: 'var(--border-default)' }}
    >
      <SummaryCell
        label="Current spread"
        value={formatPct(summary.current_pct)}
        sub={`${summary.contract_count} contracts`}
      />
      <SummaryCell
        label="Normal"
        value={formatPct(summary.normal_pct)}
        sub={baseline.time_matched ? baseline.time_bucket_label : 'no baseline'}
      />
      <SummaryCell
        label="vs normal"
        value={formatMultiple(summary.vs_normal)}
        tone={readout ? TONE_COLOR[readout.tone] : undefined}
      />
      <SummaryCell
        label="Percentile"
        value={percentileText}
        sub={
          summary.percentile == null
            ? `needs ${baseline.min_sessions} sessions`
            : 'vs own history'
        }
        tone={readout ? TONE_COLOR[readout.tone] : undefined}
      />
      <SummaryCell
        label="Two-sided"
        value={summary.two_sided_pct != null ? formatPct(summary.two_sided_pct, 0) : EMPTY}
        sub="of contracts in range"
      />
      <SummaryCell
        label="History"
        value={`${baseline.sessions}`}
        sub={baseline.sessions === 1 ? 'session' : 'sessions'}
      />
    </div>
  );
}

export default function SurfaceSection({
  symbol,
  enabled,
  historyDays,
}: {
  symbol: string;
  enabled: boolean;
  historyDays: number;
}) {
  const [side, setSide] = useState<'P' | 'C'>('P');
  const [dteMax, setDteMax] = useState<number>(0);
  const [bandPct, setBandPct] = useState<number>(5);
  const [metric, setMetric] = useState<SurfaceMetric>('spread');

  const { data, loading, error } = useSpreadSurface(symbol, side, {
    dteMax,
    moneynessBandPct: bandPct,
    historyDays,
    enabled,
  });

  const readout = data ? surfaceReadout(data) : null;
  const worstExpiry = data ? mostElevatedExpiry(data.by_dte) : null;
  const sideWord = side === 'P' ? 'Put' : 'Call';

  return (
    <ChartPanel
      title="Spread surface vs history"
      tooltip="Today's quoted width across the strikes, against what this symbol normally quotes in the same band at the same time of day. Every judgement here is a comparison against this symbol's own stored sessions — there is no universal 'wide'. Scopes are limited to the ones the rollup stores, because a reading can only be ranked inside a population that was actually measured."
      sub={
        <>
          Are spreads unusually wide right now, and where across the strikes?{' '}
          {worstExpiry?.percentile != null && (
            <>
              Most elevated expiry is <strong>{worstExpiry.label}</strong> at the{' '}
              {worstExpiry.percentile.toFixed(0)}th percentile of its own history.
            </>
          )}
        </>
      }
    >
      {/* The section's own filter row, in the body rather than the panel's
          `actions` slot. Eleven chips beside a standfirst squeezes the
          sentence into a three-line column against the left edge, and the
          sentence is the part that says what the section found. */}
      <FilterBar className="mb-4">
        <FilterChip active={side === 'P'} onClick={() => setSide('P')}>
          Puts
        </FilterChip>
        <FilterChip active={side === 'C'} onClick={() => setSide('C')}>
          Calls
        </FilterChip>
        <FilterDivider />
        {DTE_CHOICES.map((choice) => (
          <FilterChip
            key={choice}
            active={dteMax === choice}
            onClick={() => setDteMax(choice)}
          >
            {scopeLabel(choice)}
          </FilterChip>
        ))}
        <FilterDivider />
        {BAND_CHOICES.map((choice) => (
          <FilterChip
            key={choice}
            active={bandPct === choice}
            onClick={() => setBandPct(choice)}
          >
            ±{choice}%
          </FilterChip>
        ))}
      </FilterBar>

      {error && (
        <p className="py-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
          {error}
        </p>
      )}
      {loading && !data && <LoadingSpinner size="sm" />}

      {data && (
        <>
          <SummaryStrip surface={data} />

          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h4 className="zg-eyebrow">
              {sideWord} spread by strike vs normal
            </h4>
            <FilterBar>
              <FilterChip active={metric === 'spread'} onClick={() => setMetric('spread')}>
                Spread %
              </FilterChip>
              <FilterChip
                active={metric === 'percentile'}
                onClick={() => setMetric('percentile')}
              >
                Percentile
              </FilterChip>
            </FilterBar>
          </div>

          <SurfaceCurve points={data.curve} metric={metric} />

          {metric === 'percentile' && (
            <p className="mt-2 text-[11px]" style={{ color: 'var(--text-secondary)' }}>
              Each point is that strike band ranked against its own stored
              sessions, not a width. The guides at 80 and 20 are the same
              thresholds the cards above use for &ldquo;wider than usual&rdquo; and
              &ldquo;tighter than usual&rdquo;. Bands with too little history to rank
              are absent rather than plotted at zero, which would read as the
              tightest market on the chart.
            </p>
          )}

          <p className="mt-2 text-[11px]" style={{ color: 'var(--text-secondary)' }}>
            {baselineSummary(data.baseline)} · {sideWord}s, {scopeLabel(data.dte_max)},
            ±{data.moneyness_band_pct}% of spot.
            {data.baseline.fell_back_to_last_bucket && (
              <>
                {' '}
                The market is closed, so the comparison uses the{' '}
                {data.baseline.time_bucket_label} bucket — the last one of the session —
                rather than a clock time that has no history behind it.
              </>
            )}
            {!hasUsableBaseline(data.baseline) && (
              <>
                {' '}
                Below {data.baseline.min_sessions} comparable sessions no percentile is
                shown: a reading being the widest of a handful of days is not a
                distribution, and drawing it as one would be the most misleading thing on
                this page.
              </>
            )}
          </p>

          {readout && (
            <p
              className="mt-3 text-[11px] leading-relaxed"
              style={{ color: 'var(--text-secondary)' }}
            >
              <span className="font-semibold" style={{ color: TONE_COLOR[readout.tone] }}>
                {readout.label}.
              </span>{' '}
              {readout.meaning}
            </p>
          )}

          <div className="mt-6">
            <h4 className="zg-eyebrow mb-2">Where current spreads rank by expiry</h4>
            <ExpiryRankChart ranks={data.by_dte} />
            <p className="mt-2 text-[11px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              Each bar is that expiry&rsquo;s own percentile, not its width — 0DTE is
              structurally the widest book every day of the year, so a width chart here
              would say nothing. A single tall bar beside four ordinary ones is the
              finding: the chain is broadly normal and one expiry is not. Buckets are
              ranked inside the ±{data.moneyness_band_pct}% band and change with it.
            </p>
          </div>
        </>
      )}
    </ChartPanel>
  );
}
