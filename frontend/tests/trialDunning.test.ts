import test from 'node:test';
import assert from 'node:assert/strict';
import { isTrialConversionFailure, type TrialConversionFailureInput } from '../core/trialDunning.ts';

// Distinguishing a trial-conversion first-charge failure from a renewal failure
// is what lets the webhook send new-customer-appropriate dunning copy instead of
// the renewal-framed nudge. Lock the boundary: a charge right at trial_end is a
// conversion; a charge a full cycle later is a renewal; anything that isn't the
// normal cycle invoice (proration, the $0 trial-create invoice) is neither.

const TRIAL_END = Date.UTC(2026, 7, 14, 12, 0, 0) / 1000; // Unix seconds

function input(over: Partial<TrialConversionFailureInput> = {}): TrialConversionFailureInput {
  return {
    trialEndUnix: TRIAL_END,
    invoiceCreatedUnix: TRIAL_END, // the conversion invoice is created at trial_end
    billingReason: 'subscription_cycle',
    ...over,
  };
}

test('conversion invoice created right at trial_end → trial conversion', () => {
  assert.equal(isTrialConversionFailure(input()), true);
});

test('a few hours after trial_end still counts (real invoices lag slightly)', () => {
  assert.equal(isTrialConversionFailure(input({ invoiceCreatedUnix: TRIAL_END + 3 * 3600 })), true);
});

test('a renewal a full month later is NOT a trial conversion', () => {
  assert.equal(
    isTrialConversionFailure(input({ invoiceCreatedUnix: TRIAL_END + 30 * 24 * 3600 })),
    false,
  );
});

test('no trial on the sub (trial_end null) is never a conversion', () => {
  assert.equal(isTrialConversionFailure(input({ trialEndUnix: null })), false);
});

test('a non-cycle invoice (proration / manual / $0 create) is excluded', () => {
  assert.equal(isTrialConversionFailure(input({ billingReason: 'subscription_update' })), false);
  assert.equal(isTrialConversionFailure(input({ billingReason: 'subscription_create' })), false);
  assert.equal(isTrialConversionFailure(input({ billingReason: 'manual' })), false);
});

test('unknown billing_reason (null) is tolerated — falls back to the time window', () => {
  assert.equal(isTrialConversionFailure(input({ billingReason: null })), true);
});

test('malformed / missing timestamps never classify as a conversion', () => {
  assert.equal(isTrialConversionFailure(input({ invoiceCreatedUnix: null })), false);
  assert.equal(isTrialConversionFailure(input({ trialEndUnix: Number.NaN })), false);
});

test('window is configurable', () => {
  const oneDayLate = TRIAL_END + 24 * 3600;
  assert.equal(isTrialConversionFailure(input({ invoiceCreatedUnix: oneDayLate, windowDays: 0 })), false);
  assert.equal(isTrialConversionFailure(input({ invoiceCreatedUnix: oneDayLate, windowDays: 2 })), true);
});
