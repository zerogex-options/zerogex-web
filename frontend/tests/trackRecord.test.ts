// Unit tests for core/trackRecord.ts — what the published track record is
// allowed to claim.
//
// The central case is the one the live data actually produced: SPX coverage
// of 29/29 against an 80% target. A page that reports that as "100% accurate"
// is not merely overselling, it is WRONG — coverage at 100% against an 80%
// target means the band is wider than advertised, and the sophisticated
// reader this page exists to convince will spot it instantly and discount
// everything else on it. Several tests below exist only to stop that sentence
// ever being generated.

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  BRIER_COIN_FLIP,
  MIN_SCORED_FOR_RATES,
  articleForPercent,
  brierVerdict,
  clusteringNote,
  coverageVerdict,
  coverageVerdictText,
  fmtCi,
  fmtRate,
  historyHeadline,
  missClusters,
  summarizeForecastHistory,
  trackRecordOneLiner,
  volVerdict,
  volVerdictText,
  type ForecastDateEntry,
  type RollingStats,
} from '../core/trackRecord.ts';

/** The exact payload /api/forecast/stats/rolling returned on 2026-09-22. */
const LIVE: RollingStats = {
  symbol: 'SPX', window: 30, n_scored: 29,
  range_respected_rate: 1.0, range_respected_ci: [0.883, 1.0], range_baseline: 0.8,
  vol_state_correct_rate: 0.5862, vol_state_correct_ci: [0.4074, 0.7449],
  vol_baseline: 0.6897, vol_baseline_label: 'compression', vol_stats_from: '2026-08-04',
  vol_n_scored: 29, levels_brier_avg: 0.1431, levels_n_scored: 29,
};

const withStats = (over: Partial<RollingStats>): RollingStats => ({ ...LIVE, ...over });

// ── Coverage is not accuracy ────────────────────────────────────────────────

test('coverage well above its target is reported as over, never as a win', () => {
  // 29/29 against an 80% target. The band is padded, not perfect.
  assert.equal(coverageVerdict(1.0, 0.8), 'over');
  assert.match(coverageVerdictText('over'), /wider than it needs to be/);
  assert.ok(!/accurate|perfect|flawless/i.test(coverageVerdictText('over')));
});

test('coverage near its target is on target, and below it is a miss', () => {
  assert.equal(coverageVerdict(0.82, 0.8), 'on-target');
  assert.equal(coverageVerdict(0.78, 0.8), 'on-target'); // inside tolerance
  assert.equal(coverageVerdict(0.6, 0.8), 'under');
  assert.match(coverageVerdictText('under'), /too narrow/);
});

test('the tolerance is wide enough that one session cannot flip the verdict', () => {
  // ~6pts is about one standard error on a rate near 0.85 over 30 sessions.
  // A tighter band would have the page contradicting itself week to week.
  assert.equal(coverageVerdict(0.85, 0.8), 'on-target');
  assert.equal(coverageVerdict(0.87, 0.8), 'over');
});

test('a missing rate or baseline is unknown, not silently on target', () => {
  assert.equal(coverageVerdict(null, 0.8), 'unknown');
  assert.equal(coverageVerdict(0.9, null), 'unknown');
  assert.equal(coverageVerdict(Number.NaN, 0.8), 'unknown');
});

// ── Brier ───────────────────────────────────────────────────────────────────

test('Brier is judged against the coin-flip reference, not against zero', () => {
  assert.equal(BRIER_COIN_FLIP, 0.25);
  assert.equal(brierVerdict(0.1431), 'better-than-coin-flip'); // the live value
  assert.equal(brierVerdict(0.25), 'coin-flip');
  assert.equal(brierVerdict(0.4), 'worse-than-coin-flip');
  assert.equal(brierVerdict(null), 'unknown');
});

// ── Formatting ──────────────────────────────────────────────────────────────

test('rates round to whole points — a decimal implies precision n cannot support', () => {
  assert.equal(fmtRate(0.9014), '90%');
  assert.equal(fmtRate(1.0), '100%');
  assert.equal(fmtRate(null), '—');
});

test('confidence intervals render as a range', () => {
  assert.equal(fmtCi([0.883, 1.0]), '88-100%');
  assert.equal(fmtCi(null), '—');
});

test('the indefinite article matches how the number is spoken', () => {
  // "a 80% target" is the first thing a reader notices on a page whose whole
  // job is looking rigorous.
  assert.equal(articleForPercent(0.8), 'an');
  assert.equal(articleForPercent(0.85), 'an');
  assert.equal(articleForPercent(0.08), 'an');
  assert.equal(articleForPercent(0.11), 'an');
  assert.equal(articleForPercent(0.18), 'an');
  assert.equal(articleForPercent(0.9), 'a');
  assert.equal(articleForPercent(0.5), 'a');
});

/** The seven SPX sessions that broke the band, per forecast-range-width. */
const SPX_MISSES = [
  '2026-07-06', '2026-07-07', '2026-07-08',
  '2026-07-15', '2026-07-23',
  '2026-08-03', '2026-08-04',
];

/** 55 graded sessions + 1 ungraded, mirroring the production archive. */
function spxArchive(): ForecastDateEntry[] {
  const out: ForecastDateEntry[] = [];
  // Weekday sequence long enough to cover Jul 6 -> Sep 21 without a calendar:
  // the dates only need to be ordered and distinct for adjacency to work.
  const start = Date.UTC(2026, 6, 6); // 2026-07-06
  let made = 0;
  for (let i = 0; made < 55; i++) {
    const d = new Date(start + i * 86400000);
    const dow = d.getUTCDay();
    if (dow === 0 || dow === 6) continue; // skip weekends
    const date = d.toISOString().slice(0, 10);
    out.push({ date, has_receipt: true, range_respected: !SPX_MISSES.includes(date) });
    made++;
  }
  // One date with no receipt yet — the "1 skipped" the script reported.
  out.push({ date: '2026-09-22', has_receipt: false, range_respected: null });
  return out;
}

// ── The one-liner ───────────────────────────────────────────────────────────
//
// It now reads the FULL RECORD. The rolling-window headline it used to share
// a source with is gone: /track-record publishes 48 of 55, and a one-liner
// sourced from the rolling window would have said 29 of 29 on the six
// highest-traffic pages on the site. Two numbers for one claim, the bigger
// one where it gets read. These tests exist to keep that from coming back.

test('the one-liner leads with the practice, never with a bare percentage', () => {
  // It has no room for a confidence interval, so a bare rate would be the
  // least defensible sentence on whichever page it lands.
  const line = trackRecordOneLiner(summarizeForecastHistory(spxArchive(), 'SPX'), 'SPX', LIVE);
  assert.ok(line.startsWith('We commit to a SPX forecast before every open'), line);
  assert.match(line, /0\.14 on Brier/);
});

test('the one-liner NEVER prints the rolling 29 of 29', () => {
  // The whole reason this module exists: a headline on /spx-gamma-levels may
  // not say something /track-record would contradict.
  const line = trackRecordOneLiner(summarizeForecastHistory(spxArchive(), 'SPX'), 'SPX', LIVE);
  assert.ok(!line.includes('100%'), line);
  assert.ok(!line.includes('29 of 29'), line);
});

test('without a Brier score it falls back to the FULL record, not the window', () => {
  const noBrier = withStats({ levels_brier_avg: null, levels_n_scored: 0 });
  const line = trackRecordOneLiner(summarizeForecastHistory(spxArchive(), 'SPX'), 'SPX', noBrier);
  assert.match(line, /48 of 55 graded sessions/);
  // n_scored on the rolling payload is 29 and must not leak in.
  assert.ok(!line.includes('of 29'), line);
});

test('the one-liner works with no rolling payload at all', () => {
  const line = trackRecordOneLiner(summarizeForecastHistory(spxArchive(), 'SPX'), 'SPX');
  assert.match(line, /48 of 55 graded sessions/);
});

test('the one-liner degrades to the practice alone on a thin record', () => {
  const thin = summarizeForecastHistory(
    [{ date: '2026-01-05', has_receipt: true, range_respected: true }],
    'SPY',
  );
  const line = trackRecordOneLiner(thin, 'SPY');
  assert.match(line, /Every receipt is published/);
  assert.ok(!/\d+%/.test(line), 'must not print a rate off one session');
  assert.ok(!/\d+ of \d+/.test(line), 'must not print a fraction off one session');
});

test('the one-liner survives a null record', () => {
  const line = trackRecordOneLiner(null, 'NDX');
  assert.match(line, /^We commit to a NDX forecast/);
  assert.match(line, /Every receipt is published/);
});

// ── The full record, not the rolling window ────────────────────────────────
//
// The fixture below is the REAL production SPX archive as of 2026-09-22, not
// an invented one. Seven misses at the dates the range-width script reported,
// five of them in two back-to-back runs (Jul 6-7-8 and Aug 3-4). If the page
// is going to publish 48 of 55, the arithmetic that produces "48 of 55" is
// worth pinning to the data it came from.



test('summarizeForecastHistory reproduces the published 48 of 55', () => {
  const s = summarizeForecastHistory(spxArchive(), 'SPX');
  assert.equal(s.sessions, 55);
  assert.equal(s.range.graded, 55);
  assert.equal(s.range.held, 48);
  assert.equal(Math.round(s.range.rate! * 1000) / 10, 87.3);
});

test('the ungraded session is counted in neither numerator nor denominator', () => {
  const s = summarizeForecastHistory(spxArchive(), 'SPX');
  assert.equal(s.range.graded, 55, 'the no-receipt date must not inflate the denominator');
  assert.ok(!s.range.misses.includes('2026-09-22'), 'ungraded is not a miss');
});

test('every miss is published, newest first', () => {
  const s = summarizeForecastHistory(spxArchive(), 'SPX');
  assert.equal(s.range.misses.length, 7);
  assert.equal(s.range.misses[0], '2026-08-04');
  assert.deepEqual([...s.range.misses].sort(), [...SPX_MISSES].sort());
});

test('the Wilson interval does not collapse and brackets the rate', () => {
  const s = summarizeForecastHistory(spxArchive(), 'SPX');
  const [low, high] = s.range.ci!;
  assert.ok(low < s.range.rate! && s.range.rate! < high, 'rate must sit inside its interval');
  assert.ok(low > 0.75 && high < 0.95, `interval implausibly wide: ${low}-${high}`);
});

test('clusters find the two consecutive-session runs and nothing else', () => {
  const s = summarizeForecastHistory(spxArchive(), 'SPX');
  assert.equal(s.clusters.length, 2);
  assert.equal(s.clustered, 5, 'five of the seven misses are in a run');
  // Newest run first.
  assert.deepEqual(s.clusters[0], ['2026-08-03', '2026-08-04']);
  assert.deepEqual(s.clusters[1], ['2026-07-06', '2026-07-07', '2026-07-08']);
});

test('an isolated miss is not a cluster', () => {
  const entries: ForecastDateEntry[] = [
    { date: '2026-01-05', has_receipt: true, range_respected: true },
    { date: '2026-01-06', has_receipt: true, range_respected: false },
    { date: '2026-01-07', has_receipt: true, range_respected: true },
  ];
  assert.deepEqual(missClusters(entries), []);
});

test('adjacency is measured in graded sessions, not calendar days', () => {
  // A holiday sits between two misses. They ARE consecutive graded sessions,
  // because nothing graded happened in between.
  const entries: ForecastDateEntry[] = [
    { date: '2026-01-05', has_receipt: true, range_respected: true },
    { date: '2026-01-06', has_receipt: true, range_respected: false },
    { date: '2026-01-07', has_receipt: false, range_respected: null },
    { date: '2026-01-08', has_receipt: true, range_respected: false },
  ];
  assert.deepEqual(missClusters(entries), [['2026-01-06', '2026-01-08']]);
});

test('out-of-order input still finds the run', () => {
  const shuffled = spxArchive().reverse();
  const s = summarizeForecastHistory(shuffled, 'SPX');
  assert.equal(s.clustered, 5);
  assert.deepEqual(s.clusters[0], ['2026-08-03', '2026-08-04']);
});

test('headline states the rate and volunteers that the band is padded', () => {
  const s = summarizeForecastHistory(spxArchive(), 'SPX');
  const line = historyHeadline(s, 0.8)!;
  assert.match(line, /48 of 55/);
  assert.match(line, /87%/);
  assert.match(line, /an 80% target/, 'article must be "an", not "a"');
  assert.match(line, /wider than it needs to be/);
  assert.doesNotMatch(line, /accura|flawless|perfect/i);
});

test('headline says so plainly when coverage runs UNDER target', () => {
  const entries = spxArchive().map((e, i) => ({ ...e, range_respected: e.has_receipt ? i % 3 !== 0 : null }));
  const line = historyHeadline(summarizeForecastHistory(entries, 'SPX'), 0.8)!;
  assert.match(line, /too narrow/);
});

test('headline returns null rather than a rate off too few sessions', () => {
  const thin: ForecastDateEntry[] = [
    { date: '2026-01-05', has_receipt: true, range_respected: true },
    { date: '2026-01-06', has_receipt: true, range_respected: true },
  ];
  assert.equal(historyHeadline(summarizeForecastHistory(thin, 'SPX'), 0.8), null);
});

test('clustering note says the intervals are too confident', () => {
  const note = clusteringNote(summarizeForecastHistory(spxArchive(), 'SPX'))!;
  assert.match(note, /5 of those 7 misses/);
  assert.match(note, /2 runs/);
  assert.match(note, /narrower than the truth/);
});

test('no clustering note when misses are genuinely scattered', () => {
  const entries: ForecastDateEntry[] = [
    { date: '2026-01-05', has_receipt: true, range_respected: false },
    { date: '2026-01-06', has_receipt: true, range_respected: true },
    { date: '2026-01-07', has_receipt: true, range_respected: false },
  ];
  assert.equal(clusteringNote(summarizeForecastHistory(entries, 'SPX')), null);
});

test('an empty archive is survivable, not a crash', () => {
  const s = summarizeForecastHistory([], 'SPX');
  assert.equal(s.sessions, 0);
  assert.equal(s.range.rate, null);
  assert.equal(s.range.ci, null);
  assert.equal(historyHeadline(s, 0.8), null);
  assert.equal(clusteringNote(s), null);
  assert.equal(summarizeForecastHistory(null, 'SPX').sessions, 0);
});

// ── The volatility call against its baseline ───────────────────────────────

test('vol call below its baseline is called out as subtracting value', () => {
  // The real SPX numbers on 2026-09-22: 58.6% against a 69.0% baseline.
  const v = volVerdict(0.5862, 0.6897);
  assert.equal(v, 'below-baseline');
  const text = volVerdictText(v, 'always normal');
  assert.match(text, /WORSE/);
  assert.match(text, /always normal/);
});

test('vol call beating its baseline says so without gloating', () => {
  const text = volVerdictText(volVerdict(0.78, 0.69), 'always normal');
  assert.match(text, /better than/);
  assert.doesNotMatch(text, /WORSE|excellent|outstanding/i);
});

test('a vol call inside the tolerance band is "no better than" the baseline', () => {
  assert.equal(volVerdict(0.70, 0.69), 'matches-baseline');
  assert.match(volVerdictText('matches-baseline', 'always normal'), /not adding anything/);
});

test('vol verdict is unknown rather than wrong when a baseline is missing', () => {
  assert.equal(volVerdict(0.7, null), 'unknown');
  assert.equal(volVerdict(null, 0.7), 'unknown');
  assert.match(volVerdictText('unknown'), /no baseline/);
});
