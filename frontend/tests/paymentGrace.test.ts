import test from 'node:test';
import assert from 'node:assert/strict';
import {
  decidePaymentGrace,
  graceWindowEndIso,
  type PaymentGraceInput,
} from '../core/paymentGrace.ts';

// The bounded payment-recovery grace window decides whether a member whose
// renewal charge just failed keeps their paid tier while Stripe's Smart Retries
// work the card. It's the involuntary-churn fix, so lock the matrix down: it
// must protect established payers, must NOT extend unvalidated trial cards, and
// must stay bounded (never "weeks of free premium").

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 6, 24, 12, 0, 0); // fixed clock for determinism

function input(over: Partial<PaymentGraceInput> = {}): PaymentGraceInput {
  return {
    status: 'past_due',
    previousStatus: 'active',
    graceStartedAt: null,
    graceDays: 3,
    nowMs: NOW,
    ...over,
  };
}

test('opens a window on the first past_due of a previously-active subscription', () => {
  const d = decidePaymentGrace(input({ previousStatus: 'active', graceStartedAt: null }));
  assert.equal(d.inGrace, true);
  assert.equal(d.graceStartedAt, new Date(NOW).toISOString());
});

test('a trial-conversion failure (previousStatus trialing) opens no window', () => {
  const d = decidePaymentGrace(input({ previousStatus: 'trialing', graceStartedAt: null }));
  assert.equal(d.inGrace, false);
  assert.equal(d.graceStartedAt, null);
});

test('a first past_due with no known previous status opens no window', () => {
  const d = decidePaymentGrace(input({ previousStatus: null, graceStartedAt: null }));
  assert.equal(d.inGrace, false);
  assert.equal(d.graceStartedAt, null);
});

test('graceDays=0 disables the window (old instant-downgrade behavior preserved)', () => {
  const d = decidePaymentGrace(input({ graceDays: 0, graceStartedAt: null }));
  assert.equal(d.inGrace, false);
  assert.equal(d.graceStartedAt, null);
});

test('stays in grace while within the window, preserving the original anchor', () => {
  const opened = new Date(NOW - 2 * DAY_MS).toISOString(); // 2 days into a 3-day window
  const d = decidePaymentGrace(input({ graceStartedAt: opened, previousStatus: 'past_due' }));
  assert.equal(d.inGrace, true);
  assert.equal(d.graceStartedAt, opened);
});

test('expires once the window has elapsed, retaining the anchor until status changes', () => {
  const opened = new Date(NOW - 4 * DAY_MS).toISOString(); // 4 days into a 3-day window
  const d = decidePaymentGrace(input({ graceStartedAt: opened, previousStatus: 'past_due' }));
  assert.equal(d.inGrace, false);
  assert.equal(d.graceStartedAt, opened);
});

test('the window boundary is exclusive (exactly graceDays out is expired)', () => {
  const opened = new Date(NOW - 3 * DAY_MS).toISOString(); // exactly 3 days, window is 3
  const d = decidePaymentGrace(input({ graceStartedAt: opened, previousStatus: 'past_due' }));
  assert.equal(d.inGrace, false);
});

test('a malformed anchor is treated as expired, never trusted into grace', () => {
  const d = decidePaymentGrace(
    input({ graceStartedAt: 'not-a-date', previousStatus: 'past_due' }),
  );
  assert.equal(d.inGrace, false);
});

test('disabling grace mid-window (graceDays=0) expires an already-open window', () => {
  const opened = new Date(NOW - 1 * DAY_MS).toISOString();
  const d = decidePaymentGrace(
    input({ graceStartedAt: opened, graceDays: 0, previousStatus: 'past_due' }),
  );
  assert.equal(d.inGrace, false);
});

test('any non-past_due status closes the window and grants no grace', () => {
  const open = new Date(NOW - DAY_MS).toISOString();
  for (const status of [
    'active',
    'trialing',
    'canceled',
    'unpaid',
    'incomplete',
    'incomplete_expired',
    'paused',
  ]) {
    const d = decidePaymentGrace(input({ status, graceStartedAt: open }));
    assert.equal(d.inGrace, false, `status=${status} should not be in grace`);
    assert.equal(d.graceStartedAt, null, `status=${status} should clear the anchor`);
  }
});

// graceWindowEndIso feeds the payment-failed dunning email: it must return a
// date ONLY while a window is genuinely open, so the email never promises
// retained access that doesn't exist.

test('graceWindowEndIso: returns the window end while the window is open', () => {
  const opened = new Date(NOW - 1 * DAY_MS).toISOString(); // 1 day into a 3-day window
  assert.equal(
    graceWindowEndIso(opened, 3, NOW),
    new Date(Date.parse(opened) + 3 * DAY_MS).toISOString(),
  );
});

test('graceWindowEndIso: null once the window has elapsed', () => {
  const opened = new Date(NOW - 4 * DAY_MS).toISOString(); // past a 3-day window
  assert.equal(graceWindowEndIso(opened, 3, NOW), null);
});

test('graceWindowEndIso: null with no anchor, grace disabled, or a malformed anchor', () => {
  assert.equal(graceWindowEndIso(null, 3, NOW), null);
  assert.equal(graceWindowEndIso(new Date(NOW).toISOString(), 0, NOW), null);
  assert.equal(graceWindowEndIso('not-a-date', 3, NOW), null);
});
