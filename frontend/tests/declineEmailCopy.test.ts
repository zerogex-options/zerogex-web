import test from 'node:test';
import assert from 'node:assert/strict';

import { buildDeclineEmailCopy, type DeclineEmailInput } from '../core/declineEmailCopy.ts';

// What the member READS when a charge fails. Every case below is a sentence the
// old single-message version got wrong for somebody, and two of them are wrong
// in ways that send a person to an institution that cannot help them.

const base: DeclineEmailInput = {
  category: 'insufficient_funds',
  cardPhrase: 'your Visa card ending in 4242',
  nextAttemptLabel: 'March 3',
  hasInvoiceUrl: true,
  trialConversion: true,
};

const input = (overrides: Partial<DeclineEmailInput> = {}): DeclineEmailInput => ({ ...base, ...overrides });

test('an empty account is never told to fix a card that works', () => {
  // 60 first payments got "update your card" for this. The card was fine every
  // time; the instruction was not just useless but actively misleading, because
  // the member goes and finds nothing wrong.
  const copy = buildDeclineEmailCopy(input({ category: 'insufficient_funds' }));
  assert.match(copy.reason, /insufficient funds/i);
  assert.match(copy.reason, /nothing to fix|is fine/i);
  assert.doesNotMatch(copy.reason, /update your card|expired|re-?enter it/i);
  assert.doesNotMatch(copy.ctaLabel, /update/i);
  // And it must point at the thing that can actually collect the money.
  assert.equal(copy.preferInvoice, true);
});

test('a genuine card fault still sends them to the account page', () => {
  // The fix must not overshoot: when the card really is the problem, the hosted
  // invoice would collect this one payment and leave the next renewal to fail
  // against the same dead card.
  const copy = buildDeclineEmailCopy(input({ category: 'card_problem' }));
  assert.match(copy.reason, /expired|mistyped|no longer accepted/i);
  assert.match(copy.ctaLabel, /update/i);
  assert.equal(copy.preferInvoice, false);
});

test('a Radar block is never reported to the member as their bank refusing', () => {
  // Our own automated check stopped it. Telling them their bank declined sends
  // them to an issuer that never saw the charge — the same rule
  // core/declineReason.ts already enforces for the operator-facing guidance.
  const copy = buildDeclineEmailCopy(input({ category: 'blocked_by_risk' }));
  assert.doesNotMatch(copy.reason, /your bank|card issuer|declined by/i);
  assert.match(copy.reason, /our (automated )?payment checks|on our side/i);
  assert.match(copy.remedy, /reply/i);
});

test('an unknown reason states only what we observed', () => {
  // Guessing a cause in customer-facing mail is how somebody ends up phoning a
  // bank about a charge it never saw.
  for (const category of [null, 'unknown'] as const) {
    const copy = buildDeclineEmailCopy(input({ category }));
    assert.match(copy.reason, /did not go through/i);
    assert.doesNotMatch(copy.reason, /insufficient funds|expired|your bank (declined|blocked)/i);
  }
});

test('the retry line tells the truth about whether Stripe will try again', () => {
  const more = buildDeclineEmailCopy(input({ nextAttemptLabel: 'March 3' }));
  assert.match(more.remedy, /try again automatically on March 3/i);

  const done = buildDeclineEmailCopy(input({ nextAttemptLabel: null }));
  assert.match(done.remedy, /last automatic attempt|will not retry/i);
  assert.doesNotMatch(done.remedy, /will try again automatically on/i);
});

test('no invoice link means no invitation to use one', () => {
  const copy = buildDeclineEmailCopy(input({ hasInvoiceUrl: false }));
  assert.doesNotMatch(copy.remedy, /link below|takes any card/i);
  // The reason still stands on its own — losing the link must not lose the
  // explanation, which is the half that stops a wasted call to the bank.
  assert.match(copy.reason, /insufficient funds/i);
});

test('trial conversions and renewals are described as what they are', () => {
  const trial = buildDeclineEmailCopy(input({ trialConversion: true }));
  assert.match(trial.reason, /first charge/i);
  const renewal = buildDeclineEmailCopy(input({ trialConversion: false }));
  assert.doesNotMatch(renewal.reason, /first charge/i);
});

test('every category produces usable copy', () => {
  const categories = [
    'insufficient_funds', 'issuer_block', 'card_problem',
    'authentication_required', 'try_again', 'blocked_by_risk', 'unknown',
  ] as const;
  for (const category of categories) {
    const copy = buildDeclineEmailCopy(input({ category }));
    assert.ok(copy.reason.length > 25, `${category} reason is too thin`);
    assert.ok(copy.ctaLabel.length > 3, `${category} has no button label`);
    // A sentence that trails off mid-clause reads as a broken template.
    assert.match(copy.reason.trim(), /[.!?]$/, `${category} reason is unterminated`);
    if (copy.remedy) assert.match(copy.remedy.trim(), /[.!?]$/, `${category} remedy is unterminated`);
  }
});

test('only a real card fault keeps the member off the invoice page', () => {
  // Stated as an invariant rather than case by case: the hosted page takes any
  // card and settles the debt in one step, so it is the right destination
  // everywhere except where re-saving the card is itself the fix.
  const categories = [
    'insufficient_funds', 'issuer_block', 'authentication_required',
    'try_again', 'blocked_by_risk', 'unknown',
  ] as const;
  for (const category of categories) {
    assert.equal(buildDeclineEmailCopy(input({ category })).preferInvoice, true, category);
  }
  assert.equal(buildDeclineEmailCopy(input({ category: 'card_problem' })).preferInvoice, false);
});

test('the reason always opens a sentence properly', () => {
  // It follows "…start your subscription ($49.00)." in both emails, and two
  // branches lead with the card phrase, which is lower-case by construction.
  // Rendering the real email caught this; no assertion on the fragment did.
  const categories = [
    'insufficient_funds', 'issuer_block', 'card_problem',
    'authentication_required', 'try_again', 'blocked_by_risk', 'unknown',
  ] as const;
  for (const category of categories) {
    for (const cardPhrase of ['your Visa card ending in 4242', null]) {
      const { reason } = buildDeclineEmailCopy(input({ category, cardPhrase }));
      assert.match(reason, /^[A-Z]/, `${category} reason starts lower-case: ${reason.slice(0, 40)}`);
    }
  }
});
