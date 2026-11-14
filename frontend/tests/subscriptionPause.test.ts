import test from 'node:test';
import assert from 'node:assert/strict';
import {
  derivePauseState,
  clampPauseMonths,
  computeResumesAtUnix,
  isPausableCadence,
} from '../core/subscriptionPause.ts';

// core/stripe.ts builds its price table at module load, so the env goes first.
// Every cadence is mapped for one tier, so priceIdToSku resolves the real thing.
process.env.STRIPE_PRICE_BASIC_MONTHLY = 'price_basic_monthly';
process.env.STRIPE_PRICE_BASIC_QUARTERLY = 'price_basic_quarterly';
process.env.STRIPE_PRICE_BASIC_ANNUAL = 'price_basic_annual';
const { priceIdToSku } = await import('../core/stripe.ts');

// Pause is the entitlement-critical retention lever: a paused sub must read as
// "no access, not churned", the pause length must stay bounded, and only a
// monthly plan may pause at all. Lock the derivation, the clamp and the gate.

test('derivePauseState: no pause_collection → not paused', () => {
  assert.deepEqual(derivePauseState(null), { paused: false, resumesAtIso: null });
  assert.deepEqual(derivePauseState(undefined), { paused: false, resumesAtIso: null });
  assert.deepEqual(derivePauseState({ behavior: null, resumesAt: null }), {
    paused: false,
    resumesAtIso: null,
  });
});

test('derivePauseState: a behavior with resumes_at → paused, with the ISO resume', () => {
  const resumesAt = Math.floor(Date.UTC(2026, 9, 14, 12, 0, 0) / 1000);
  const s = derivePauseState({ behavior: 'void', resumesAt });
  assert.equal(s.paused, true);
  assert.equal(s.resumesAtIso, new Date(resumesAt * 1000).toISOString());
});

test('derivePauseState: paused with no resumes_at (indefinite) → paused, null resume', () => {
  assert.deepEqual(derivePauseState({ behavior: 'void', resumesAt: null }), {
    paused: true,
    resumesAtIso: null,
  });
});

test('clampPauseMonths: valid stays, out-of-range clamps to [1,3], garbage → 1', () => {
  assert.equal(clampPauseMonths(1), 1);
  assert.equal(clampPauseMonths(2), 2);
  assert.equal(clampPauseMonths(3), 3);
  assert.equal(clampPauseMonths(0), 1);
  assert.equal(clampPauseMonths(-5), 1);
  assert.equal(clampPauseMonths(12), 3);
  assert.equal(clampPauseMonths(2.9), 2);
  assert.equal(clampPauseMonths('2'), 2);
  assert.equal(clampPauseMonths('nope'), 1);
  assert.equal(clampPauseMonths(null), 1);
  assert.equal(clampPauseMonths(undefined), 1);
});

test('computeResumesAtUnix: adds calendar months', () => {
  const now = Date.UTC(2026, 7, 14, 12, 0, 0); // 2026-08-14
  const oneMonth = computeResumesAtUnix(now, 1);
  assert.equal(new Date(oneMonth * 1000).toISOString(), new Date(Date.UTC(2026, 8, 14, 12, 0, 0)).toISOString());
  const threeMonths = computeResumesAtUnix(now, 3);
  assert.equal(new Date(threeMonths * 1000).toISOString(), new Date(Date.UTC(2026, 10, 14, 12, 0, 0)).toISOString());
});

// What both routes compute from users.stripe_price_id before asking the gate.
function cadenceOfPrice(priceId: string | null) {
  const sku = priceId ? priceIdToSku(priceId) : null;
  return sku?.cadence;
}

test('isPausableCadence: monthly only', () => {
  assert.equal(isPausableCadence('monthly'), true);
  // A pause across a quarterly or annual renewal voids the whole renewal invoice.
  assert.equal(isPausableCadence('quarterly'), false);
  assert.equal(isPausableCadence('annual'), false);
  // A cadence added later stays unpausable until someone decides otherwise.
  assert.equal(isPausableCadence('semiannual'), false);
});

test('isPausableCadence: through priceIdToSku, as the routes call it', () => {
  assert.equal(isPausableCadence(cadenceOfPrice('price_basic_monthly')), true);
  assert.equal(isPausableCadence(cadenceOfPrice('price_basic_quarterly')), false);
  assert.equal(isPausableCadence(cadenceOfPrice('price_basic_annual')), false);
});

test('isPausableCadence: an unmapped price (null SKU) is not pausable', () => {
  assert.equal(priceIdToSku('price_nobody_sells'), null);
  assert.equal(isPausableCadence(cadenceOfPrice('price_nobody_sells')), false);
  // No price on the row at all.
  assert.equal(isPausableCadence(cadenceOfPrice(null)), false);
  assert.equal(isPausableCadence(null), false);
  assert.equal(isPausableCadence(undefined), false);
});
