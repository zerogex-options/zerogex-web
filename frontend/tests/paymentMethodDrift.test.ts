import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyPaymentMethodPin,
  decideDriftReportVisibility,
  type PaymentMethodPinInput,
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
