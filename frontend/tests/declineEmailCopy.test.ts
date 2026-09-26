import test from 'node:test';
import assert from 'node:assert/strict';

import { buildDeclineEmailCopy, type DeclineEmailInput } from '../core/declineEmailCopy.ts';

// What the member READS when a charge fails, and what it asks them to DO. Two
// wordings failed before this one. The first told everybody to update their
// card, which is wrong for an empty account, whose card works. The second was
// so reassuring it asked nobody to do anything ("nothing to fix", "nothing
// changes right now", "we'll try again automatically"). Each test below pins
// one of those lessons.

const CATEGORIES = [
  'insufficient_funds', 'issuer_block', 'card_problem',
  'authentication_required', 'try_again', 'blocked_by_risk', 'unknown', null,
] as const;

const base: DeclineEmailInput = {
  category: 'insufficient_funds',
  nextAttemptLabel: 'March 3',
  retriesExhausted: false,
  trialConversion: true,
};

const input = (overrides: Partial<DeclineEmailInput> = {}): DeclineEmailInput => ({ ...base, ...overrides });

test('an empty account is told to pay with a different card', () => {
  const copy = buildDeclineEmailCopy(input({ category: 'insufficient_funds' }));
  assert.match(copy.reason, /insufficient funds/i);
  assert.match(copy.remedy, /different card/i);
  assert.match(copy.ctaLabel, /different card/i);
  // Not a card fault: never sent to "update" a card that works, and paying the
  // open invoice is what collects the money.
  assert.doesNotMatch(`${copy.reason} ${copy.remedy} ${copy.ctaLabel}`, /update|expired|re-?enter/i);
  assert.equal(copy.preferInvoice, true);
});

test('an empty account is not sent to its bank', () => {
  // There is nothing for the bank to approve: the money was not there.
  const copy = buildDeclineEmailCopy(input({ category: 'insufficient_funds' }));
  assert.doesNotMatch(copy.remedy, /bank/i);
});

test('a bank refusal is told to call the bank, or use a different card', () => {
  const copy = buildDeclineEmailCopy(input({ category: 'issuer_block' }));
  assert.match(copy.reason, /your bank declined/i);
  assert.match(copy.remedy, /call your bank/i);
  assert.match(copy.remedy, /different card/i);
  // Lost-card and "fraudulent" codes land in this category too, and are never
  // repeated back to the member.
  assert.doesNotMatch(`${copy.reason} ${copy.remedy}`, /fraud|stolen|lost/i);
});

test('no usable reason gets both instructions and no guessed cause', () => {
  // `try_again` belongs here on evidence: its codes read like a glitch and did
  // not clear on retry, so promising that a retry will fix it is off the table.
  for (const category of [null, 'unknown', 'try_again'] as const) {
    const copy = buildDeclineEmailCopy(input({ category }));
    assert.equal(copy.reason, '', String(category));
    assert.match(copy.remedy, /different card/i, String(category));
    assert.match(copy.remedy, /call your bank/i, String(category));
  }
});

test('a genuine card fault is sent to update the card', () => {
  const copy = buildDeclineEmailCopy(input({ category: 'card_problem' }));
  assert.match(copy.reason, /expired|entered incorrectly|no longer active/i);
  assert.match(copy.remedy, /update your card/i);
  assert.match(copy.ctaLabel, /update/i);
  assert.equal(copy.preferInvoice, false);
});

test('a Radar block is never put on the member or their bank', () => {
  // Our own automated check stopped it. Sending the member to a bank that
  // never saw the charge makes the email look like the scam.
  const copy = buildDeclineEmailCopy(input({ category: 'blocked_by_risk' }));
  assert.match(copy.reason, /our (automated )?payment checks|on our side/i);
  assert.doesNotMatch(`${copy.reason} ${copy.remedy}`, /bank|card issuer/i);
  assert.doesNotMatch(copy.subject, /declined/i);
  assert.match(copy.remedy, /reply/i);
});

test('no branch tells the member there is nothing to do', () => {
  // Every phrase below reads as "ignore this email", and members read it so.
  for (const category of CATEGORIES) {
    for (const nextAttemptLabel of ['March 3', null]) {
      const copy = buildDeclineEmailCopy(input({ category, nextAttemptLabel }));
      const all = [copy.subject, copy.reason, copy.remedy, copy.followUp ?? ''].join(' ');
      assert.doesNotMatch(
        all,
        /nothing to (fix|do)|nothing changes|is fine|good news|no action|try again automatically|on its own/i,
        String(category),
      );
      assert.match(copy.remedy, /^Please /, `${category}: the remedy is not an instruction`);
    }
  }
});

test('the keep-this-card route is offered only for a short balance, as a deadline', () => {
  const funds = buildDeclineEmailCopy(input({ category: 'insufficient_funds', nextAttemptLabel: 'March 3' }));
  assert.match(funds.followUp ?? '', /funds are in the account before March 3/);
  for (const category of CATEGORIES.filter((c) => c !== 'insufficient_funds')) {
    const copy = buildDeclineEmailCopy(input({ category, nextAttemptLabel: 'March 3' }));
    assert.equal(copy.followUp, null, String(category));
    assert.doesNotMatch(copy.remedy, /March 3/, String(category));
  }
});

test('"no retries left" is said only when Stripe says so', () => {
  for (const category of CATEGORIES) {
    const exhausted = buildDeclineEmailCopy(input({ category, nextAttemptLabel: null, retriesExhausted: true }));
    assert.match(exhausted.followUp ?? '', /no automatic retries left/i, String(category));
    assert.match(exhausted.followUp ?? '', /canceled/i, String(category));

    // A missing date alone can mean the caller never reached Stripe.
    const unknown = buildDeclineEmailCopy(input({ category, nextAttemptLabel: null, retriesExhausted: false }));
    assert.equal(unknown.followUp, null, String(category));
  }
});

test('subjects state the failure, framed as a trial or a renewal', () => {
  assert.equal(
    buildDeclineEmailCopy(input({ trialConversion: true })).subject,
    'Your ZeroGEX trial ended - your payment was declined',
  );
  assert.equal(buildDeclineEmailCopy(input({ trialConversion: false })).subject, 'Your ZeroGEX payment was declined');
  assert.match(
    buildDeclineEmailCopy(input({ category: 'authentication_required', trialConversion: false })).subject,
    /confirm/i,
  );
  for (const category of CATEGORIES) {
    for (const trialConversion of [true, false]) {
      const { subject } = buildDeclineEmailCopy(input({ category, trialConversion }));
      assert.equal(/trial/i.test(subject), trialConversion, `${category}: trial framing`);
      // A subject takes a plain space before its hyphen, never a no-break
      // space and never a long dash.
      assert.doesNotMatch(subject, /[ –—]/, `${category}: subject spacing`);
    }
  }
});

test('every category produces finished sentences', () => {
  for (const category of CATEGORIES) {
    const copy = buildDeclineEmailCopy(input({ category }));
    assert.ok(copy.remedy.length > 25, `${category} remedy is too thin`);
    assert.ok(copy.ctaLabel.length > 3, `${category} has no button label`);
    for (const sentence of [copy.reason, copy.remedy, copy.followUp].filter(Boolean) as string[]) {
      assert.match(sentence, /^[A-Z]/, `${category}: starts lower-case: ${sentence.slice(0, 40)}`);
      assert.match(sentence.trim(), /[.!?]$/, `${category}: unterminated: ${sentence.slice(-40)}`);
      // Member emails use hyphens, never long dashes.
      assert.doesNotMatch(sentence, /[–—]/, `${category}: long dash`);
    }
  }
});

test('only a real card fault is told to update the card instead of paying', () => {
  // The open invoice takes any card and settles the debt in one step, so paying
  // it is the right button everywhere except where re-saving the card is itself
  // the fix.
  for (const category of CATEGORIES) {
    assert.equal(
      buildDeclineEmailCopy(input({ category })).preferInvoice,
      category !== 'card_problem',
      String(category),
    );
  }
});

test('a lapsed subscription is only ever asked to pay the invoice', () => {
  // The open-invoice recovery email: Stripe stopped retrying and canceled the
  // subscription, so no card is left on file to update and no retry is coming.
  for (const category of CATEGORIES) {
    const copy = buildDeclineEmailCopy(
      input({ category, lapsed: true, trialConversion: false, nextAttemptLabel: null, retriesExhausted: false }),
    );
    assert.equal(copy.preferInvoice, true, String(category));
    assert.equal(copy.followUp, null, String(category));
    assert.match(copy.subject, /^Your ZeroGEX access ended - /, String(category));
    assert.doesNotMatch(copy.remedy, /update your card/i, String(category));
  }
  const dead = buildDeclineEmailCopy(input({ category: 'card_problem', lapsed: true }));
  assert.match(dead.remedy, /pay with a different card/i);
  assert.match(dead.ctaLabel, /different card/i);
  // Even when a caller hands over a retry date or an exhausted schedule, neither
  // "we'll try it again" nor "will be canceled" is true of a canceled plan.
  const funds = buildDeclineEmailCopy(
    input({ category: 'insufficient_funds', lapsed: true, nextAttemptLabel: 'March 3', retriesExhausted: true }),
  );
  assert.equal(funds.followUp, null);
});
