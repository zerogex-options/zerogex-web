import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeCommissionMinor,
  proportionalReversalMinor,
  isAttributionWithinWindow,
  computeHoldReleaseAt,
  addMonthsIso,
  maskEmail,
  getAmbassadorTerms,
  isAmbassadorProgramEnabled,
  isAmbassadorAttributionEnabled,
} from '../core/ambassadorConfig.ts';

// core/ambassadorConfig.ts is a pure leaf module (no DB/Stripe imports), so it
// runs directly under `node --experimental-strip-types --test`. These cover the
// decimal-safe money math and the deterministic time/attribution helpers.

test('cash commission is 20% of collected revenue (integer minor units)', () => {
  // $39.00 monthly -> $7.80
  assert.equal(computeCommissionMinor(3900, 2000), 780);
  // $59.00 monthly -> $11.80
  assert.equal(computeCommissionMinor(5900, 2000), 1180);
  // annual $299.00 -> $59.80
  assert.equal(computeCommissionMinor(29900, 2000), 5980);
});

test('account-credit reward is 25% of collected revenue', () => {
  assert.equal(computeCommissionMinor(3900, 2500), 975);
  assert.equal(computeCommissionMinor(5900, 2500), 1475);
});

test('commission rounds to the nearest cent, never drifts on fractions', () => {
  // 2000 bps of 1999 = 399.8 -> 400 (round half up on .8)
  assert.equal(computeCommissionMinor(1999, 2000), 400);
  // 2500 bps of 333 = 83.25 -> 83
  assert.equal(computeCommissionMinor(333, 2500), 83);
  // zero / negative inputs never produce a reward
  assert.equal(computeCommissionMinor(0, 2000), 0);
  assert.equal(computeCommissionMinor(-100, 2000), 0);
  assert.equal(computeCommissionMinor(3900, 0), 0);
});

test('full refund reverses the entire commission', () => {
  assert.equal(proportionalReversalMinor(780, 3900, 3900), 780);
  // refunded >= charged clamps to full
  assert.equal(proportionalReversalMinor(780, 5000, 3900), 780);
});

test('partial refund reverses proportionally and is clamped', () => {
  // half the charge refunded -> half the commission
  assert.equal(proportionalReversalMinor(780, 1950, 3900), 390);
  // a third refunded
  assert.equal(proportionalReversalMinor(780, 1300, 3900), 260);
  // nothing refunded -> nothing reversed
  assert.equal(proportionalReversalMinor(780, 0, 3900), 0);
});

test('attribution is valid within the window and expired beyond it', () => {
  const click = '2026-01-01T00:00:00.000Z';
  const within = '2026-02-15T00:00:00.000Z'; // 45 days later
  const beyond = '2026-03-15T00:00:00.000Z'; // ~73 days later
  assert.equal(isAttributionWithinWindow(click, within, 60), true);
  assert.equal(isAttributionWithinWindow(click, beyond, 60), false);
  // exactly at the boundary (60 days) is still valid
  assert.equal(isAttributionWithinWindow(click, '2026-03-02T00:00:00.000Z', 60), true);
});

test('attribution fails OPEN when first-touch is unknown or malformed', () => {
  assert.equal(isAttributionWithinWindow(null, '2026-02-15T00:00:00.000Z', 60), true);
  assert.equal(isAttributionWithinWindow('not-a-date', '2026-02-15T00:00:00.000Z', 60), true);
  // conversion before click (clock skew) is not punished
  assert.equal(isAttributionWithinWindow('2026-02-15T00:00:00.000Z', '2026-01-01T00:00:00.000Z', 60), true);
});

test('holding-period release is 30 days after the earned date', () => {
  const earned = '2026-01-01T00:00:00.000Z';
  const release = computeHoldReleaseAt(earned, 30);
  assert.equal(release, '2026-01-31T00:00:00.000Z');
});

test('commission-duration window is 12 calendar months out', () => {
  assert.equal(addMonthsIso('2026-01-15T00:00:00.000Z', 12), '2027-01-15T00:00:00.000Z');
});

test('maskEmail never reveals the full local part', () => {
  assert.equal(maskEmail('jane.doe@example.com'), 'ja••••••@example.com');
  assert.equal(maskEmail(null), 'anonymous customer');
  assert.ok(!maskEmail('someone@zerogex.com').startsWith('someone'));
});

test('default terms match the documented pilot defaults', () => {
  const saved = { ...process.env };
  // Clear any overrides so we read the documented defaults.
  delete process.env.AMBASSADOR_COMMISSION_BPS;
  delete process.env.AMBASSADOR_CREDIT_BPS;
  delete process.env.AMBASSADOR_COMMISSION_WINDOW_MONTHS;
  delete process.env.AMBASSADOR_ATTRIBUTION_WINDOW_DAYS;
  delete process.env.AMBASSADOR_HOLDING_PERIOD_DAYS;
  delete process.env.AMBASSADOR_PILOT_DAYS;
  const terms = getAmbassadorTerms();
  assert.equal(terms.commissionBps, 2000);
  assert.equal(terms.creditBps, 2500);
  assert.equal(terms.commissionWindowMonths, 12);
  assert.equal(terms.attributionWindowDays, 60);
  assert.equal(terms.holdingPeriodDays, 30);
  assert.equal(terms.pilotDays, 90);
  process.env = saved;
});

test('program + attribution kill switches gate off cleanly', () => {
  const saved = { ...process.env };
  delete process.env.AMBASSADOR_PROGRAM_ENABLED;
  assert.equal(isAmbassadorProgramEnabled(), false);
  assert.equal(isAmbassadorAttributionEnabled(), false);
  process.env.AMBASSADOR_PROGRAM_ENABLED = '1';
  assert.equal(isAmbassadorProgramEnabled(), true);
  assert.equal(isAmbassadorAttributionEnabled(), true);
  process.env.AMBASSADOR_ATTRIBUTION_DISABLED = '1';
  assert.equal(isAmbassadorAttributionEnabled(), false);
  process.env = saved;
});
