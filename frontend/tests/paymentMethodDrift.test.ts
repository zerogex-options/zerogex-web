import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyPaymentMethodPin,
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
    ...over,
  };
}

test('the ibfinanzas shape: pin and customer default disagree', () => {
  const v = classifyPaymentMethodPin(
    input({ pinnedPaymentMethodId: 'pm_old', customerDefaultPaymentMethodId: 'pm_new' }),
  );
  assert.equal(v.kind, 'drift');
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
