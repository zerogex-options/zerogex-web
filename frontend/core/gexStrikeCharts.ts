/**
 * Pure, React-free derivations for the two by-strike gamma charts —
 * "Gamma Exposure by Strike" (GexProfileChart) and "Open Interest by Strike"
 * (GexWallsChart).
 *
 * These transforms are the single source of truth shared by the /gamma-exposure
 * page and the matching "My Dashboard" widgets, so a chart added to a board
 * computes its inputs identically to the same chart on the page. Kept free of
 * React and `window` so the contract can be exercised directly under the Node
 * test runner, like core/chartSettings.ts and core/expirationPersistence.ts.
 *
 * Two raw feeds drive everything here:
 *   • /api/gex/by-strike   → per-(strike, expiration) dealer GEX, OI and volume
 *   • /api/market/open-interest → per-contract open interest for the OI chart
 *
 * The expiration *selection* itself (reconciling the shared, persisted pick to a
 * chart's own expiration universe) is the generic core/expirationPersistence
 * `reconcileExpirations` — callers apply it before handing the result to
 * `chartStrikeData` / `perExpirationStrikeData` here.
 */

// Loose row shape for the /api/gex/by-strike snapshot. The hook types these
// fields as numbers, but the raw snapshot can carry strings/nulls, so every
// field is coerced with Number() at the point of use.
export type GexByStrikeRow = {
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

// Per-strike totals (GEX in $M) used by the strike table and, via
// toProfileStrikeData, by the GEX Profile chart.
export type StrikeAggregate = {
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

/** Raw-dollar (per 1% move) per-strike GEX rows consumed by GexProfileChart. */
export type ProfileStrikeRow = {
  strike: number;
  netGex: number;
  callGex: number;
  putGex: number;
};

/**
 * Per-(strike, expiration) dealer GEX for GexProfileChart's stacked bars and
 * its "% of total at this strike" baseline. Raw dollars per 1% move.
 */
export type PerExpirationStrikeRow = {
  strike: number;
  expiration: string;
  callGex: number;
  putGex: number;
};

// The /api/market/open-interest response arrives in one of several row-key
// shapes (or as a bare array); this captures every variant we normalize.
export type OpenInterestApiResponse = {
  spot_price?: number | string;
  contracts?: Record<string, unknown>[];
  rows?: Record<string, unknown>[];
  data?: Record<string, unknown>[];
  items?: Record<string, unknown>[];
  results?: Record<string, unknown>[];
};

/**
 * Aggregate raw by-strike rows into per-strike totals. Shared by the chart
 * (single-select expiration filter) and the snapshot table (multi-select
 * expiration filter) — each caller passes a different pre-filtered slice.
 */
export function aggregateStrikes(rows: GexByStrikeRow[] | null | undefined): StrikeAggregate[] {
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

/** Unique expirations present in a by-strike snapshot, ascending (nearest first). */
export function strikeExpirationOptions(gexByStrike: GexByStrikeRow[] | null | undefined): string[] {
  const unique = new Set((gexByStrike || []).map((row) => String(row.expiration)));
  return Array.from(unique).sort((a, b) => a.localeCompare(b));
}

/**
 * The GEX Profile chart's expiration universe: current/future expirations only.
 * The by-strike snapshot can still carry yesterday's expirations for a window
 * post-close (the analytics engine keeps the rows until the next session's data
 * lands), but they're not interesting to filter the chart by once we've crossed
 * midnight ET. `todayKey` is the ET date key (YYYY-MM-DD).
 */
export function chartExpirationOptions(expirationOptions: string[], todayKey: string): string[] {
  return expirationOptions.filter((exp) => exp >= todayKey);
}

/**
 * Aggregate by-strike data for the GEX Profile chart, respecting its expiration
 * selection. Empty selection = All: sum every expiration in the current/future
 * universe per strike; a non-empty selection sums only the chosen expirations.
 * "All" is the universe (not literally every row) so the aggregate bars/net line
 * stay consistent with the stacked segments, which only cover current/future
 * expirations.
 */
export function chartStrikeData(
  gexByStrike: GexByStrikeRow[] | null | undefined,
  selectedExpirations: string[],
  chartExpirations: string[],
): StrikeAggregate[] {
  const universe = new Set(chartExpirations);
  const selectedSet = new Set(selectedExpirations);
  const filteredSource =
    selectedExpirations.length === 0
      ? (gexByStrike || []).filter((row) => universe.has(String(row.expiration)))
      : (gexByStrike || []).filter((row) => selectedSet.has(String(row.expiration)));
  return aggregateStrikes(filteredSource);
}

/**
 * Raw-dollar strike rows for the GEX Profile chart. The /api/gex/profile
 * endpoint returns the spot-shift curve in raw dollars per 1% move, so matching
 * the per-strike bars to the same unit is what keeps the two y-axes
 * commensurable (the profile axis is an order-of-magnitude expansion of the bar
 * axis — see GexProfileChart).
 */
export function toProfileStrikeData(strikeData: StrikeAggregate[]): ProfileStrikeRow[] {
  return strikeData.map((row) => ({
    strike: row.strike,
    netGex: row.netGexM * 1_000_000,
    callGex: row.callGexM * 1_000_000,
    putGex: row.putGexM * 1_000_000,
  }));
}

/**
 * Per-(strike, expiration) GEX for the Gamma Exposure by Strike chart's stacked
 * bars and its "% of total at this strike" readout. Raw dollars (per 1% move)
 * over the chart's current/future expiration universe, so the stacked segments
 * and the all-expiration total share one coherent set. Deliberately NOT filtered
 * by the selection — the chart needs the whole breakdown to render each
 * expiration segment and to compute each pick's share of the strike total.
 */
export function perExpirationStrikeData(
  gexByStrike: GexByStrikeRow[] | null | undefined,
  chartExpirations: string[],
): PerExpirationStrikeRow[] {
  const universe = new Set(chartExpirations);
  const grouped = new Map<string, PerExpirationStrikeRow>();
  (gexByStrike || []).forEach((row) => {
    const expiration = String(row.expiration);
    if (!universe.has(expiration)) return;
    const strike = Number(row.strike);
    if (!Number.isFinite(strike)) return;
    const key = `${strike.toFixed(2)}|${expiration}`;
    const current = grouped.get(key) ?? { strike, expiration, callGex: 0, putGex: 0 };
    current.callGex += Number(row.call_gex || 0);
    current.putGex += Number(row.put_gex || 0);
    grouped.set(key, current);
  });
  return Array.from(grouped.values());
}

/**
 * The canonical expirations parameter the strike-profile timeseries hook keys
 * its cache on and the backend sums the walls across: 'all' (empty selection) or
 * a sorted, comma-joined list of the chosen expirations.
 */
export function expirationsParam(selectedExpirations: string[]): string {
  return selectedExpirations.length === 0 ? 'all' : [...selectedExpirations].sort().join(',');
}

/**
 * Coerce the /api/market/open-interest payload into the canonical response
 * shape. A bare array of contracts is wrapped; a keyed object is passed through;
 * anything else is null.
 */
export function normalizeOpenInterestPayload(
  openInterestData: OpenInterestApiResponse | Record<string, unknown>[] | null | undefined,
): OpenInterestApiResponse | null {
  if (!openInterestData) return null;
  if (Array.isArray(openInterestData)) {
    return { contracts: openInterestData };
  }
  if (typeof openInterestData === 'object') {
    return openInterestData as OpenInterestApiResponse;
  }
  return null;
}

/**
 * Pull the contract rows out of a normalized open-interest payload, accepting
 * every row-key variant the endpoint has used (contracts / rows / data / items /
 * results). Returns an empty array when none is present.
 */
export function openInterestRows(payload: OpenInterestApiResponse | null): Record<string, unknown>[] {
  if (payload && typeof payload === 'object') {
    const p = payload as Record<string, unknown>;
    if (Array.isArray(p.contracts)) return p.contracts as Record<string, unknown>[];
    if (Array.isArray(p.rows)) return p.rows as Record<string, unknown>[];
    if (Array.isArray(p.data)) return p.data as Record<string, unknown>[];
    if (Array.isArray(p.items)) return p.items as Record<string, unknown>[];
    if (Array.isArray(p.results)) return p.results as Record<string, unknown>[];
  }
  return [];
}

/** The snapshot spot price carried by an open-interest payload, or null. */
export function openInterestSpotPrice(payload: OpenInterestApiResponse | null): number | null {
  if (!payload) return null;
  const value = Number(payload.spot_price);
  return Number.isFinite(value) ? value : null;
}
