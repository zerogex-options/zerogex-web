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
 * The per-strike cells come from /api/gex/strike-profile-timeseries — the same
 * summed dollar-GEX surface the Strike Profile chart and Gamma Shift read — so
 * the ladder can be scoped to an expiration selection (`expirations`), and its
 * values agree with the by-strike surfaces elsewhere on the site. With a
 * specific expiration set the endpoint recomputes the bucket's walls and flip
 * for that set alone, so the ladder's level markers follow the filter; Max
 * Pain has no per-set equivalent, so it reads NA while filtered.
 *
 * Replay is deliberately NOT here: only Pair Comparison replays a session, and
 * it builds its columns from the buffered frames (see usePairReplay) instead.
 */

import { useMemo } from "react";
import type { HeatmapCell, HeatmapColumnInput, SessionBaselineInput } from "@/components/PairGammaHeatmap";
import { useApiData, useGEXSummary, useMarketQuote, useSessionCloses } from "./useApiData";
import { getSpotPriorCloseChange } from "@/core/priceChange";
import { baselineNetByStrike, sessionOpenIsoFor, type FrameStrikeRow } from "@/core/sessionDelta";

/** Everything a ladder column renders except the header control, which the
 *  surface injects (a symbol dropdown on Pair Comparison, a plain label in a
 *  dashboard tile) so the ladder itself stays presentational. */
export type GammaLadderColumnData = Omit<HeatmapColumnInput, "control">;

// ── Live-poll cadences ───────────────────────────────────────────────────────
// A ladder column is expensive: it polls the per-strike surface and the GEX
// summary, so each mounted column adds directly to this site's per-viewer
// request rate (Pair Comparison runs two of them; a board can carry more). The
// website's BFF proxies straight to the API (ZEROGEX_API_BASE_URL, default
// 127.0.0.1:8000), bypassing the nginx response cache / request coalescing that
// fronts direct API traffic — so every poll from every viewer lands on a
// uvicorn worker. That is why the site-wide overload surfaced on Pair
// Comparison first, on the gamma heatmap.
//
// The per-strike tip and the summary go through useApiData as independent
// per-URL fetch loops (and columns are usually different symbols), so their
// cadence directly sets how many requests a column emits. The tip is a
// window_units=3 strike-profile-timeseries read — a few bucket-representative
// index probes, nothing like the chart pages' 78-bucket seed — and the surface
// only changes on the analytics cycle (~60s) with a ~5s server-side cache
// (ANALYTICS_CACHE_TTL_SECONDS), so the poll stays aligned with that cache
// exactly as the old heatmap poll was. The summary (flip / walls / max-pain,
// also 60s-cycle) is kept a touch faster so its spot_price — the ladder
// marker, and on Pair Comparison the candles' horizontal spot line — stays
// live-ish.
//
// Quotes are deliberately NOT rate-limited here: useMarketQuote already shares
// one deduplicated subscription per symbol (min interval across subscribers) and
// drops to a heartbeat once the WebSocket is serving that symbol, so the live
// header change badge keeps its 1 Hz feel without adding per-column HTTP load.
//
// NOTE: useApiData halves the nominal interval (REFRESH_ACCELERATION_FACTOR) with
// a 1s floor, so 10_000 → ~5s and 5_000 → ~2.5s effective.
const TIP_REFRESH_MS = 10_000; // ~5s effective — matches the server GEX cache
const SUMMARY_REFRESH_MS = 5_000; // ~2.5s effective — keeps the spot marker live-ish
// The Δ-since-open baseline is one frozen frame per symbol per session: the
// slow re-poll only exists to roll it over when a new session opens (and to
// self-heal a failed fetch). 600_000 → ~5min effective.
const BASELINE_REFRESH_MS = 600_000;

/** One /api/gex/strike-profile-timeseries bucket, as the ladder reads it. */
interface TipBucket {
  timestamp: string;
  gamma_flip?: number | string | null;
  call_wall?: number | string | null;
  put_wall?: number | string | null;
  strikes?: Array<{
    strike?: number | string;
    net_gamma?: number | string | null;
  }>;
}

/** /api/replay/frame payload — only the fields the baseline needs. */
interface BaselineFrame {
  frame_ts?: string | null;
  strikes?: FrameStrikeRow[];
}

function num(v: number | string | null | undefined): number | null {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? ""));
  return Number.isFinite(n) ? n : null;
}

/** Freshest bucket carrying real positioning (an empty or tape-less all-zero
 *  after-hours tip mustn't blank the ladder). */
function latestLiveBucket(buckets: TipBucket[] | null | undefined): TipBucket | null {
  if (!Array.isArray(buckets)) return null;
  for (let i = buckets.length - 1; i >= 0; i -= 1) {
    const strikes = buckets[i]?.strikes;
    if (Array.isArray(strikes) && strikes.some((s) => (num(s?.net_gamma) ?? 0) !== 0)) {
      return buckets[i];
    }
  }
  return null;
}

function bucketCells(bucket: TipBucket | null): HeatmapCell[] {
  const out: HeatmapCell[] = [];
  for (const s of bucket?.strikes ?? []) {
    const strike = num(s?.strike);
    if (strike == null || strike <= 0) continue;
    out.push({ strike, net_gex: num(s?.net_gamma) ?? 0 });
  }
  return out;
}

// '5min' + a tiny window: the tip only has to catch the analytics engine's
// latest write, and 5min keeps the request on the same bucket grid the other
// ladder-adjacent caches use.
function tipUrl(symbol: string, expirationsParam: string): string {
  const s = encodeURIComponent(symbol);
  const exp = encodeURIComponent(expirationsParam);
  return (
    `/api/gex/strike-profile-timeseries?symbol=${s}&underlying=${s}` +
    `&timeframe=5min&window_units=3&expirations=${exp}`
  );
}

// The frame's rows are per (strike, expiration) — the raw gex_by_strike grain
// — so one fetch serves EVERY expiration selection: switching expiries re-sums
// client-side instead of refetching. strike_limit counts those rows; 4000
// comfortably spans the ladder's window on a dense chain.
function baselineUrl(symbol: string, openIso: string): string {
  const s = encodeURIComponent(symbol);
  return `/api/replay/frame?symbol=${s}&ts=${encodeURIComponent(openIso)}&strike_limit=4000`;
}

export interface GammaLadderOptions {
  /**
   * Expiration scope, using the site-wide convention: an empty array (or
   * omitted) = all expirations. Pass the RECONCILED selection for this
   * symbol (useChartExpirations) so a foreign date can't leak into the param.
   */
  expirations?: readonly string[];
  /** Fetch + expose the Δ-since-open baseline (the session-delta triangles). */
  sessionDelta?: boolean;
}

/**
 * Poll one symbol's live ladder column. `enabled` gates every feed, so a
 * surface that has switched away from live (Pair Comparison in Replay) stops
 * emitting requests entirely rather than polling behind the scrubber.
 */
export function useGammaLadderColumn(
  symbol: string,
  enabled = true,
  options?: GammaLadderOptions,
): GammaLadderColumnData {
  const selection = options?.expirations ?? [];
  const expParam = selection.length === 0 ? "all" : [...selection].sort().join(",");
  const filtered = expParam !== "all";

  const { data: summary } = useGEXSummary(symbol, SUMMARY_REFRESH_MS, enabled);
  const { data: tip, loading, error } = useApiData<TipBucket[]>(tipUrl(symbol, expParam), {
    refreshInterval: TIP_REFRESH_MS,
    enabled,
  });
  const { data: quote } = useMarketQuote(symbol, 1000, enabled);
  const { data: closes } = useSessionCloses(symbol, 60000, quote?.session ?? null, enabled);

  const tipBucket = useMemo(() => latestLiveBucket(tip), [tip]);

  // Session-open anchor: the ET session the ladder's own data belongs to, so
  // a weekend view baselines against Friday's open, not an empty Saturday.
  const openIso = useMemo(
    () => (options?.sessionDelta ? sessionOpenIsoFor(tipBucket?.timestamp) : null),
    [options?.sessionDelta, tipBucket?.timestamp],
  );
  const { data: baselineFrame } = useApiData<BaselineFrame>(
    openIso ? baselineUrl(symbol, openIso) : "",
    { refreshInterval: BASELINE_REFRESH_MS, enabled: enabled && !!openIso },
  );

  const sessionBaseline = useMemo<SessionBaselineInput | null>(() => {
    if (!openIso || !baselineFrame?.strikes?.length) return null;
    // Re-derive the selection from its canonical param string so this memo
    // keys off a stable value instead of the caller's per-render array.
    const selected = expParam === "all" ? [] : expParam.split(",");
    return {
      netByStrike: baselineNetByStrike(baselineFrame.strikes, selected),
      frameTs: baselineFrame.frame_ts ?? null,
    };
  }, [openIso, baselineFrame, expParam]);

  return useMemo(() => {
    // The header badge is the plain day change of the DISPLAYED spot vs the
    // previous regular-session close — the reading everyone expects beside a
    // price. Not getPrimaryPriceChangeSummary: that reading freezes its price
    // side on the official close in extended hours and swaps indices to a
    // futures-vs-futures basis overnight, so its % can describe a different
    // number than the analytics spot this header actually shows.
    const spot = summary?.spot_price ?? null;
    const change = getSpotPriorCloseChange(spot, quote?.session ?? null, closes ?? null);
    return {
      symbol,
      cells: bucketCells(tipBucket),
      spot,
      // With a specific expiration set, the walls and flip must describe that
      // set's gamma alone — the timeseries bucket recomputes them for the
      // filter, while /api/gex/summary is always the whole chain. "All" keeps
      // the canonical summary levels (parity with every other surface).
      gammaFlip: filtered ? num(tipBucket?.gamma_flip) : summary?.gamma_flip ?? null,
      callWall: filtered ? num(tipBucket?.call_wall) : summary?.call_wall ?? null,
      putWall: filtered ? num(tipBucket?.put_wall) : summary?.put_wall ?? null,
      maxPain: filtered ? null : summary?.max_pain ?? null,
      changePercent: change.changePercent,
      isPositive: change.isPositive,
      sessionBaseline,
      loading,
      error,
    };
  }, [symbol, tipBucket, summary, quote, closes, filtered, sessionBaseline, loading, error]);
}
