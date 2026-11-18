import test from 'node:test';
import assert from 'node:assert/strict';
import {
  derivePauseState,
  clampPauseMonths,
  computeResumesAtUnix,
  isPausableCadence,
  monthlyBillUnix,
  billsDuringPause,
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

// --- Bill preview (scripts/pause-subscription.mts) --------------------------
// Unix seconds for a UTC wall-clock time. Explicit UTC throughout, so these
// don't depend on the machine's time zone.
const utc = (y: number, m: number, d: number, h = 0, min = 0) => Math.floor(Date.UTC(y, m - 1, d, h, min) / 1000);
const iso = (unix: number | null) => (unix == null ? null : new Date(unix * 1000).toISOString());

test('monthlyBillUnix: same UTC day and time each month', () => {
  const anchor = utc(2026, 3, 15, 14, 30);
  assert.equal(iso(monthlyBillUnix(anchor, 0)), '2026-03-15T14:30:00.000Z');
  assert.equal(iso(monthlyBillUnix(anchor, 9)), '2026-12-15T14:30:00.000Z');
  // Across a year boundary.
  assert.equal(iso(monthlyBillUnix(anchor, 10)), '2027-01-15T14:30:00.000Z');
});

test('monthlyBillUnix: an anchor on the 31st bills the last day of short months, then the 31st again', () => {
  const anchor = utc(2026, 1, 31, 9);
  assert.equal(iso(monthlyBillUnix(anchor, 1)), '2026-02-28T09:00:00.000Z');
  assert.equal(iso(monthlyBillUnix(anchor, 2)), '2026-03-31T09:00:00.000Z');
  assert.equal(iso(monthlyBillUnix(anchor, 10)), '2026-11-30T09:00:00.000Z');
  assert.equal(iso(monthlyBillUnix(anchor, 11)), '2026-12-31T09:00:00.000Z');
  // 2028 is a leap year.
  assert.equal(iso(monthlyBillUnix(anchor, 25)), '2028-02-29T09:00:00.000Z');
});

test('billsDuringPause: paused just after a renewal skips the next two bills, and the paid month carries over', () => {
  // Renews on the 15th; renewed Nov 15, paused Nov 18 for two months.
  const anchor = utc(2026, 6, 15, 12);
  const now = utc(2026, 11, 18, 15);
  const resumesAt = utc(2027, 1, 18, 15);
  const bills = billsDuringPause(anchor, now, resumesAt);
  assert.deepEqual(bills.skippedUnix.map(iso), ['2026-12-15T12:00:00.000Z', '2027-01-15T12:00:00.000Z']);
  // Nothing more until the bill after the resume: the Nov 15 payment covers
  // Jan 18 to Feb 15.
  assert.equal(iso(bills.nextChargeUnix), '2027-02-15T12:00:00.000Z');
});

test('billsDuringPause: a bill already raised (before now) is not counted', () => {
  // Renewed earlier today; that bill is behind us, not inside the pause.
  const anchor = utc(2026, 6, 18, 9);
  const now = utc(2026, 11, 18, 15);
  const bills = billsDuringPause(anchor, now, utc(2026, 12, 18, 15));
  assert.deepEqual(bills.skippedUnix.map(iso), ['2026-12-18T09:00:00.000Z']);
  assert.equal(iso(bills.nextChargeUnix), '2027-01-18T09:00:00.000Z');
});

test('billsDuringPause: a trial anchor in the future is the first bill', () => {
  // Trial ends Nov 21; a one-month pause from Nov 18 skips the conversion bill.
  const anchor = utc(2026, 11, 21, 10);
  const bills = billsDuringPause(anchor, utc(2026, 11, 18, 15), utc(2026, 12, 18, 15));
  assert.deepEqual(bills.skippedUnix.map(iso), ['2026-11-21T10:00:00.000Z']);
  assert.equal(iso(bills.nextChargeUnix), '2026-12-21T10:00:00.000Z');
});

test('billsDuringPause: N months paused skips exactly N bills, whenever it starts', () => {
  // The fairness the pause promises, over every billing day the calendar
  // always has (1-28), pause start days on either side of it, and 1-3 months.
  // Resumes N calendar months out at the same UTC time, as Stripe is asked to.
  for (let billingDay = 1; billingDay <= 28; billingDay++) {
    const anchor = utc(2026, 1, billingDay, 13, 7);
    for (const startDay of [1, billingDay, 15, 28]) {
      for (const hour of [0, 13, 23]) {
        for (const months of [1, 2, 3]) {
          const now = utc(2026, 11, startDay, hour);
          const resumesAt = utc(2026, 11 + months, startDay, hour);
          const bills = billsDuringPause(anchor, now, resumesAt);
          assert.equal(
            bills.skippedUnix.length,
            months,
            `billing day ${billingDay}, paused Nov ${startDay} ${hour}:00 UTC for ${months}`,
          );
          assert.ok(bills.nextChargeUnix != null && bills.nextChargeUnix >= resumesAt);
        }
      }
    }
  }
});

test('billsDuringPause: bad input previews nothing', () => {
  const now = utc(2026, 11, 18);
  assert.deepEqual(billsDuringPause(Number.NaN, now, now + 86_400), { skippedUnix: [], nextChargeUnix: null });
  assert.deepEqual(billsDuringPause(now, now, now), { skippedUnix: [], nextChargeUnix: null });
  assert.deepEqual(billsDuringPause(now, now, now - 1), { skippedUnix: [], nextChargeUnix: null });
});
