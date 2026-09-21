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

/**
 * The symbols the cone is actually modelled for.
 *
 * Deliberately NOT the global SYMBOLS list, which includes ES and NQ. The
 * cone hardcodes a cash session — 390 minutes from 09:30 ET, with a diurnal
 * variance profile shaped around an opening auction, a midday trough and a
 * closing ramp. Futures trade roughly 23 hours (see market_calendar's
 * 18:00 reopen / 17:00 close), so pointing this model at ES would anchor
 * every fire to 09:30, treat the day as 390 minutes, and ignore the session
 * where those instruments are most distinctive.
 *
 * Offering them in the picker would render "no cone committed" forever,
 * which reads as a broken page rather than a scoping decision. Futures need
 * a per-symbol session and their own fitted diurnal curve; until that exists
 * they are not listed.
 */
export const CONE_SYMBOLS = ['SPY', 'SPX', 'QQQ', 'NDX'] as const;

export type ConeSymbol = (typeof CONE_SYMBOLS)[number];

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

/**
 * Price range for the y axis: the cone, the realized path, and any reference
 * level close enough to be worth showing.
 *
 * This exists because the band is drawn as two STACKED areas, and a stack's
 * implied baseline is zero — so recharts derives a domain starting at 0 and
 * `domain={['auto','auto']}` cannot override it. The first version of this
 * chart rendered a $2-wide cone inside a 0–800 axis: a flat line at the top
 * of an empty rectangle.
 *
 * The caller must also pass `allowDataOverflow`, because recharts EXPANDS an
 * explicit domain to fit stray data unless told not to — and the stray datum
 * here is that invisible zero baseline. Domain alone is not enough.
 *
 * Reference levels are included only when they sit within roughly one band
 * width of the cone. A wall 5% away would flatten the band back into a line
 * to show a level nobody is trading against on a two-hour horizon; it is
 * better for that line to fall off the chart than to take the cone with it.
 */
export function conePriceDomain(
  rows: readonly ConePathPoint[],
  refs: readonly (number | null | undefined)[] = [],
  padFraction = 0.12,
): [number, number] | null {
  const values: number[] = [];
  for (const r of rows) {
    if (r.spot !== null && r.spot !== undefined) values.push(r.spot);
    if (r.bandBase !== null && r.bandBase !== undefined) {
      values.push(r.bandBase);
      if (r.bandSpan !== null && r.bandSpan !== undefined) {
        values.push(r.bandBase + r.bandSpan);
      }
    }
  }
  const usable = values.filter((v) => Number.isFinite(v));
  if (!usable.length) return null;

  let lo = Math.min(...usable);
  let hi = Math.max(...usable);
  // A single anchor has zero width, so fall back to a fraction of the price
  // rather than a zero tolerance that admits nothing.
  const reach = hi - lo || Math.abs(hi) * 0.002 || 1;

  for (const ref of refs) {
    if (ref === null || ref === undefined || !Number.isFinite(ref)) continue;
    if (ref >= lo - reach && ref <= hi + reach) {
      lo = Math.min(lo, ref);
      hi = Math.max(hi, ref);
    }
  }

  const pad = (hi - lo) * padFraction || Math.abs(hi) * 0.002 || 1;
  return niceBounds(lo - pad, hi + pad);
}

/**
 * Round a range outward to a readable step.
 *
 * Needed because `allowDataOverflow` makes recharts use the domain bounds
 * verbatim as the outermost ticks. Without this the axis reads 765.40,
 * 767.40, 769.40, 771.60 — three even gaps and then a short one, which looks
 * like a rounding bug on a chart whose whole job is to be believed about
 * numbers.
 */
function niceBounds(lo: number, hi: number): [number, number] {
  const range = hi - lo;
  if (!(range > 0) || !Number.isFinite(range)) return [lo, hi];
  // Aim for ~4 intervals, then snap the step to 1, 2 or 5 times a power of 10.
  const raw = range / 4;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const norm = raw / mag;
  const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10) * mag;
  return [Math.floor(lo / step) * step, Math.ceil(hi / step) * step];
}

/**
 * Decimal places for a price axis, by magnitude.
 *
 * SPY needs cents; NDX at 30,000 does not, and printing "30220.12" four
 * times down an axis is noise that crowds out the band.
 */
export function conePriceDecimals(reference: number): number {
  const v = Math.abs(reference);
  if (v >= 5000) return 0;
  if (v >= 500) return 1;
  return 2;
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
