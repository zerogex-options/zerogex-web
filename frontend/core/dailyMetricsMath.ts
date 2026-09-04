// Pure math + parsing for the admin "Daily Signals" panel: no I/O, no DB, no
// server-only imports, so every branch below is unit-testable (see
// tests/dailyMetricsMath.test.ts). The side-effecting half — reading the audit
// log, materializing the per-day rollup table, importing CSVs — lives in
// core/dailyMetrics.ts, exactly as core/pageAnalyticsPaths.ts is the pure half
// of core/pageAnalytics.ts.
//
// What this exists for: the daily fact table (one row per ET calendar day) is
// only useful if you can ASK it questions, and the questions worth asking about
// acquisition are all of the form "does A on day D move B on day D+k". That is
// a lagged correlation, and a lagged correlation without a sample size and a
// p-value is a Rorschach test — on 30 days of noisy counts an |r| of 0.35 is
// unremarkable. So every relationship reported here carries n, r (Pearson AND
// Spearman) and a two-sided p, and the classifier below refuses to call
// anything a signal on fewer than MIN_CORRELATION_N paired observations.

// ---------------------------------------------------------------------------
// Day bucketing
// ---------------------------------------------------------------------------

const ET_DAY_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/New_York',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/**
 * The America/New_York calendar day an instant falls on, as 'YYYY-MM-DD'.
 *
 * Produces the same key as core/monitoringBuckets.etBucketKeys().day, which is
 * what every other chart on the admin page buckets by, so a day here is the
 * same day there. Implemented separately rather than imported because that
 * module is marked `server-only` and this one is loaded by
 * scripts/backfill-daily-metrics.mts under bare Node — and because the
 * behaviour worth protecting is the DST-correct output, which the tests pin
 * directly against known instants rather than against another implementation.
 */
export function etDayKey(date: Date): string {
  return ET_DAY_FORMATTER.format(date);
}

/** Weekday labels in the Mon→Sun order core/subscriptionFlow.ts already uses. */
export const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

/**
 * Fewest paired days a correlation needs before it is reported as anything but
 * "not enough data". Ten is not a statistical threshold so much as a floor
 * against nonsense: with n=4 a single burst day can drive |r| past 0.9, and the
 * p-value that comes with it is honest but easy to misread next to a big r.
 */
export const MIN_CORRELATION_N = 10;

// ---------------------------------------------------------------------------
// Distribution tails. Both p-values below are regularized-incomplete-beta
// evaluations, so the continued fraction is written once and shared.
// ---------------------------------------------------------------------------

const BETACF_MAX_ITER = 200;
const BETACF_EPS = 3e-12;
const BETACF_TINY = 1e-300;

function logGamma(x: number): number {
  // Lanczos approximation (g=7, n=9). Accurate to ~15 significant digits over
  // the range these tests need (a, b are half-integers of modest size).
  const coefficients = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
    -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6,
    1.5056327351493116e-7,
  ];
  if (x < 0.5) {
    // Reflection: Γ(x)Γ(1-x) = π / sin(πx)
    return Math.log(Math.PI / Math.sin(Math.PI * x)) - logGamma(1 - x);
  }
  const z = x - 1;
  let a = coefficients[0];
  const t = z + 7.5;
  for (let i = 1; i < coefficients.length; i++) a += coefficients[i] / (z + i);
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(a);
}

/** Continued-fraction expansion for the incomplete beta (Lentz's method). */
function betacf(a: number, b: number, x: number): number {
  const qab = a + b;
  const qap = a + 1;
  const qam = a - 1;
  let c = 1;
  let d = 1 - (qab * x) / qap;
  if (Math.abs(d) < BETACF_TINY) d = BETACF_TINY;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= BETACF_MAX_ITER; m++) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < BETACF_TINY) d = BETACF_TINY;
    c = 1 + aa / c;
    if (Math.abs(c) < BETACF_TINY) c = BETACF_TINY;
    d = 1 / d;
    h *= d * c;
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < BETACF_TINY) d = BETACF_TINY;
    c = 1 + aa / c;
    if (Math.abs(c) < BETACF_TINY) c = BETACF_TINY;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < BETACF_EPS) break;
  }
  return h;
}

/** Regularized incomplete beta I_x(a, b). Returns NaN on invalid input. */
export function incompleteBeta(a: number, b: number, x: number): number {
  if (!Number.isFinite(a) || !Number.isFinite(b) || !Number.isFinite(x)) return NaN;
  if (a <= 0 || b <= 0) return NaN;
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const front = Math.exp(
    logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log(1 - x),
  );
  // The fraction converges fast only for x < (a+1)/(a+b+2); past that, use the
  // symmetry I_x(a,b) = 1 - I_{1-x}(b,a).
  if (x < (a + 1) / (a + b + 2)) return (front * betacf(a, b, x)) / a;
  return 1 - (Math.exp(
    logGamma(a + b) - logGamma(a) - logGamma(b) + b * Math.log(1 - x) + a * Math.log(x),
  ) * betacf(b, a, 1 - x)) / b;
}

/** Two-sided p for Student's t with `df` degrees of freedom. */
export function studentTTwoSidedP(t: number, df: number): number {
  if (!Number.isFinite(t) || !Number.isFinite(df) || df <= 0) return NaN;
  const p = incompleteBeta(df / 2, 0.5, df / (df + t * t));
  if (!Number.isFinite(p)) return NaN;
  return Math.min(1, Math.max(0, p));
}

/** Upper-tail p for the F distribution: P(F_{df1,df2} > f). */
export function fDistributionUpperP(f: number, df1: number, df2: number): number {
  if (!Number.isFinite(f) || f < 0 || df1 <= 0 || df2 <= 0) return NaN;
  if (f === 0) return 1;
  const p = incompleteBeta(df2 / 2, df1 / 2, df2 / (df2 + df1 * f));
  if (!Number.isFinite(p)) return NaN;
  return Math.min(1, Math.max(0, p));
}

// ---------------------------------------------------------------------------
// Correlation
// ---------------------------------------------------------------------------

export type CorrelationResult = {
  /** Paired observations actually used (days where BOTH series had a value). */
  n: number;
  /** Pearson product-moment r, or null when undefined (n < 3, or zero variance). */
  r: number | null;
  /**
   * Spearman rank r. Reported alongside Pearson deliberately: daily counts here
   * are bursty (one viral post, one promo day), and a single outlier can carry
   * a Pearson r on its own. When the two disagree sharply, the Pearson number is
   * an artifact of one or two days, not a relationship.
   */
  rho: number | null;
  /** Two-sided p for the Pearson r under H0: rho = 0, or null when r is null. */
  p: number | null;
};

export type Pair = readonly [number, number];

/** Keep only pairs where both sides are present and finite. */
export function finitePairs(
  xs: ReadonlyArray<number | null | undefined>,
  ys: ReadonlyArray<number | null | undefined>,
): Pair[] {
  const out: Pair[] = [];
  const len = Math.min(xs.length, ys.length);
  for (let i = 0; i < len; i++) {
    const x = xs[i];
    const y = ys[i];
    if (typeof x !== 'number' || !Number.isFinite(x)) continue;
    if (typeof y !== 'number' || !Number.isFinite(y)) continue;
    out.push([x, y]);
  }
  return out;
}

function pearsonOfPairs(pairs: ReadonlyArray<Pair>): number | null {
  const n = pairs.length;
  if (n < 3) return null;
  let sx = 0;
  let sy = 0;
  for (const [x, y] of pairs) {
    sx += x;
    sy += y;
  }
  const mx = sx / n;
  const my = sy / n;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (const [x, y] of pairs) {
    const dx = x - mx;
    const dy = y - my;
    sxy += dx * dy;
    sxx += dx * dx;
    syy += dy * dy;
  }
  // A flat series (every day identical, very common for a metric that is all
  // zeros) has no variance, so correlation is undefined rather than zero.
  if (sxx <= 0 || syy <= 0) return null;
  const r = sxy / Math.sqrt(sxx * syy);
  if (!Number.isFinite(r)) return null;
  return Math.min(1, Math.max(-1, r));
}

/**
 * Fractional ranks with ties averaged (the standard Spearman tie correction).
 * Ties are the norm here — a metric that is 0 on eleven of thirty days has an
 * eleven-way tie — so midranking is load-bearing, not a nicety.
 */
export function rankWithTies(values: ReadonlyArray<number>): number[] {
  const order = values.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v);
  const ranks = new Array<number>(values.length);
  let i = 0;
  while (i < order.length) {
    let j = i;
    while (j + 1 < order.length && order[j + 1].v === order[i].v) j++;
    const midRank = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) ranks[order[k].i] = midRank;
    i = j + 1;
  }
  return ranks;
}

/**
 * Correlate two aligned daily series. Days where either side is missing (a
 * metric that has not been imported yet, a day before a metric existed) are
 * dropped pairwise rather than coerced to zero — treating "not measured" as
 * "measured zero" is how you manufacture a correlation out of nothing.
 */
export function correlate(
  xs: ReadonlyArray<number | null | undefined>,
  ys: ReadonlyArray<number | null | undefined>,
): CorrelationResult {
  const pairs = finitePairs(xs, ys);
  const n = pairs.length;
  const r = pearsonOfPairs(pairs);
  const xRanks = rankWithTies(pairs.map((p) => p[0]));
  const yRanks = rankWithTies(pairs.map((p) => p[1]));
  const rho = pearsonOfPairs(xRanks.map((x, i) => [x, yRanks[i]] as Pair));
  let p: number | null = null;
  if (r !== null && n > 2) {
    if (Math.abs(r) >= 1) {
      p = 0;
    } else {
      const t = r * Math.sqrt((n - 2) / (1 - r * r));
      const computed = studentTTwoSidedP(t, n - 2);
      p = Number.isFinite(computed) ? computed : null;
    }
  }
  return { n, r, rho, p };
}

/**
 * Pair `xs[i]` with `ys[i + lag]` — i.e. "x today, y `lag` days later" — then
 * correlate. lag 0 is same-day; a negative lag looks backwards.
 */
export function laggedCorrelation(
  xs: ReadonlyArray<number | null | undefined>,
  ys: ReadonlyArray<number | null | undefined>,
  lag: number,
): CorrelationResult {
  const shiftedX: Array<number | null | undefined> = [];
  const shiftedY: Array<number | null | undefined> = [];
  for (let i = 0; i < xs.length; i++) {
    const j = i + lag;
    if (j < 0 || j >= ys.length) continue;
    shiftedX.push(xs[i]);
    shiftedY.push(ys[j]);
  }
  return correlate(shiftedX, shiftedY);
}

export type LagPoint = CorrelationResult & { lag: number };

/** The full lag profile 0…maxLag, so a claimed spike can be read in context. */
export function lagProfile(
  xs: ReadonlyArray<number | null | undefined>,
  ys: ReadonlyArray<number | null | undefined>,
  maxLag: number,
  minLag = 0,
): LagPoint[] {
  const out: LagPoint[] = [];
  for (let lag = minLag; lag <= maxLag; lag++) {
    out.push({ lag, ...laggedCorrelation(xs, ys, lag) });
  }
  return out;
}

export type CorrelationStrength = 'insufficient' | 'none' | 'weak' | 'moderate' | 'strong';

/**
 * Bucket a correlation for display. Significance gates strength on purpose: an
 * r of 0.5 over 12 days (p ≈ 0.1) is not a "moderate relationship", it is a
 * coin flip that landed heads, and labeling it otherwise is how a dashboard
 * talks its owner into a bad decision.
 */
export function classifyCorrelation(result: CorrelationResult, alpha = 0.05): CorrelationStrength {
  if (result.n < MIN_CORRELATION_N || result.r === null) return 'insufficient';
  if (result.p === null || result.p > alpha) return 'none';
  const magnitude = Math.abs(result.r);
  if (magnitude >= 0.6) return 'strong';
  if (magnitude >= 0.35) return 'moderate';
  return 'weak';
}

// ---------------------------------------------------------------------------
// Day-of-week seasonality
// ---------------------------------------------------------------------------

/** 0=Mon … 6=Sun for a 'YYYY-MM-DD' key, or null when it isn't a real date. */
export function weekdayIndex(day: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  return (dt.getUTCDay() + 6) % 7;
}

export type WeekdayBucket = {
  weekday: number;
  label: string;
  /** How many of that weekday carried a value — the averaging denominator. */
  days: number;
  total: number;
  mean: number;
  /** Sample standard deviation within the weekday (0 when days < 2). */
  sd: number;
  /** Standard error of the mean, for the error bars. */
  stderr: number;
};

export type AnovaResult = {
  f: number | null;
  dfBetween: number;
  dfWithin: number;
  p: number | null;
};

/** One-way ANOVA across k groups. Null f/p when the design is degenerate. */
export function anova(groups: ReadonlyArray<ReadonlyArray<number>>): AnovaResult {
  const nonEmpty = groups.filter((g) => g.length > 0);
  const k = nonEmpty.length;
  const n = nonEmpty.reduce((sum, g) => sum + g.length, 0);
  const dfBetween = k - 1;
  const dfWithin = n - k;
  if (k < 2 || dfWithin <= 0) return { f: null, dfBetween: Math.max(0, dfBetween), dfWithin: Math.max(0, dfWithin), p: null };
  const grandMean = nonEmpty.reduce((sum, g) => sum + g.reduce((s, v) => s + v, 0), 0) / n;
  let ssBetween = 0;
  let ssWithin = 0;
  for (const g of nonEmpty) {
    const mean = g.reduce((s, v) => s + v, 0) / g.length;
    ssBetween += g.length * (mean - grandMean) ** 2;
    for (const v of g) ssWithin += (v - mean) ** 2;
  }
  // Every observation identical: no variance to partition, so "do the weekdays
  // differ" has no answer rather than the answer "no".
  if (ssWithin <= 0) return { f: null, dfBetween, dfWithin, p: null };
  const f = ssBetween / dfBetween / (ssWithin / dfWithin);
  const p = fDistributionUpperP(f, dfBetween, dfWithin);
  return { f, dfBetween, dfWithin, p: Number.isFinite(p) ? p : null };
}

export type WeekdayAnalysis = {
  buckets: WeekdayBucket[];
  anova: AnovaResult;
  /** Highest- and lowest-mean weekday, for the one-line summary. */
  peak: WeekdayBucket | null;
  trough: WeekdayBucket | null;
};

/**
 * Fold a daily series onto the seven weekdays and test whether the weekday
 * means actually differ. Averaging (rather than totaling) matters because a
 * window rarely holds each weekday the same number of times.
 */
export function weekdayAnalysis(
  points: ReadonlyArray<{ day: string; value: number | null | undefined }>,
): WeekdayAnalysis {
  const groups: number[][] = WEEKDAY_LABELS.map(() => []);
  for (const point of points) {
    const wd = weekdayIndex(point.day);
    if (wd === null) continue;
    const v = point.value;
    if (typeof v !== 'number' || !Number.isFinite(v)) continue;
    groups[wd].push(v);
  }
  const buckets: WeekdayBucket[] = groups.map((values, weekday) => {
    const days = values.length;
    const total = values.reduce((s, v) => s + v, 0);
    const mean = days > 0 ? total / days : 0;
    let sd = 0;
    if (days > 1) {
      const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / (days - 1);
      sd = Math.sqrt(variance);
    }
    return {
      weekday,
      label: WEEKDAY_LABELS[weekday],
      days,
      total,
      mean,
      sd,
      stderr: days > 1 ? sd / Math.sqrt(days) : 0,
    };
  });
  const populated = buckets.filter((b) => b.days > 0);
  let peak: WeekdayBucket | null = null;
  let trough: WeekdayBucket | null = null;
  for (const b of populated) {
    if (!peak || b.mean > peak.mean) peak = b;
    if (!trough || b.mean < trough.mean) trough = b;
  }
  return { buckets, anova: anova(groups), peak, trough };
}

// ---------------------------------------------------------------------------
// Smoothing
// ---------------------------------------------------------------------------

/**
 * Trailing mean over `window` days, null until the window is full. This is the
 * direct answer to "is the day-to-day swing real or is it a rolling 24-hour
 * measurement bouncing around" — plot the raw series against its 7-day mean and
 * the volatility separates from the trend by eye. Missing days are skipped, not
 * zero-filled, so a gap widens the window rather than dragging the mean down.
 */
export function rollingMean(
  values: ReadonlyArray<number | null | undefined>,
  window: number,
): Array<number | null> {
  if (window < 1) return values.map(() => null);
  const out: Array<number | null> = [];
  for (let i = 0; i < values.length; i++) {
    if (i + 1 < window) {
      out.push(null);
      continue;
    }
    let sum = 0;
    let count = 0;
    for (let j = i - window + 1; j <= i; j++) {
      const v = values[j];
      if (typeof v === 'number' && Number.isFinite(v)) {
        sum += v;
        count += 1;
      }
    }
    out.push(count > 0 ? sum / count : null);
  }
  return out;
}

/** Coefficient of variation (sd / mean) — a scale-free "how noisy is this". */
export function coefficientOfVariation(values: ReadonlyArray<number | null | undefined>): number | null {
  const nums = values.filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  if (nums.length < 2) return null;
  const mean = nums.reduce((s, v) => s + v, 0) / nums.length;
  if (mean === 0) return null;
  const variance = nums.reduce((s, v) => s + (v - mean) ** 2, 0) / (nums.length - 1);
  return Math.sqrt(variance) / Math.abs(mean);
}
