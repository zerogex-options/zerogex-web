import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeMrr,
  deriveTargetMrr,
  parseAmountTable,
  DEFAULT_AMOUNTS,
  DEFAULT_MRR_CONFIG,
  type MrrConfig,
  type SubscriberBucket,
} from '../core/pricing.ts';

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
