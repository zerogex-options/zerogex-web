/**
 * Gamma Trend — dealer gamma and the flip↔spot cushion as SERIES, not levels.
 *
 * Every other surface in the app answers "where is dealer gamma now?" (the
 * GEX profile, the walls, the regime header) or "how does now compare to one
 * earlier moment?" (Gamma Shift's A→B diff). Neither answers the question a
 * trader actually asks mid-session: *which way is this going?* A +$50B book
 * that has been bleeding down all morning and one that has been building all
 * morning read identically as a level and mean opposite things.
 *
 * This module turns the strike-profile bucket series the app already caches
 * into two plottable series and a summary of what they did:
 *
 *   • **gamma**   — Σ net dealer gamma across every strike, per bucket.
 *                   Building or decaying, and whether it changed sign.
 *   • **cushion** — spot − flip, per bucket. How much room price has before
 *                   the hedging regime inverts, and whether that room is
 *                   opening or closing.
 *
 * ---------------------------------------------------------------------------
 * Why cushion is measured as a gap, not as flip migration
 * ---------------------------------------------------------------------------
 * The ladder's wall-move read holds spot fixed and asks whether the flip
 * moved closer to it, which isolates the flip's own migration. That is the
 * right question for "did dealers reposition." It is the WRONG question for
 * "how fragile is this tape," because a cushion collapses just as hard when
 * spot falls onto a stationary flip as when the flip climbs into a stationary
 * spot. So the series here is the true gap, and `flipMove` / `spotMove` are
 * reported alongside it so the copy can say which side did the moving —
 * a distinction the gap alone hides and traders immediately ask about.
 *
 * Kept pure and framework-free — no React, and no imports at all — so it runs
 * under the Node test runner like core/regimeShift.ts and core/sessionDelta.ts.
 * The two formatters below are deliberate twins of regimeShift's rather than
 * an import of them: a value import across core modules would need a `.ts`
 * specifier that the bundler's resolution mode does not allow, and every
 * existing cross-core import here is type-only for that reason. The output is
 * identical, including the U+2212 minus, so the two panels agree on screen.
 */

// ---------------------------------------------------------------------------
// Formatting (twins of core/regimeShift.ts — see the note above)
// ---------------------------------------------------------------------------

function compactDollars(abs: number): string {
  if (abs >= 1e9) return `$${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `$${(abs / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `$${(abs / 1e3).toFixed(0)}K`;
  return `$${abs.toFixed(0)}`;
}

/** Compact dollars with an explicit sign, e.g. "+$1.2B" / "−$430M". */
export function formatSignedGex(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—';
  if (value === 0) return '$0';
  return `${value > 0 ? '+' : '−'}${compactDollars(Math.abs(value))}`;
}

/**
 * Axis tick: magnitude, with a minus for negatives but no "+" on positives.
 * A column of "+$15.00B / +$30.00B / +$45.00B" spends a character per tick
 * restating a sign the axis order already makes obvious; the signed form is
 * kept for the stat row and tooltip, where a lone number really is ambiguous.
 */
export function formatGexAxis(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '';
  if (value === 0) return '$0';
  return value < 0 ? `−${compactDollars(Math.abs(value))}` : compactDollars(value);
}

/** Strike / level label, dropping a trailing ".0". */
export function formatStrike(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return Number.isInteger(value) ? String(value) : value.toFixed(value < 50 ? 1 : 0);
}

// ---------------------------------------------------------------------------
// Input — structurally satisfied by StrikeProfileBucket
// ---------------------------------------------------------------------------

/**
 * The subset of a strike-profile bucket this module reads.
 *
 * Declared structurally rather than imported from `hooks/` on purpose: that
 * module is a `'use client'` React file, and importing it would drag React
 * into a module whose whole point is running headless under `node --test`.
 * `StrikeProfileBucket` satisfies this shape, so callers pass it unchanged.
 */
export interface TrendBucketStrike {
  strike?: number | string;
  net_gamma?: number | string | null;
}

export interface TrendBucket {
  timestamp: string;
  close?: number | string | null;
  gamma_flip?: number | string | null;
  strikes?: TrendBucketStrike[];
}

// ---------------------------------------------------------------------------
// Series
// ---------------------------------------------------------------------------

export interface GammaTrendPoint {
  timestamp: string;
  /** Epoch ms. Recharts needs a numeric x for a true time scale — a category
   *  axis would space an illiquid 5-minute gap the same as a busy one. */
  t: number;
  /** Σ net dealer gamma across every strike, in the caller's display unit. */
  gamma: number;
  /** Gamma flip level, or null when this bucket carried none. */
  flip: number | null;
  /** Underlying at the bucket close. */
  spot: number | null;
  /** spot − flip. Positive = price sits above the flip (long-gamma side). */
  cushion: number | null;
}

function num(value: unknown): number | null {
  if (value == null) return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * Build the plottable series from raw buckets.
 *
 * `scale` is applied uniformly (it comes from `gexScaleFactor`, which divides
 * by spot for the per-point unit). Re-deriving it per bucket from that
 * bucket's own spot would make the divisor move with price, so a flat book
 * would render as a slope — the shape would be an artifact of the unit
 * rather than of the data.
 *
 * Buckets carrying no strike data are dropped rather than summed to zero: a
 * gap in the feed must not draw a cliff to $0 that reads as the book
 * vanishing.
 */
export function buildTrendSeries(
  buckets: readonly TrendBucket[] | null | undefined,
  scale = 1,
): GammaTrendPoint[] {
  if (!buckets || buckets.length === 0) return [];
  const out: GammaTrendPoint[] = [];

  for (const bucket of buckets) {
    const strikes = bucket?.strikes;
    if (!Array.isArray(strikes) || strikes.length === 0) continue;

    const t = Date.parse(bucket.timestamp);
    if (!Number.isFinite(t)) continue;

    let gamma = 0;
    let seen = 0;
    for (const s of strikes) {
      const g = num(s?.net_gamma);
      if (g == null) continue;
      gamma += g;
      seen += 1;
    }
    if (seen === 0) continue;

    const spot = num(bucket.close);
    const flip = num(bucket.gamma_flip);

    out.push({
      timestamp: bucket.timestamp,
      t,
      gamma: gamma * scale,
      flip,
      spot,
      cushion: spot != null && flip != null ? spot - flip : null,
    });
  }

  out.sort((a, b) => a.t - b.t);
  return out;
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

export type TrendDirection = 'building' | 'decaying' | 'flat';
export type CushionDrift = 'converging' | 'widening' | 'steady';

export interface TrendSummary {
  count: number;
  first: GammaTrendPoint | null;
  last: GammaTrendPoint | null;

  gammaNow: number | null;
  gammaChange: number | null;
  direction: TrendDirection;
  /** Gamma changed sign across the window — dealers flipped side. */
  crossedZero: boolean;

  cushionNow: number | null;
  /** Change in the ABSOLUTE gap. Negative = the cushion closed. */
  cushionChange: number | null;
  drift: CushionDrift;
  /** Spot crossed the flip across the window — the regime actually inverted. */
  crossedFlip: boolean;

  /** How much of the cushion move each side contributed. */
  flipMove: number | null;
  spotMove: number | null;
}

/**
 * A change smaller than this fraction of the window's largest reading is
 * noise, not a trend. Without a deadband every session reads as "building"
 * or "decaying" on rounding alone, which would make the verdict worthless.
 */
const GAMMA_FLAT_FRACTION = 0.02;

/** Same idea for the cushion, as a fraction of spot (~4pts on a 7,800 index). */
const CUSHION_STEADY_FRACTION = 0.0005;

export function summarizeTrend(points: readonly GammaTrendPoint[]): TrendSummary {
  const empty: TrendSummary = {
    count: 0,
    first: null,
    last: null,
    gammaNow: null,
    gammaChange: null,
    direction: 'flat',
    crossedZero: false,
    cushionNow: null,
    cushionChange: null,
    drift: 'steady',
    crossedFlip: false,
    flipMove: null,
    spotMove: null,
  };
  if (points.length === 0) return empty;

  const first = points[0];
  const last = points[points.length - 1];

  // Gamma.
  const gammaChange = last.gamma - first.gamma;
  let peak = 0;
  for (const p of points) peak = Math.max(peak, Math.abs(p.gamma));
  const gammaDeadband = peak * GAMMA_FLAT_FRACTION;
  const direction: TrendDirection =
    Math.abs(gammaChange) <= gammaDeadband
      ? 'flat'
      : gammaChange > 0
        ? 'building'
        : 'decaying';
  const crossedZero =
    first.gamma !== 0 && last.gamma !== 0 && Math.sign(first.gamma) !== Math.sign(last.gamma);

  // Cushion. Both ends need a resolved gap for any of this to mean anything.
  const haveCushion = first.cushion != null && last.cushion != null;
  const cushionChange = haveCushion
    ? Math.abs(last.cushion as number) - Math.abs(first.cushion as number)
    : null;

  const spotRef = last.spot ?? first.spot ?? 0;
  const cushionDeadband = Math.abs(spotRef) * CUSHION_STEADY_FRACTION;
  let drift: CushionDrift = 'steady';
  if (cushionChange != null && Math.abs(cushionChange) > cushionDeadband) {
    drift = cushionChange < 0 ? 'converging' : 'widening';
  }

  const crossedFlip =
    haveCushion &&
    (first.cushion as number) !== 0 &&
    (last.cushion as number) !== 0 &&
    Math.sign(first.cushion as number) !== Math.sign(last.cushion as number);

  return {
    count: points.length,
    first,
    last,
    gammaNow: last.gamma,
    gammaChange,
    direction,
    crossedZero,
    cushionNow: last.cushion,
    cushionChange,
    drift,
    crossedFlip,
    flipMove: first.flip != null && last.flip != null ? last.flip - first.flip : null,
    spotMove: first.spot != null && last.spot != null ? last.spot - first.spot : null,
  };
}

// ---------------------------------------------------------------------------
// Copy
// ---------------------------------------------------------------------------

/** "Dealer gamma is building — +$4.1B since the start of the window." */
export function describeGammaTrend(summary: TrendSummary): string {
  if (summary.count === 0) return 'No gamma history in this window yet.';
  if (summary.count === 1) return 'Only one reading so far — nothing to trend against yet.';

  const delta = formatSignedGex(summary.gammaChange);
  switch (summary.direction) {
    case 'building':
      return `Dealer gamma is building — ${delta} across the window.`;
    case 'decaying':
      return `Dealer gamma is decaying — ${delta} across the window.`;
    default:
      return 'Dealer gamma is holding flat — the book has not meaningfully changed size.';
  }
}

/**
 * The cushion read, naming which side moved.
 *
 * A narrowing gap is the fragility signal, so it leads; the attribution
 * follows, because "the flip climbed into spot" and "spot fell onto the flip"
 * call for different trades and the gap alone cannot tell them apart.
 */
export function describeCushionTrend(summary: TrendSummary): string {
  if (summary.cushionNow == null) return 'No gamma flip resolved in this window.';

  if (summary.crossedFlip) {
    return summary.cushionNow >= 0
      ? 'Spot crossed above the flip — dealers are long gamma here now.'
      : 'Spot crossed below the flip — dealers are short gamma here now.';
  }

  const side = summary.cushionNow >= 0 ? 'above' : 'below';
  const gap = formatStrike(Math.abs(summary.cushionNow));

  if (summary.drift === 'steady') {
    return `Spot is holding ${gap} pts ${side} the flip — the cushion is steady.`;
  }

  const lead =
    summary.drift === 'converging'
      ? `The cushion is thinning — ${gap} pts ${side} the flip and closing`
      : `The cushion is widening — ${gap} pts ${side} the flip and opening up`;

  return `${lead}${attributeMove(summary)}.`;
}

/** ", as the flip climbed 12 pts into a falling spot" — or "" when unclear. */
function attributeMove(summary: TrendSummary): string {
  const { flipMove, spotMove } = summary;
  if (flipMove == null || spotMove == null) return '';

  const flipMag = Math.abs(flipMove);
  const spotMag = Math.abs(spotMove);
  // Below this the side genuinely did not move; naming it would invent a
  // cause for a gap that closed for the other reason entirely.
  const floor = Math.max(1e-9, Math.abs(summary.last?.spot ?? 0) * CUSHION_STEADY_FRACTION);
  if (flipMag <= floor && spotMag <= floor) return '';

  if (flipMag > spotMag * 2) {
    return `, driven by the flip ${flipMove > 0 ? 'climbing' : 'sliding'} ${formatStrike(flipMag)} pts`;
  }
  if (spotMag > flipMag * 2) {
    return `, driven by spot ${spotMove > 0 ? 'rising' : 'falling'} ${formatStrike(spotMag)} pts`;
  }
  return ', with both spot and the flip on the move';
}

/** Which semantic tone the cushion read should wear. */
export function cushionTone(summary: TrendSummary): 'bull' | 'bear' | 'warning' | 'muted' {
  if (summary.cushionNow == null) return 'muted';
  if (summary.cushionNow < 0) return 'bear';
  if (summary.drift === 'converging') return 'warning';
  return 'bull';
}

/** Which semantic tone the gamma read should wear. */
export function gammaTone(summary: TrendSummary): 'bull' | 'bear' | 'muted' {
  if (summary.direction === 'flat') return 'muted';
  return summary.direction === 'building' ? 'bull' : 'bear';
}

/** "+412 pts" / "−38 pts" — a signed point delta for the stat row. */
export function formatSignedPoints(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—';
  if (value === 0) return '0 pts';
  return `${value > 0 ? '+' : '−'}${formatStrike(Math.abs(value))} pts`;
}

// ---------------------------------------------------------------------------
// Plot domains
// ---------------------------------------------------------------------------

/** Round a raw step up to a 1/2/5×10ⁿ value, so axis ticks land on readable
 *  numbers instead of the arbitrary bounds a padded domain would produce. */
function niceStep(raw: number): number {
  const safe = Math.max(Math.abs(raw), 1e-9);
  const mag = Math.pow(10, Math.floor(Math.log10(safe)));
  const norm = safe / mag;
  const step = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10;
  return step * mag;
}

/** How many session ranges from the data zero may sit and still be shown. */
const ZERO_PULL_IN_SPANS = 1.5;

export interface PlotDomain {
  domain: [number, number];
  /** Whether zero falls inside the domain — the caller anchors the area fill
   *  and draws the regime rule only when it does. */
  includesZero: boolean;
}

/**
 * Vertical extent for the gamma plot.
 *
 * Deliberately NOT anchored to zero. A book oscillating between $38B and
 * $51B plotted from $0 puts the entire session inside the top fifth of the
 * plot, so the one thing the panel exists to show — the shape of the change —
 * is compressed into a flat line above a large block of colour.
 *
 * Zero is pulled back in when the series runs near it, because a book about
 * to change sign has to show the boundary it is approaching; that is the
 * moment the hedging regime inverts and it must not be cropped out of frame.
 * "Near" is measured in session ranges, not in dollars or in a fraction of
 * the span: a book at $2B with a $2B range could plausibly reach zero today,
 * one at $38B with the same range could not, and only the distance-in-ranges
 * separates those two cases. Measuring it as a fraction of the span instead
 * would make the boundary appear or vanish according to how volatile the
 * session happened to be, which is the wrong variable entirely.
 */
export function gammaDomain(values: readonly number[]): PlotDomain {
  let max = -Infinity;
  let min = Infinity;
  for (const v of values) {
    if (!Number.isFinite(v)) continue;
    max = Math.max(max, v);
    min = Math.min(min, v);
  }
  if (!Number.isFinite(max) || !Number.isFinite(min)) {
    return { domain: [0, 1], includesZero: true };
  }

  const span = max - min || Math.abs(max) || 1;
  let lo = min - span * 0.12;
  let hi = max + span * 0.12;
  if (lo > 0 && min <= span * ZERO_PULL_IN_SPANS) lo = 0;
  if (hi < 0 && -max <= span * ZERO_PULL_IN_SPANS) hi = 0;

  // Snap outward to round bounds so the ticks read "$40B" rather than
  // "$40.85B" — the same treatment the price axis gets, for the same reason.
  const step = niceStep((hi - lo) / 4);
  lo = Math.floor(lo / step) * step;
  hi = Math.ceil(hi / step) * step;

  // Recomputed AFTER snapping: rounding a small positive floor down can bring
  // zero into frame on its own, and the fill anchor must agree with the axis
  // the reader is actually looking at.
  return { domain: [lo, hi], includesZero: lo <= 0 && hi >= 0 };
}

/**
 * Vertical extent for the price plot, snapped outward to round bounds.
 *
 * Spot and the flip are both prices, so they share this one axis honestly —
 * the whole reason the panel is two plots rather than one dual-axis plot.
 */
export function priceDomain(values: readonly (number | null)[]): [number, number] | undefined {
  let max = -Infinity;
  let min = Infinity;
  for (const v of values) {
    if (v == null || !Number.isFinite(v)) continue;
    max = Math.max(max, v);
    min = Math.min(min, v);
  }
  if (!Number.isFinite(max) || !Number.isFinite(min)) return undefined;

  const span = max - min || Math.abs(max) * 0.01 || 1;
  const pad = span * 0.12;
  const step = niceStep((span + pad * 2) / 4);
  return [Math.floor((min - pad) / step) * step, Math.ceil((max + pad) / step) * step];
}
