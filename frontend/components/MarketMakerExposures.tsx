'use client';

import { useMemo } from 'react';
import {
  useApiData,
  useGEXByStrike,
  useGEXSummary,
  useMarketQuote,
} from '@/hooks/useApiData';
import { useTimeframe } from '@/core/TimeframeContext';
import { useTheme } from '@/core/ThemeContext';
import { colors } from '@/core/colors';
import LivePriceWidget from './LivePriceWidget';
import UnderlyingCandlesChart from './UnderlyingCandlesChart';
import GexStrikeChart from './GexStrikeChart';
import GexWallsChart from './GexWallsChart';
import ErrorMessage from './ErrorMessage';

type OpenInterestApiResponse = {
  spot_price?: number | string;
  contracts?: Record<string, unknown>[];
  rows?: Record<string, unknown>[];
  data?: Record<string, unknown>[];
  items?: Record<string, unknown>[];
  results?: Record<string, unknown>[];
};

export default function MarketMakerExposures() {
  const { theme } = useTheme();
  const { symbol } = useTimeframe();

  const { data: gexData, error: gexError, refetch: refetchGex } = useGEXSummary(symbol, 5000);
  const { data: quoteData } = useMarketQuote(symbol, 1000);
  const { data: gexByStrike, error: byStrikeError } = useGEXByStrike(symbol, 200, 10000, 'impact');
  const { data: openInterestData } = useApiData<OpenInterestApiResponse | Record<string, unknown>[] | null>(
    `/api/market/open-interest?symbol=${encodeURIComponent(symbol)}&underlying=${encodeURIComponent(symbol)}`,
    { refreshInterval: 30000 },
  );

  const openInterestPayload = useMemo<OpenInterestApiResponse | null>(() => {
    if (!openInterestData) return null;
    if (Array.isArray(openInterestData)) return { contracts: openInterestData };
    if (typeof openInterestData === 'object') return openInterestData as OpenInterestApiResponse;
    return null;
  }, [openInterestData]);

  const normalizedOpenInterest = useMemo(() => {
    if (!openInterestPayload) return [];
    const payload = openInterestPayload as Record<string, unknown>;
    if (Array.isArray(payload.contracts)) return payload.contracts as Record<string, unknown>[];
    if (Array.isArray(payload.rows)) return payload.rows as Record<string, unknown>[];
    if (Array.isArray(payload.data)) return payload.data as Record<string, unknown>[];
    if (Array.isArray(payload.items)) return payload.items as Record<string, unknown>[];
    if (Array.isArray(payload.results)) return payload.results as Record<string, unknown>[];
    return [];
  }, [openInterestPayload]);

  const openInterestSpotPrice = useMemo(() => {
    if (!openInterestPayload) return null;
    const value = Number(openInterestPayload.spot_price);
    return Number.isFinite(value) ? value : null;
  }, [openInterestPayload]);

  const chartStrikeData = useMemo(() => {
    const grouped = new Map<number, { strike: number; netGexB: number; callGexB: number; putGexB: number }>();
    (gexByStrike || []).forEach((row) => {
      const strike = Number(row.strike);
      if (!Number.isFinite(strike)) return;
      const current = grouped.get(strike) ?? { strike, netGexB: 0, callGexB: 0, putGexB: 0 };
      current.netGexB += Number(row.net_gex || 0) / 1e9;
      current.callGexB += Number(row.call_gex || 0) / 1e9;
      current.putGexB += Number(row.put_gex || 0) / 1e9;
      grouped.set(strike, current);
    });
    return Array.from(grouped.values()).sort((a, b) => a.strike - b.strike);
  }, [gexByStrike]);

  const livePrice = useMemo(() => {
    if (!quoteData) return null;
    const close = Number(quoteData.close);
    const open = Number(quoteData.open);
    const change = Number.isFinite(close) && Number.isFinite(open) ? close - open : 0;
    const changePercent = Number.isFinite(open) && open !== 0 ? (change / open) * 100 : 0;
    const volumeNum = Number(quoteData.volume ?? 0);
    const volume = volumeNum >= 1_000_000
      ? `${(volumeNum / 1_000_000).toFixed(1)}M`
      : volumeNum >= 1_000
        ? `${(volumeNum / 1_000).toFixed(0)}K`
        : `${volumeNum}`;
    return {
      symbol: quoteData.symbol || symbol,
      price: Number.isFinite(close) ? close : 0,
      change,
      changePercent,
      volume,
    };
  }, [quoteData, symbol]);

  const lastUpdate = quoteData?.timestamp || gexData?.timestamp;
  const isDark = theme === 'dark';

  return (
    <div className="space-y-6">
      <header
        className="rounded-2xl px-6 py-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4"
        style={{
          backgroundColor: isDark ? colors.cardDark : colors.cardLight,
          border: `1px solid ${colors.muted}`,
          color: isDark ? colors.light : colors.dark,
        }}
      >
        <div>
          <h1 className="text-3xl font-bold leading-tight">Market Maker Exposures</h1>
          <p className="text-sm" style={{ color: colors.muted }}>
            Live underlying candles, dealer GEX by strike, and open-interest positioning — refreshed automatically.
          </p>
        </div>
        <div className="flex flex-col items-start md:items-end gap-1">
          {livePrice ? (
            <LivePriceWidget data={livePrice} theme={theme} />
          ) : (
            <span className="text-sm" style={{ color: colors.muted }}>Waiting for live quote…</span>
          )}
          {lastUpdate && (
            <span className="text-xs" style={{ color: colors.muted }}>
              Last update: {new Date(lastUpdate).toLocaleTimeString()}
            </span>
          )}
        </div>
      </header>

      {gexError && <ErrorMessage message={gexError} onRetry={refetchGex} />}
      {byStrikeError && <ErrorMessage message={byStrikeError} />}

      <section>
        <UnderlyingCandlesChart />
      </section>

      <section>
        <GexStrikeChart
          strikeData={chartStrikeData}
          gammaFlip={gexData?.gamma_flip}
          spotPrice={quoteData?.close}
        />
      </section>

      <section>
        <GexWallsChart
          openInterestData={normalizedOpenInterest}
          spotPrice={openInterestSpotPrice ?? quoteData?.close ?? null}
          byStrikeFallback={gexByStrike || []}
        />
      </section>
    </div>
  );
}
