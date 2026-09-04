import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MIN_CORRELATION_N,
  anova,
  classifyCorrelation,
  etDayKey,
  coefficientOfVariation,
  correlate,
  fDistributionUpperP,
  finitePairs,
  incompleteBeta,
  laggedCorrelation,
  lagProfile,
  rankWithTies,
  rollingMean,
  studentTTwoSidedP,
  weekdayAnalysis,
  weekdayIndex,
} from '../core/dailyMetricsMath.ts';
import {
  detectDelimiter,
  normalizeDayKey,
  parseExternalMetricsCsv,
  parseMetricValue,
  splitCsvLine,
} from '../core/dailyMetricsCsv.ts';

const close = (actual: number | null, expected: number, tolerance = 1e-6) => {
  assert.ok(actual !== null, 'expected a value, got null');
  assert.ok(
    Math.abs((actual as number) - expected) <= tolerance,
    `expected ${actual} to be within ${tolerance} of ${expected}`,
  );
};

// ── Distribution tails ──────────────────────────────────────────────────────

test('incompleteBeta matches known symmetry and endpoints', () => {
  close(incompleteBeta(0.5, 0.5, 0.5), 0.5, 1e-9);
  assert.equal(incompleteBeta(2, 3, 0), 0);
  assert.equal(incompleteBeta(2, 3, 1), 1);
  // I_x(a,b) = 1 - I_{1-x}(b,a)
  close(incompleteBeta(2, 5, 0.3), 1 - incompleteBeta(5, 2, 0.7), 1e-9);
});

test('studentTTwoSidedP reproduces published critical values', () => {
  // t(0.025, 10) = 2.228 → two-sided p = 0.05
  close(studentTTwoSidedP(2.228, 10), 0.05, 1e-3);
  // t(0.025, 30) = 2.042 → two-sided p = 0.05
  close(studentTTwoSidedP(2.042, 30), 0.05, 1e-3);
  assert.equal(studentTTwoSidedP(0, 5), 1);
  // Larger |t| is always less probable.
  assert.ok(studentTTwoSidedP(4, 10) < studentTTwoSidedP(2, 10));
});

test('fDistributionUpperP is 0.5 at the F(1,1) median and shrinks with f', () => {
  close(fDistributionUpperP(1, 1, 1), 0.5, 1e-9);
  assert.ok(fDistributionUpperP(10, 3, 20) < fDistributionUpperP(2, 3, 20));
  assert.equal(fDistributionUpperP(0, 3, 20), 1);
});

// ── Correlation ─────────────────────────────────────────────────────────────

test('finitePairs drops any day where either side is missing', () => {
  const pairs = finitePairs([1, null, 3, 4, undefined], [5, 6, null, 8, 9]);
  assert.deepEqual(pairs, [
    [1, 5],
    [4, 8],
  ]);
});

test('correlate finds perfect linear relationships in both directions', () => {
  close(correlate([1, 2, 3, 4, 5], [2, 4, 6, 8, 10]).r, 1);
  close(correlate([1, 2, 3, 4, 5], [5, 4, 3, 2, 1]).r, -1);
});

test('correlate reproduces a hand-computed r and its two-sided p', () => {
  const result = correlate([1, 2, 3, 4, 5], [2, 1, 4, 3, 5]);
  assert.equal(result.n, 5);
  close(result.r, 0.8, 1e-9);
  // r=0.8, n=5 → t = 2.3094 on 3 df, which sits just above the 10% level.
  assert.ok(result.p !== null && result.p > 0.09 && result.p < 0.12, `p was ${result.p}`);
});

test('correlate returns null r for a flat series rather than pretending to zero', () => {
  const result = correlate([0, 0, 0, 0, 0], [1, 2, 3, 4, 5]);
  assert.equal(result.r, null);
  assert.equal(result.p, null);
  assert.equal(result.n, 5);
});

test('correlate counts only the days both series cover', () => {
  const result = correlate([1, 2, null, 4], [1, 2, 3, null]);
  assert.equal(result.n, 2);
});

test('rankWithTies midranks tied values', () => {
  assert.deepEqual(rankWithTies([10, 20, 20, 30]), [1, 2.5, 2.5, 4]);
  assert.deepEqual(rankWithTies([5, 5, 5]), [2, 2, 2]);
});

test('Spearman catches a monotone curve that Pearson understates', () => {
  const result = correlate([1, 2, 3, 4, 5], [1, 4, 9, 16, 25]);
  close(result.rho, 1, 1e-9);
  assert.ok(result.r !== null && result.r < 1);
});

test('laggedCorrelation aligns driver day D with outcome day D+lag', () => {
  // The outcome is the driver pushed forward three days; only lag 3 is perfect.
  const driver = [5, 1, 9, 2, 7, 3, 8, 4];
  const outcome = [0, 0, 0, 5, 1, 9, 2, 7];
  close(laggedCorrelation(driver, outcome, 3).r, 1, 1e-9);
  const sameDay = laggedCorrelation(driver, outcome, 0);
  assert.ok(sameDay.r === null || Math.abs(sameDay.r) < 0.9);
});

test('laggedCorrelation shortens n by the lag', () => {
  const xs = [1, 2, 3, 4, 5, 6];
  const ys = [1, 2, 3, 4, 5, 6];
  assert.equal(laggedCorrelation(xs, ys, 0).n, 6);
  assert.equal(laggedCorrelation(xs, ys, 2).n, 4);
  assert.equal(laggedCorrelation(xs, ys, 99).n, 0);
});

test('lagProfile covers the requested inclusive range', () => {
  const profile = lagProfile([1, 2, 3, 4, 5], [1, 2, 3, 4, 5], 3);
  assert.deepEqual(profile.map((p) => p.lag), [0, 1, 2, 3]);
});

test('classifyCorrelation refuses to grade a short or insignificant sample', () => {
  assert.equal(classifyCorrelation({ n: 4, r: 0.95, rho: 0.95, p: 0.04 }), 'insufficient');
  assert.equal(classifyCorrelation({ n: MIN_CORRELATION_N, r: 0.5, rho: 0.5, p: 0.4 }), 'none');
  assert.equal(classifyCorrelation({ n: 40, r: 0.2, rho: 0.2, p: 0.01 }), 'weak');
  assert.equal(classifyCorrelation({ n: 40, r: 0.45, rho: 0.45, p: 0.01 }), 'moderate');
  assert.equal(classifyCorrelation({ n: 40, r: -0.8, rho: -0.8, p: 0.001 }), 'strong');
});

// ── Weekday seasonality ─────────────────────────────────────────────────────

test('weekdayIndex maps to Mon=0 … Sun=6 and rejects non-dates', () => {
  assert.equal(weekdayIndex('2026-09-07'), 0); // a Monday
  assert.equal(weekdayIndex('2026-09-13'), 6); // the following Sunday
  assert.equal(weekdayIndex('2026-02-30'), null);
  assert.equal(weekdayIndex('not-a-day'), null);
});

test('anova reproduces a hand-computed F', () => {
  const result = anova([
    [1, 2, 3],
    [4, 5, 6],
  ]);
  close(result.f, 13.5, 1e-9);
  assert.equal(result.dfBetween, 1);
  assert.equal(result.dfWithin, 4);
  assert.ok(result.p !== null && result.p < 0.05);
});

test('anova declines to answer when nothing varies', () => {
  const result = anova([
    [2, 2],
    [2, 2],
  ]);
  assert.equal(result.f, null);
  assert.equal(result.p, null);
});

test('weekdayAnalysis averages per weekday and names the peak and trough', () => {
  // Two consecutive weeks; Mondays are 10, Fridays are 0, everything else 5.
  const days = [
    '2026-09-07', '2026-09-08', '2026-09-09', '2026-09-10', '2026-09-11', '2026-09-12', '2026-09-13',
    '2026-09-14', '2026-09-15', '2026-09-16', '2026-09-17', '2026-09-18', '2026-09-19', '2026-09-20',
  ];
  const points = days.map((day) => {
    const wd = weekdayIndex(day);
    return { day, value: wd === 0 ? 10 : wd === 4 ? 0 : 5 };
  });
  const analysis = weekdayAnalysis(points);
  assert.equal(analysis.buckets.length, 7);
  assert.equal(analysis.buckets[0].label, 'Mon');
  close(analysis.buckets[0].mean, 10);
  assert.equal(analysis.buckets[0].days, 2);
  close(analysis.buckets[4].mean, 0);
  assert.equal(analysis.peak?.label, 'Mon');
  assert.equal(analysis.trough?.label, 'Fri');
  // No within-weekday variance at all, so the F test has nothing to divide by.
  assert.equal(analysis.anova.f, null);
});

test('weekdayAnalysis skips unparseable days and missing values', () => {
  const analysis = weekdayAnalysis([
    { day: '2026-09-07', value: 3 },
    { day: 'garbage', value: 99 },
    { day: '2026-09-14', value: null },
  ]);
  assert.equal(analysis.buckets[0].days, 1);
  assert.equal(analysis.buckets[0].total, 3);
});

// ── Smoothing ───────────────────────────────────────────────────────────────

test('rollingMean is null until the window fills, then trails', () => {
  assert.deepEqual(rollingMean([1, 2, 3, 4], 2), [null, 1.5, 2.5, 3.5]);
  assert.deepEqual(rollingMean([1, 2, 3], 1), [1, 2, 3]);
});

test('rollingMean skips gaps instead of counting them as zero', () => {
  const smoothed = rollingMean([4, null, 4], 3);
  assert.equal(smoothed[0], null);
  assert.equal(smoothed[1], null);
  close(smoothed[2], 4);
});

test('coefficientOfVariation shrinks once a spiky series is smoothed', () => {
  const spiky = [0, 0, 20, 0, 0, 20, 0, 0, 20, 0, 0, 20];
  const raw = coefficientOfVariation(spiky);
  const smoothed = coefficientOfVariation(rollingMean(spiky, 3));
  assert.ok(raw !== null && smoothed !== null);
  assert.ok((smoothed as number) < (raw as number));
  assert.equal(coefficientOfVariation([0, 0, 0]), null);
});

// ── CSV import ──────────────────────────────────────────────────────────────

test('splitCsvLine honors quoted fields and doubled quotes', () => {
  assert.deepEqual(splitCsvLine('a,b,c', ','), ['a', 'b', 'c']);
  assert.deepEqual(splitCsvLine('2026-08-01,"1,234",5', ','), ['2026-08-01', '1,234', '5']);
  assert.deepEqual(splitCsvLine('"say ""hi""",2', ','), ['say "hi"', '2']);
  assert.deepEqual(splitCsvLine('a\tb', '\t'), ['a', 'b']);
});

test('detectDelimiter prefers whichever separator the header actually uses', () => {
  assert.equal(detectDelimiter('Date,Clicks,Impressions'), ',');
  assert.equal(detectDelimiter('Date\tClicks\tImpressions'), '\t');
});

test('normalizeDayKey accepts ISO and US dates and rejects anything else', () => {
  assert.equal(normalizeDayKey('2026-08-01'), '2026-08-01');
  assert.equal(normalizeDayKey('2026-08-01T00:00:00Z'), '2026-08-01');
  assert.equal(normalizeDayKey('8/1/2026'), '2026-08-01');
  assert.equal(normalizeDayKey('2026-02-30'), null);
  assert.equal(normalizeDayKey('1 August 2026'), null);
  assert.equal(normalizeDayKey(''), null);
});

test('parseMetricValue strips separators and distinguishes blank from zero', () => {
  assert.equal(parseMetricValue('1,234'), 1234);
  assert.equal(parseMetricValue('3.53%'), 4); // rounded; only used for whole counts
  assert.equal(parseMetricValue('0'), 0);
  assert.equal(parseMetricValue(''), undefined);
  assert.equal(parseMetricValue('—'), undefined);
  assert.equal(parseMetricValue('abc'), null);
  assert.equal(parseMetricValue('-5'), null);
});

test('parseExternalMetricsCsv reads an X account-overview export', () => {
  const csv = [
    'Date,impressions,likes,engagements,replies,reposts,profile visits,media views',
    '2026-08-01,"12,430",31,405,4,7,188,900',
    '2026-08-02,9010,12,210,1,2,96,410',
  ].join('\n');
  const result = parseExternalMetricsCsv(csv, 'x');
  assert.deepEqual(result.errors, []);
  assert.equal(result.rows.length, 2);
  assert.deepEqual(result.rows[0], { day: '2026-08-01', xImpressions: 12430, xProfileVisits: 188 });
  assert.equal(result.rows[1].xImpressions, 9010);
  assert.equal(result.mapping.xImpressions, 'impressions');
  assert.equal(result.mapping.xProfileVisits, 'profile visits');
  assert.ok(result.ignoredColumns.includes('likes'));
});

test('parseExternalMetricsCsv reads a Search Console dates export with a BOM', () => {
  const csv = '﻿Date,Clicks,Impressions,CTR,Position\n2026-08-01,12,340,3.53%,18.2\n';
  const result = parseExternalMetricsCsv(csv, 'google');
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.rows, [
    { day: '2026-08-01', googleClicks: 12, googleImpressions: 340 },
  ]);
});

test('parseExternalMetricsCsv files a bare Impressions column by the declared source', () => {
  const csv = 'Date,Clicks,Impressions\n2026-08-01,5,900\n';
  const asGoogle = parseExternalMetricsCsv(csv, 'google');
  assert.equal(asGoogle.rows[0].googleImpressions, 900);
  assert.equal(asGoogle.rows[0].xImpressions, undefined);
  const asX = parseExternalMetricsCsv(csv, 'x');
  assert.equal(asX.rows[0].xImpressions, 900);
  assert.equal(asX.rows[0].googleClicks, undefined);
});

test('parseExternalMetricsCsv skips a title line above the real header', () => {
  const csv = [
    'Performance on Search — zerogex.com',
    'Date,Clicks,Impressions,CTR,Position',
    '2026-08-01,7,120,5.8%,12.1',
  ].join('\n');
  const result = parseExternalMetricsCsv(csv, 'google');
  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0].googleClicks, 7);
});

test('parseExternalMetricsCsv reads the combined round-trip shape', () => {
  const csv = [
    'date,x_impressions,x_profile_visits,google_clicks,google_impressions',
    '2026-08-01,1000,50,9,300',
  ].join('\n');
  const result = parseExternalMetricsCsv(csv, 'combined');
  assert.deepEqual(result.rows, [
    { day: '2026-08-01', xImpressions: 1000, xProfileVisits: 50, googleClicks: 9, googleImpressions: 300 },
  ]);
});

test('parseExternalMetricsCsv reports bad rows without discarding the good ones', () => {
  const csv = [
    'Date,Clicks',
    '2026-08-01,10',
    'yesterday,4',
    '2026-08-03,not-a-number',
    '2026-08-04,6',
  ].join('\n');
  const result = parseExternalMetricsCsv(csv, 'google');
  assert.equal(result.rows.length, 2);
  assert.deepEqual(result.rows.map((r) => r.day), ['2026-08-01', '2026-08-04']);
  assert.equal(result.errors.length, 2);
  assert.ok(result.errors[0].includes('Line 3'));
  assert.ok(result.errors[1].includes('Line 4'));
});

test('parseExternalMetricsCsv keeps the last row when a date repeats', () => {
  const csv = 'Date,Clicks\n2026-08-01,10\n2026-08-01,25\n';
  const result = parseExternalMetricsCsv(csv, 'google');
  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0].googleClicks, 25);
});

test('parseExternalMetricsCsv leaves a blank cell unset rather than zero', () => {
  const csv = 'Date,Impressions,Profile visits\n2026-08-01,500,\n';
  const result = parseExternalMetricsCsv(csv, 'x');
  assert.equal(result.rows[0].xImpressions, 500);
  assert.equal('xProfileVisits' in result.rows[0], false);
});

test('parseExternalMetricsCsv explains an unusable file instead of importing nothing silently', () => {
  assert.ok(parseExternalMetricsCsv('', 'x').errors[0].includes('empty'));
  assert.ok(parseExternalMetricsCsv('Foo,Bar\n1,2\n', 'x').errors[0].includes('Date'));
  assert.ok(parseExternalMetricsCsv('Date,Likes\n2026-08-01,3\n', 'x').errors[0].includes('Impressions'));
  assert.ok(parseExternalMetricsCsv('Date,Likes\n2026-08-01,3\n', 'google').errors[0].includes('Clicks'));
});

test('parseExternalMetricsCsv sorts output oldest-first', () => {
  const csv = 'Date,Clicks\n2026-08-03,3\n2026-08-01,1\n2026-08-02,2\n';
  const result = parseExternalMetricsCsv(csv, 'google');
  assert.deepEqual(result.rows.map((r) => r.day), ['2026-08-01', '2026-08-02', '2026-08-03']);
});

// ── Day bucketing ───────────────────────────────────────────────────────────

test('etDayKey buckets on the America/New_York calendar day, not UTC', () => {
  // 03:30 UTC on Jan 2 is still 22:30 on Jan 1 in New York (EST, UTC-5).
  assert.equal(etDayKey(new Date('2026-01-02T03:30:00Z')), '2026-01-01');
  assert.equal(etDayKey(new Date('2026-01-02T05:30:00Z')), '2026-01-02');
  // …and 03:30 UTC in July is 23:30 the previous day (EDT, UTC-4).
  assert.equal(etDayKey(new Date('2026-07-02T03:30:00Z')), '2026-07-01');
  assert.equal(etDayKey(new Date('2026-07-02T04:30:00Z')), '2026-07-02');
});

test('etDayKey handles the DST transitions themselves', () => {
  // Spring forward 2026: 2026-03-08 02:00 EST → 03:00 EDT.
  assert.equal(etDayKey(new Date('2026-03-08T06:59:00Z')), '2026-03-08');
  assert.equal(etDayKey(new Date('2026-03-08T07:01:00Z')), '2026-03-08');
  // Fall back 2026: 2026-11-01 02:00 EDT → 01:00 EST. 05:30 UTC is 01:30 EDT,
  // 06:30 UTC is 01:30 EST — the same wall clock, the same calendar day.
  assert.equal(etDayKey(new Date('2026-11-01T05:30:00Z')), '2026-11-01');
  assert.equal(etDayKey(new Date('2026-11-01T06:30:00Z')), '2026-11-01');
  // 03:30 UTC is 23:30 EDT on Oct 31 — still the previous calendar day.
  assert.equal(etDayKey(new Date('2026-11-01T03:30:00Z')), '2026-10-31');
});
