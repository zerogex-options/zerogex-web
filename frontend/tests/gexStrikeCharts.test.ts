// Unit tests for the pure by-strike chart derivations (core/gexStrikeCharts.ts)
// that back both the /gamma-exposure page charts and their "My Dashboard"
// widget twins ("Gamma Exposure by Strike" / "Open Interest by Strike"). Because
// the page and the widgets share these exact transforms, pinning them here is
// what guarantees a chart added to a board computes identically to the page.
//
// The module is pure (no window / React), so it imports directly with no stub.
import test from 'node:test';
import assert from 'node:assert/strict';

const {
  aggregateStrikes,
  strikeExpirationOptions,
  chartExpirationOptions,
  chartStrikeData,
  toProfileStrikeData,
  perExpirationStrikeData,
  expirationsParam,
  normalizeOpenInterestPayload,
  openInterestRows,
  openInterestSpotPrice,
} = await import('../core/gexStrikeCharts.ts');

// ── aggregateStrikes ─────────────────────────────────────────────────────────

test('aggregateStrikes sums per strike, scales GEX to $M, and sorts ascending', () => {
  const rows = [
    { strike: 600, expiration: '2026-08-14', net_gex: 2_000_000, call_gex: 3_000_000, put_gex: -1_000_000, call_oi: 10, put_oi: 5, call_volume: 2, put_volume: 1, distance_from_spot: 1 },
    // Same strike, different expiration — must fold into one row.
    { strike: 600, expiration: '2026-08-15', net_gex: 1_000_000, call_gex: 1_000_000, put_gex: 0, call_oi: 4, put_oi: 6, call_volume: 3, put_volume: 2, distance_from_spot: 1 },
    { strike: 590, expiration: '2026-08-14', net_gex: -500_000, call_gex: 0, put_gex: -500_000, call_oi: 1, put_oi: 9, call_volume: 0, put_volume: 4, distance_from_spot: -9 },
  ];
  const out = aggregateStrikes(rows);
  assert.equal(out.length, 2);
  // Sorted ascending by strike.
  assert.deepEqual(out.map((r) => r.strike), [590, 600]);
  const s600 = out[1];
  assert.equal(s600.netGexM, 3); // (2M + 1M) / 1e6
  assert.equal(s600.callGexM, 4);
  assert.equal(s600.putGexM, -1);
  assert.equal(s600.callOi, 14);
  assert.equal(s600.putOi, 11);
  assert.equal(s600.callVolume, 5);
  assert.equal(s600.putVolume, 3);
});

test('aggregateStrikes coerces string/null fields and tolerates empty input', () => {
  assert.deepEqual(aggregateStrikes(null), []);
  assert.deepEqual(aggregateStrikes(undefined), []);
  const out = aggregateStrikes([
    { strike: '600', net_gex: '2000000', call_gex: null, put_gex: undefined, call_oi: '7' },
  ]);
  assert.equal(out.length, 1);
  assert.equal(out[0].strike, 600);
  assert.equal(out[0].netGexM, 2);
  assert.equal(out[0].callGexM, 0);
  assert.equal(out[0].callOi, 7);
});

// ── expiration universe helpers ───────────────────────────────────────────────

test('strikeExpirationOptions dedupes and sorts ascending', () => {
  const rows = [
    { strike: 1, expiration: '2026-08-15' },
    { strike: 2, expiration: '2026-08-14' },
    { strike: 3, expiration: '2026-08-15' },
  ];
  assert.deepEqual(strikeExpirationOptions(rows), ['2026-08-14', '2026-08-15']);
  assert.deepEqual(strikeExpirationOptions(null), []);
});

test('chartExpirationOptions keeps only current/future expirations', () => {
  const options = ['2026-08-10', '2026-08-12', '2026-08-14'];
  assert.deepEqual(chartExpirationOptions(options, '2026-08-12'), ['2026-08-12', '2026-08-14']);
});

// ── chartStrikeData ────────────────────────────────────────────────────────────

const BY_STRIKE = [
  { strike: 600, expiration: '2026-08-14', net_gex: 2_000_000, call_gex: 2_000_000, put_gex: 0 },
  { strike: 600, expiration: '2026-08-15', net_gex: 1_000_000, call_gex: 1_000_000, put_gex: 0 },
  // A past expiration outside the chart universe — must be excluded even from "All".
  { strike: 600, expiration: '2026-08-01', net_gex: 9_000_000, call_gex: 9_000_000, put_gex: 0 },
];
const UNIVERSE = ['2026-08-14', '2026-08-15'];

test('chartStrikeData "All" sums only the current/future universe (not every row)', () => {
  const out = chartStrikeData(BY_STRIKE, [], UNIVERSE);
  assert.equal(out.length, 1);
  // 2M + 1M over the universe; the 9M past-expiration row is excluded.
  assert.equal(out[0].netGexM, 3);
});

test('chartStrikeData with a subset sums only the chosen expirations', () => {
  const out = chartStrikeData(BY_STRIKE, ['2026-08-15'], UNIVERSE);
  assert.equal(out.length, 1);
  assert.equal(out[0].netGexM, 1);
});

test('toProfileStrikeData re-expands $M aggregates back to raw dollars', () => {
  const out = toProfileStrikeData(chartStrikeData(BY_STRIKE, [], UNIVERSE));
  assert.deepEqual(out, [{ strike: 600, netGex: 3_000_000, callGex: 3_000_000, putGex: 0 }]);
});

// ── perExpirationStrikeData ────────────────────────────────────────────────────

test('perExpirationStrikeData breaks out each (strike, expiration) in the universe', () => {
  const out = perExpirationStrikeData(BY_STRIKE, UNIVERSE);
  // Two universe rows at strike 600 (the past-expiration row is excluded).
  assert.equal(out.length, 2);
  const byExp = Object.fromEntries(out.map((r) => [r.expiration, r.callGex]));
  assert.equal(byExp['2026-08-14'], 2_000_000);
  assert.equal(byExp['2026-08-15'], 1_000_000);
  assert.equal(byExp['2026-08-01'], undefined);
});

test('perExpirationStrikeData skips non-finite strikes', () => {
  const out = perExpirationStrikeData(
    [{ strike: 'nan', expiration: '2026-08-14', call_gex: 1 }],
    ['2026-08-14'],
  );
  assert.deepEqual(out, []);
});

// ── expirationsParam ───────────────────────────────────────────────────────────

test('expirationsParam is "all" for an empty selection and a sorted CSV otherwise', () => {
  assert.equal(expirationsParam([]), 'all');
  assert.equal(expirationsParam(['2026-08-15', '2026-08-14']), '2026-08-14,2026-08-15');
});

// ── open-interest normalization ────────────────────────────────────────────────

test('normalizeOpenInterestPayload wraps a bare array and passes objects through', () => {
  assert.deepEqual(normalizeOpenInterestPayload([{ strike: 1 }]), { contracts: [{ strike: 1 }] });
  const obj = { spot_price: 600, rows: [{ strike: 1 }] };
  assert.equal(normalizeOpenInterestPayload(obj), obj);
  assert.equal(normalizeOpenInterestPayload(null), null);
});

test('openInterestRows picks the first present row key, else []', () => {
  assert.deepEqual(openInterestRows({ contracts: [{ a: 1 }] }), [{ a: 1 }]);
  assert.deepEqual(openInterestRows({ rows: [{ a: 2 }] }), [{ a: 2 }]);
  assert.deepEqual(openInterestRows({ results: [{ a: 3 }] }), [{ a: 3 }]);
  assert.deepEqual(openInterestRows({ spot_price: 1 }), []);
  assert.deepEqual(openInterestRows(null), []);
});

test('openInterestSpotPrice parses a finite spot or returns null', () => {
  assert.equal(openInterestSpotPrice({ spot_price: 601.25 }), 601.25);
  assert.equal(openInterestSpotPrice({ spot_price: '601.25' }), 601.25);
  assert.equal(openInterestSpotPrice({ spot_price: 'n/a' }), null);
  assert.equal(openInterestSpotPrice({}), null);
  assert.equal(openInterestSpotPrice(null), null);
});
