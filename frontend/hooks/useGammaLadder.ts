"use client";

/**
 * useGammaLadderColumn — the live data behind ONE Net-GEX gamma ladder column.
 *
 * A ladder column is the per-strike Net GEX around spot plus the dealer-gamma
 * levels drawn on it (Gamma Flip, Call/Put Walls, Max Pain) and the header's
 * spot + day-change readout. Extracted from the Pair Comparison page so the
 * page's two columns and the "Gamma Ladder" dashboard widget (a single column)
 * read the exact same feeds at the exact same cadence — the ladder can't drift
 * between the two surfaces.
 *
 * Replay is deliberately NOT here: only Pair Comparison replays a session, and
 * it builds its columns from the buffered frames (see usePairReplay) instead.
 */

import { useMemo } from "react";
import type { HeatmapCell, HeatmapColumnInput } from "@/components/PairGammaHeatmap";
import { useApiData, useGEXSummary, useMarketQuote, useSessionCloses } from "./useApiData";
import { getPrimaryPriceChangeSummary } from "@/core/priceChange";

/** Everything a ladder column renders except the header control, which the
 *  surface injects (a symbol dropdown on Pair Comparison, a plain label in a
 *  dashboard tile) so the ladder itself stays presentational. */
export type GammaLadderColumnData = Omit<HeatmapColumnInput, "control">;

// ── Live-poll cadences ───────────────────────────────────────────────────────
// A ladder column is expensive: it polls the GEX heatmap and the GEX summary,
// so each mounted column adds directly to this site's per-viewer request rate
// (Pair Comparison runs two of them; a board can carry more). The website's BFF
// proxies straight to the API (ZEROGEX_API_BASE_URL, default 127.0.0.1:8000),
// bypassing the nginx response cache / request coalescing that fronts direct API
// traffic — so every poll from every viewer lands on a uvicorn worker. That is
// why the site-wide overload surfaced on Pair Comparison first, on the gamma
// heatmap.
//
// The heatmap and summary go through useApiData as independent per-URL fetch
// loops (and columns are usually different symbols), so their cadence directly
// sets how many requests a column emits. The heatmap only changes on the
// analytics cycle (~60s) and is cached ~5s server-side (ANALYTICS_CACHE_TTL_
// SECONDS), so polling it every second just re-fetched byte-identical data;
// aligning the poll with that cache cuts the heaviest request type ~5× per
// column with no visible change to the surface. The summary (flip / walls /
// max-pain, also 60s-cycle) is kept a touch faster so its spot_price — the
// ladder marker, and on Pair Comparison the candles' horizontal spot line —
// stays live-ish.
//
// Quotes are deliberately NOT rate-limited here: useMarketQuote already shares
// one deduplicated subscription per symbol (min interval across subscribers) and
// drops to a heartbeat once the WebSocket is serving that symbol, so the live
// header change badge keeps its 1 Hz feel without adding per-column HTTP load.
//
// NOTE: useApiData halves the nominal interval (REFRESH_ACCELERATION_FACTOR) with
// a 1s floor, so 10_000 → ~5s and 5_000 → ~2.5s effective.
const HEATMAP_REFRESH_MS = 10_000; // ~5s effective — matches the server GEX cache
const SUMMARY_REFRESH_MS = 5_000; // ~2.5s effective — keeps the spot marker live-ish

interface HeatmapBucket {
  timestamp: string;
  heatmap?: HeatmapCell[];
}

/** Freshest non-empty per-strike column (an empty after-hours tip mustn't blank it). */
function latestHeatmap(buckets: HeatmapBucket[] | null | undefined): HeatmapCell[] {
  if (!Array.isArray(buckets)) return [];
  for (let i = buckets.length - 1; i >= 0; i -= 1) {
    const h = buckets[i]?.heatmap;
    if (Array.isArray(h) && h.length > 0) return h;
  }
  return [];
}

function heatmapUrl(symbol: string): string {
  const s = encodeURIComponent(symbol);
  return `/api/gex/heatmap?symbol=${s}&underlying=${s}&timeframe=5min&window_units=6`;
}

/**
 * Poll one symbol's live ladder column. `enabled` gates every feed, so a
 * surface that has switched away from live (Pair Comparison in Replay) stops
 * emitting requests entirely rather than polling behind the scrubber.
 */
export function useGammaLadderColumn(symbol: string, enabled = true): GammaLadderColumnData {
  const { data: summary } = useGEXSummary(symbol, SUMMARY_REFRESH_MS, enabled);
  const { data: hm, loading, error } = useApiData<HeatmapBucket[]>(heatmapUrl(symbol), {
    refreshInterval: HEATMAP_REFRESH_MS,
    enabled,
  });
  const { data: quote } = useMarketQuote(symbol, 1000, enabled);
  const { data: closes } = useSessionCloses(symbol, 60000, quote?.session ?? null, enabled);

  return useMemo(() => {
    const change = getPrimaryPriceChangeSummary({
      quoteClose: quote?.close ?? null,
      quoteSession: quote?.session ?? null,
      sessionCloses: closes ?? null,
      displaySource: quote?.display_source ?? null,
      futuresClose: quote?.futures_close ?? null,
      futuresReferenceClose: quote?.futures_reference_close ?? null,
    });
    return {
      symbol,
      cells: latestHeatmap(hm),
      spot: summary?.spot_price ?? null,
      gammaFlip: summary?.gamma_flip ?? null,
      callWall: summary?.call_wall ?? null,
      putWall: summary?.put_wall ?? null,
      maxPain: summary?.max_pain ?? null,
      changePercent: change.changePercent,
      isPositive: change.isPositive,
      loading,
      error,
    };
  }, [symbol, hm, summary, quote, closes, loading, error]);
}
