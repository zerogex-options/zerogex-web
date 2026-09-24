// The published track record: what may be claimed, and in what words.
//
// The numbers themselves already exist. /api/forecast/stats/rolling returns
// rolling coverage and calibration with 95% Wilson intervals and baselines,
// and app/forecast/[symbol]/[date] has rendered them for some time. What was
// missing is a single URL that IS the record, and the one-line version of it
// on the pages that actually carry traffic. This module owns the rules both
// of those obey, so a headline on /spx-gamma-levels can never say something
// the receipt page would contradict.
//
// PURE. No network, no DB, no server-only, no '@/' alias — stats are handed
// in. Unit-tested in tests/trackRecord.test.ts.

import { wilsonInterval } from './wilson.ts';

/** Mirror of the /api/forecast/stats/rolling payload. */
export type RollingStats = {
  symbol: string;
  window: number;
  n_scored: number;
  range_respected_rate: number | null;
  range_respected_ci: [number, number] | null;
  range_baseline: number | null;
  vol_state_correct_rate: number | null;
  vol_state_correct_ci: [number, number] | null;
  vol_baseline: number | null;
  vol_baseline_label: string | null;
  vol_stats_from: string | null;
  vol_n_scored: number;
  levels_brier_avg: number | null;
  levels_n_scored: number;
};

/**
 * Graded receipts required before a rate may be shown as a rate.
 *
 * Matches MIN_SCORED_FOR_RATES in app/forecast/[symbol]/[date] deliberately:
 * two surfaces disagreeing about when a number is trustworthy is worse than
 * either threshold. At n=1 a claim can only read 0% or 100%, and a page that
 * prints "100%" off one session has told the reader everything they need to
 * know about how much to trust the rest of it.
 */
export const MIN_SCORED_FOR_RATES = 5;

/**
 * How far realized coverage may sit from its target and still be "on target".
 *
 * Wide on purpose. Over thirty sessions the standard error on a rate near 0.85
 * is roughly six points, so a tighter band would flip the verdict on noise
 * alone and make the page look like it was chasing its own tail week to week.
 */
export const COVERAGE_TOLERANCE = 0.06;

/**
 * Whether a COVERAGE claim landed where it said it would.
 *
 * THREE STATES, NOT TWO, and this is the whole reason this module exists.
 * Coverage is not accuracy. A band advertised to contain the day 80-90% of
 * the time SHOULD contain it that often — no more. Realized coverage well
 * ABOVE the target is not a better result; it means the band is wider than
 * advertised and therefore carries less information. Reporting that as "98%
 * accurate" would be the single fastest way to lose the reader this page
 * exists to persuade, because the sophisticated ones will spot it immediately
 * and the rest will be misled.
 *
 * So: below target is a miss, at target is the goal, above target is stated
 * plainly as a wider-than-needed band rather than dressed up as a win.
 */
export type CoverageVerdict = 'under' | 'on-target' | 'over' | 'unknown';

export function coverageVerdict(
  rate: number | null | undefined,
  baseline: number | null | undefined,
  tolerance: number = COVERAGE_TOLERANCE,
): CoverageVerdict {
  if (rate == null || baseline == null || !Number.isFinite(rate) || !Number.isFinite(baseline)) {
    return 'unknown';
  }
  if (rate < baseline - tolerance) return 'under';
  if (rate > baseline + tolerance) return 'over';
  return 'on-target';
}

/** One plain sentence for each verdict. Never congratulatory. */
export function coverageVerdictText(verdict: CoverageVerdict): string {
  switch (verdict) {
    case 'on-target':
      return 'on target\u00a0- the band is containing the day about as often as it claims to';
    case 'over':
      return 'above target\u00a0- the band is holding more often than advertised, which means it is currently wider than it needs to be';
    case 'under':
      return 'below target\u00a0- the band is too narrow on this sample and is missing more days than it should';
    default:
      return 'no target published for this symbol yet';
  }
}

/**
 * "a" or "an" before a spoken percentage.
 *
 * Read aloud, 80% is "eighty" and 8% is "eight" — both take "an", as do 11
 * and 18. Everything else takes "a". Small, but the target figure appears in
 * every headline on every high-traffic page, so "a 80% target" would be the
 * first thing a reader notices about a page whose entire job is looking
 * rigorous.
 */
export function articleForPercent(value: number): string {
  const n = Math.round(value * 100);
  const s = String(n);
  if (n === 11 || n === 18) return 'an';
  if (s.startsWith('8') && n !== 8_000) return 'an';
  return 'a';
}

/** 0.9014 -> "90%". Rounded to whole points: a decimal implies precision n cannot support. */
export function fmtRate(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return `${Math.round(value * 100)}%`;
}

/** [0.74, 0.98] -> "74-98%". */
export function fmtCi(ci: readonly [number, number] | null | undefined): string {
  if (!ci || ci.length !== 2 || !ci.every((v) => Number.isFinite(v))) return '—';
  return `${Math.round(ci[0] * 100)}-${Math.round(ci[1] * 100)}%`;
}

/**
 * Brier reads backwards to most people — lower is better — so it never ships
 * as a bare number. 0.25 is the reference point: that is what you score by
 * guessing the base rate every time, so anything at or above it is no better
 * than a coin flip and is said so in those words.
 */
export const BRIER_COIN_FLIP = 0.25;

export type BrierVerdict = 'better-than-coin-flip' | 'coin-flip' | 'worse-than-coin-flip' | 'unknown';

export function brierVerdict(value: number | null | undefined): BrierVerdict {
  if (value == null || !Number.isFinite(value)) return 'unknown';
  if (value < BRIER_COIN_FLIP - 0.01) return 'better-than-coin-flip';
  if (value > BRIER_COIN_FLIP + 0.01) return 'worse-than-coin-flip';
  return 'coin-flip';
}

export function brierVerdictText(verdict: BrierVerdict): string {
  switch (verdict) {
    case 'better-than-coin-flip':
      return 'better calibrated than guessing';
    case 'coin-flip':
      return 'no better than guessing';
    case 'worse-than-coin-flip':
      return 'worse than guessing\u00a0- the odds are miscalibrated on this sample';
    default:
      return 'not enough graded levels yet';
  }
}

// ── What the high-traffic pages are allowed to say ──────────────────────────

/**
 * The compact form, for a levels page or the daily email.
 *
 * READS THE FULL RECORD, not the rolling window. This module exists so "a
 * headline on /spx-gamma-levels can never say something the receipt page
 * would contradict", and once /track-record started publishing 48 of 55, a
 * one-liner sourced from the rolling window would have said 29 of 29 on the
 * six highest-traffic pages on the site. Same claim, two numbers, the bigger
 * one on the pages that actually get read.
 *
 * `stats` is optional and supplies the one thing the dated archive cannot:
 * the Brier score on the touch odds. A caller with no rolling payload still
 * gets a true sentence.
 *
 * Leads with the PRACTICE, not a percentage. Two reasons: a one-liner has no
 * room for a confidence interval, so a bare rate would be the least defensible
 * thing on the page; and committing to a dated forecast every morning and
 * grading it the same afternoon is the differentiator, which a bad month
 * cannot take away.
 */
export function trackRecordOneLiner(
  history: HistorySummary | null | undefined,
  symbol: string,
  stats?: RollingStats | null,
): string {
  const lead = `We commit to a ${symbol} forecast before every open and grade it against the close.`;

  // Brier leads when it is genuinely good: it is a calibration measure with a
  // fixed reference point, so a good one is unambiguously good. Coverage has
  // no such property -- above target means the band is too wide -- so it is
  // never the line we lead with while something better is available.
  if (
    stats
    && brierVerdict(stats.levels_brier_avg) === 'better-than-coin-flip'
    && stats.levels_n_scored >= MIN_SCORED_FOR_RATES
  ) {
    return `${lead} Touch odds score ${stats.levels_brier_avg!.toFixed(2)} on Brier across ${stats.levels_n_scored} graded sessions\u00a0- 0.25 is a coin flip.`;
  }

  const range = history?.range;
  if (range && range.graded >= MIN_SCORED_FOR_RATES) {
    return `${lead} The range has held ${range.held} of ${range.graded} graded sessions, misses published.`;
  }

  return `${lead} Every receipt is published.`;
}

/**
 * The volatility call against its own baseline.
 *
 * Separate from coverageVerdict because the comparison is the opposite shape.
 * Coverage has a TARGET and beating it is a fault — the band is too wide.
 * The vol call has a BASELINE, the score you get by answering "normal" every
 * single day without looking at anything, and beating it is the entire point.
 * Failing to beat it means the call is adding nothing.
 *
 * On the record as of 2026-09-22 the SPX vol call sat at 59% against a 69%
 * baseline: worse than not making the call at all. That number is on the page
 * with those words next to it. A page that grades itself and then declines to
 * say which claim is losing is not grading itself.
 */
export type VolVerdict = 'beats-baseline' | 'matches-baseline' | 'below-baseline' | 'unknown';

export function volVerdict(
  rate: number | null | undefined,
  baseline: number | null | undefined,
  tolerance: number = 0.02,
): VolVerdict {
  if (rate == null || baseline == null || !Number.isFinite(rate) || !Number.isFinite(baseline)) {
    return 'unknown';
  }
  if (rate > baseline + tolerance) return 'beats-baseline';
  if (rate < baseline - tolerance) return 'below-baseline';
  return 'matches-baseline';
}

export function volVerdictText(verdict: VolVerdict, baselineLabel?: string | null): string {
  const naive = baselineLabel ? `answering "${baselineLabel}" every day` : 'answering the same thing every day';
  switch (verdict) {
    case 'beats-baseline':
      return `better than ${naive}`;
    case 'matches-baseline':
      return `no better than ${naive}\u00a0- on this sample the call is not adding anything`;
    case 'below-baseline':
      return `WORSE than ${naive}. On this sample the volatility call is subtracting value, and we would rather say that than leave you to notice it`;
    default:
      return 'no baseline published yet';
  }
}

// ── The full record, not the recent window ─────────────────────────────────
//
// Everything above reads /api/forecast/stats/rolling, which is a WINDOW. On
// 2026-09-22 that window reported SPX range coverage of 29 for 29 while the
// full 55-session history held 48 — seven misses, the most recent on Aug 4.
//
// Those are not in conflict. If every session in the rolling window held, and
// every miss in the record is on or before Aug 4, then the window necessarily
// begins after Aug 4. Nobody chose that; it is what a rolling window does.
//
// But it means the 100% is an artifact of where the window happens to start,
// and it starts about a week past the two worst sessions ever recorded. A
// credibility page led by that number is one archive lookup away from looking
// like it buried them — and the archive is published, by us, at /forecast.
//
// So the published headline is computed from the WHOLE record. The rolling
// stats stay, because the backend's Wilson intervals, baselines and Brier are
// genuinely useful, but they are labelled as recent form and never as the
// record.


/**
 * The deepest `limit` /api/forecast/available-dates will accept.
 *
 * NOT a preference — a hard server-side validation bound. Asking for more is
 * rejected outright:
 *
 *   HTTP 422 — {"type":"less_than_equal","loc":["query","limit"],
 *               "msg":"Input should be less than or equal to 365","ctx":{"le":365}}
 *
 * This shipped as a hand-written 400 in four separate call sites, so every
 * track-record fetch on the site returned null and every surface silently fell
 * back to its no-numbers copy. Nothing broke loudly: serverApiGet returns null
 * on a non-2xx, summarizeForecastHistory turns null into an empty record, and
 * the copy for "too few graded sessions" is indistinguishable from the copy for
 * "the request was malformed". Hence one exported constant, and
 * tests/trackRecord asserting it stays inside the bound.
 */
export const FORECAST_HISTORY_LIMIT = 365;

/** One row of the /api/forecast/available-dates payload. */
export type ForecastDateEntry = {
  date: string;
  has_receipt: boolean;
  range_respected: boolean | null;
  vol_state_correct?: boolean | null;
  expected_vol_state?: string | null;
  regime?: string | null;
};

export type ClaimHistory = {
  /** Sessions where this claim was actually graded. */
  graded: number;
  held: number;
  rate: number | null;
  ci: readonly [number, number] | null;
  /** Dates this claim missed, newest first. Published as evidence, not hidden. */
  misses: string[];
};

export type HistorySummary = {
  symbol: string;
  /** Sessions carrying a receipt, graded or not. */
  sessions: number;
  first: string | null;
  last: string | null;
  range: ClaimHistory;
  /**
   * Runs of two or more misses on BACK-TO-BACK graded sessions, newest first.
   *
   * This is the single most important number on the page and the reason the
   * band is not simply being narrowed. Five of the seven SPX misses fell in
   * two consecutive-session runs (Jul 6-7-8 and Aug 3-4), which means the
   * failures are volatility events rather than independent trials. A Wilson
   * interval assumes independence, so clustering makes the published interval
   * narrower than the truth — and saying so is the difference between a
   * statistics page and a marketing page.
   */
  clusters: string[][];
  /** Misses that belong to some cluster. */
  clustered: number;
};

function summarizeClaim(
  graded: ForecastDateEntry[],
  pick: (e: ForecastDateEntry) => boolean | null | undefined,
): ClaimHistory {
  const scored = graded.filter((e) => pick(e) != null);
  const held = scored.filter((e) => pick(e) === true).length;
  const ci = wilsonInterval(held, scored.length);
  return {
    graded: scored.length,
    held,
    rate: scored.length > 0 ? held / scored.length : null,
    ci: ci ? ([ci.low, ci.high] as const) : null,
    misses: scored
      .filter((e) => pick(e) === false)
      .map((e) => e.date)
      .sort((a, b) => b.localeCompare(a)),
  };
}

/**
 * Consecutive-session miss runs.
 *
 * Adjacency is measured in GRADED SESSIONS, not calendar days, so this needs
 * no trading calendar and cannot be fooled by a holiday or a day the writer
 * skipped: two misses are adjacent when nothing graded sits between them.
 */
export function missClusters(entries: readonly ForecastDateEntry[]): string[][] {
  const scored = entries
    .filter((e) => e.has_receipt && e.range_respected != null)
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date));

  const runs: string[][] = [];
  let current: string[] = [];
  for (const e of scored) {
    if (e.range_respected === false) {
      current.push(e.date);
    } else {
      if (current.length > 1) runs.push(current);
      current = [];
    }
  }
  if (current.length > 1) runs.push(current);
  return runs.reverse();
}

/** The whole published record for one symbol, from the dated archive. */
export function summarizeForecastHistory(
  entries: readonly ForecastDateEntry[] | null | undefined,
  symbol: string,
): HistorySummary {
  const all = (entries ?? []).filter((e) => typeof e?.date === 'string');
  const graded = all.filter((e) => e.has_receipt);
  const dates = graded.map((e) => e.date).sort((a, b) => a.localeCompare(b));
  const clusters = missClusters(all);

  return {
    symbol,
    sessions: graded.length,
    first: dates[0] ?? null,
    last: dates[dates.length - 1] ?? null,
    range: summarizeClaim(graded, (e) => e.range_respected),
    clusters,
    clustered: clusters.reduce((n, run) => n + run.length, 0),
  };
}

/**
 * The headline sentence, computed from the whole record.
 *
 * Says the rate, says the denominator, and when coverage sits above target
 * says that too — in the same breath, not in a footnote. A reader who works
 * out for themselves that 87% against an 80% target means a padded band
 * trusts nothing else on the page; a reader told up front trusts the rest
 * of it more.
 */
export function historyHeadline(
  summary: HistorySummary,
  target: number | null | undefined,
): string | null {
  const { graded, held, rate } = summary.range;
  if (graded < MIN_SCORED_FOR_RATES || rate == null) return null;

  const base = `The ${summary.symbol} projected range has contained the day in ${held} of ${graded} graded sessions (${fmtRate(rate)})`;
  if (target == null || !Number.isFinite(target)) return `${base}.`;

  const verdict = coverageVerdict(rate, target);
  const against = ` against ${articleForPercent(target)} ${fmtRate(target)} target`;
  if (verdict === 'over') {
    return `${base}${against}\u00a0- which means the band is currently wider than it needs to be, not that the forecast is better than advertised.`;
  }
  if (verdict === 'under') {
    return `${base}${against}\u00a0- below where it should be, so the band is running too narrow on this record.`;
  }
  return `${base}${against}.`;
}

/**
 * The independence caveat, or null when the misses really are scattered.
 *
 * Volunteered because it cuts AGAINST the page: it says the published
 * interval is too confident. That is exactly why it belongs here.
 */
export function clusteringNote(summary: HistorySummary): string | null {
  if (summary.clusters.length === 0 || summary.range.misses.length < 2) return null;
  const runs = summary.clusters.length;
  const inRuns = summary.clustered;
  const total = summary.range.misses.length;
  return (
    `${inRuns} of those ${total} misses fell in ${runs === 1 ? 'a single run' : `${runs} runs`} of `
    + `back-to-back sessions, so they are volatility events rather than independent days. `
    + `Confidence intervals assume independence, which makes the ones below narrower than the truth.`
  );
}
