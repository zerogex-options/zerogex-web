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
  /** Epoch ms. Kept for labeling and tooltips; the plots are indexed by
   *  position rather than plotted on a time scale — see `buildTrendAxis`. */
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
// The time axis
// ---------------------------------------------------------------------------

/**
 * Why these plots are indexed by POSITION and not plotted on a time scale.
 *
 * The series is a fixed-cadence bucket feed, and the analytics engine only
 * writes while the chain is open. A true time axis therefore spends its width
 * in proportion to the CLOCK, and the clock includes the ~17.5 hours between
 * one session's close and the next one's open. At 10am the seed window
 * reaches back into yesterday afternoon, so most of the plot is an empty
 * overnight span with the two stubs of real data squeezed against its edges.
 * There is nothing to read in that space: dealer gamma does not move while
 * the market is shut, and the line drawn across it is an interpolation
 * between two sessions, not a reading.
 *
 * Indexing by position gives every stored bucket the same width, which drops
 * the closed span to nothing. Two things have to come back for that to be
 * honest, and `buildTrendAxis` produces both:
 *
 *   • **ticks on round wall-clock times.** Position indices are meaningless
 *     to a reader, and letting the chart library pick from them lands labels
 *     on 10:07 and 11:42. Ticks are chosen at :00/:30 ET boundaries — the
 *     times a trader already thinks in.
 *   • **a visible seam** wherever a gap was collapsed, so the axis never
 *     silently claims 15:55 and 09:35 are adjacent readings.
 *
 * ET, not local time: the boundaries a reader wants are the session's, and a
 * reader in London must see the same 10:30 tick as one in Chicago.
 */
export interface TrendAxisTick {
  /** Index into the points array — the x value the chart plots against. */
  index: number;
  /** "10:30", or "Fri 10:30" on the first tick of a new day. */
  label: string;
}

export interface TrendAxisBreak {
  /** Index of the first point AFTER the collapsed gap. */
  index: number;
  /** "Fri 8/28" — which session resumes here. */
  label: string;
}

export interface TrendAxis {
  ticks: TrendAxisTick[];
  breaks: TrendAxisBreak[];
  /** Minutes between ticks, for callers that want to describe the scale. */
  stepMinutes: number;
}

interface EtParts {
  day: string;
  minuteOfDay: number;
}

/**
 * ET calendar parts for an epoch-ms instant.
 *
 * A local twin of `core/signalHelpers.etPartsFromMs`, for the same reason the
 * formatters at the top of this file are twins: this module takes no imports
 * so it can run headless under `node --test`. `Intl` is a global, not an
 * import, and it is the only thing that gets ET right across DST without a
 * timezone table.
 */
function etParts(ms: number): EtParts {
  if (!Number.isFinite(ms)) return { day: '', minuteOfDay: 0 };
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(new Date(ms));
  let year = '';
  let month = '';
  let day = '';
  let hour = '0';
  let minute = '0';
  for (const p of parts) {
    if (p.type === 'year') year = p.value;
    else if (p.type === 'month') month = p.value;
    else if (p.type === 'day') day = p.value;
    else if (p.type === 'hour') hour = p.value;
    else if (p.type === 'minute') minute = p.value;
  }
  // `hour12: false` renders midnight as "24" in some ICU versions.
  const hr = parseInt(hour, 10) % 24;
  return { day: `${year}-${month}-${day}`, minuteOfDay: hr * 60 + parseInt(minute, 10) };
}

function etClock(minuteOfDay: number): string {
  const hh = Math.floor(minuteOfDay / 60);
  const mm = minuteOfDay % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

/** "Fri 8/28" — enough to place a session without spending a whole date. */
function etDayLabel(ms: number): string {
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      weekday: 'short',
      month: 'numeric',
      day: 'numeric',
    }).format(new Date(ms));
  } catch {
    return '';
  }
}

/**
 * Tick spacings to try, coarsest last.
 *
 * Half-hourly is the target — it is the grain a session is actually discussed
 * in ("the 10:30 push", "into the 15:30 imbalance") — and the ladder only
 * coarsens when half-hourly would not fit in `maxTicks`.
 */
const TICK_STEPS_MINUTES = [30, 60, 120, 240] as const;

/**
 * A gap is a break when it exceeds the typical bucket spacing by this much.
 *
 * Generous on purpose: a single missed write is a gap of ~2 cadences and is
 * NOT a session boundary, and marking it as one would put a seam in the
 * middle of a continuous session. An overnight gap is ~200 cadences on a
 * 5-minute feed, so nothing subtle is being separated here.
 */
const BREAK_GAP_MULTIPLE = 4;

function medianSpacing(points: readonly GammaTrendPoint[]): number {
  const gaps: number[] = [];
  for (let i = 1; i < points.length; i += 1) {
    const d = points[i].t - points[i - 1].t;
    if (d > 0) gaps.push(d);
  }
  if (gaps.length === 0) return 0;
  gaps.sort((a, b) => a - b);
  return gaps[Math.floor(gaps.length / 2)];
}

/**
 * Ticks on round ET times, plus the seams where a closed market was cut out.
 *
 * `maxTicks` is a budget, not a target: the finest spacing that fits wins, so
 * a two-hour window gets half-hourly ticks and a three-session one gets
 * four-hourly, without either crowding the axis.
 */
export function buildTrendAxis(
  points: readonly GammaTrendPoint[],
  maxTicks = 9,
): TrendAxis {
  const empty: TrendAxis = { ticks: [], breaks: [], stepMinutes: TICK_STEPS_MINUTES[0] };
  if (!points || points.length === 0) return empty;

  const parts = points.map((p) => etParts(p.t));
  const cadence = medianSpacing(points);

  // Seams first: they also force a tick, since the first reading of a new
  // session is a point a reader looks for by name.
  const breaks: TrendAxisBreak[] = [];
  if (cadence > 0) {
    const threshold = cadence * BREAK_GAP_MULTIPLE;
    for (let i = 1; i < points.length; i += 1) {
      if (points[i].t - points[i - 1].t > threshold) {
        breaks.push({ index: i, label: etDayLabel(points[i].t) });
      }
    }
  }
  const breakIndices = new Set(breaks.map((b) => b.index));

  const pick = (stepMinutes: number): number[] => {
    const out: number[] = [];
    for (let i = 0; i < points.length; i += 1) {
      // The bucket that CROSSES a boundary carries its tick, so a feed whose
      // buckets do not land exactly on :30 still gets labeled — one bucket
      // late is a label off by less than a cadence, where requiring an exact
      // hit would silently drop every tick on that feed.
      const crossed =
        i === 0 ||
        breakIndices.has(i) ||
        parts[i].day !== parts[i - 1].day ||
        Math.floor(parts[i].minuteOfDay / stepMinutes) !==
          Math.floor(parts[i - 1].minuteOfDay / stepMinutes);
      if (crossed) out.push(i);
    }
    return out;
  };

  let stepMinutes = TICK_STEPS_MINUTES[TICK_STEPS_MINUTES.length - 1];
  let indices = pick(stepMinutes);
  for (const step of TICK_STEPS_MINUTES) {
    const candidate = pick(step);
    if (candidate.length <= maxTicks) {
      stepMinutes = step;
      indices = candidate;
      break;
    }
  }

  const ticks = indices.map((index) => {
    const clock = etClock(parts[index].minuteOfDay);
    // The date rides along only where it changes — repeating it on every
    // tick of a one-session chart is noise, and omitting it entirely on a
    // multi-session one makes 10:30 ambiguous.
    const newDay = index > 0 && parts[index].day !== parts[index - 1].day;
    return {
      index,
      label: newDay ? `${etDayLabel(points[index].t)} ${clock}` : clock,
    };
  });

  return { ticks, breaks, stepMinutes };
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
 * is compressed into a flat line above a large block of color.
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
