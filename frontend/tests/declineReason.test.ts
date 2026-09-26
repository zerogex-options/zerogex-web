import test from 'node:test';
import assert from 'node:assert/strict';
import {
  categoryFromStoredDeclines,
  classifyDecline,
  declineGuidance,
  transientClaimExpired,
  TRANSIENT_ATTEMPT_LIMIT,
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
  return {
    code: null,
    declineCode: null,
    networkDeclineCode: null,
    message: null,
    sellerMessage: null,
    ...over,
  };
}

// --- reading off the wire ---------------------------------------------------

test('reads a failed charge, taking the normalized reason and the seller message', () => {
  const d = readChargeDecline({
    status: 'failed',
    failure_code: 'card_declined',
    failure_message: 'Your card was declined.',
    outcome: {
      reason: 'insufficient_funds',
      network_decline_code: '51',
      seller_message: 'The bank returned the decline code insufficient_funds.',
    },
  });
  assert.equal(d?.code, 'card_declined');
  assert.equal(d?.declineCode, 'insufficient_funds');
  assert.equal(d?.networkDeclineCode, '51');
  assert.equal(d?.sellerMessage, 'The bank returned the decline code insufficient_funds.');
  assert.equal(classifyDecline(d), 'insufficient_funds');
});

// REGRESSION. The first real decline this module met in production carried NO
// outcome.reason -- only the raw network code 51 -- and the original read put
// that numeric into declineCode, where the string lookup missed it and the whole
// thing classified as 'unknown'. The seller message said insufficient_funds in
// plain sight. Five retries across five days never cleared, and the operator was
// told to use neutral copy when the gentler insufficient-funds copy was right.
test('a raw network code classifies even with no outcome.reason', () => {
  const d = readChargeDecline({
    status: 'failed',
    failure_code: 'card_declined',
    outcome: {
      network_decline_code: '51',
      seller_message: 'The bank returned the decline code `insufficient_funds`.',
    },
  });
  assert.equal(d?.declineCode, null, 'a numeric must never land in the string field');
  assert.equal(d?.networkDeclineCode, '51');
  assert.equal(classifyDecline(d), 'insufficient_funds');
});

test('network codes classify across the categories, padded or not', () => {
  const cases: Array<[string, string]> = [
    ['51', 'insufficient_funds'],
    ['61', 'insufficient_funds'],
    ['05', 'issuer_block'],
    ['5', 'issuer_block'],
    ['041', 'issuer_block'],
    ['54', 'card_problem'],
    ['91', 'try_again'],
    ['99', 'unknown'],
    ['not-a-number', 'unknown'],
  ];
  for (const [networkDeclineCode, expected] of cases) {
    assert.equal(classifyDecline(decline({ networkDeclineCode })), expected, networkDeclineCode);
  }
});

// The string alphabet is the more specific signal and must win outright, so a
// mismatched pair can never be resolved by the numeric.
test('the normalized reason outranks the raw network code', () => {
  assert.equal(
    classifyDecline(decline({ declineCode: 'expired_card', networkDeclineCode: '51' })),
    'card_problem',
  );
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
      networkDeclineCode: '51',
      sellerMessage: 'The bank returned the decline code insufficient_funds.',
    }),
  );
  assert.match(line, /^insufficient_funds — "/);
  assert.match(line, /\[card_declined\/insufficient_funds\/51\]$/);
  assert.equal(describeDecline(null), 'no decline data');
});

test('describeDecline degrades when there is no message', () => {
  assert.equal(describeDecline(decline({ declineCode: 'do_not_honor' })), 'issuer_block [do_not_honor]');
});

// ---------------------------------------------------------------------------
// Codes seen on real production declines that previously fell through to
// 'unknown'. Each was left unmapped until it actually turned up; the ones still
// absent below are absent on purpose.
// ---------------------------------------------------------------------------

test('a banking-partner shortfall is still a shortfall', () => {
  // The single most common decline on a live product, and it was reading as
  // "no usable decline code" — the one bucket nobody can act on.
  assert.equal(classifyDecline(decline({ declineCode: 'partner_insufficient_funds' })), 'insufficient_funds');
});

test('"do not retry" is the issuer conversation, not a retry', () => {
  assert.equal(
    classifyDecline(decline({ declineCode: 'previously_declined_do_not_retry' })),
    'issuer_block',
  );
});

test('a Radar block is OURS, and never reported as the bank refusing', () => {
  // Telling a member to call their bank about a charge our own fraud rules
  // refused sends them somewhere that cannot help and makes us look broken.
  assert.equal(classifyDecline(decline({ declineCode: 'highest_risk_level' })), 'blocked_by_risk');
  const guidance = declineGuidance('blocked_by_risk');
  assert.match(guidance, /Radar/);
  // It must say WHOSE decision this was, and forbid the bank framing outright —
  // the issuer_block advice would send the member somewhere that cannot help.
  assert.match(guidance, /never tell the member their bank/i);
  assert.notEqual(guidance, declineGuidance('issuer_block'));
});

test('dropped connections and undelivered mandate notices are transient', () => {
  assert.equal(classifyDecline(decline({ declineCode: 'link_connection_closed' })), 'try_again');
  assert.equal(classifyDecline(decline({ declineCode: 'debit_notification_undelivered' })), 'try_again');
});

test('a generic payment failure is still not guessed at', () => {
  // Same rule as `card_declined`: it names the outcome, not the cause. Mapping
  // it would turn every unexplained decline into a confident wrong answer.
  assert.equal(classifyDecline(decline({ declineCode: 'payment_intent_generic_payment_failed' })), 'unknown');
});

test('a Radar rule firing on a postcode or CVC mismatch is OUR block, not the card being broken', () => {
  // These look like a card problem and are not one: the member cannot fix a rule
  // they cannot see, and "update your card" is the wrong ask.
  for (const code of ['requested_block_on_incorrect_zip', 'requested_block_on_incorrect_cvc', 'requested_block']) {
    assert.equal(classifyDecline(decline({ declineCode: code })), 'blocked_by_risk', code);
  }
  assert.notEqual(classifyDecline(decline({ declineCode: 'requested_block_on_incorrect_zip' })), 'card_problem');
});

test('a charge our Radar rules or Stripe itself stopped is OUR block, not the bank', () => {
  // `rule` is outcome.reason for one of our Radar rules; it reached the dunning
  // emails as "unknown", whose copy tells the member to call their bank.
  // `low_probability_of_authorization` is Stripe declining to send it at all.
  for (const code of ['rule', 'low_probability_of_authorization']) {
    assert.equal(classifyDecline(decline({ code: 'card_declined', declineCode: code })), 'blocked_by_risk', code);
  }
  // Read off the wire the way the webhook sees it: outcome.reason is the field.
  const charge = {
    status: 'failed',
    failure_code: 'card_declined',
    failure_message: 'Your card was declined.',
    outcome: { type: 'blocked', reason: 'rule', seller_message: 'Stripe blocked this payment.' },
  };
  assert.equal(classifyDecline(readChargeDecline(charge)), 'blocked_by_risk');
});

// --- reading the ledger back -----------------------------------------------

const stored = (over: Partial<Parameters<typeof categoryFromStoredDeclines>[0][number]> = {}) => ({
  category: null,
  failureCode: null,
  declineCode: null,
  networkDeclineCode: null,
  ...over,
});

test('a stored category stands, and the latest usable row wins', () => {
  assert.equal(
    categoryFromStoredDeclines([stored({ category: 'issuer_block' }), stored({ category: 'insufficient_funds' })]),
    'issuer_block',
  );
  // A later attempt that said nothing usable does not erase an earlier reason.
  assert.equal(
    categoryFromStoredDeclines([stored({ category: 'unknown' }), stored({ category: 'insufficient_funds' })]),
    'insufficient_funds',
  );
});

test('an unknown row is asked again from its stored codes', () => {
  // Recorded before `rule` was mapped: stored as unknown, codes intact. Every
  // email reading the ledger must see the block for what it is, without waiting
  // on a backfill to rewrite the row.
  assert.equal(
    categoryFromStoredDeclines([stored({ category: 'unknown', failureCode: 'card_declined', declineCode: 'rule' })]),
    'blocked_by_risk',
  );
  assert.equal(
    categoryFromStoredDeclines([stored({ category: 'unknown', networkDeclineCode: '51' })]),
    'insufficient_funds',
  );
});

test('nothing usable on record reads as no reason, never a guess', () => {
  assert.equal(categoryFromStoredDeclines([]), null);
  assert.equal(categoryFromStoredDeclines([stored({ category: 'unknown', failureCode: 'card_declined' })]), null);
  // A value that is not a category at all is not trusted either.
  assert.equal(categoryFromStoredDeclines([stored({ category: 'constructor' })]), null);
});

// ---------------------------------------------------------------------------
// A transient code that outlived its own premise
//
// Found in production, not in review: six try_again invoices, 27 attempts
// between them, zero recovered. The category's whole claim is that the next
// retry will fix it, and here it never did — while the panel went on telling
// the operator "no action needed yet" beside a column reading "recovery
// exhausted".
// ---------------------------------------------------------------------------

test('try_again advice holds while the retries are still running', () => {
  const early = declineGuidance('try_again', { attempts: 1, retriesExhausted: false });
  assert.match(early, /clear on its own|check back/i);
  // It must not promise, even early: the old copy said "very likely to clear",
  // which is the sentence the data falsified.
  assert.doesNotMatch(early, /very likely/i);
});

test('try_again advice escalates once the retries have failed', () => {
  const spent = declineGuidance('try_again', { attempts: 5, retriesExhausted: true });
  assert.match(spent, /issuer block|refusing persistently/i);
  assert.match(spent, /bank|different card/i);
  assert.notEqual(spent, declineGuidance('try_again', { attempts: 1 }));
  // Silence is the failure mode being fixed — the row has to ask for a human.
  assert.doesNotMatch(spent, /no action needed/i);
});

test('either signal alone expires the transient claim', () => {
  // Authoritative, and present on rows written since the Stripe columns landed.
  assert.equal(transientClaimExpired({ attempts: 1, retriesExhausted: true }), true);
  // The fallback, for backfilled rows whose retry state reads 'unknown'.
  assert.equal(transientClaimExpired({ attempts: TRANSIENT_ATTEMPT_LIMIT }), true);
  assert.equal(transientClaimExpired({ attempts: TRANSIENT_ATTEMPT_LIMIT - 1 }), false);
  // No context at all is not evidence of exhaustion.
  assert.equal(transientClaimExpired(undefined), false);
  assert.equal(transientClaimExpired({}), false);
});

test('only try_again reads the attempt count', () => {
  // Every other category describes a standing fact about the card or the issuer,
  // which five attempts neither confirm nor refute. If they started varying,
  // the advice would drift with volume rather than with evidence.
  for (const category of ['insufficient_funds', 'issuer_block', 'card_problem', 'blocked_by_risk', 'unknown'] as const) {
    assert.equal(
      declineGuidance(category, { attempts: 9, retriesExhausted: true }),
      declineGuidance(category),
      `${category} guidance must not depend on attempts`,
    );
  }
});
