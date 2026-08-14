import test from 'node:test';
import assert from 'node:assert/strict';
import { decideCardExpiryReminder, type CardExpiryInput } from '../core/cardExpiry.ts';

// The proactive card-expiry reminder must fire exactly once per expiring card,
// only while there's still time to act, and re-arm when the member swaps in a new
// card. Lock the window + the latch behavior.

const NOW = Date.UTC(2026, 7, 14, 12, 0, 0); // 2026-08-14 (month index 7 = Aug)

function input(over: Partial<CardExpiryInput> = {}): CardExpiryInput {
  return {
    expMonth: 9, // Sept 2026 → invalid Oct 1 2026 (~48 days out from NOW)
    expYear: 2026,
    nowMs: NOW,
    alreadyNotifiedYm: null,
    ...over,
  };
}

test('a card expiring within the window, not yet warned → notify', () => {
  // Sept 2026 expiry (invalid Oct 1) is ~48d out; use a 60d threshold.
  const d = decideCardExpiryReminder(input({ thresholdDays: 60 }));
  assert.equal(d.shouldNotify, true);
  assert.equal(d.notifyYm, '2026-09');
  assert.equal(d.expiryLabel, '09/2026');
});

test('a card expiring beyond the window → no notify (but still reports the ym/label)', () => {
  const d = decideCardExpiryReminder(input({ expMonth: 12, expYear: 2027, thresholdDays: 45 }));
  assert.equal(d.shouldNotify, false);
  assert.equal(d.notifyYm, '2027-12');
});

test('an already-expired card is left to the dunning path, not this reminder', () => {
  const d = decideCardExpiryReminder(input({ expMonth: 7, expYear: 2026 })); // invalid Aug 1, before NOW
  assert.equal(d.shouldNotify, false);
});

test('already warned for the SAME expiry → skip (no re-nag)', () => {
  const d = decideCardExpiryReminder(input({ thresholdDays: 60, alreadyNotifiedYm: '2026-09' }));
  assert.equal(d.shouldNotify, false);
});

test('warned for a DIFFERENT expiry (member updated the card) → re-arms', () => {
  const d = decideCardExpiryReminder(input({ thresholdDays: 60, alreadyNotifiedYm: '2026-05' }));
  assert.equal(d.shouldNotify, true);
  assert.equal(d.notifyYm, '2026-09');
});

test('a card at the very edge of the current month still counts (end-of-month validity)', () => {
  // Card exp Aug 2026: valid through Aug 31, invalid Sep 1 — still in the future
  // relative to NOW (mid-Aug), so with a modest threshold it should notify.
  const d = decideCardExpiryReminder(input({ expMonth: 8, expYear: 2026, thresholdDays: 45 }));
  assert.equal(d.shouldNotify, true);
  assert.equal(d.expiryLabel, '08/2026');
});

test('unusable / malformed expiries never notify (wallet, out-of-range, non-integer)', () => {
  for (const bad of [
    { expMonth: null, expYear: null },
    { expMonth: 0, expYear: 2026 },
    { expMonth: 13, expYear: 2026 },
    { expMonth: 9, expYear: 1999 },
    { expMonth: 9.5, expYear: 2026 },
  ]) {
    const d = decideCardExpiryReminder(input({ ...bad, thresholdDays: 60 }));
    assert.equal(d.shouldNotify, false, `expiry ${JSON.stringify(bad)} should not notify`);
  }
});
