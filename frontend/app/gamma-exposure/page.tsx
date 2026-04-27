'use client';

import { useMemo, useState } from 'react';
import { Info } from 'lucide-react';
import {
  useGEXSummary,
  useGEXByStrike,
  useMarketQuote,
  useVolatilityGauge,
  useApiData,
} from '@/hooks/useApiData';
import type { VolExpansionSignalResponse } from '@/hooks/useApiData';
import MetricCard from '@/components/MetricCard';
import { LoadingCard } from '@/components/LoadingSpinner';
import ErrorMessage from '@/components/ErrorMessage';
import GammaHeatmap from '@/components/GammaHeatmap';
import GexRegimeHeader from '@/components/GexRegimeHeader';
import GexStrikeChart from '@/components/GexStrikeChart';
import GexStrikeDteHeatmap from '@/components/GexStrikeDteHeatmap';
import GexWallsChart from '@/components/GexWallsChart';
import CharmVannaFlows from '@/components/CharmVannaFlows';
import VolSurfaceChart from '@/components/VolSurfaceChart';
import TooltipWrapper from '@/components/TooltipWrapper';
import ExpandableCard from '@/components/ExpandableCard';
import { useTimeframe } from '@/core/TimeframeContext';
import { useTheme } from '@/core/ThemeContext';
import { colors } from '@/core/colors';

function SectionTitle({ title, tooltip }: { title: string; tooltip: string }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <h2 className="text-2xl font-semibold">{title}</h2>
      <TooltipWrapper text={tooltip}><Info size={14} /></TooltipWrapper>
    </div>
  );
}

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

export default function GammaExposurePage() {
  const { symbol, timeframe, setTimeframe } = useTimeframe();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const textColor = isDark ? colors.light : colors.dark;
  const cardBg = isDark ? 'var(--color-surface)' : 'var(--color-surface)';
  const inputBg = isDark ? 'var(--color-bg)' : 'var(--color-surface-subtle)';
  const mutedText = isDark ? 'var(--color-text-secondary)' : 'var(--color-text-secondary)';
  const borderColor = 'var(--color-border)';

  // Data fetching — all at page level, passed as props to children
  const { data: gexData, loading: gexLoading, error: gexError, refetch: refetchGex } = useGEXSummary(symbol, 5000);
  const { data: quoteData } = useMarketQuote(symbol, 1000);
  const { data: gexByStrike, error: byStrikeError } = useGEXByStrike(symbol, 200, 10000, 'impact');
  const { data: openInterestData } = useApiData<OpenInterestApiResponse | Record<string, unknown>[] | null>(
    `/api/market/open-interest?symbol=${symbol}`,
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
  const { data: volGauge } = useVolatilityGauge(30000);
  const { data: volExpansion } = useApiData<VolExpansionSignalResponse>(
    `/api/signals/advanced/vol-expansion?symbol=${symbol}`,
    { refreshInterval: 30000 },
  );

  // Expiration filter state for strike table
  const expirationOptions = useMemo(() => {
    const unique = new Set((gexByStrike || []).map((row) => String(row.expiration)));
    return Array.from(unique).sort((a, b) => a.localeCompare(b));
  }, [gexByStrike]);

  const [selectedExpirations, setSelectedExpirations] = useState<string[] | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('strike');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  // Aggregate by-strike data for the chart and table
  const strikeData = useMemo(() => {
    const selected = selectedExpirations && selectedExpirations.length > 0 ? selectedExpirations : expirationOptions;
    const activeExpirations = new Set(selected);
    const filteredSource = (gexByStrike || []).filter((row) => activeExpirations.has(String(row.expiration)));

    const grouped = new Map<string, StrikeAggregate>();
    filteredSource.forEach((row) => {
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
  }, [gexByStrike, selectedExpirations, expirationOptions]);

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

  // Prepare chart data — keep the per-strike call / put / net split so the
  // strike chart can render Net/Call/Put columns alongside the bar.
  const chartStrikeData = useMemo(
    () =>
      strikeData.map((row) => ({
        strike: row.strike,
        netGexB: row.netGexM / 1000,
        callGexB: row.callGexM / 1000,
        putGexB: row.putGexM / 1000,
      })),
    [strikeData],
  );

  // Metric computations
  const netGexPositive = (gexData?.net_gex ?? 0) >= 0;
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
    const netGex = gexData?.net_gex ?? null;
    if (netGex != null && netGex < 0 && (vannaTrend === 'bearish' || vannaTrend === 'bullish') && ivRankPct != null && ivRankPct >= 60) {
      return 'Aggressive';
    }
    if (netGex != null && netGex > 0 && ivRankPct != null && ivRankPct <= 40) {
      return 'Defensive';
    }
    return 'Balanced';
  }, [gexData?.net_gex, vannaTrend, ivRankPct]);

  const marketContextSummary = useMemo(() => {
    const horizonLabel = timeframe === '1day' || timeframe === '1hr' ? 'swing' : 'intraday';
    const spot = quoteData?.close;
    const callWall = gexData?.call_wall ?? null;
    const putWall = gexData?.put_wall ?? null;
    const netGex = gexData?.net_gex ?? null;
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
        ? 'Net GEX is unclear, so expect less reliable pinning behavior.'
        : netGex > 2e9
          ? 'Net GEX is highly positive, which usually suppresses volatility and favors fade/mean-reversion setups over aggressive trend chasing.'
          : netGex > 0
            ? 'Net GEX is positive, so price is more likely to mean-revert than sustain runaway moves.'
            : netGex < -2e9
              ? 'Net GEX is deeply negative, which often amplifies volatility and can punish late entries on both sides.'
              : 'Net GEX is negative, which supports trend extension and larger directional swings.';

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
  }, [quoteData?.close, gexData, vannaTrend, charmLabel, ivRankPct, timeframe]);

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((dir) => (dir === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortKey(key);
    setSortDir('desc');
  };

  if (gexLoading && !gexData) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">Dealer Exposure Analysis</h1>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <LoadingCard /><LoadingCard /><LoadingCard /><LoadingCard />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Dealer Exposure Analysis</h1>
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
            value={gexData?.net_gex != null ? formatGexValue(gexData.net_gex) : '--'}
            trend={netGexPositive ? 'bullish' : 'bearish'}
            tooltip="Net gamma exposure across all strikes. Positive = dealer long gamma (pinning, mean-reversion). Negative = dealer short gamma (trending, vol amplification)."
          />
          <MetricCard
            title="IV Rank"
            value={ivRankPct != null ? `${ivRankPct}%` : '--'}
            subtitle={volGauge?.level_label}
            tooltip="Implied volatility rank derived from VIX level. 0% = historically calm, 100% = extreme fear. Maps VIX to a 0-100 percentile scale."
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

      {/* Section 3: GEX by Strike */}
      <section className="mb-8">
        <div className="grid grid-cols-1 gap-4">
          <GexStrikeChart
            strikeData={chartStrikeData}
            gammaFlip={gexData?.gamma_flip}
            spotPrice={quoteData?.close}
          />
        </div>
      </section>

      {/* Section 4: Call/Put Wall Map */}
      <section className="mb-8">
        <div className="grid grid-cols-1 gap-4">
          <GexWallsChart openInterestData={normalizedOpenInterest} spotPrice={openInterestSpotPrice} byStrikeFallback={gexByStrike || []} />
        </div>
      </section>

      {/* Section 5: Strike×DTE Heatmap + Charm/Vanna Flows */}
      <section className="mb-8">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          <div className="lg:col-span-3 h-full">
            <GexStrikeDteHeatmap byStrikeData={gexByStrike} />
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
        <ExpandableCard expandTrigger="button" expandButtonLabel="Expand card">
          <div className="rounded-lg p-6" style={{ backgroundColor: cardBg, border: `1px solid ${borderColor}` }}>
            <SectionTitle title="GEX Metrics Snapshot" tooltip="Filter expirations and inspect strike-level net GEX, vanna, charm, OI, and volume from /api/gex/by-strike." />
            {byStrikeError ? <ErrorMessage message={byStrikeError} /> : strikeData.length === 0 ? (
              <div className="text-center py-8" style={{ color: mutedText }}>No strike-level gamma data available</div>
            ) : (
              <>
                <div className="mb-5 flex flex-wrap gap-2 items-center">
                  <span className="text-sm" style={{ color: mutedText }}>Expirations:</span>
                  <button onClick={() => setSelectedExpirations(null)} className="px-2 py-1 text-xs rounded" style={{ backgroundColor: inputBg, color: textColor }}>All</button>
                  {expirationOptions.map((exp) => {
                    const active = selectedExpirations === null || selectedExpirations.includes(exp);
                    return (
                      <button
                        key={exp}
                        onClick={() => setSelectedExpirations((current) => {
                          const base = current === null ? [...expirationOptions] : [...current];
                          const updated = active ? base.filter((v) => v !== exp) : [...base, exp];
                          return updated.length === 0 ? null : updated;
                        })}
                        style={active ? undefined : { backgroundColor: inputBg, borderColor: borderColor, color: mutedText }}
                        className={`px-3 py-1 text-xs rounded border ${active ? 'bg-[var(--color-info-soft)] border-[var(--color-info)] text-[var(--text-primary)]' : ''}`}
                      >
                        {exp}
                      </button>
                    );
                  })}
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b" style={{ borderColor: borderColor, color: mutedText }}>
                        <th className="text-right py-2 px-2 cursor-pointer" onClick={() => toggleSort('strike')}>Strike</th>
                        <th className="text-right py-2 px-2 cursor-pointer" onClick={() => toggleSort('distanceFromSpot')}>Dist.</th>
                        <th className="text-right py-2 px-2 cursor-pointer" onClick={() => toggleSort('netGexM')}>Net GEX</th>
                        <th className="text-right py-2 px-2 cursor-pointer" onClick={() => toggleSort('vannaM')}>Vanna</th>
                        <th className="text-right py-2 px-2 cursor-pointer" onClick={() => toggleSort('charmM')}>Charm</th>
                        <th className="text-right py-2 px-2 cursor-pointer" onClick={() => toggleSort('callOi')}>Call OI</th>
                        <th className="text-right py-2 px-2 cursor-pointer" onClick={() => toggleSort('putOi')}>Put OI</th>
                        <th className="text-right py-2 px-2 cursor-pointer" onClick={() => toggleSort('callVolume')}>Call Vol</th>
                        <th className="text-right py-2 px-2 cursor-pointer" onClick={() => toggleSort('putVolume')}>Put Vol</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedRows.map((row) => (
                        <tr key={row.strike} className="border-b" style={{ borderColor: borderColor }}>
                          <td className="text-right py-2 px-2 font-mono">${row.strike.toFixed(2)}</td>
                          <td className="text-right py-2 px-2">{row.distanceFromSpot.toFixed(2)}</td>
                          <td className={`text-right py-2 px-2 font-semibold ${row.netGexM >= 0 ? 'text-[var(--color-bull)]' : 'text-[var(--color-bear)]'}`}>${row.netGexM.toFixed(2)}M</td>
                          <td className={`text-right py-2 px-2 font-semibold ${row.vannaM >= 0 ? 'text-[var(--color-bull)]' : 'text-[var(--color-bear)]'}`}>${row.vannaM.toFixed(2)}M</td>
                          <td className={`text-right py-2 px-2 font-semibold ${row.charmM >= 0 ? 'text-[var(--color-bull)]' : 'text-[var(--color-bear)]'}`}>${row.charmM.toFixed(2)}M</td>
                          <td className="text-right py-2 px-2">{row.callOi.toLocaleString()}</td>
                          <td className="text-right py-2 px-2">{row.putOi.toLocaleString()}</td>
                          <td className="text-right py-2 px-2">{row.callVolume.toLocaleString()}</td>
                          <td className="text-right py-2 px-2">{row.putVolume.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </ExpandableCard>
      </section>

      {/* Section 8: Existing Time-Series Heatmap */}
      <section className="mb-8">
        <GammaHeatmap />
      </section>
    </div>
  );
}
