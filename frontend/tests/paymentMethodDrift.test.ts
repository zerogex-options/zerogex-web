import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyPaymentMethodPin,
  decideDriftReportVisibility,
  decideRepointOnPayment,
  type PaymentMethodPinInput,
  type RepointOnPaymentInput,
} from '../core/paymentMethodDrift.ts';

// A subscription pinned to a payment method the member has replaced bills the
// dead method every renewal, and every other signal we have reads it as an
// ordinary decline. This locks the matrix down: a disagreement must be found, a
// method that cannot be charged must outrank a mere disagreement, and the
// healthy shapes must stay quiet — a sweep that cries wolf on every
// subscription with no pin is a sweep nobody runs twice.

const CUSTOMER = 'cus_live';

function input(over: Partial<PaymentMethodPinInput> = {}): PaymentMethodPinInput {
  return {
    customerId: CUSTOMER,
    pinnedPaymentMethodId: 'pm_old',
    customerDefaultPaymentMethodId: 'pm_old',
    pinnedExists: true,
    pinnedOwnerCustomerId: CUSTOMER,
    instrumentSameness: 'different',
    ...over,
  };
}

test('pin and default that are genuinely different instruments is drift', () => {
  const v = classifyPaymentMethodPin(
    input({
      pinnedPaymentMethodId: 'pm_old',
      customerDefaultPaymentMethodId: 'pm_new',
      instrumentSameness: 'different',
    }),
  );
  assert.equal(v.kind, 'drift');
});

// The false positive that a live run produced three of: Stripe mints a fresh
// PaymentMethod on many checkouts, so a member who re-paid with the SAME card
// ends up with two ids for one instrument. Reported as drift, that sends an
// operator to tell a member their old card was the problem when it never was.
test('two ids for one instrument is not drift', () => {
  const v = classifyPaymentMethodPin(
    input({
      pinnedPaymentMethodId: 'pm_a',
      customerDefaultPaymentMethodId: 'pm_b',
      instrumentSameness: 'same',
    }),
  );
  assert.equal(v.kind, 'duplicate');
});

test('an unreadable method is reported as drift, not quietly cleared', () => {
  // 'unknown' means we learned nothing about one side. Silence would be the
  // wrong default: the whole point is to surface pairs worth a human look.
  const v = classifyPaymentMethodPin(
    input({
      pinnedPaymentMethodId: 'pm_a',
      customerDefaultPaymentMethodId: 'pm_b',
      instrumentSameness: 'unknown',
    }),
  );
  assert.equal(v.kind, 'drift');
});

test('sameness defaults to unknown when the caller cannot compare', () => {
  const v = classifyPaymentMethodPin(
    input({ pinnedPaymentMethodId: 'pm_a', customerDefaultPaymentMethodId: 'pm_b' }),
  );
  assert.equal(v.kind, 'drift');
});

test('sameness never rescues a broken pin', () => {
  // A method that is detached cannot be charged even if it is "the same
  // instrument" as the default. Broken has to win over the duplicate check.
  const v = classifyPaymentMethodPin(
    input({
      pinnedPaymentMethodId: 'pm_a',
      customerDefaultPaymentMethodId: 'pm_b',
      instrumentSameness: 'same',
      pinnedExists: false,
      pinnedOwnerCustomerId: null,
    }),
  );
  assert.equal(v.kind, 'broken');
});

test('pin agreeing with the customer default is not a finding', () => {
  const v = classifyPaymentMethodPin(
    input({ pinnedPaymentMethodId: 'pm_same', customerDefaultPaymentMethodId: 'pm_same' }),
  );
  assert.equal(v.kind, 'ok');
});

test('no pin with a customer default is not drift — Stripe falls back to it', () => {
  const v = classifyPaymentMethodPin(
    input({ pinnedPaymentMethodId: null, customerDefaultPaymentMethodId: 'pm_new' }),
  );
  assert.equal(v.kind, 'ok');
});

test('nothing named anywhere is reported separately, not as drift', () => {
  const v = classifyPaymentMethodPin(
    input({ pinnedPaymentMethodId: null, customerDefaultPaymentMethodId: null }),
  );
  assert.equal(v.kind, 'no_default');
});

test('a pin that no longer exists in Stripe is broken, not drift', () => {
  const v = classifyPaymentMethodPin(
    input({ pinnedExists: false, pinnedOwnerCustomerId: null, customerDefaultPaymentMethodId: 'pm_new' }),
  );
  assert.equal(v.kind, 'broken');
  assert.match(v.reason, /no longer exists/);
});

test('a detached pin is broken even when the customer default agrees with it', () => {
  // The ids match, so a disagreement check alone would call this healthy. What
  // makes it a finding is that the method is attached to nobody: Stripe has
  // nothing chargeable, whatever the two fields say.
  const v = classifyPaymentMethodPin(
    input({
      pinnedPaymentMethodId: 'pm_gone',
      customerDefaultPaymentMethodId: 'pm_gone',
      pinnedExists: true,
      pinnedOwnerCustomerId: null,
    }),
  );
  assert.equal(v.kind, 'broken');
  assert.match(v.reason, /detached/);
});

test('a pin owned by another customer is broken, and says so', () => {
  const v = classifyPaymentMethodPin(input({ pinnedOwnerCustomerId: 'cus_someone_else' }));
  assert.equal(v.kind, 'broken');
  assert.match(v.reason, /different customer/);
});

test('broken outranks drift when the pin is both dead and disagreeing', () => {
  // Filing this as drift would under-read it as "the pinned card might still be
  // fine" — it cannot be, so the harder verdict has to win.
  const v = classifyPaymentMethodPin(
    input({
      pinnedPaymentMethodId: 'pm_old',
      customerDefaultPaymentMethodId: 'pm_new',
      pinnedExists: false,
      pinnedOwnerCustomerId: null,
    }),
  );
  assert.equal(v.kind, 'broken');
});

test('a live owned pin with no customer default is not a finding', () => {
  // Nothing to disagree with. The pin is the only instruction Stripe has and it
  // is chargeable, so reporting it would be noise.
  const v = classifyPaymentMethodPin(input({ customerDefaultPaymentMethodId: null }));
  assert.equal(v.kind, 'ok');
});

test('pinnedExists is ignored when there is no pin at all', () => {
  // The caller has no method to retrieve in this shape, so whatever it passes
  // for pinnedExists must not change the verdict.
  for (const pinnedExists of [true, false]) {
    const v = classifyPaymentMethodPin(
      input({ pinnedPaymentMethodId: null, customerDefaultPaymentMethodId: 'pm_new', pinnedExists }),
    );
    assert.equal(v.kind, 'ok');
  }
});

// --- Report visibility -----------------------------------------------------
//
// A live run against 179 subscriptions printed the scanned count, then the
// footer, and nothing in between: the all-clear was keyed on what was FOUND
// while the sections were keyed on what would be SHOWN, so healthy
// same-instrument pairs suppressed the all-clear and were themselves hidden.
// A clean sweep has to be distinguishable from truncated output.

function visibility(over: Partial<Parameters<typeof decideDriftReportVisibility>[0]> = {}) {
  return decideDriftReportVisibility({
    brokenCount: 0,
    driftCount: 0,
    duplicateCount: 0,
    failingDuplicateCount: 0,
    verbose: false,
    ...over,
  });
}

test('the exact live case: healthy same-instrument pairs still print the all-clear', () => {
  const v = visibility({ duplicateCount: 2, failingDuplicateCount: 0 });
  assert.equal(v.allClear, true);
  assert.equal(v.shownDuplicateCount, 0);
  assert.equal(v.hiddenDuplicateCount, 2, 'the all-clear must be able to say they exist');
});

test('a failing same-instrument pair is shown and withholds the all-clear', () => {
  const v = visibility({ duplicateCount: 2, failingDuplicateCount: 1 });
  assert.equal(v.allClear, false);
  assert.equal(v.shownDuplicateCount, 1);
  assert.equal(v.hiddenDuplicateCount, 1);
});

test('--verbose shows every duplicate and hides none', () => {
  const v = visibility({ duplicateCount: 3, failingDuplicateCount: 0, verbose: true });
  assert.equal(v.shownDuplicateCount, 3);
  assert.equal(v.hiddenDuplicateCount, 0);
  assert.equal(v.allClear, false);
});

test('THE INVARIANT: a run is never silent, and never says both things', () => {
  for (const brokenCount of [0, 1]) {
    for (const driftCount of [0, 2]) {
      for (const duplicateCount of [0, 1, 3]) {
        for (const failingDuplicateCount of [0, 1]) {
          if (failingDuplicateCount > duplicateCount) continue;
          for (const verbose of [false, true]) {
            const v = visibility({
              brokenCount,
              driftCount,
              duplicateCount,
              failingDuplicateCount,
              verbose,
            });
            const printsASection =
              brokenCount > 0 || driftCount > 0 || v.shownDuplicateCount > 0;
            assert.notEqual(
              v.allClear,
              printsASection,
              `silent or contradictory report for ${JSON.stringify({
                brokenCount, driftCount, duplicateCount, failingDuplicateCount, verbose,
              })}`,
            );
            assert.ok(v.hiddenDuplicateCount >= 0, 'hidden count must never go negative');
          }
        }
      }
    }
  }
});

// --- decideRepointOnPayment ---------------------------------------------------
//
// The webhook re-points a subscription at the method that just paid its invoice,
// so a member who rescues a failed renewal with a new method is not billed on
// the failed one again next month. It must act on exactly that case, and stay
// out of every other one: the method that paid must be chargeable again, and
// there must be something renewing to point at it.

function repoint(over: Partial<RepointOnPaymentInput> = {}): RepointOnPaymentInput {
  return {
    amountPaid: 2900,
    subscriptionStatus: 'active',
    customerId: CUSTOMER,
    pinnedPaymentMethodId: 'pm_old_card',
    customerDefaultPaymentMethodId: 'pm_link',
    paidWithPaymentMethodId: 'pm_link',
    paidWithOwnerCustomerId: CUSTOMER,
    ...over,
  };
}

test('re-points when a rescue paid with a different saved method (the aabbon case)', () => {
  const d = decideRepointOnPayment(repoint());
  assert.equal(d.repoint, true);
});

test('fills an empty pin with the saved method that paid (the chen case)', () => {
  const d = decideRepointOnPayment(
    repoint({ pinnedPaymentMethodId: null, customerDefaultPaymentMethodId: null }),
  );
  assert.equal(d.repoint, true);
});

test('fills an empty pin when the customer default is some other method', () => {
  const d = decideRepointOnPayment(
    repoint({ pinnedPaymentMethodId: null, customerDefaultPaymentMethodId: 'pm_other' }),
  );
  assert.equal(d.repoint, true);
});

test('stays out when the subscription already renews on the method that paid', () => {
  const d = decideRepointOnPayment(repoint({ pinnedPaymentMethodId: 'pm_link' }));
  assert.equal(d.repoint, false);
});

test('stays out when there is no pin and the fallback default is the method that paid', () => {
  const d = decideRepointOnPayment(
    repoint({ pinnedPaymentMethodId: null, customerDefaultPaymentMethodId: 'pm_link' }),
  );
  assert.equal(d.repoint, false);
});

test('never points at a one-off method that is not saved to the customer', () => {
  assert.equal(decideRepointOnPayment(repoint({ paidWithOwnerCustomerId: null })).repoint, false);
  assert.equal(
    decideRepointOnPayment(repoint({ paidWithOwnerCustomerId: 'cus_someone_else' })).repoint,
    false,
  );
});

test('stays out when nothing was charged', () => {
  assert.equal(decideRepointOnPayment(repoint({ amountPaid: 0 })).repoint, false);
});

test('stays out when the paying method could not be read', () => {
  assert.equal(decideRepointOnPayment(repoint({ paidWithPaymentMethodId: null })).repoint, false);
});

test('re-points every status that renews, and none that does not', () => {
  for (const status of ['active', 'trialing', 'past_due', 'unpaid']) {
    assert.equal(decideRepointOnPayment(repoint({ subscriptionStatus: status })).repoint, true, status);
  }
  for (const status of ['canceled', 'incomplete', 'incomplete_expired', 'paused']) {
    assert.equal(decideRepointOnPayment(repoint({ subscriptionStatus: status })).repoint, false, status);
  }
});
