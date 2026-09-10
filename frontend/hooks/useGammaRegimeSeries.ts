'use client';

import { useMemo } from 'react';

import { useApiData } from '@/hooks/useApiData';
import { canonicalTimestamp } from '@/core/flowSeriesCharts';

/**
 * One 5-minute bar of the intraday Gamma Shift read, from
 * GET /api/gex/regime-series.
 *
 * Two independent lenses, deliberately mirroring the Hedging Flow panel's two
 * views. `anchored_*` compares against the session's first bar ("how has
 * structure changed today" — pairs with the cumulative curve). `rolling_*`
 * compares against `rolling_bars` bars back ("how is it changing right now" —
 * pairs with the rate line, and is the one to read beside a flip).
 *
 * They do NOT sum. Both are proximity-weighted around each bar's own spot, so
 * the kernel re-centres every bar; treating the anchored lens as a running
 * total of the rolling one would produce a number matching neither.
 *
 * Positive `stability` = more long gamma near spot, so dealers hedge against
 * moves: pinning, vol suppression. Negative = the book has turned accelerant.
 * Positive `lean` = the change is supportive (building below spot / eroding
 * above). Negative = capping.
 *
 * Scores are RAW dollar-GEX. `rolling_*` is null for the session's first
 * `rolling_bars` bars, where no lookback exists.
 */
export interface GammaRegimeBar {
  timestamp: string;
  bar_start: string;
  bar_end: string;
  spot: number | null;
  anchored_lean: number;
  anchored_stability: number;
  anchored_net_shift: number;
  anchored_gross_shift: number;
  rolling_lean: number | null;
  rolling_stability: number | null;
  rolling_net_shift: number | null;
  rolling_gross_shift: number | null;
  sigma_price: number | null;
  near_spot_stock: number | null;
  strike_count: number;
  /** Expiries that left the board since the comparison point — reported, never a shed. */
  expired_expirations: string[];
  rolling_bars: number | null;
}

export interface GammaRegimeSeriesPayload {
  symbol: string;
  session: string;
  rolling_bars: number | null;
  bars: GammaRegimeBar[];
}

const DEFAULT_REFRESH_MS = 30_000;

/**
 * The intraday structure series for a symbol's current session.
 *
 * Polls at half the Hedging Flow cadence: this is written once per Analytics
 * Engine cycle rather than accumulated per trade, so a faster poll would only
 * re-fetch identical rows.
 *
 * Bars come back OLDEST-FIRST (the wire order is newest-first, matching the
 * other series endpoints) with canonicalised timestamps, so rows key
 * identically to the Hedging Flow series and the two charts can share an axis.
 *
 * An empty `bars` array on a live session means the engine has not written
 * this session yet — not that the data is unavailable. Callers should say so
 * rather than rendering an error.
 */
export function useGammaRegimeSeries(symbol: string, refreshMs: number = DEFAULT_REFRESH_MS) {
  const { data, loading, error, errorStatus, refetch } = useApiData<GammaRegimeSeriesPayload>(
    `/api/gex/regime-series?symbol=${encodeURIComponent(symbol)}`,
    { refreshInterval: refreshMs },
  );

  const payload = useMemo(() => {
    if (!data) return null;
    return {
      ...data,
      bars: [...(data.bars ?? [])]
        .map((bar) => ({ ...bar, timestamp: canonicalTimestamp(bar.timestamp) }))
        .reverse(),
    } satisfies GammaRegimeSeriesPayload;
  }, [data]);

  return { data: payload, loading, error, errorStatus, refetch };
}

/** The most recent bar carrying a rolling reading, or null. */
export function latestRegimeBar(
  payload: GammaRegimeSeriesPayload | null,
): GammaRegimeBar | null {
  if (!payload || payload.bars.length === 0) return null;
  for (let i = payload.bars.length - 1; i >= 0; i--) {
    if (payload.bars[i].rolling_stability != null) return payload.bars[i];
  }
  return payload.bars[payload.bars.length - 1];
}

/**
 * The four-quadrant read, in the vocabulary regime_shift.classify uses.
 *
 * Kept here rather than server-side because it is a *label for a pair of
 * numbers already in the payload*, not a new computation — and the endpoint
 * deliberately returns raw scores so the z-scoring question stays where the
 * trailing session distribution lives.
 */
export function regimeLabel(
  stability: number | null | undefined,
  lean: number | null | undefined,
): { title: string; meaning: string } | null {
  if (stability == null || lean == null) return null;
  if (stability >= 0 && lean >= 0) {
    return {
      title: 'Firming',
      meaning: 'Structure is stabilizing and supportive — dips are being absorbed.',
    };
  }
  if (stability >= 0 && lean < 0) {
    return {
      title: 'Capping',
      meaning: 'Structure is stabilizing but building above — rallies are being sold into.',
    };
  }
  if (stability < 0 && lean >= 0) {
    return {
      title: 'Fragile bid',
      meaning: 'Supportive lean but thinning gamma — a bid that can gap if it breaks.',
    };
  }
  return {
    title: 'Deteriorating',
    meaning: 'Gamma thinning and leaning heavy — moves are more likely to accelerate.',
  };
}
