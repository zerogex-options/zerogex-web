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
import CharmVannaFlows from '@/components/CharmVannaFlows';
import VolSurfaceChart from '@/components/VolSurfaceChart';
import TooltipWrapper from '@/components/TooltipWrapper';
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
  callOi: number;
  putOi: number;
  callVolume: number;
  putVolume: number;
  vannaM: number;
  charmM: number;
};

type SortKey = keyof StrikeAggregate;

export default function GammaExposurePage() {
  const { symbol } = useTimeframe();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const textColor = isDark ? colors.light : colors.dark;
  const cardBg = isDark ? '#423d3f' : '#ffffff';
  const inputBg = isDark ? '#2a2628' : '#f3f4f6';
  const mutedText = isDark ? '#9ca3af' : '#6b7280';
  const borderColor = isDark ? 'rgba(150,143,146,0.3)' : 'rgba(0,0,0,0.1)';

  // Data fetching — all at page level, passed as props to children
  const { data: gexData, loading: gexLoading, error: gexError, refetch: refetchGex } = useGEXSummary(symbol, 5000);
  const { data: quoteData } = useMarketQuote(symbol, 1000);
  const { data: gexByStrike, error: byStrikeError } = useGEXByStrike(symbol, 200, 10000, 'impact');
  const { data: volGauge } = useVolatilityGauge(30000);
  const { data: volExpansion } = useApiData<VolExpansionSignalResponse>(
    `/api/signals/vol-expansion?symbol=${symbol}`,
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

  // Prepare chart data (in $B for the strike chart)
  const chartStrikeData = useMemo(
    () => strikeData.map((row) => ({ strike: row.strike, netGexB: row.netGexM / 1000 })),
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

  const formatLargeM = (value: number) => {
    const abs = Math.abs(value);
    if (abs >= 1000) return `${value.toFixed(0)}M`;
    if (abs >= 1) return `${value.toFixed(1)}M`;
    return `${(value * 1000).toFixed(0)}K`;
  };

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
        <h1 className="text-3xl font-bold mb-8">Gamma Exposure Analysis</h1>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <LoadingCard /><LoadingCard /><LoadingCard /><LoadingCard />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Gamma Exposure Analysis</h1>
      {gexError && <ErrorMessage message={gexError} onRetry={refetchGex} />}

      {/* Section 1: Regime Header */}
      <GexRegimeHeader gexSummary={gexData} quoteData={quoteData} symbol={symbol} />

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

      {/* Section 3: GEX by Strike + Strike×DTE Heatmap */}
      <section className="mb-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <GexStrikeChart
            strikeData={chartStrikeData}
            gammaFlip={gexData?.gamma_flip}
            spotPrice={quoteData?.close}
          />
          <GexStrikeDteHeatmap byStrikeData={gexByStrike} />
        </div>
      </section>

      {/* Section 4: Charm/Vanna Flows + Vol Surface */}
      <section className="mb-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <CharmVannaFlows byStrikeData={gexByStrike} volExpansion={volExpansion} />
          <VolSurfaceChart symbol={symbol} />
        </div>
      </section>

      {/* Section 5: Strike Data Table */}
      <section className="mb-8 rounded-lg p-6" style={{ backgroundColor: cardBg }}>
        <SectionTitle title="Gamma Exposure by Strike" tooltip="Filter expirations and inspect strike-level net GEX, vanna, charm, OI, and volume from /api/gex/by-strike." />
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
                    className={`px-3 py-1 text-xs rounded border ${active ? 'bg-cyan-900 border-cyan-400 text-cyan-100' : ''}`}
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
                      <td className={`text-right py-2 px-2 font-semibold ${row.netGexM >= 0 ? 'text-green-400' : 'text-red-400'}`}>${row.netGexM.toFixed(2)}M</td>
                      <td className="text-right py-2 px-2">${row.vannaM.toFixed(2)}M</td>
                      <td className="text-right py-2 px-2">${row.charmM.toFixed(2)}M</td>
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
      </section>

      {/* Section 6: Existing Time-Series Heatmap */}
      <section className="mb-8">
        <GammaHeatmap />
      </section>
    </div>
  );
}
