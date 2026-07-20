'use client';

import PageShell from '@/components/layout/PageShell';
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import SectionHead from "@/components/layout/SectionHead";
import {
  useGEXSummary,
  useGEXByStrike,
  useGEXHistoricalContext,
  useMarketQuote,
  useVolatilityGauge,
  useApiData,
} from '@/hooks/useApiData';
import type { VolExpansionSignalResponse } from '@/hooks/useApiData';
import { useStrikeProfileTimeseries } from '@/hooks/useStrikeProfileTimeseries';
import MetricCard from '@/components/MetricCard';
import HistoricalContextBadge from '@/components/HistoricalContextBadge';
import { capture } from '@/core/telemetry/posthog-client';
import { TelemetryEvent } from '@/core/telemetry/events';
import { LoadingCard } from '@/components/LoadingSpinner';
import ErrorMessage from '@/components/ErrorMessage';
import GexRegimeHeader from '@/components/GexRegimeHeader';
import GexProfileChart from '@/components/GexProfileChart';
import GexStrikeDteHeatmap from '@/components/GexStrikeDteHeatmap';
import GexUnitToggle from '@/components/GexUnitToggle';
import GexWallsChart from '@/components/GexWallsChart';
import CharmVannaFlows from '@/components/CharmVannaFlows';
import VolSurfaceChart from '@/components/VolSurfaceChart';
import ExpandableCard, { useExpandedCard } from '@/components/ExpandableCard';
import { useTimeframe } from '@/core/TimeframeContext';
import { useTheme } from '@/core/ThemeContext';
import { etTodayDateKey } from '@/core/utils';
import { usePageT } from '@/core/LanguageContext';
import { dict } from './page.i18n';

// Wraps the GEX Metrics Snapshot table scroller so its max height tracks the
// expanded-card state — collapsed view fits ~20 rows, expanded view fills the
// browser viewport minus the modal chrome above/below the table.
const StrikeTableScroll = React.forwardRef<HTMLDivElement, { children: React.ReactNode }>(
  function StrikeTableScroll({ children }, ref) {
    const expanded = useExpandedCard();
    return (
      <div
        ref={ref}
        className="overflow-auto"
        style={{ maxHeight: expanded ? 'calc(100vh - 260px)' : 800 }}
      >
        {children}
      </div>
    );
  },
);

type StrikeAggregate = {
  strike: number;
  distanceFromSpot: number;
  netGexM: number;
  callGexM: number;
  putGexM: number;
  callOi: number;
  putOi: number;
  callVolume: number;
  putVolume: number;
  vannaM: number;
  charmM: number;
};

type SortKey = keyof StrikeAggregate;

type OpenInterestApiResponse = {
  spot_price?: number | string;
  contracts?: Record<string, unknown>[];
  rows?: Record<string, unknown>[];
  data?: Record<string, unknown>[];
  items?: Record<string, unknown>[];
  results?: Record<string, unknown>[];
};

type GexByStrikeRow = {
  strike?: number | string;
  expiration?: string;
  distance_from_spot?: number | string | null;
  net_gex?: number | string | null;
  call_gex?: number | string | null;
  put_gex?: number | string | null;
  call_oi?: number | string | null;
  put_oi?: number | string | null;
  call_volume?: number | string | null;
  put_volume?: number | string | null;
  vanna_exposure?: number | string | null;
  charm_exposure?: number | string | null;
};

// Aggregate raw by-strike rows into per-strike totals. Shared by the chart
// (single-select expiration filter) and the snapshot table (multi-select
// expiration filter) — each caller passes a different pre-filtered slice.
function aggregateStrikes(rows: GexByStrikeRow[] | null | undefined): StrikeAggregate[] {
  const grouped = new Map<string, StrikeAggregate>();
  (rows || []).forEach((row) => {
    const strike = Number(row.strike);
    const key = strike.toFixed(2);
    if (!grouped.has(key)) {
      grouped.set(key, {
        strike,
        distanceFromSpot: Number(row.distance_from_spot || 0),
        netGexM: 0,
        callGexM: 0,
        putGexM: 0,
        callOi: 0,
        putOi: 0,
        callVolume: 0,
        putVolume: 0,
        vannaM: 0,
        charmM: 0,
      });
    }
    const current = grouped.get(key)!;
    current.netGexM += Number(row.net_gex || 0) / 1000000;
    current.callGexM += Number(row.call_gex || 0) / 1000000;
    current.putGexM += Number(row.put_gex || 0) / 1000000;
    current.callOi += Number(row.call_oi || 0);
    current.putOi += Number(row.put_oi || 0);
    current.callVolume += Number(row.call_volume || 0);
    current.putVolume += Number(row.put_volume || 0);
    current.vannaM += Number(row.vanna_exposure || 0) / 1000000;
    current.charmM += Number(row.charm_exposure || 0) / 1000000;
    current.distanceFromSpot = Number(row.distance_from_spot || current.distanceFromSpot);
  });
  return Array.from(grouped.values()).sort((a, b) => a.strike - b.strike);
}

export default function GammaExposurePage() {
  const t = usePageT(dict);
  const { symbol, timeframe, setTimeframe } = useTimeframe();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const cardBg = isDark ? 'var(--color-surface)' : 'var(--color-surface)';
  const inputBg = isDark ? 'var(--color-bg)' : 'var(--color-surface-subtle)';
  const mutedText = isDark ? 'var(--color-text-secondary)' : 'var(--color-text-secondary)';
  const borderColor = 'var(--color-border)';

  // Data fetching — all at page level, passed as props to children
  const { data: gexData, loading: gexLoading, error: gexError, refetch: refetchGex } = useGEXSummary(symbol, 5000);
  const { data: quoteData } = useMarketQuote(symbol, 1000);

  // "Aha" / first-value: the first time gamma-exposure data actually renders
  // for this user in this session. Fired once via a ref guard (the data hook
  // polls every 5s, so we must not re-emit on every refresh). No-op unless a
  // PostHog key is configured.
  const firstValueFired = useRef(false);
  useEffect(() => {
    if (!firstValueFired.current && gexData) {
      firstValueFired.current = true;
      capture(TelemetryEvent.FirstValue, { feature: 'gamma_exposure', symbol });
    }
  }, [gexData, symbol]);
  const { data: gexByStrike, error: byStrikeError } = useGEXByStrike(symbol, 200, 10000, 'impact');
  const { data: historicalContext } = useGEXHistoricalContext(symbol, 15000);
  const { data: openInterestData } = useApiData<OpenInterestApiResponse | Record<string, unknown>[] | null>(
    `/api/market/open-interest?symbol=${symbol}&underlying=${symbol}`,
    { refreshInterval: 30000 },
  );
  const openInterestPayload = useMemo<OpenInterestApiResponse | null>(() => {
    if (!openInterestData) return null;
    if (Array.isArray(openInterestData)) {
      return { contracts: openInterestData };
    }
    if (openInterestData && typeof openInterestData === 'object') {
      return openInterestData as OpenInterestApiResponse;
    }
    return null;
  }, [openInterestData]);
  const normalizedOpenInterest = useMemo(() => {
    if (openInterestPayload && typeof openInterestPayload === 'object') {
      const payload = openInterestPayload as Record<string, unknown>;
      if (Array.isArray(payload.contracts)) return payload.contracts as Record<string, unknown>[];
      if (Array.isArray(payload.rows)) return payload.rows as Record<string, unknown>[];
      if (Array.isArray(payload.data)) return payload.data as Record<string, unknown>[];
      if (Array.isArray(payload.items)) return payload.items as Record<string, unknown>[];
      if (Array.isArray(payload.results)) return payload.results as Record<string, unknown>[];
    }
    return [];
  }, [openInterestPayload]);
  const openInterestSpotPrice = useMemo(() => {
    if (!openInterestPayload) return null;
    const value = Number(openInterestPayload.spot_price);
    return Number.isFinite(value) ? value : null;
  }, [openInterestPayload]);
  // QQQ's correct implied-vol input is VXN (Nasdaq-100); SPX/SPY use VIX.
  const volIndex: 'VIX' | 'VXN' = symbol === 'QQQ' ? 'VXN' : 'VIX';
  const { data: volGauge } = useVolatilityGauge(30000, volIndex);
  const { data: volExpansion } = useApiData<VolExpansionSignalResponse>(
    `/api/signals/advanced/vol-expansion?symbol=${encodeURIComponent(symbol)}&underlying=${encodeURIComponent(symbol)}`,
    { refreshInterval: 30000 },
  );

  // Expiration filter state for strike table
  const expirationOptions = useMemo(() => {
    const unique = new Set((gexByStrike || []).map((row) => String(row.expiration)));
    return Array.from(unique).sort((a, b) => a.localeCompare(b));
  }, [gexByStrike]);

  const [selectedExpirations, setSelectedExpirations] = useState<string[] | null>(null);
  // Charts' expiration selection (Gamma-Exposure-by-Strike bars/walls/flip).
  // Empty = All (aggregate the whole chain); a non-empty set aggregates the
  // bars and scopes the walls + flip to exactly those expirations.
  const [chartSelectedExpirations, setChartSelectedExpirations] = useState<string[]>([]);
  const [sortKey, setSortKey] = useState<SortKey>('strike');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  // GEX Profile chart's expiration dropdown only surfaces current/future
  // expirations.  The /api/gex/by-strike snapshot can still carry yesterday's
  // expirations for a window post-close (the analytics engine keeps the rows
  // around until the next session's data lands), but they're not interesting
  // to filter the chart by once we've crossed midnight ET.  The strike-table
  // section below keeps the unfiltered universe so the multi-select can still
  // inspect those rows for diagnostic purposes.
  const todayKey = etTodayDateKey();
  const chartExpirationOptions = useMemo(
    () => expirationOptions.filter((exp) => exp >= todayKey),
    [expirationOptions, todayKey],
  );
  // Drop any now-past expirations from the chart selection (page left open
  // across midnight ET, or a refresh rolled the date).  Pruning to a shorter
  // list only keeps this render-time adjustment convergent.
  if (chartSelectedExpirations.some((exp) => exp < todayKey)) {
    setChartSelectedExpirations((cur) => cur.filter((exp) => exp >= todayKey));
  }

  // Aggregate by-strike data for the table (respects table's multi-select).
  const strikeData = useMemo(() => {
    const selected = selectedExpirations === null ? expirationOptions : selectedExpirations;
    const activeExpirations = new Set(selected);
    const filteredSource = (gexByStrike || []).filter((row) => activeExpirations.has(String(row.expiration)));
    return aggregateStrikes(filteredSource as GexByStrikeRow[]);
  }, [gexByStrike, selectedExpirations, expirationOptions]);

  // Aggregate by-strike data for the GEX-profile chart (respects the chart's
  // multi-select expiration filter, independent of the table's filter).
  // Empty set = All: sum every expiration per strike, same as the table's
  // "All".  A non-empty set sums only the chosen expirations per strike.
  const chartStrikeData = useMemo(() => {
    const selectedSet = new Set(chartSelectedExpirations);
    const filteredSource = chartSelectedExpirations.length === 0
      ? (gexByStrike || [])
      : (gexByStrike || []).filter((row) => selectedSet.has(String(row.expiration)));
    return aggregateStrikes(filteredSource as GexByStrikeRow[]);
  }, [gexByStrike, chartSelectedExpirations]);

  // 'all' (empty set) or a sorted, comma-joined list of the chosen
  // expirations — the canonical value the timeseries hook keys its cache on
  // and the backend sums the walls across.
  const chartExpirationsParam = chartSelectedExpirations.length === 0
    ? 'all'
    : [...chartSelectedExpirations].sort().join(',');

  // Strike-profile timeseries drives the chart's Call/Put Wall reference
  // lines from the latest bucket, scoped to the chart's expiration selection.
  // (The Gamma-Flip line is derived by GexProfileChart itself from the GEX
  // Profile curve so the two always agree — for a subset both are the
  // scoped cumulative net-GEX curve.)  Timeframe is pinned to '5min' to share
  // the cache key MarketMakerExposures populates by default (DEFAULTS.tf =
  // '5m') — wall values are snapshots, so the bucket cadence doesn't affect
  // them, only cache reuse.
  const { buckets: strikeProfileBuckets } = useStrikeProfileTimeseries(
    symbol, '5min', chartExpirationsParam,
  );
  const { chartCallWall, chartPutWall } = useMemo(() => {
    if (strikeProfileBuckets.length === 0) {
      return { chartCallWall: undefined, chartPutWall: undefined };
    }
    const latest = strikeProfileBuckets[strikeProfileBuckets.length - 1];
    const cw = Number(latest?.call_wall);
    const pw = Number(latest?.put_wall);
    return {
      chartCallWall: Number.isFinite(cw) ? cw : undefined,
      chartPutWall: Number.isFinite(pw) ? pw : undefined,
    };
  }, [strikeProfileBuckets]);

  const sortedRows = useMemo(() => {
    const cloned = [...strikeData];
    cloned.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      const comparison = av < bv ? -1 : av > bv ? 1 : 0;
      return sortDir === 'asc' ? comparison : -comparison;
    });
    return cloned;
  }, [strikeData, sortKey, sortDir]);

  // Raw-dollar strike rows for the GEX Profile chart.  The /api/gex/profile
  // endpoint returns the spot-shift curve in raw dollars per 1% move, so
  // matching the per-strike bars to the same unit is what keeps the two
  // y-axes commensurable (the profile axis is just an order-of-magnitude
  // expansion of the bar axis — see GexProfileChart).
  const profileStrikeData = useMemo(
    () =>
      chartStrikeData.map((row) => ({
        strike: row.strike,
        netGex: row.netGexM * 1_000_000,
        callGex: row.callGexM * 1_000_000,
        putGex: row.putGexM * 1_000_000,
      })),
    [chartStrikeData],
  );

  // Metric computations
  // Dealer-gamma readings are taken AT SPOT — the cumulative-curve value at
  // the current price, which is sign-consistent with the gamma flip — not
  // the chain-wide total (which can carry the opposite sign when far-OTM
  // strikes dominate the tail). Fall back to the chain total only until the
  // backend has written net_gex_at_spot for the latest snapshot.
  const netGexAtSpot = gexData?.net_gex_at_spot ?? gexData?.net_gex ?? null;
  const netGexPositive = (netGexAtSpot ?? 0) >= 0;
  const ivRankPct = volGauge ? Math.round(volGauge.level * 10) : null;

  const totalVanna = useMemo(
    () => (gexByStrike || []).reduce((sum, r) => sum + Number(r.vanna_exposure || 0), 0),
    [gexByStrike],
  );
  const vannaLabel = totalVanna > 1e8 ? '+Tailwind' : totalVanna < -1e8 ? '-Headwind' : 'Neutral';
  const vannaTrend: 'bullish' | 'bearish' | 'neutral' = totalVanna > 1e8 ? 'bullish' : totalVanna < -1e8 ? 'bearish' : 'neutral';

  const totalCharm = useMemo(
    () => (gexByStrike || []).reduce((sum, r) => sum + Number(r.charm_exposure || 0), 0),
    [gexByStrike],
  );
  const charmLabel = Math.abs(totalCharm) < 1e8 ? 'Neutral' : totalCharm > 0 ? 'Bullish' : 'Bearish';

  const formatGexValue = (value: number): string => {
    const abs = Math.abs(value);
    const sign = value >= 0 ? '+' : '';
    if (abs >= 1e9) return `${sign}$${(value / 1e9).toFixed(1)}B`;
    if (abs >= 1e6) return `${sign}$${(value / 1e6).toFixed(1)}M`;
    if (abs >= 1e3) return `${sign}$${(value / 1e3).toFixed(0)}K`;
    return `${sign}$${value.toFixed(0)}`;
  };

  const postureTag: 'Aggressive' | 'Balanced' | 'Defensive' = useMemo(() => {
    const netGex = netGexAtSpot;
    if (netGex != null && netGex < 0 && (vannaTrend === 'bearish' || vannaTrend === 'bullish') && ivRankPct != null && ivRankPct >= 60) {
      return 'Aggressive';
    }
    if (netGex != null && netGex > 0 && ivRankPct != null && ivRankPct <= 40) {
      return 'Defensive';
    }
    return 'Balanced';
  }, [netGexAtSpot, vannaTrend, ivRankPct]);

  const marketContextSummary = useMemo(() => {
    const horizonLabel = timeframe === '1day' || timeframe === '1hr' ? 'swing' : 'intraday';
    const spot = quoteData?.close;
    const callWall = gexData?.call_wall ?? null;
    const putWall = gexData?.put_wall ?? null;
    const netGex = netGexAtSpot;
    const pcr = gexData?.put_call_ratio ?? null;
    const callDistance = spot != null && callWall != null ? Math.abs(callWall - spot) : null;
    const putDistance = spot != null && putWall != null ? Math.abs(spot - putWall) : null;
    const nearestWall = callDistance != null && putDistance != null
      ? (callDistance < putDistance ? 'call' : 'put')
      : null;

    const locationText =
      spot != null && callWall != null && putWall != null
        ? spot > callWall
          ? t('locAboveCallWall')
          : spot < putWall
            ? t('locBelowPutWall')
            : nearestWall === 'put'
              ? t('locNearPutWall')
              : t('locNearCallWall')
        : t('locIncomplete');

    const gexText =
      netGex == null
        ? t('gexUnclear')
        : netGex > 2e9
          ? t('gexDeepLong')
          : netGex > 0
            ? t('gexNetLong')
            : netGex < -2e9
              ? t('gexDeepShort')
              : t('gexNetShort');

    const flowText =
      vannaTrend === 'bullish' && charmLabel === 'Bullish'
        ? t('flowBullish')
        : vannaTrend === 'bearish' && charmLabel === 'Bearish'
          ? t('flowBearish')
          : t('flowMixed');

    const riskText =
      ivRankPct == null
        ? t('riskUnclear')
        : ivRankPct >= 70
          ? t('riskElevated')
          : ivRankPct <= 30
            ? t('riskCalm')
            : t('riskMiddle');

    const crowdingText =
      pcr == null
        ? ''
        : pcr >= 1.2
          ? t('crowdPutHeavy')
          : pcr <= 0.8
            ? t('crowdCallHeavy')
            : t('crowdBalanced');

    const actionText =
      netGex != null && netGex < 0
        ? t('actionBearish')
        : t('actionDefault');
    const horizonText = horizonLabel === 'intraday'
      ? t('horizonIntraday')
      : t('horizonSwing');

    return `${locationText} ${gexText} ${flowText} ${riskText} ${crowdingText} ${actionText} ${horizonText}`.trim();
  }, [quoteData?.close, gexData, netGexAtSpot, vannaTrend, charmLabel, ivRankPct, timeframe, t]);

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((dir) => (dir === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortKey(key);
    setSortDir('desc');
  };

  // Strike closest to spot — used to center the snapshot table on the
  // most actionable row when it first renders. Recomputes only when the
  // visible row set or spot changes, not on every spot tick (closestStrike
  // stays the same until spot crosses a strike-spacing midpoint).
  const tableScrollRef = useRef<HTMLDivElement | null>(null);
  const closestStrikeToSpot = useMemo<number | null>(() => {
    const spot = quoteData?.close;
    if (spot == null || !Number.isFinite(spot) || sortedRows.length === 0) return null;
    let best = sortedRows[0].strike;
    let bestDist = Math.abs(best - spot);
    for (const row of sortedRows) {
      const dist = Math.abs(row.strike - spot);
      if (dist < bestDist) {
        best = row.strike;
        bestDist = dist;
      }
    }
    return best;
  }, [sortedRows, quoteData?.close]);

  // Strikes to flag in the ladder: the gamma-flip crossing and the call/put
  // walls. Walls/flip are reported as prices at strikes; snap each to the
  // nearest visible strike so the row still highlights if the value is a
  // hair off the strike grid.
  const ladderMarks = useMemo(() => {
    const nearest = (target: number | null | undefined): number | null => {
      const t = Number(target);
      if (!Number.isFinite(t) || sortedRows.length === 0) return null;
      let best = sortedRows[0].strike;
      let bestDist = Math.abs(best - t);
      for (const row of sortedRows) {
        const d = Math.abs(row.strike - t);
        if (d < bestDist) { best = row.strike; bestDist = d; }
      }
      return best;
    };
    return {
      flip: nearest(gexData?.gamma_flip),
      callWall: nearest(gexData?.call_wall),
      putWall: nearest(gexData?.put_wall),
    };
  }, [sortedRows, gexData?.gamma_flip, gexData?.call_wall, gexData?.put_wall]);

  // Center the scroll on the closest-to-spot row whenever the row set
  // changes meaningfully (initial load, sort change, expiration filter
  // change, or spot crossing a strike midpoint). useLayoutEffect runs
  // before paint so the user never sees a flash of top-aligned scroll.
  useLayoutEffect(() => {
    if (closestStrikeToSpot == null) return;
    const container = tableScrollRef.current;
    if (!container) return;
    const row = container.querySelector(`tr[data-strike="${closestStrikeToSpot}"]`);
    if (!(row instanceof HTMLElement)) return;
    const containerRect = container.getBoundingClientRect();
    const rowRect = row.getBoundingClientRect();
    const rowOffsetWithinScroll = rowRect.top - containerRect.top + container.scrollTop;
    container.scrollTop = Math.max(
      0,
      rowOffsetWithinScroll - container.clientHeight / 2 + row.clientHeight / 2,
    );
  }, [closestStrikeToSpot, sortKey, sortDir]);

  if (gexLoading && !gexData) {
    return (
      <PageShell>
        <h1 className="text-3xl font-bold mb-8">{t('pageTitle')}</h1>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <LoadingCard /><LoadingCard /><LoadingCard /><LoadingCard />
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <h1 className="text-3xl font-bold mb-6">{t('pageTitle')}</h1>
      <div className="mb-4">
        <GexUnitToggle />
      </div>
      {gexError && <ErrorMessage message={gexError} onRetry={refetchGex} />}
      {/* Section 1: Regime Header */}
      <GexRegimeHeader
        gexSummary={gexData}
        quoteData={quoteData}
        symbol={symbol}
        marketContextSummary={marketContextSummary}
        postureTag={postureTag}
        contextHorizon={timeframe === '1day' || timeframe === '1hr' ? 'swing' : 'intraday'}
        onContextHorizonChange={(horizon) => setTimeframe(horizon === 'intraday' ? '5min' : '1day')}
      />

      {/* Section 2: Metric Cards */}
      <section className="mb-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <MetricCard
            title="Net GEX"
            value={netGexAtSpot != null ? formatGexValue(netGexAtSpot) : '--'}
            trend={netGexPositive ? 'bullish' : 'bearish'}
            tooltip={t('netGexTooltip')}
            contextBadge={
              <HistoricalContextBadge
                metric={historicalContext?.metrics?.net_gex_at_spot}
                window="30d"
                trackingStartedAt={historicalContext?.tracking_started_at}
              />
            }
          />
          <MetricCard
            title="IV Rank"
            value={ivRankPct != null ? `${ivRankPct}%` : '--'}
            subtitle={volGauge?.level_label}
            tooltip={t('ivRankTooltip', { volIndex })}
          />
          <MetricCard
            title="Vanna Flow"
            value={vannaLabel}
            trend={vannaTrend}
            tooltip={t('vannaTooltip')}
          />
          <MetricCard
            title="Charm Decay"
            value={charmLabel}
            tooltip={t('charmTooltip')}
          />
        </div>
      </section>

      {/* Section 3: GEX Profile overlay — bars + spot-shift profile curve. */}
      <section className="mb-8">
        <div className="grid grid-cols-1 gap-4">
          <GexProfileChart
            symbol={symbol}
            strikeData={profileStrikeData}
            spotPrice={quoteData?.close}
            gammaFlip={gexData?.gamma_flip}
            callWall={chartCallWall}
            putWall={chartPutWall}
            expirationOptions={chartExpirationOptions}
            selectedExpirations={chartSelectedExpirations}
            onSelectedExpirationsChange={setChartSelectedExpirations}
          />
        </div>
      </section>

      {/* Section 4: Call/Put Wall Map */}
      <section className="mb-8">
        <div className="grid grid-cols-1 gap-4">
          {/*
           * spotPrice priority: live WS quote (updates on every tick) first,
           * then the open-interest endpoint's snapshot spot (HTTP polled,
           * lags). Pre-WS this used openInterestSpotPrice exclusively which
           * looked ~500ms behind the header price now that the header ticks
           * on a live socket. Falls back to openInterestSpotPrice off-market
           * hours when quoteData.close would stay flat and the OI snapshot is
           * the more meaningful reference.
           */}
          <GexWallsChart
            openInterestData={normalizedOpenInterest}
            spotPrice={
              quoteData?.close != null &&
              Number.isFinite(quoteData.close) &&
              quoteData.close > 0 &&
              quoteData.session != null &&
              quoteData.session !== 'closed'
                ? quoteData.close
                : openInterestSpotPrice
            }
            byStrikeFallback={gexByStrike || []}
          />
        </div>
      </section>

      {/* Section 5: Strike×DTE Heatmap + Charm/Vanna Flows */}
      <section className="mb-8">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          <div className="lg:col-span-3 h-full">
            <GexStrikeDteHeatmap byStrikeData={gexByStrike} spotPrice={quoteData?.close} />
          </div>
          <div className="lg:col-span-2 h-full">
            <CharmVannaFlows byStrikeData={gexByStrike} volExpansion={volExpansion} />
          </div>
        </div>
      </section>

      {/* Section 6: Vol Surface */}
      <section className="mb-8">
        <div className="grid grid-cols-1 gap-4">
          <VolSurfaceChart symbol={symbol} />
        </div>
      </section>

      {/* Section 7: Strike Data Table */}
      <section className="mb-8">
        <ExpandableCard expandTrigger="button" expandButtonLabel={t('expandCardLabel')}>
          <div className="rounded-lg p-6" style={{ backgroundColor: cardBg, border: `1px solid ${borderColor}` }}>
            <SectionHead title={t('metricsSnapshotTitle')} tooltip={t('metricsSnapshotTooltip')} />
            {byStrikeError ? <ErrorMessage message={byStrikeError} /> : expirationOptions.length === 0 ? (
              <div className="text-center py-8" style={{ color: mutedText }}>{t('noStrikeData')}</div>
            ) : (
              <>
                <div className="mb-5 flex flex-wrap gap-2 items-center">
                  <span className="text-sm" style={{ color: mutedText }}>{t('expirationsLabel')}</span>
                  {(() => {
                    const allSelected =
                      selectedExpirations === null ||
                      (expirationOptions.length > 0 && selectedExpirations.length === expirationOptions.length);
                    return (
                      <button
                        onClick={() => setSelectedExpirations(null)}
                        disabled={allSelected}
                        style={
                          allSelected
                            ? { backgroundColor: inputBg, borderColor: borderColor, color: mutedText, opacity: 0.5, cursor: 'not-allowed' }
                            : undefined
                        }
                        className={`px-3 py-1 text-xs rounded border ${allSelected ? '' : 'bg-[var(--color-info-soft)] border-[var(--color-info)] text-[var(--text-primary)]'}`}
                      >
                        {t('allButton')}
                      </button>
                    );
                  })()}
                  {(() => {
                    const isEmpty = Array.isArray(selectedExpirations) && selectedExpirations.length === 0;
                    const canClear = !isEmpty;
                    return (
                      <button
                        type="button"
                        onClick={() => setSelectedExpirations([])}
                        disabled={!canClear}
                        style={{
                          backgroundColor: inputBg,
                          borderColor: borderColor,
                          color: mutedText,
                          opacity: canClear ? 1 : 0.5,
                          cursor: canClear ? 'pointer' : 'not-allowed',
                        }}
                        className="px-3 py-1 text-xs rounded border"
                        title={t('clearButtonTitle')}
                      >
                        {t('clearButton')}
                      </button>
                    );
                  })()}
                  {expirationOptions.map((exp) => {
                    const active = selectedExpirations === null || selectedExpirations.includes(exp);
                    return (
                      <button
                        key={exp}
                        onClick={() => setSelectedExpirations((current) => {
                          if (current === null) {
                            return expirationOptions.filter((v) => v !== exp);
                          }
                          if (current.includes(exp)) {
                            return current.filter((v) => v !== exp);
                          }
                          return [...current, exp];
                        })}
                        style={active ? undefined : { backgroundColor: inputBg, borderColor: borderColor, color: mutedText }}
                        className={`px-3 py-1 text-xs rounded border ${active ? 'bg-[var(--color-info-soft)] border-[var(--color-info)] text-[var(--text-primary)]' : ''}`}
                      >
                        {exp}
                      </button>
                    );
                  })}
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-2 zg-eyebrow" style={{ color: 'var(--text-secondary)' }}>
                  <span className="flex items-center gap-1.5"><span style={{ width: 10, height: 2, background: 'var(--color-accent-hot)', display: 'inline-block' }} />Spot</span>
                  <span className="flex items-center gap-1.5"><span style={{ width: 10, height: 2, background: 'var(--heat-mid)', display: 'inline-block' }} />Gamma&nbsp;Flip</span>
                  <span className="flex items-center gap-1.5"><span style={{ width: 10, height: 2, background: 'var(--color-bull)', display: 'inline-block' }} />Call&nbsp;Wall</span>
                  <span className="flex items-center gap-1.5"><span style={{ width: 10, height: 2, background: 'var(--color-bear)', display: 'inline-block' }} />Put&nbsp;Wall</span>
                </div>

                <StrikeTableScroll ref={tableScrollRef}>
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 z-10" style={{ backgroundColor: cardBg }}>
                      <tr className="border-b" style={{ borderColor: borderColor, color: mutedText }}>
                        <th className="zg-label text-right py-1.5 px-2 cursor-pointer whitespace-nowrap" onClick={() => toggleSort('strike')}>Strike</th>
                        <th className="zg-label text-right py-1.5 px-2 cursor-pointer whitespace-nowrap" onClick={() => toggleSort('distanceFromSpot')}>Dist.</th>
                        <th className="zg-label text-right py-1.5 px-2 cursor-pointer whitespace-nowrap" onClick={() => toggleSort('netGexM')}>Net GEX</th>
                        <th className="zg-label text-right py-1.5 px-2 cursor-pointer whitespace-nowrap" onClick={() => toggleSort('vannaM')}>Vanna</th>
                        <th className="zg-label text-right py-1.5 px-2 cursor-pointer whitespace-nowrap" onClick={() => toggleSort('charmM')}>Charm</th>
                        <th className="zg-label text-right py-1.5 px-2 cursor-pointer whitespace-nowrap" onClick={() => toggleSort('callOi')}>Call OI</th>
                        <th className="zg-label text-right py-1.5 px-2 cursor-pointer whitespace-nowrap" onClick={() => toggleSort('putOi')}>Put OI</th>
                        <th className="zg-label text-right py-1.5 px-2 cursor-pointer whitespace-nowrap" onClick={() => toggleSort('callVolume')}>Call Vol</th>
                        <th className="zg-label text-right py-1.5 px-2 cursor-pointer whitespace-nowrap" onClick={() => toggleSort('putVolume')}>Put Vol</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedRows.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="text-center py-8" style={{ color: mutedText }}>
                            {t('noExpirationsSelected')}
                          </td>
                        </tr>
                      ) : (
                        sortedRows.map((row) => {
                          // The single live cursor (spot), the flip crossing, and the
                          // walls — each flagged with a left rule in its own theme token;
                          // the flip and spot rows also get a faint band.
                          const isSpot = row.strike === closestStrikeToSpot;
                          const isFlip = row.strike === ladderMarks.flip;
                          const isCallWall = row.strike === ladderMarks.callWall;
                          const isPutWall = row.strike === ladderMarks.putWall;
                          const edge = isSpot
                            ? 'var(--color-accent-hot)'
                            : isFlip
                              ? 'var(--heat-mid)'
                              : isCallWall
                                ? 'var(--color-bull)'
                                : isPutWall
                                  ? 'var(--color-bear)'
                                  : null;
                          const band = isFlip
                            ? 'color-mix(in srgb, var(--heat-mid) 14%, transparent)'
                            : isSpot
                              ? 'color-mix(in srgb, var(--color-accent-hot) 10%, transparent)'
                              : undefined;
                          return (
                            <tr
                              key={row.strike}
                              data-strike={row.strike}
                              className="border-b"
                              style={{
                                borderColor: borderColor,
                                backgroundColor: band,
                                boxShadow: edge ? `inset 3px 0 0 0 ${edge}` : undefined,
                              }}
                            >
                              <td className="zg-datum py-1.5 px-2" style={{ color: 'var(--text-primary)' }}>${row.strike.toFixed(2)}</td>
                              <td className="zg-datum py-1.5 px-2">{row.distanceFromSpot.toFixed(2)}</td>
                              <td className={`zg-datum py-1.5 px-2 font-semibold ${row.netGexM >= 0 ? 'text-[var(--color-bull)]' : 'text-[var(--color-bear)]'}`}>${row.netGexM.toFixed(2)}M</td>
                              <td className={`zg-datum py-1.5 px-2 font-semibold ${row.vannaM >= 0 ? 'text-[var(--color-bull)]' : 'text-[var(--color-bear)]'}`}>${row.vannaM.toFixed(2)}M</td>
                              <td className={`zg-datum py-1.5 px-2 font-semibold ${row.charmM >= 0 ? 'text-[var(--color-bull)]' : 'text-[var(--color-bear)]'}`}>${row.charmM.toFixed(2)}M</td>
                              <td className="zg-datum py-1.5 px-2">{row.callOi.toLocaleString()}</td>
                              <td className="zg-datum py-1.5 px-2">{row.putOi.toLocaleString()}</td>
                              <td className="zg-datum py-1.5 px-2">{row.callVolume.toLocaleString()}</td>
                              <td className="zg-datum py-1.5 px-2">{row.putVolume.toLocaleString()}</td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </StrikeTableScroll>
              </>
            )}
          </div>
        </ExpandableCard>
      </section>
    </PageShell>
  );
}
