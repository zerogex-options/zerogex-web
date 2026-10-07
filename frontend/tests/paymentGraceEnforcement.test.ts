import test from 'node:test';
import assert from 'node:assert/strict';
import {
  decideGraceEnforcement,
  type GraceEnforcementInput,
} from '../core/paymentGraceEnforcement.ts';
import { decidePaymentGrace } from '../core/paymentGrace.ts';

// The cutoff sweep ends access the webhook would have ended had Stripe sent a
// subscription event after the window closed. Two properties carry that job:
//   1. It acts only on a lapsed window, never on one still open.
//   2. Its bound is the webhook's bound, so the two can never disagree.

const HOUR_MS = 60 * 60 * 1000;
const NOW = Date.UTC(2026, 9, 7, 14, 0, 0); // fixed clock for determinism

function openedHoursAgo(hoursAgo: number): string {
  return new Date(NOW - hoursAgo * HOUR_MS).toISOString();
}

function input(over: Partial<GraceEnforcementInput> = {}): GraceEnforcementInput {
  return {
    subscriptionStatus: 'past_due',
    tier: 'basic',
    subscriptionId: 'sub_123',
    graceStartedAt: openedHoursAgo(73), // 3-day window, closed an hour ago
    graceDays: 3,
    nowMs: NOW,
    ...over,
  };
}

test('enforces a lapsed window on a paid tier', () => {
  const d = decideGraceEnforcement(input());
  assert.equal(d.enforce, true);
  assert.equal(d.skip, null);
  assert.equal(d.windowEndIso, new Date(NOW - HOUR_MS).toISOString());
});

test('enforces Pro the same as Basic', () => {
  assert.equal(decideGraceEnforcement(input({ tier: 'pro' })).enforce, true);
});

test('leaves a window that is still open alone', () => {
  const d = decideGraceEnforcement(input({ graceStartedAt: openedHoursAgo(71) }));
  assert.equal(d.enforce, false);
  assert.equal(d.skip, 'still-in-grace');
  assert.equal(d.windowEndIso, new Date(NOW + HOUR_MS).toISOString());
});

test('the window closes exactly at graceDays, matching the webhook', () => {
  // At the boundary instant the webhook says the window is over.
  const atBoundary = input({ graceStartedAt: openedHoursAgo(72) });
  assert.equal(decideGraceEnforcement(atBoundary).enforce, true);
  // One millisecond before it, still in grace.
  const justBefore = input({ graceStartedAt: new Date(NOW - 72 * HOUR_MS + 1).toISOString() });
  assert.equal(decideGraceEnforcement(justBefore).skip, 'still-in-grace');
});

test('agrees with decidePaymentGrace across window lengths and ages', () => {
  for (const graceDays of [1, 3, 7, 14]) {
    for (const hoursAgo of [0, 1, 23, 24, 25, 71, 72, 73, 167, 168, 169, 400]) {
      const graceStartedAt = openedHoursAgo(hoursAgo);
      const webhook = decidePaymentGrace({
        status: 'past_due',
        previousStatus: 'past_due',
        graceStartedAt,
        graceDays,
        nowMs: NOW,
      });
      const sweep = decideGraceEnforcement(input({ graceStartedAt, graceDays }));
      assert.equal(sweep.enforce, !webhook.inGrace, `graceDays=${graceDays} hoursAgo=${hoursAgo}`);
    }
  }
});

test('grace disabled after the window opened ends it, as the webhook would', () => {
  const d = decideGraceEnforcement(input({ graceStartedAt: openedHoursAgo(1), graceDays: 0 }));
  assert.equal(d.enforce, true);
});

test('a malformed anchor is treated as lapsed, as the webhook does', () => {
  const d = decideGraceEnforcement(input({ graceStartedAt: 'not-a-date' }));
  assert.equal(d.enforce, true);
  assert.equal(d.windowEndIso, null);
});

test('skips anything that is not past_due', () => {
  for (const status of ['active', 'trialing', 'canceled', 'unpaid', 'incomplete', null]) {
    const d = decideGraceEnforcement(input({ subscriptionStatus: status }));
    assert.equal(d.enforce, false, String(status));
    assert.equal(d.skip, 'not-past-due');
  }
});

test('skips a member who already has no paid tier', () => {
  assert.equal(decideGraceEnforcement(input({ tier: 'public' })).skip, 'already-public');
  assert.equal(decideGraceEnforcement(input({ tier: null })).skip, 'already-public');
});

test('never demotes an admin', () => {
  assert.equal(decideGraceEnforcement(input({ tier: 'admin' })).skip, 'protected-tier');
});

test('skips a row with no subscription to send the update through', () => {
  assert.equal(decideGraceEnforcement(input({ subscriptionId: null })).skip, 'no-subscription');
});

test('reports, but does not act on, a paid past_due row with no window', () => {
  const d = decideGraceEnforcement(input({ graceStartedAt: null }));
  assert.equal(d.enforce, false);
  assert.equal(d.skip, 'no-window');
  assert.equal(d.windowEndIso, null);
});
