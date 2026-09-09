'use client';

import { useMemo, useState } from 'react';

import PageShell from '@/components/layout/PageShell';
import SectionHead from '@/components/layout/SectionHead';
import ErrorMessage from '@/components/ErrorMessage';
import LoadingSpinner from '@/components/LoadingSpinner';
import MetricCard from '@/components/MetricCard';
import HedgingFlowChart from '@/components/HedgingFlowChart';
import { useTimeframe } from '@/core/TimeframeContext';
import {
  latestRateFlip,
  latestRealBar,
  useHedgingFlow,
} from '@/hooks/useHedgingFlow';
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
 */

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

  const expirations = useMemo(
    () => (zeroDteOnly ? [etTodayDateKey()] : undefined),
    [zeroDteOnly],
  );

  const { data, loading, error, refetch } = useHedgingFlow(symbol, { expirations });

  const latest = latestRealBar(data);
  const flip = latestRateFlip(data);

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
            <HedgingFlowChart payload={data} />
          </div>
        </>
      )}
    </PageShell>
  );
}
