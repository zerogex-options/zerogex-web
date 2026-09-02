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
import { useTierAccessState } from '@/hooks/useAuthSession';
import { resolveSignalAvailability } from '@/core/signalAvailability';
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
import GammaHeatmapCanvas from '@/components/GammaHeatmapCanvas';
import GexUnitToggle from '@/components/GexUnitToggle';
import StrikeFilterToggle from '@/components/StrikeFilterToggle';
import GexWallsChart from '@/components/GexWallsChart';
import CharmVannaFlows from '@/components/CharmVannaFlows';
import VolSurfaceChart from '@/components/VolSurfaceChart';
import ExpandableCard, { useExpandedCard } from '@/components/ExpandableCard';
import ModeledPositioningNote from '@/components/ModeledPositioningNote';
import { useTimeframe } from '@/core/TimeframeContext';
import { useStrikeFilter } from '@/core/StrikeFilterContext';
import { selectActive } from '@/core/strikeFilter';
import { useTheme } from '@/core/ThemeContext';
import { etTodayDateKey } from '@/core/utils';
import { useSharedExpirations } from '@/hooks/useSharedExpirations';
import { useZeroDteOption } from '@/hooks/useZeroDteOption';
import { reconcileExpirations } from '@/core/expirationPersistence';
import { netGexAtSpotOrNull, longGammaAtSpot } from '@/core/gammaRegime';
import { volatilityIndexFor } from '@/core/symbols';
import {
  aggregateStrikes,
  chartExpirationOptions as deriveChartExpirationOptions,
  chartStrikeData as deriveChartStrikeData,
  expirationsParam,
  normalizeOpenInterestPayload,
  openInterestRows,
  openInterestSpotPrice as deriveOpenInterestSpotPrice,
  perExpirationStrikeData as derivePerExpirationStrikeData,
  strikeExpirationOptions,
  toProfileStrikeData,
  type GexByStrikeRow,
  type OpenInterestApiResponse,
  type StrikeAggregate,
} from '@/core/gexStrikeCharts';

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

type SortKey = keyof StrikeAggregate;

export default function GammaExposurePage() {
  const { symbol, timeframe, setTimeframe } = useTimeframe();
  const { activeOnly } = useStrikeFilter();
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
  const openInterestPayload = useMemo(
    () => normalizeOpenInterestPayload(openInterestData),
    [openInterestData],
  );
  const normalizedOpenInterest = useMemo(
    () => openInterestRows(openInterestPayload),
    [openInterestPayload],
  );
  const openInterestSpotPrice = useMemo(
    () => deriveOpenInterestSpotPrice(openInterestPayload),
    [openInterestPayload],
  );
  // QQQ/NDX's correct implied-vol input is VXN (Nasdaq-100); SPX/SPY use VIX.
  const volIndex: 'VIX' | 'VXN' = volatilityIndexFor(symbol);
  const { data: volGauge } = useVolatilityGauge(30000, volIndex);
  // vol-expansion is a Pro-only endpoint; this page is Basic-tier, so gate the
  // poll behind Pro access instead of 403-looping for non-Pro viewers.
  //
  // Skipping the request is right, but it used to make the row indistinguishable
  // from a broken one: no request means no data, and CharmVannaFlows had only
  // the resulting null to render, so a Basic viewer got "N/A — No expansion
  // signal available" over a Pro feature working exactly as designed. We now
  // carry the REASON alongside the data — entitlement, HTTP status, and whether
  // the session has even resolved — so the row can name the gate (and an
  // outage can look like an outage).
  const { allowed: hasProAccess, loading: tierResolving } = useTierAccessState('pro');
  const {
    data: volExpansion,
    loading: volExpansionLoading,
    error: volExpansionError,
    errorStatus: volExpansionStatus,
  } = useApiData<VolExpansionSignalResponse>(
    `/api/signals/advanced/vol-expansion?symbol=${encodeURIComponent(symbol)}&underlying=${encodeURIComponent(symbol)}`,
    { refreshInterval: 30000, enabled: hasProAccess },
  );
  const volExpansionAvailability = useMemo(
    () => resolveSignalAvailability({
      entitled: hasProAccess,
      tierResolving,
      // Explicit null check first: Number(null) is 0, which IS finite, so a
      // coercion-only test would read a backend `"expansion": null` as a real
      // reading and fall straight back to the bare "no signal" copy this
      // change exists to remove. Mirrors CharmVannaFlows' own guard.
      hasValue: volExpansion?.expansion != null && Number.isFinite(Number(volExpansion.expansion)),
      loading: volExpansionLoading,
      hasError: volExpansionError != null,
      errorStatus: volExpansionStatus,
      requiredTier: 'pro',
    }),
    [hasProAccess, tierResolving, volExpansion, volExpansionLoading, volExpansionError, volExpansionStatus],
  );

  // Expiration filter state for strike table
  const expirationOptions = useMemo(() => strikeExpirationOptions(gexByStrike), [gexByStrike]);

  // Shared, persisted expiration selection (empty = All) used by every
  // expiration-filtering chart in the tab. Both charts on this page follow it,
  // so they move together, and the pick carries over to the Gamma Terminal,
  // Flow Analysis, etc. — and back on the next reload. See useSharedExpirations.
  const { selection: sharedExpirations, setSelection: setSharedExpirations } = useSharedExpirations();

  // The strike TABLE mostly follows the shared selection, but keeps one
  // table-local affordance the shared "empty = All" model can't represent:
  // "Clear to an empty table" (none). We store only the shared value it was
  // cleared against — the derived `selectedExpirations` below turns that into
  // the table's tri-state — so the clear is released automatically the moment
  // the shared selection moves, with no state-syncing effect.
  const [clearedAgainst, setClearedAgainst] = useState<string[] | null>(null);
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
    () => deriveChartExpirationOptions(expirationOptions, todayKey),
    [expirationOptions, todayKey],
  );
  // The GEX Profile chart follows the shared selection directly (empty = All),
  // reconciled to the current/future expirations it can plot — which also drops
  // any now-past pick after the date rolls, so no separate pruning is needed.
  const chartSelectedExpirations = useMemo(
    () => reconcileExpirations(sharedExpirations, chartExpirationOptions, todayKey),
    [sharedExpirations, chartExpirationOptions, todayKey],
  );
  const zeroDte = useZeroDteOption(chartExpirationOptions, todayKey);

  // The table's tri-state selection (null = All, [] = none / empty table,
  // [dates] = subset), derived — not stored — so it tracks the shared selection
  // live (the chart above, another tab, a restored reload) with no effect. A
  // local "Clear" holds only while the shared value it was made against is
  // unchanged; once shared moves, `clearedAgainst` no longer matches (the store
  // hands back a stable reference until the value actually changes) and the
  // table follows shared again. Reconciled to the table's own expiration
  // universe, and memoised so the strike-table aggregation below keeps its
  // referential-stability fast path.
  const tableCleared = clearedAgainst !== null && clearedAgainst === sharedExpirations;
  const selectedExpirations = useMemo<string[] | null>(() => {
    if (tableCleared) return [];
    const reconciled = reconcileExpirations(sharedExpirations, expirationOptions, todayKey);
    return reconciled.length > 0 ? reconciled : null;
  }, [tableCleared, sharedExpirations, expirationOptions, todayKey]);

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
  const chartStrikeData = useMemo(
    () => deriveChartStrikeData(gexByStrike, chartSelectedExpirations, chartExpirationOptions),
    [gexByStrike, chartSelectedExpirations, chartExpirationOptions],
  );

  // Per-(strike, expiration) GEX for the Gamma Exposure by Strike chart's
  // stacked bars and its "% of total at this strike" readout. Raw dollars
  // (per 1% move) over the chart's current/future expiration universe, so the
  // stacked segments and the all-expiration total share one coherent set.
  // Deliberately NOT filtered by the selection — the chart needs the whole
  // breakdown to render each expiration segment and to compute each pick's
  // share of the strike total.
  const perExpirationStrikeData = useMemo(
    () => derivePerExpirationStrikeData(gexByStrike, chartExpirationOptions),
    [gexByStrike, chartExpirationOptions],
  );

  // 'all' (empty set) or a sorted, comma-joined list of the chosen
  // expirations — the canonical value the timeseries hook keys its cache on
  // and the backend sums the walls across.
  const chartExpirationsParam = expirationsParam(chartSelectedExpirations);

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
    // Hide strikes with no open interest when the shared "Active" filter is on,
    // so a fine-grid chain like NDX surfaces real levels instead of the many
    // listed-but-empty strikes; falls back to the full set when nothing has OI
    // yet (e.g. a degraded pre-market snapshot). See selectActive.
    const base = selectActive(strikeData, activeOnly, (r) => r.callOi + r.putOi > 0);
    const cloned = [...base];
    cloned.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      const comparison = av < bv ? -1 : av > bv ? 1 : 0;
      return sortDir === 'asc' ? comparison : -comparison;
    });
    return cloned;
  }, [strikeData, activeOnly, sortKey, sortDir]);

  // Raw-dollar strike rows for the GEX Profile chart.  The /api/gex/profile
  // endpoint returns the spot-shift curve in raw dollars per 1% move, so
  // matching the per-strike bars to the same unit is what keeps the two
  // y-axes commensurable (the profile axis is just an order-of-magnitude
  // expansion of the bar axis — see GexProfileChart).
  const profileStrikeData = useMemo(() => toProfileStrikeData(chartStrikeData), [chartStrikeData]);

  // Metric computations
  // Dealer-gamma readings are taken AT SPOT — the cumulative-curve value at
  // the current price, which is sign-consistent with the gamma flip — not
  // the chain-wide total (which can carry the opposite sign when far-OTM
  // strikes dominate the tail). When the at-spot value is unavailable the
  // regime sign degrades to the geometric spot-vs-flip read (never the chain
  // total), so the Net GEX trend can't contradict the Gamma Flip card.
  const netGexAtSpot = netGexAtSpotOrNull(gexData?.net_gex_at_spot);
  const netGexLong = longGammaAtSpot(netGexAtSpot, quoteData?.close ?? gexData?.spot_price ?? null, gexData?.gamma_flip ?? null);
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
          ? 'Spot is above the call wall, so upside continuation can squeeze quickly but failed breakouts can snap back hard.'
          : spot < putWall
            ? 'Spot is below the put wall, so downside can accelerate fast if support keeps failing.'
            : nearestWall === 'put'
              ? 'Spot is just above the put wall, where failed breakdowns often reverse sharply and trap late shorts.'
              : 'Spot is leaning toward the call wall, where breakouts can run if buyers keep pressure on.'
        : 'Wall placement is incomplete, so treat directional conviction as lower until structure is clearer.';

    const gexText =
      netGex == null
        ? 'Dealer gamma at spot is unclear, so expect less reliable pinning behavior.'
        : netGex > 2e9
          ? 'Dealers are deeply long gamma at spot, which usually suppresses volatility and favors fade/mean-reversion over aggressive trend chasing.'
          : netGex > 0
            ? 'Dealers are net long gamma at spot, so price is more likely to mean-revert than sustain runaway moves.'
            : netGex < -2e9
              ? 'Dealers are deeply short gamma at spot, which often amplifies volatility and can punish late entries on both sides.'
              : 'Dealers are net short gamma at spot, which supports trend extension and larger directional swings.';

    const flowText =
      vannaTrend === 'bullish' && charmLabel === 'Bullish'
        ? 'Vanna flow and charm decay are both adding a bullish tailwind as dealers rebalance delta across vol and time.'
        : vannaTrend === 'bearish' && charmLabel === 'Bearish'
          ? 'Vanna flow and charm decay are both adding bearish pressure, so downside moves can snowball faster.'
          : 'Vanna and charm are mixed, so directional follow-through is less trustworthy and fake-outs are more likely.';

    const riskText =
      ivRankPct == null
        ? 'Volatility regime is unclear; size risk conservatively.'
        : ivRankPct >= 70
          ? 'Vol is elevated, so prioritize defined-risk structures and avoid oversized directional bets.'
          : ivRankPct <= 30
            ? 'Vol is relatively calm, which favors cleaner structure-driven entries but still requires trap awareness near walls.'
            : 'Vol is in a middle regime; stay selective and demand confirmation before pressing size.';

    const crowdingText =
      pcr == null
        ? ''
        : pcr >= 1.2
          ? 'Positioning is put-heavy, so failed downside can trigger sharp reflex squeezes.'
          : pcr <= 0.8
            ? 'Positioning is call-heavy, so upside failures can unwind quickly.'
            : 'Positioning is fairly balanced, so wall behavior matters more than crowding extremes.';

    const actionText =
      netGex != null && netGex < 0
        ? 'Trading posture: bias toward momentum when structure confirms, but avoid chasing extended candles because reversals can be violent.'
        : 'Trading posture: favor disciplined entries near key levels, take profits faster on extensions, and be ready to fade obvious trap moves.';
    const horizonText = horizonLabel === 'intraday'
      ? 'Intraday lens: prioritize reaction at walls/flip and tighten risk quickly if tape fails to follow through.'
      : 'Swing lens: focus on whether price can hold outside walls for multiple sessions before committing full size.';

    return `${locationText} ${gexText} ${flowText} ${riskText} ${crowdingText} ${actionText} ${horizonText}`.trim();
  }, [quoteData?.close, gexData, netGexAtSpot, vannaTrend, charmLabel, ivRankPct, timeframe]);

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
        <h1 className="text-3xl font-bold mb-8">Dealer Positioning Analysis</h1>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <LoadingCard /><LoadingCard /><LoadingCard /><LoadingCard />
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <h1 className="text-3xl font-bold mb-6">Dealer Positioning Analysis</h1>
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
            trend={netGexLong == null ? 'neutral' : netGexLong ? 'bullish' : 'bearish'}
            tooltip="Cumulative dealer gamma at the current spot price — the value of the same low→high cumulative curve whose zero crossing is the gamma flip, so it is always sign-consistent with the flip. Positive = dealers net long gamma here (pinning, mean-reversion); negative = net short gamma here (trending, vol amplification). The regime flips at the gamma flip level above. (Not the chain-wide total, which can carry the opposite sign when far-OTM strikes dominate the tail.)"
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
            tooltip={`Implied volatility rank derived from ${volIndex} level. 0% = historically calm, 100% = extreme fear. Maps ${volIndex} to a 0-100 percentile scale.`}
          />
          <MetricCard
            title="Vanna Flow"
            value={vannaLabel}
            trend={vannaTrend}
            tooltip="Net vanna exposure across all strikes. Positive vanna = vol crush supports upside (tailwind). Negative vanna = vol crush pressures downside (headwind)."
          />
          <MetricCard
            title="Charm Decay"
            value={charmLabel}
            tooltip="Net charm (delta decay over time) across all strikes. Shows whether time decay is systematically adding or removing directional delta pressure."
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
            onSelectedExpirationsChange={setSharedExpirations}
            zeroDte={zeroDte}
            perExpirationData={perExpirationStrikeData}
            todayKey={todayKey}
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

      {/* GEX Heatmap · Strike × Time — SpotGamma-style candle-overlay surface,
          the price-context view (candles can be zoomed/expanded from its
          toolbar). Complements the Strike × DTE snapshot matrix below; reuses
          the same component as the standalone /gex-heatmap page. */}
      <section className="mb-8">
        <div className="grid grid-cols-1 gap-4">
          <GammaHeatmapCanvas />
        </div>
      </section>

      {/* Section 5: Strike×DTE Heatmap + Charm/Vanna Flows */}
      <section className="mb-8">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          <div className="lg:col-span-3 h-full">
            <GexStrikeDteHeatmap byStrikeData={gexByStrike} spotPrice={quoteData?.close} />
          </div>
          <div className="lg:col-span-2 h-full">
            <CharmVannaFlows
              byStrikeData={gexByStrike}
              volExpansion={volExpansion}
              volExpansionState={volExpansionAvailability}
              symbol={symbol}
            />
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
        <ExpandableCard expandTrigger="button" expandButtonLabel="Expand card">
          <div className="rounded-lg p-6" style={{ backgroundColor: cardBg, border: `1px solid ${borderColor}` }}>
            <SectionHead title="GEX Metrics Snapshot" tooltip="Filter expirations and inspect strike-level net GEX, vanna, charm, OI, and volume from /api/gex/by-strike. The Strikes toggle hides strikes with no open interest (Active) or shows every listed strike (All)." />
            {byStrikeError ? <ErrorMessage message={byStrikeError} /> : expirationOptions.length === 0 ? (
              <div className="text-center py-8" style={{ color: mutedText }}>No strike-level gamma data available</div>
            ) : (
              <>
                <div className="mb-5 flex flex-wrap gap-2 items-center">
                  <span className="text-sm" style={{ color: mutedText }}>Expirations:</span>
                  {(() => {
                    const allSelected =
                      selectedExpirations === null ||
                      (expirationOptions.length > 0 && selectedExpirations.length === expirationOptions.length);
                    return (
                      <button
                        // "All" is the shared empty selection — release any
                        // local clear and broadcast it so every chart resets too.
                        onClick={() => { setClearedAgainst(null); setSharedExpirations([]); }}
                        disabled={allSelected}
                        style={
                          allSelected
                            ? { backgroundColor: inputBg, borderColor: borderColor, color: mutedText, opacity: 0.5, cursor: 'not-allowed' }
                            : undefined
                        }
                        className={`px-3 py-1 text-xs rounded border ${allSelected ? '' : 'bg-[var(--color-info-soft)] border-[var(--color-info)] text-[var(--text-primary)]'}`}
                      >
                        All
                      </button>
                    );
                  })()}
                  {(() => {
                    const isEmpty = Array.isArray(selectedExpirations) && selectedExpirations.length === 0;
                    const canClear = !isEmpty;
                    return (
                      <button
                        type="button"
                        // Table-local "none" (empty table): not shared. Marked
                        // against the current shared value so it releases as soon
                        // as the shared selection changes.
                        onClick={() => setClearedAgainst(sharedExpirations)}
                        disabled={!canClear}
                        style={{
                          backgroundColor: inputBg,
                          borderColor: borderColor,
                          color: mutedText,
                          opacity: canClear ? 1 : 0.5,
                          cursor: canClear ? 'pointer' : 'not-allowed',
                        }}
                        className="px-3 py-1 text-xs rounded border"
                        title="Clear all expiration selections"
                      >
                        Clear
                      </button>
                    );
                  })()}
                  {expirationOptions.map((exp) => {
                    const active = selectedExpirations === null || selectedExpirations.includes(exp);
                    return (
                      <button
                        key={exp}
                        onClick={() => {
                          // Toggle from the current view (null = All → every
                          // other expiration once one is switched off).
                          const base = selectedExpirations === null ? expirationOptions : selectedExpirations;
                          const next = base.includes(exp)
                            ? base.filter((v) => v !== exp)
                            : [...base, exp];
                          if (next.length > 0) {
                            // A real subset — release any local clear and share
                            // it so every chart tracks the change.
                            setClearedAgainst(null);
                            setSharedExpirations(next);
                          } else {
                            // Switched the last one off → table-local "none".
                            setClearedAgainst(sharedExpirations);
                          }
                        }}
                        style={active ? undefined : { backgroundColor: inputBg, borderColor: borderColor, color: mutedText }}
                        className={`px-3 py-1 text-xs rounded border ${active ? 'bg-[var(--color-info-soft)] border-[var(--color-info)] text-[var(--text-primary)]' : ''}`}
                      >
                        {exp}
                      </button>
                    );
                  })}
                  <div className="flex items-center gap-1.5 ml-auto">
                    <span className="text-sm" style={{ color: mutedText }}>Strikes:</span>
                    <StrikeFilterToggle showHint={false} />
                  </div>
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
                            No expirations selected. Click an expiration or &ldquo;All&rdquo; to display data.
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

      {/* Every number on this page is signed by the positioning convention, so
          the disclosure closes the page rather than living only in tooltips. */}
      <ModeledPositioningNote />
    </PageShell>
  );
}
