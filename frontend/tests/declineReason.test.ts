import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyDecline,
  declineGuidance,
  describeDecline,
  readChargeDecline,
  readPaymentIntentDecline,
  type ChargeDecline,
} from '../core/declineReason.ts';

// The point of this module is that "declined" splits into opposite remedies: an
// issuer block needs the member to approve the charge, an empty account needs
// time or a cheaper plan. Getting the split wrong sends advice that is not just
// unhelpful but slightly insulting in either direction, so lock the mapping down.

function decline(over: Partial<ChargeDecline> = {}): ChargeDecline {
  return { code: null, declineCode: null, message: null, sellerMessage: null, ...over };
}

// --- reading off the wire ---------------------------------------------------

test('reads a failed charge, preferring the issuer code and seller message', () => {
  const d = readChargeDecline({
    status: 'failed',
    failure_code: 'card_declined',
    failure_message: 'Your card was declined.',
    outcome: {
      network_decline_code: 'insufficient_funds',
      seller_message: 'The bank returned the decline code insufficient_funds.',
    },
  });
  assert.equal(d?.code, 'card_declined');
  assert.equal(d?.declineCode, 'insufficient_funds');
  assert.equal(d?.sellerMessage, 'The bank returned the decline code insufficient_funds.');
  assert.equal(classifyDecline(d), 'insufficient_funds');
});

test('a succeeded charge carries no decline', () => {
  assert.equal(readChargeDecline({ status: 'succeeded', outcome: { seller_message: 'Payment complete.' } }), null);
});

test('non-objects and empties read as no decline', () => {
  for (const input of [null, undefined, 'card_declined', 42, {}]) {
    assert.equal(readChargeDecline(input), null);
  }
});

// A charge whose status field is missing but which carries failure data is
// still a failure — the shape varies by API version, so don't require both.
test('failure fields alone are enough, without a status', () => {
  const d = readChargeDecline({ failure_code: 'expired_card' });
  assert.equal(d?.code, 'expired_card');
  assert.equal(classifyDecline(d), 'card_problem');
});

test('reads a PaymentIntent last_payment_error', () => {
  const d = readPaymentIntentDecline({
    last_payment_error: {
      code: 'card_declined',
      decline_code: 'do_not_honor',
      message: 'Your card was declined.',
    },
  });
  assert.equal(classifyDecline(d), 'issuer_block');
  assert.equal(readPaymentIntentDecline({}), null);
});

// --- classification ---------------------------------------------------------

test('maps issuer codes to the remedy they imply', () => {
  const cases: Array<[string, string]> = [
    ['insufficient_funds', 'insufficient_funds'],
    ['withdrawal_count_limit_exceeded', 'insufficient_funds'],
    ['do_not_honor', 'issuer_block'],
    ['generic_decline', 'issuer_block'],
    ['transaction_not_allowed', 'issuer_block'],
    ['lost_card', 'issuer_block'],
    ['expired_card', 'card_problem'],
    ['incorrect_cvc', 'card_problem'],
    ['currency_not_supported', 'card_problem'],
    ['authentication_required', 'authentication_required'],
    ['processing_error', 'try_again'],
    ['issuer_not_available', 'try_again'],
  ];
  for (const [declineCode, expected] of cases) {
    assert.equal(classifyDecline(decline({ declineCode })), expected, declineCode);
  }
});

test('issuer codes are matched case-insensitively', () => {
  assert.equal(classifyDecline(decline({ declineCode: 'INSUFFICIENT_FUNDS' })), 'insufficient_funds');
});

// 'card_declined' is the bucket, not the reason. Mapping it would turn every
// unexplained decline into a confident wrong answer in customer-facing mail.
test('a bare card_declined stays unknown rather than guessing', () => {
  assert.equal(classifyDecline(decline({ code: 'card_declined' })), 'unknown');
});

test('unmapped codes and no data stay unknown', () => {
  assert.equal(classifyDecline(decline({ declineCode: 'some_future_code' })), 'unknown');
  assert.equal(classifyDecline(decline()), 'unknown');
  assert.equal(classifyDecline(null), 'unknown');
});

test('the coarse code is a fallback, never an override', () => {
  // declineCode wins when both are present...
  assert.equal(
    classifyDecline(decline({ code: 'expired_card', declineCode: 'insufficient_funds' })),
    'insufficient_funds',
  );
  // ...and is consulted only when it says nothing.
  assert.equal(classifyDecline(decline({ code: 'expired_card' })), 'card_problem');
});

// --- operator output --------------------------------------------------------

test('every category has actionable guidance', () => {
  const categories = [
    'insufficient_funds',
    'issuer_block',
    'card_problem',
    'authentication_required',
    'try_again',
    'unknown',
  ] as const;
  for (const category of categories) {
    const text = declineGuidance(category);
    assert.ok(text.length > 20, `${category} guidance is too thin`);
  }
});

// The two categories whose advice is opposite must not read alike, since the
// whole feature exists to keep them apart.
test('insufficient-funds guidance does not send them to their bank', () => {
  assert.match(declineGuidance('insufficient_funds'), /cheaper plan|pause/i);
  assert.match(declineGuidance('issuer_block'), /approve it with their bank/i);
  assert.doesNotMatch(declineGuidance('insufficient_funds'), /approve it with their bank/i);
});

test('describeDecline names the category, the text and the codes', () => {
  const line = describeDecline(
    decline({
      code: 'card_declined',
      declineCode: 'insufficient_funds',
      sellerMessage: 'The bank returned the decline code insufficient_funds.',
    }),
  );
  assert.match(line, /^insufficient_funds — "/);
  assert.match(line, /\[card_declined\/insufficient_funds\]$/);
  assert.equal(describeDecline(null), 'no decline data');
});

test('describeDecline degrades when there is no message', () => {
  assert.equal(describeDecline(decline({ declineCode: 'do_not_honor' })), 'issuer_block [do_not_honor]');
});
