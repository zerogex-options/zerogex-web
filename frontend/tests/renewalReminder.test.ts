import test from 'node:test';
import assert from 'node:assert/strict';

// Renewal reminders for prepaid (quarterly / annual) plans — core/renewalReminder.ts.

import { isRenewalReminderDue, RENEWAL_REMINDER_LEAD_DAYS } from '../core/renewalReminder.ts';

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 9, 1, 12, 0, 0);
const iso = (ms: number) => new Date(ms).toISOString();

function input(over: Partial<Parameters<typeof isRenewalReminderDue>[0]> = {}) {
  return {
    cadence: 'annual' as const,
    status: 'active',
    cancelAtPeriodEnd: false,
    periodEndIso: iso(NOW + 20 * DAY),
    sentForIso: null,
    nowMs: NOW,
    ...over,
  };
}

test('lead times: 30 days for annual, 7 for quarterly, none for monthly', () => {
  assert.deepEqual(RENEWAL_REMINDER_LEAD_DAYS, { monthly: null, quarterly: 7, annual: 30 });
});

test('an annual plan inside its 30-day window is due; outside it is not', () => {
  assert.equal(isRenewalReminderDue(input({ periodEndIso: iso(NOW + 30 * DAY) })), true);
  assert.equal(isRenewalReminderDue(input({ periodEndIso: iso(NOW + 30 * DAY + 1) })), false);
  assert.equal(isRenewalReminderDue(input({ periodEndIso: iso(NOW + 1) })), true);
  // Already past: the renewal has happened (or is happening) — too late to remind.
  assert.equal(isRenewalReminderDue(input({ periodEndIso: iso(NOW - 1) })), false);
});

test('a quarterly plan is reminded a week out', () => {
  assert.equal(isRenewalReminderDue(input({ cadence: 'quarterly', periodEndIso: iso(NOW + 7 * DAY) })), true);
  assert.equal(isRenewalReminderDue(input({ cadence: 'quarterly', periodEndIso: iso(NOW + 8 * DAY) })), false);
});

test('monthly plans are never reminded', () => {
  assert.equal(isRenewalReminderDue(input({ cadence: 'monthly', periodEndIso: iso(NOW + DAY) })), false);
});

test('exactly once per renewal: the latch holds for this period and re-arms for the next', () => {
  const periodEndIso = iso(NOW + 10 * DAY);
  assert.equal(isRenewalReminderDue(input({ periodEndIso, sentForIso: periodEndIso })), false);
  assert.equal(isRenewalReminderDue(input({ periodEndIso, sentForIso: iso(NOW - 355 * DAY) })), true);
});

test('only live subscriptions that will actually renew', () => {
  assert.equal(isRenewalReminderDue(input({ cancelAtPeriodEnd: true })), false);
  for (const status of ['trialing', 'past_due', 'canceled', null]) {
    assert.equal(isRenewalReminderDue(input({ status })), false, String(status));
  }
  assert.equal(isRenewalReminderDue(input({ cadence: null })), false);
  assert.equal(isRenewalReminderDue(input({ periodEndIso: null })), false);
  assert.equal(isRenewalReminderDue(input({ periodEndIso: 'not a date' })), false);
});
