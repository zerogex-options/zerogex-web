/**
 * Pure series construction for the intraday cone chart.
 *
 * Extracted from the component for the same reason the other `core/` modules
 * are: the shape of the cone is a claim about what the model said, and a
 * claim worth publishing is worth testing without mounting a chart.
 *
 * The cone's meaning is load-bearing here. Each point is the band committed
 * for one horizon, and the band edges are what the grader tested price
 * against. Drawing them wrong — starting at full width, dropping a horizon,
 * letting a merge erase a bound — would show the reader a band nobody
 * committed to and then report a verdict against a different one.
 */

export interface ConePathPoint {
  /** Epoch ms. Numeric so the cone (which runs into the future) and the
   *  realized path share one x scale. */
  t: number;
  /** Lower band edge, carried as the transparent base of the stacked area. */
  bandBase: number | null;
  /** band_high − band_low: the visible span stacked on top of the base. */
  bandSpan: number | null;
  /** Realized price at this instant, where one was sampled. */
  spot: number | null;
}

interface HorizonLike {
  horizon_min: number;
  band_low: number | null;
  band_high: number | null;
}

interface FireLike {
  forecast_ts: string | null;
  anchor_spot: number | null;
  horizons: HorizonLike[];
}

/**
 * The cone for one fire: a POINT at the anchor, then one widening step per
 * published horizon.
 *
 * Starting at spot rather than at full width is not cosmetic. A band that
 * begins already wide implies price could gap to its edge instantly; the
 * horizon sigma says the opposite, that the band earns its width over time.
 *
 * Horizons with a missing bound are skipped rather than coerced, and the
 * result is sorted by horizon so an out-of-order payload cannot fold the
 * cone back on itself.
 */
export function buildConePoints(fire: FireLike | null | undefined): ConePathPoint[] {
  if (!fire?.forecast_ts || fire.anchor_spot === null || fire.anchor_spot === undefined) {
    return [];
  }
  const anchorMs = Date.parse(fire.forecast_ts);
  if (!Number.isFinite(anchorMs)) return [];

  const points: ConePathPoint[] = [
    { t: anchorMs, bandBase: fire.anchor_spot, bandSpan: 0, spot: fire.anchor_spot },
  ];

  const ordered = [...(fire.horizons ?? [])].sort((a, b) => a.horizon_min - b.horizon_min);
  for (const h of ordered) {
    if (h.band_low === null || h.band_high === null) continue;
    points.push({
      t: anchorMs + h.horizon_min * 60_000,
      bandBase: h.band_low,
      bandSpan: h.band_high - h.band_low,
      spot: null,
    });
  }
  return points;
}

/**
 * The realized path, sampled at each fire's anchor.
 *
 * Free, and exactly aligned by construction: every anchor IS a price the
 * writer read and committed against, so no second data source can disagree
 * with the chart about where price was when a claim was made.
 */
export function buildSpotPath(fires: readonly FireLike[] | null | undefined): ConePathPoint[] {
  if (!fires?.length) return [];
  return fires
    .filter((f) => f.forecast_ts && f.anchor_spot !== null && f.anchor_spot !== undefined)
    .map((f) => ({
      t: Date.parse(f.forecast_ts as string),
      bandBase: null,
      bandSpan: null,
      spot: f.anchor_spot,
    }))
    .filter((p) => Number.isFinite(p.t))
    .sort((a, b) => a.t - b.t);
}

/**
 * Merge the cone and the realized path onto one time axis.
 *
 * The merge is additive per field: a null never overwrites a value. The
 * anchor instant carries BOTH a band and a price, and a naive object spread
 * would let whichever arrived second erase the other — dropping either the
 * cone's origin or the price print it was anchored on.
 */
export function mergeConeSeries(
  cone: readonly ConePathPoint[],
  path: readonly ConePathPoint[],
): ConePathPoint[] {
  const merged = new Map<number, ConePathPoint>();
  for (const p of [...path, ...cone]) {
    const existing = merged.get(p.t);
    if (!existing) {
      merged.set(p.t, { ...p });
      continue;
    }
    merged.set(p.t, {
      t: p.t,
      bandBase: p.bandBase ?? existing.bandBase,
      bandSpan: p.bandSpan ?? existing.bandSpan,
      spot: p.spot ?? existing.spot,
    });
  }
  return [...merged.values()].sort((a, b) => a.t - b.t);
}

/** Inclusive time domain for the x axis, or null when there is nothing to draw. */
export function coneDomain(rows: readonly ConePathPoint[]): [number, number] | null {
  if (!rows.length) return null;
  const ts = rows.map((r) => r.t);
  return [Math.min(...ts), Math.max(...ts)];
}

export type ConeVerdict = 'held' | 'broke' | 'not scored' | 'pending';

/**
 * The four states a horizon can be in, kept in one place so the chip and any
 * future summary cannot drift apart.
 *
 * "not scored" is a real third outcome — a matured claim whose window never
 * produced bars. It is deliberately neither held nor broke: folding it into
 * either would move a published hit rate for a reason that has nothing to do
 * with the model.
 */
export function horizonVerdict(h: { graded: boolean; held: boolean | null }): ConeVerdict {
  if (!h.graded) return 'pending';
  if (h.held === null) return 'not scored';
  return h.held ? 'held' : 'broke';
}
