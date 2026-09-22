import test from 'node:test';
import assert from 'node:assert/strict';
import {
  hasConversionChargeInFlight,
  isTrialConversionFailure,
  isWithinTrialConversionWindow,
  type TrialConversionFailureInput,
} from '../core/trialDunning.ts';

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

// The subscription-only variant, used by the grace decision on
// customer.subscription.updated where no invoice is in hand. Same window, same
// skew — a trial that ended moments ago is a first charge; a renewal a cycle
// later is not.
const NOW_MS = TRIAL_END * 1000;

test('isWithinTrialConversionWindow: right at trial_end is a conversion', () => {
  assert.equal(isWithinTrialConversionWindow(TRIAL_END, NOW_MS), true);
});

test('isWithinTrialConversionWindow: an hour later (invoice finalization lag) still counts', () => {
  assert.equal(isWithinTrialConversionWindow(TRIAL_END, NOW_MS + 3600_000), true);
});

test('isWithinTrialConversionWindow: a renewal a cycle later does not', () => {
  assert.equal(isWithinTrialConversionWindow(TRIAL_END, NOW_MS + 30 * 24 * 3600_000), false);
});

test('isWithinTrialConversionWindow: no trial on the sub is never a conversion', () => {
  assert.equal(isWithinTrialConversionWindow(null, NOW_MS), false);
  assert.equal(isWithinTrialConversionWindow(undefined, NOW_MS), false);
});

test('isWithinTrialConversionWindow: malformed inputs are never trusted', () => {
  assert.equal(isWithinTrialConversionWindow(Number.NaN, NOW_MS), false);
  assert.equal(isWithinTrialConversionWindow(Number.POSITIVE_INFINITY, NOW_MS), false);
  assert.equal(isWithinTrialConversionWindow(TRIAL_END, Number.NaN), false);
});

test('isWithinTrialConversionWindow: window is configurable and matches the invoice check', () => {
  const oneDayLate = NOW_MS + 24 * 3600_000;
  assert.equal(isWithinTrialConversionWindow(TRIAL_END, oneDayLate, 0), false);
  assert.equal(isWithinTrialConversionWindow(TRIAL_END, oneDayLate, 2), true);
  // Same boundary the invoice-based check uses, so the two can't drift apart.
  assert.equal(
    isWithinTrialConversionWindow(TRIAL_END, oneDayLate),
    isTrialConversionFailure({ trialEndUnix: TRIAL_END, invoiceCreatedUnix: oneDayLate / 1000 }),
  );
});

// hasConversionChargeInFlight answers "is money about to move right now?" at the
// moment a member cancels. Stripe creates the post-trial cycle invoice as a
// DRAFT at trial_end and only finalizes (and charges) it ~1h later, and
// cancel_at_period_end does nothing to an invoice that already exists — so a
// cancel inside that hour is still followed by a charge. The charge stands;
// what this predicate buys is a cancellation email that says so up front
// instead of promising "nothing changes yet on your end".

const CONVERSION_TRIAL_END = Math.floor(Date.UTC(2026, 8, 14, 10, 3, 14) / 1000);
const MS_HOUR = 60 * 60 * 1000;

test('hasConversionChargeInFlight: the real case — canceled between trial end and the charge', () => {
  // Exactly the reported incident: trial ended 10:03, canceled 10:33, the draft
  // invoice finalized and charged 11:04.
  assert.equal(
    hasConversionChargeInFlight({
      status: 'active',
      trialEndUnix: CONVERSION_TRIAL_END,
      subscriptionPaidAtIso: null,
      nowMs: CONVERSION_TRIAL_END * 1000 + 30 * 60 * 1000,
    }),
    true,
  );
});

test('hasConversionChargeInFlight: canceling DURING the trial is the happy path', () => {
  // Still trialing → no invoice exists yet and they are never charged at all.
  // This member must keep the reassuring copy.
  assert.equal(
    hasConversionChargeInFlight({
      status: 'trialing',
      trialEndUnix: CONVERSION_TRIAL_END,
      subscriptionPaidAtIso: null,
      nowMs: CONVERSION_TRIAL_END * 1000 - 2 * MS_HOUR,
    }),
    false,
  );
});

test('hasConversionChargeInFlight: an established member has nothing in flight', () => {
  assert.equal(
    hasConversionChargeInFlight({
      status: 'active',
      trialEndUnix: CONVERSION_TRIAL_END,
      subscriptionPaidAtIso: '2026-09-14T11:04:09.443Z',
      nowMs: CONVERSION_TRIAL_END * 1000 + 40 * 24 * MS_HOUR,
    }),
    false,
  );
});

test('hasConversionChargeInFlight: a RETURNING member is still warned', () => {
  // The regression this rename exists to prevent. Reading the account-scoped
  // users.first_payment_at here disarmed the warning for everyone on their
  // second subscription: they carry a non-null value in from the first, so a
  // reactivated member canceling inside the conversion hour was told "nothing
  // changes yet on your end" — and then charged half an hour later.
  //
  // subscriptionPaidAt returns null for them (the pointer names the PREVIOUS
  // subscription), so the warning fires exactly as it does for a first-timer.
  assert.equal(
    hasConversionChargeInFlight({
      status: 'active',
      trialEndUnix: CONVERSION_TRIAL_END,
      subscriptionPaidAtIso: null,
      nowMs: CONVERSION_TRIAL_END * 1000 + 30 * 60 * 1000,
    }),
    true,
  );
});

test('hasConversionChargeInFlight: past_due is left to the payment-failed email', () => {
  // That member already got told the amount and that it failed; this email must
  // not claim a payment "will go through shortly" on top of it.
  assert.equal(
    hasConversionChargeInFlight({
      status: 'past_due',
      trialEndUnix: CONVERSION_TRIAL_END,
      subscriptionPaidAtIso: null,
      nowMs: CONVERSION_TRIAL_END * 1000 + 30 * 60 * 1000,
    }),
    false,
  );
});

test('hasConversionChargeInFlight: a trial_end still in the future is never "already charged"', () => {
  // Guards clock skew: isWithinTrialConversionWindow tolerates an hour either
  // side by design, which would otherwise read as a charge that cannot exist.
  assert.equal(
    hasConversionChargeInFlight({
      status: 'active',
      trialEndUnix: CONVERSION_TRIAL_END,
      subscriptionPaidAtIso: null,
      nowMs: CONVERSION_TRIAL_END * 1000 - 30 * 60 * 1000,
    }),
    false,
  );
});

test('hasConversionChargeInFlight: outside the conversion window it is some other billing state', () => {
  assert.equal(
    hasConversionChargeInFlight({
      status: 'active',
      trialEndUnix: CONVERSION_TRIAL_END,
      subscriptionPaidAtIso: null,
      nowMs: CONVERSION_TRIAL_END * 1000 + 5 * 24 * MS_HOUR,
    }),
    false,
  );
});

test('hasConversionChargeInFlight: malformed inputs are never trusted', () => {
  const now = CONVERSION_TRIAL_END * 1000 + 30 * 60 * 1000;
  assert.equal(
    hasConversionChargeInFlight({ status: 'active', trialEndUnix: null, subscriptionPaidAtIso: null, nowMs: now }),
    false,
  );
  assert.equal(
    hasConversionChargeInFlight({ status: null, trialEndUnix: CONVERSION_TRIAL_END, subscriptionPaidAtIso: null, nowMs: now }),
    false,
  );
  assert.equal(
    hasConversionChargeInFlight({ status: 'active', trialEndUnix: Number.NaN, subscriptionPaidAtIso: null, nowMs: now }),
    false,
  );
  assert.equal(
    hasConversionChargeInFlight({ status: 'active', trialEndUnix: CONVERSION_TRIAL_END, subscriptionPaidAtIso: null, nowMs: Number.NaN }),
    false,
  );
});
