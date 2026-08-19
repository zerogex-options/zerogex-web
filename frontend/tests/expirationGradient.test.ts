// Unit tests for core/expirationGradient.ts — the "colour graded by expiry"
// math shared by the GEX Strike Profile chart's stacked bars and the Gamma
// Chart's dealer-gamma rail. The convention pinned here is the whole point of
// the feature: the NEAREST expiration is anchored at the zero baseline at full
// strength and the chain fans out to the faintest shade on the furthest.
//
// The module is pure (no window / React), so it imports directly with no stub.
import test from 'node:test';
import assert from 'node:assert/strict';

const {
  NEAR_OPACITY,
  FAR_OPACITY,
  expDateKey,
  buildExpirationSplit,
  expirationOpacityRamp,
  shownExpirations,
  expirationShares,
} = await import('../core/expirationGradient.ts');

const TODAY = '2026-08-14';

// ── expDateKey ───────────────────────────────────────────────────────────────

test('expDateKey normalises a trailing time component away', () => {
  assert.equal(expDateKey('2026-08-15T00:00:00'), '2026-08-15');
  assert.equal(expDateKey('2026-08-15'), '2026-08-15');
  assert.equal(expDateKey(null), '');
  assert.equal(expDateKey(undefined), '');
});

// ── buildExpirationSplit ─────────────────────────────────────────────────────

const ROWS = [
  { strike: 600, expiration: '2026-08-14', call_gex: 3_000_000, put_gex: -1_000_000 },
  { strike: 600, expiration: '2026-08-21T00:00:00', call_gex: 1_000_000, put_gex: 0 },
  // Same (strike, expiration) twice — must fold together.
  { strike: 600, expiration: '2026-08-21', call_gex: 1_000_000, put_gex: -500_000 },
  { strike: 590, expiration: '2026-08-14', call_gex: 0, put_gex: -500_000 },
  // Rolled-off expiration — never occupies a slot on the ramp.
  { strike: 600, expiration: '2026-08-01', call_gex: 9_000_000, put_gex: -9_000_000 },
  // Unparseable strike — dropped.
  { strike: 'nan', expiration: '2026-08-14', call_gex: 1 },
];

test('buildExpirationSplit folds by (strike, expiration) and drops past expirations', () => {
  const { perStrike, expirations } = buildExpirationSplit(ROWS, TODAY);
  assert.deepEqual(expirations, ['2026-08-14', '2026-08-21']);
  const s600 = perStrike.get(60_000);
  assert.ok(s600);
  assert.deepEqual([...s600.keys()], ['2026-08-14', '2026-08-21']);
  assert.deepEqual(s600.get('2026-08-14'), { call: 3_000_000, put: 1_000_000 });
  // The two 2026-08-21 rows (one with a time component) fold into one cell.
  assert.deepEqual(s600.get('2026-08-21'), { call: 2_000_000, put: 500_000 });
  // Puts are stored as magnitudes, so a bar width never comes out negative.
  assert.equal(perStrike.get(59_000)?.get('2026-08-14')?.put, 500_000);
  // Only the two valid strikes survive.
  assert.deepEqual([...perStrike.keys()].sort((a, b) => a - b), [59_000, 60_000]);
});

test('buildExpirationSplit keys strikes in cents so fractional strikes stay distinct', () => {
  const { perStrike } = buildExpirationSplit(
    [
      { strike: 600.5, expiration: TODAY, call_gex: 1 },
      { strike: 600, expiration: TODAY, call_gex: 2 },
    ],
    TODAY,
  );
  assert.equal(perStrike.get(60_050)?.get(TODAY)?.call, 1);
  assert.equal(perStrike.get(60_000)?.get(TODAY)?.call, 2);
});

test('buildExpirationSplit tolerates a missing snapshot', () => {
  assert.deepEqual(buildExpirationSplit(null, TODAY).expirations, []);
  assert.equal(buildExpirationSplit(undefined, TODAY).perStrike.size, 0);
});

// ── expirationOpacityRamp ────────────────────────────────────────────────────

test('expirationOpacityRamp runs nearest=full → furthest=faintest', () => {
  const ramp = expirationOpacityRamp(['2026-08-14', '2026-08-21', '2026-08-28']);
  assert.equal(ramp.get('2026-08-14'), NEAR_OPACITY);
  assert.equal(ramp.get('2026-08-28'), FAR_OPACITY);
  // Linear interpolation puts the middle expiration halfway.
  assert.ok(Math.abs((ramp.get('2026-08-21') ?? 0) - (NEAR_OPACITY + FAR_OPACITY) / 2) < 1e-9);
});

test('expirationOpacityRamp renders a lone expiration at full strength', () => {
  assert.equal(expirationOpacityRamp(['2026-08-14']).get('2026-08-14'), NEAR_OPACITY);
  assert.equal(expirationOpacityRamp([]).size, 0);
});

// ── shownExpirations ─────────────────────────────────────────────────────────

const UNIVERSE = ['2026-08-14', '2026-08-21', '2026-08-28'];

test('shownExpirations treats an empty selection as "All"', () => {
  assert.deepEqual(shownExpirations(UNIVERSE, []), UNIVERSE);
});

test('shownExpirations keeps nearest-first order and ignores foreign picks', () => {
  // Selection given out of order, with a date the snapshot doesn't carry.
  const shown = shownExpirations(UNIVERSE, ['2026-09-18', '2026-08-28', '2026-08-14T00:00:00']);
  assert.deepEqual(shown, ['2026-08-14', '2026-08-28']);
});

// ── expirationShares ─────────────────────────────────────────────────────────

test('expirationShares splits a side into fractions summing to 1, nearest-first', () => {
  const { perStrike } = buildExpirationSplit(ROWS, TODAY);
  const segs = expirationShares(perStrike.get(60_000), UNIVERSE, (c) => c.call);
  assert.deepEqual(segs.map((s) => s.exp), ['2026-08-14', '2026-08-21']);
  // 3M and 2M of a 5M total.
  assert.ok(Math.abs(segs[0].frac - 0.6) < 1e-9);
  assert.ok(Math.abs(segs[1].frac - 0.4) < 1e-9);
  assert.ok(Math.abs(segs.reduce((a, s) => a + s.frac, 0) - 1) < 1e-9);
});

test('expirationShares renormalises to the shown subset, so segments still fill the bar', () => {
  const { perStrike } = buildExpirationSplit(ROWS, TODAY);
  const segs = expirationShares(perStrike.get(60_000), ['2026-08-21'], (c) => c.call);
  assert.deepEqual(segs, [{ exp: '2026-08-21', frac: 1 }]);
});

test('expirationShares returns nothing when a side has no data at the strike', () => {
  const { perStrike } = buildExpirationSplit(ROWS, TODAY);
  // Strike 590 has zero call gamma — the caller falls back to a solid bar.
  assert.deepEqual(expirationShares(perStrike.get(59_000), UNIVERSE, (c) => c.call), []);
  // A strike the snapshot doesn't cover at all.
  assert.deepEqual(expirationShares(perStrike.get(1), UNIVERSE, (c) => c.put), []);
});
