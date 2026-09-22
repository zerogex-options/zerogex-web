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
  coverageVerdict,
  coverageVerdictText,
  fmtCi,
  fmtRate,
  trackRecordHeadline,
  trackRecordOneLiner,
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

// ── The headline ────────────────────────────────────────────────────────────

test('on the live data the headline leads with Brier, not with 100% coverage', () => {
  const h = trackRecordHeadline(LIVE, 'SPX');
  assert.equal(h.hasNumbers, true);
  assert.ok(h.numbers!.startsWith('Touch odds'), `led with: ${h.numbers}`);
  assert.match(h.numbers!, /0\.14 on Brier over 29/);
  assert.match(h.numbers!, /0\.25 is a coin flip/);
});

test('the padded band is volunteered in the headline, not omitted', () => {
  // A reader who works this out for themselves trusts nothing else on the
  // page. A reader told up front trusts everything else more.
  const h = trackRecordHeadline(LIVE, 'SPX');
  assert.match(h.numbers!, /29 of 29 against an 80% target/);
  assert.match(h.numbers!, /wider than it needs to be/);
});

test('the headline never claims an accuracy figure off a coverage rate', () => {
  const h = trackRecordHeadline(LIVE, 'SPX');
  for (const banned of [/100% accurate/i, /perfect/i, /never missed/i, /flawless/i]) {
    assert.ok(!banned.test(h.numbers!), `headline must not say ${banned}`);
  }
});

test('coverage leads when it is actually on target', () => {
  const h = trackRecordHeadline(withStats({ range_respected_rate: 0.82, levels_brier_avg: 0.3 }), 'SPX');
  assert.ok(h.numbers!.startsWith('The projected range held'), h.numbers!);
  assert.ok(!h.numbers!.includes('wider than it needs to be'));
});

test('below the minimum sample the numbers are withheld, and the practice still stands', () => {
  const thin = withStats({ n_scored: MIN_SCORED_FOR_RATES - 1 });
  const h = trackRecordHeadline(thin, 'SPX');
  assert.equal(h.hasNumbers, false);
  assert.equal(h.numbers, null);
  // The evergreen claim is the real differentiator and survives a thin sample
  // — and a bad month.
  assert.match(h.practice, /committed before the open, then graded against the close/);
});

test('no stats at all still yields the practice line, never an apology', () => {
  const h = trackRecordHeadline(null, 'QQQ');
  assert.equal(h.hasNumbers, false);
  assert.equal(h.nScored, 0);
  assert.match(h.practice, /^Every morning QQQ/);
});

// ── The one-liner ───────────────────────────────────────────────────────────

test('the one-liner leads with the practice, never with a bare percentage', () => {
  // It has no room for a confidence interval, so a bare rate would be the
  // least defensible sentence on whichever page it lands.
  const line = trackRecordOneLiner(LIVE, 'SPX');
  assert.ok(line.startsWith('We commit to a SPX forecast before every open'), line);
  assert.match(line, /0\.14 on Brier/);
  assert.ok(!line.includes('100%'));
});

test('the one-liner degrades to the practice alone on a thin sample', () => {
  const line = trackRecordOneLiner(withStats({ n_scored: 2 }), 'SPY');
  assert.match(line, /Every receipt is published/);
  assert.ok(!/\d+%/.test(line), 'must not print a rate off two sessions');
});
