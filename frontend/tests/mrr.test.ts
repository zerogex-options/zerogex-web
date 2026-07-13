import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeMrr,
  computeMrrTrend,
  buildMrrProjection,
  deriveTargetMrr,
  parseAmountTable,
  DEFAULT_AMOUNTS,
  DEFAULT_MRR_CONFIG,
  type MrrConfig,
  type SubscriberBucket,
} from '../core/pricing.ts';

// Build a daily series of consecutive ET-style day keys starting at `start`,
// mirroring how buildMrrSeries emits one carry-forward point per day.
function dailySeries(start: string, estMrrs: number[]): Array<{ day: string; estMrr: number }> {
  const [y, m, d] = start.split('-').map(Number);
  return estMrrs.map((estMrr, i) => {
    const dt = new Date(Date.UTC(y, m - 1, d + i));
    const key = `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
    return { day: key, estMrr };
  });
}

function cfg(over: Partial<MrrConfig> = {}): MrrConfig {
  return { ...DEFAULT_MRR_CONFIG, ...over };
}

test('target MRR derives from gross income and margin', () => {
  // 175,000 / 0.75 / 12 ≈ 19,444.44
  const target = deriveTargetMrr(cfg());
  assert.ok(Math.abs(target - 175_000 / 0.75 / 12) < 1e-6);
  assert.ok(target > 19_000 && target < 20_000);
});

test('explicit target override wins over derived target', () => {
  assert.equal(deriveTargetMrr(cfg({ targetMrrOverride: 20_000 })), 20_000);
});

test('empty subscriber set yields zero MRR and null subs-to-target', () => {
  const snap = computeMrr({ buckets: [], unpricedActive: 0, unpricedTrialing: 0, config: cfg() });
  assert.equal(snap.estMrr, 0);
  assert.equal(snap.activeSubscribers, 0);
  assert.equal(snap.arpu, 0);
  assert.equal(snap.subscribersToTarget, null);
  assert.equal(snap.progressPct, 0);
});

test('active subscribers sum to MRR; trials excluded from estMrr but in committed', () => {
  const buckets: SubscriberBucket[] = [
    { tier: 'pro', cadence: 'monthly', rate: 'founding', state: 'active', count: 10 }, // 10 * 19 = 190
    { tier: 'pro', cadence: 'monthly', rate: 'list', state: 'active', count: 2 }, //  2 * 59 = 118
    { tier: 'basic', cadence: 'monthly', rate: 'founding', state: 'active', count: 3 }, //  3 * 12 = 36
    { tier: 'pro', cadence: 'monthly', rate: 'founding', state: 'trialing', count: 4 }, // trial: 4 * 19 = 76 committed only
  ];
  const snap = computeMrr({ buckets, unpricedActive: 0, unpricedTrialing: 0, config: cfg() });
  assert.equal(snap.estMrr, 190 + 118 + 36);
  assert.equal(snap.committedMrr, 190 + 118 + 36 + 76);
  assert.equal(snap.activeSubscribers, 15);
  assert.equal(snap.trialingSubscribers, 4);
  // ARPU = 344 / 15
  assert.ok(Math.abs(snap.arpu - 344 / 15) < 1e-9);
});

test('annual plans are normalized to a monthly contribution', () => {
  const buckets: SubscriberBucket[] = [
    { tier: 'pro', cadence: 'annual', rate: 'list', state: 'active', count: 12 }, // 12 * (299/12) = 299
  ];
  const snap = computeMrr({ buckets, unpricedActive: 0, unpricedTrialing: 0, config: cfg() });
  assert.ok(Math.abs(snap.estMrr - 299) < 1e-9);
});

test('unpriced subscribers are counted but contribute no revenue', () => {
  const buckets: SubscriberBucket[] = [
    { tier: 'pro', cadence: 'monthly', rate: 'founding', state: 'active', count: 5 }, // 95
  ];
  const snap = computeMrr({ buckets, unpricedActive: 3, unpricedTrialing: 1, config: cfg() });
  assert.equal(snap.estMrr, 95);
  assert.equal(snap.activeSubscribers, 8); // 5 priced + 3 unpriced
  assert.equal(snap.trialingSubscribers, 1);
  assert.equal(snap.unpricedSubscribers, 4);
  // ARPU only divides by priced active subs (95 / 5), not the unpriced ones.
  assert.ok(Math.abs(snap.arpu - 19) < 1e-9);
});

test('progress and gap track the target; subs-to-target uses ARPU', () => {
  const buckets: SubscriberBucket[] = [
    { tier: 'pro', cadence: 'monthly', rate: 'list', state: 'active', count: 100 }, // 5900
  ];
  const snap = computeMrr({
    buckets,
    unpricedActive: 0,
    unpricedTrialing: 0,
    config: cfg({ targetMrrOverride: 20_000 }),
  });
  assert.equal(snap.estMrr, 5900);
  assert.equal(snap.gapMrr, 20_000 - 5900);
  assert.ok(Math.abs(snap.progressPct - (5900 / 20_000) * 100) < 1e-9);
  // (20000 - 5900) / 59 = 239.0 -> ceil 239
  assert.equal(snap.subscribersToTarget, Math.ceil((20_000 - 5900) / 59));
});

test('progress is clamped to 100 once the target is exceeded', () => {
  const buckets: SubscriberBucket[] = [
    { tier: 'pro', cadence: 'monthly', rate: 'list', state: 'active', count: 1000 },
  ];
  const snap = computeMrr({
    buckets,
    unpricedActive: 0,
    unpricedTrialing: 0,
    config: cfg({ targetMrrOverride: 20_000 }),
  });
  assert.equal(snap.progressPct, 100);
  assert.equal(snap.gapMrr, 0);
  assert.equal(snap.subscribersToTarget, 0);
});

test('parseAmountTable falls back to defaults on bad input and deep-merges valid keys', () => {
  assert.equal(parseAmountTable(undefined), DEFAULT_AMOUNTS);
  assert.equal(parseAmountTable('not json'), DEFAULT_AMOUNTS);
  const merged = parseAmountTable(JSON.stringify({ pro: { monthly: { founding: 25 } } }));
  assert.equal(merged.pro.monthly.founding, 25); // overridden
  assert.equal(merged.pro.monthly.list, 59); // untouched default
  assert.equal(merged.basic.monthly.founding, 12); // untouched default
});

test('trend is null without real data or with a single data day', () => {
  assert.equal(computeMrrTrend([], 20_000), null);
  assert.equal(computeMrrTrend([{ estMrr: 0 }, { estMrr: 0 }], 20_000), null);
  // First real sample is the last point -> windowDays 0 -> null.
  assert.equal(computeMrrTrend([{ estMrr: 0 }, { estMrr: 0 }, { estMrr: 100 }], 20_000), null);
});

test('trend skips leading carry-forward zeros and compounds month-over-month', () => {
  // 30-day window doubling: 1000 -> 2000 over exactly 30 days = +100%/mo.
  const clean: Array<{ estMrr: number }> = [];
  for (let d = 0; d <= 30; d++) {
    clean.push({ estMrr: 1000 * Math.pow(2, d / 30) });
  }
  // Prepend a couple of zero (pre-launch) days that must be ignored.
  const withZeros = [{ estMrr: 0 }, { estMrr: 0 }, ...clean];
  const trend = computeMrrTrend(withZeros, 20_000)!;
  assert.equal(trend.windowDays, 30);
  assert.equal(trend.startMrr, 1000);
  assert.ok(Math.abs(trend.endMrr - 2000) < 1e-6);
  assert.ok(trend.monthlyGrowthRate !== null && Math.abs(trend.monthlyGrowthRate - 1) < 1e-6);
  // From 2000 at +100%/mo to 20000 = log2(10) ≈ 3.32 months.
  assert.ok(trend.monthsToTarget !== null && Math.abs(trend.monthsToTarget - Math.log2(10)) < 1e-6);
});

test('trend reports reached (0 months) once MRR is at/over target', () => {
  const trend = computeMrrTrend([{ estMrr: 5000 }, { estMrr: 25_000 }], 20_000)!;
  assert.equal(trend.monthsToTarget, 0);
});

test('flat or declining MRR yields no ETA to target', () => {
  const flat = computeMrrTrend([{ estMrr: 1000 }, { estMrr: 1000 }], 20_000)!;
  assert.equal(flat.monthlyGrowthRate, 0);
  assert.equal(flat.monthsToTarget, null);
  const declining = computeMrrTrend([{ estMrr: 2000 }, { estMrr: 1000 }], 20_000)!;
  assert.ok(declining.monthlyGrowthRate !== null && declining.monthlyGrowthRate < 0);
  assert.equal(declining.monthsToTarget, null);
});

test('projection extrapolates a straight line at last week\'s daily pace', () => {
  // 8 days of history rising exactly $10/day: pace over the trailing week is
  // $10/day off the latest ($1070) value.
  const series = dailySeries('2026-07-01', [1000, 1010, 1020, 1030, 1040, 1050, 1060, 1070]);
  const proj = buildMrrProjection(series, 6)!;
  assert.equal(proj.windowDays, 7);
  assert.ok(Math.abs(proj.slopePerDay - 10) < 1e-9);
  assert.equal(proj.originMrr, 1070);
  assert.equal(proj.originDay, '2026-07-08');
  // First projected point is the next day, one slope-step up.
  assert.equal(proj.points[0].day, '2026-07-09');
  assert.ok(Math.abs(proj.points[0].projMrr - 1080) < 1e-9);
  // Straight line: value at N days out is origin + slope*N.
  const last = proj.points[proj.points.length - 1];
  assert.ok(Math.abs(last.projMrr - (1070 + 10 * proj.points.length)) < 1e-9);
  assert.equal(last.projMrr, proj.horizonMrr);
  // 6 calendar months from Jul 8 lands on Jan 8 -> 184 days.
  assert.equal(proj.points.length, 184);
  assert.equal(last.day, '2027-01-08');
});

test('projection horizons scale the number of forward days', () => {
  const series = dailySeries('2026-07-01', [1000, 1010, 1020, 1030, 1040, 1050, 1060, 1070]);
  const y1 = buildMrrProjection(series, 12)!;
  const y3 = buildMrrProjection(series, 36)!;
  assert.equal(y1.points[y1.points.length - 1].day, '2027-07-08');
  assert.equal(y3.points[y3.points.length - 1].day, '2029-07-08');
  // Same pace, so the 3-year endpoint is far higher than the 1-year one.
  assert.ok(y3.horizonMrr > y1.horizonMrr);
});

test('projection uses the shorter window when under a week of history', () => {
  // Only 5 days of real data (4-day span) -> window clamps to 4.
  const series = dailySeries('2026-07-01', [100, 130, 160, 190, 220]);
  const proj = buildMrrProjection(series, 6)!;
  assert.equal(proj.windowDays, 4);
  assert.ok(Math.abs(proj.slopePerDay - 30) < 1e-9);
});

test('projection skips leading pre-launch zeros when setting the pace', () => {
  const series = dailySeries('2026-07-01', [0, 0, 0, 500, 510, 520, 530, 540, 550, 560, 570]);
  const proj = buildMrrProjection(series, 6)!;
  // Trailing week still resolves to $10/day, unaffected by the zero prefix.
  assert.equal(proj.windowDays, 7);
  assert.ok(Math.abs(proj.slopePerDay - 10) < 1e-9);
  assert.equal(proj.originMrr, 570);
});

test('declining MRR projects downward and clamps at zero', () => {
  // Falling $100/day from $500 -> hits zero within the horizon, never negative.
  const series = dailySeries('2026-07-01', [1100, 1000, 900, 800, 700, 600, 500, 400]);
  const proj = buildMrrProjection(series, 6)!;
  assert.ok(proj.slopePerDay < 0);
  assert.equal(proj.horizonMrr, 0);
  assert.ok(proj.points.every((p) => p.projMrr >= 0));
});

test('projection is null without enough real history or with no horizon', () => {
  assert.equal(buildMrrProjection([], 6), null);
  assert.equal(buildMrrProjection(dailySeries('2026-07-01', [0, 0]), 6), null);
  // Single real day -> no span to set a slope.
  assert.equal(buildMrrProjection(dailySeries('2026-07-01', [0, 0, 100]), 6), null);
  // Non-positive horizon.
  assert.equal(buildMrrProjection(dailySeries('2026-07-01', [100, 200]), 0), null);
});
