'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { History } from 'lucide-react';

import PageShell from '@/components/layout/PageShell';
import PageHeader from '@/components/layout/PageHeader';
import { useTimeframe } from '@/core/TimeframeContext';
import { useHedgingFlow } from '@/hooks/useHedgingFlow';
import { useGammaRegimeSeries } from '@/hooks/useGammaRegimeSeries';
import { useGammaWeather } from '@/hooks/useGammaWeather';
import { etTodayDateKey } from '@/core/utils';
import HedgingFlowPanels, { ZeroDteToggle } from './HedgingFlowPanels';

/**
 * The LIVE Hedging Flow session — this route owns the polling, and nothing
 * else. Everything it draws is HedgingFlowPanels, which the dated permalink
 * draws too.
 *
 * The 0DTE toggle is the expirations filter carrying today's date, which is
 * also why it can honestly report "no 0DTE today": when today is not an expiry
 * the filter resolves to nothing rather than silently substituting Friday.
 */
export default function HedgingFlowPage() {
  const { symbol } = useTimeframe();
  const [zeroDteOnly, setZeroDteOnly] = useState(false);

  const sessionDateKey = etTodayDateKey();
  const expirations = useMemo(
    () => (zeroDteOnly ? [sessionDateKey] : undefined),
    [zeroDteOnly, sessionDateKey],
  );

  const { data, loading, error, refetch } = useHedgingFlow(symbol, { expirations });
  // Deliberately unfiltered by expiration: dealer gamma structure is a
  // property of the whole book, and scoping it to 0DTE would answer a
  // different question than the flow panel above it appears to be asking.
  const { data: regime, loading: regimeLoading } = useGammaRegimeSeries(symbol);
  // Unfiltered by the 0DTE toggle, same as the structure series.
  const { data: weather, notReady: weatherNotReady } = useGammaWeather(symbol);

  return (
    <PageShell>
      <PageHeader
        title="Hedging Flow"
        beta
        sub={
          <>
            Dealer hedging pressure from today&rsquo;s option trades, on price&rsquo;s timeline.
            Positive means the hedge <strong>buys</strong> stock.
          </>
        }
        tooltip="For every option that traded, the net customer position change is converted to the stock a delta-flat hedge implies: (buy - sell) x delta x 100 x spot, accumulated across the session. This is the observed counterpart to every open-interest surface on the site — Net GEX, the walls, the flip and Forced Flow all read the BOOK and ask what it would do; this reads what the tape did to that book today. The structure panel underneath shares the session window and the crosshair: flow says how hard the tape is pushing, structure says whether the book absorbs that push or amplifies it."
        actions={<ZeroDteToggle active={zeroDteOnly} onChange={setZeroDteOnly} />}
      />

      <HedgingFlowPanels
        symbol={symbol}
        sessionDateKey={sessionDateKey}
        data={data}
        regime={regime}
        weather={weather}
        weatherNotReady={weatherNotReady}
        zeroDteOnly={zeroDteOnly}
        loading={loading}
        regimeLoading={regimeLoading}
        error={error}
        onRetry={refetch}
      />

      <div className="mt-6 flex justify-end">
        <Link
          href="/hedging-flow/sessions"
          className="inline-flex items-center gap-1.5 text-xs font-semibold"
          style={{ color: 'var(--text-secondary)' }}
        >
          <History size={13} />
          Past sessions
        </Link>
      </div>
    </PageShell>
  );
}
