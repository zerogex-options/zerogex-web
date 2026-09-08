import test from 'node:test';
import assert from 'node:assert/strict';
import {
  decideGraceExpiryWarning,
  DEFAULT_LEAD_HOURS,
  DEFAULT_MIN_OPEN_HOURS,
  type GraceExpiryWarningInput,
} from '../core/graceExpiryWarning.ts';
import { graceWindowEndIso } from '../core/paymentGrace.ts';
import { buildGraceExpiryWarningEmail } from '../core/mailer.ts';

// The grace-expiry warning is the SECOND dunning touch — the one that closed the
// gap where a member got a single email on day 0 and then silently lost access
// on day 3. Two properties carry that job and are locked down here:
//   1. It fires exactly once per window, and a re-opened window re-arms it.
//   2. It never claims a deadline it can't honor (no window, already elapsed).

const HOUR_MS = 60 * 60 * 1000;
const NOW = Date.UTC(2026, 6, 27, 12, 0, 0); // fixed clock for determinism

// A window that opened `hoursAgo` before NOW.
function openedHoursAgo(hoursAgo: number): string {
  return new Date(NOW - hoursAgo * HOUR_MS).toISOString();
}

function input(over: Partial<GraceExpiryWarningInput> = {}): GraceExpiryWarningInput {
  return {
    graceStartedAt: openedHoursAgo(48), // 3-day window, 24h left
    graceDays: 3,
    warnedFor: null,
    nowMs: NOW,
    ...over,
  };
}

test('sends once the window is inside the lead time', () => {
  const d = decideGraceExpiryWarning(input());
  assert.equal(d.send, true);
  assert.equal(d.skip, null);
  assert.equal(d.hoursRemaining, DEFAULT_LEAD_HOURS);
});

test('holds off while more than the lead time remains', () => {
  const d = decideGraceExpiryWarning(input({ graceStartedAt: openedHoursAgo(24) }));
  assert.equal(d.send, false);
  assert.equal(d.skip, 'not-yet-due');
  assert.equal(d.hoursRemaining, 48);
});

// The one-sided test is the point: a sweep that lands late must still catch the
// member. A centered +/- bracket (as the trial reminder uses) would step over
// them entirely, and for a 3-day window that is the failure that matters.
test('a late sweep still warns while any time remains', () => {
  const d = decideGraceExpiryWarning(input({ graceStartedAt: openedHoursAgo(70) }));
  assert.equal(d.send, true);
  assert.equal(d.hoursRemaining, 2);
});

test('never warns twice about the same window', () => {
  const anchor = openedHoursAgo(48);
  const d = decideGraceExpiryWarning(input({ graceStartedAt: anchor, warnedFor: anchor }));
  assert.equal(d.send, false);
  assert.equal(d.skip, 'already-warned');
});

// The self-invalidating latch: a member who recovered and failed again gets a
// fresh anchor from decidePaymentGrace, so the stored value no longer matches
// and the new window is warned about. This is why nothing has to clear the
// column — and why a stale latch can't silently suppress a future warning.
test('re-arms for a new window without anything clearing the latch', () => {
  const d = decideGraceExpiryWarning(
    input({ graceStartedAt: openedHoursAgo(48), warnedFor: openedHoursAgo(500) }),
  );
  assert.equal(d.send, true);
  assert.equal(d.skip, null);
});

// With graceDays=1 the whole window is 24h, so a bare "<= leadHours remaining"
// test would be true the instant it opened and the member would get the warning
// minutes after the first dunning email.
test('does not stack on the first dunning email when the window is short', () => {
  const d = decideGraceExpiryWarning(input({ graceStartedAt: openedHoursAgo(1), graceDays: 1 }));
  assert.equal(d.send, false);
  assert.equal(d.skip, 'too-soon-after-opening');
});

test('a short window still warns once past the min-open guard', () => {
  const d = decideGraceExpiryWarning(
    input({ graceStartedAt: openedHoursAgo(DEFAULT_MIN_OPEN_HOURS), graceDays: 1 }),
  );
  assert.equal(d.send, true);
  assert.equal(d.hoursRemaining, 12);
});

test('no window: null anchor, grace disabled, or a malformed anchor', () => {
  for (const over of [
    { graceStartedAt: null },
    { graceDays: 0 },
    { graceStartedAt: 'not-a-date' },
  ] as Partial<GraceExpiryWarningInput>[]) {
    const d = decideGraceExpiryWarning(input(over));
    assert.equal(d.send, false);
    assert.equal(d.skip, 'no-window');
    assert.equal(d.graceUntilIso, null);
    assert.equal(d.hoursRemaining, null);
  }
});

// Distinct from 'no-window' on purpose: an elapsed window means a sweep did not
// run often enough, which the script surfaces as an operational warning rather
// than a quiet no-op.
test('an already-elapsed window is reported separately and never warned about', () => {
  const d = decideGraceExpiryWarning(input({ graceStartedAt: openedHoursAgo(100) }));
  assert.equal(d.send, false);
  assert.equal(d.skip, 'window-elapsed');
  assert.equal(d.graceUntilIso, null);
});

// The warning and the first dunning email must never disagree about when a
// member's access actually ends, so both read the deadline from the same helper.
test('the deadline it quotes is the one graceWindowEndIso computes', () => {
  const anchor = openedHoursAgo(48);
  const d = decideGraceExpiryWarning(input({ graceStartedAt: anchor }));
  assert.equal(d.graceUntilIso, graceWindowEndIso(anchor, 3, NOW));
});

// --- copy -------------------------------------------------------------------

const DEADLINE = '2026-07-27T16:00:00Z'; // noon EDT — "July 27, 2026" in NY
const RETRY = '2026-07-26T16:00:00Z';

test('names the deadline in both the subject and the body', () => {
  const { subject, text, html } = buildGraceExpiryWarningEmail({
    reason: 'trial',
    graceUntilIso: DEADLINE,
  });
  assert.match(subject, /July 27, 2026/);
  assert.match(text, /July 27, 2026/);
  assert.match(html, /July 27, 2026/);
});

// A trialer never completed a payment, so renewal wording describes a charge
// they never made — and vice versa. The split must survive in the wire copy.
test('trial and renewal copy describe the right relationship', () => {
  const trial = buildGraceExpiryWarningEmail({ reason: 'trial', graceUntilIso: DEADLINE });
  const renewal = buildGraceExpiryWarningEmail({ reason: 'renewal', graceUntilIso: DEADLINE });

  assert.match(trial.text, /free trial has ended/);
  assert.match(trial.subject, /first charge/);
  assert.doesNotMatch(trial.text, /most recent ZeroGEX payment/);

  assert.match(renewal.text, /most recent ZeroGEX payment/);
  assert.doesNotMatch(renewal.text, /free trial/);
});

test('names the card when one is resolvable, stays neutral when not', () => {
  const named = buildGraceExpiryWarningEmail({
    reason: 'renewal',
    graceUntilIso: DEADLINE,
    cardBrand: 'Visa',
    cardLast4: '4242',
  });
  assert.match(named.text, /your Visa card ending in 4242/);

  const unbranded = buildGraceExpiryWarningEmail({
    reason: 'renewal',
    graceUntilIso: DEADLINE,
    cardLast4: '4242',
  });
  assert.match(unbranded.text, /the card ending in 4242/);

  const neutral = buildGraceExpiryWarningEmail({ reason: 'renewal', graceUntilIso: DEADLINE });
  assert.doesNotMatch(neutral.text, /ending in/);
});

test('a pending retry reads as recoverable; an exhausted schedule does not', () => {
  const pending = buildGraceExpiryWarningEmail({
    reason: 'trial',
    graceUntilIso: DEADLINE,
    nextAttemptIso: RETRY,
  });
  assert.match(pending.text, /try again automatically on July 26, 2026/);

  const exhausted = buildGraceExpiryWarningEmail({ reason: 'trial', graceUntilIso: DEADLINE });
  assert.match(exhausted.text, /final automatic attempt/);
});

// The member's real fear here is losing their account, not their tier. The
// honest answer is also the one most likely to get the card fixed, so it is
// load-bearing copy rather than padding.
test('states the downgrade is non-destructive and reversible', () => {
  const { text } = buildGraceExpiryWarningEmail({ reason: 'trial', graceUntilIso: DEADLINE });
  assert.match(text, /Nothing is deleted/);
  assert.match(text, /switches back on automatically/);
});

// Urgent/transactional emails carry no Folds of Honor footer — the convention
// both dunning siblings follow.
test('carries no Folds of Honor footer', () => {
  const { text, html } = buildGraceExpiryWarningEmail({ reason: 'trial', graceUntilIso: DEADLINE });
  assert.doesNotMatch(text, /Folds of Honor/);
  assert.doesNotMatch(html, /Folds of Honor/);
});

test('escapes interpolated values into the HTML body', () => {
  const { html } = buildGraceExpiryWarningEmail({
    reason: 'renewal',
    graceUntilIso: DEADLINE,
    cardBrand: '<script>alert(1)</script>',
    cardLast4: '4242',
  });
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /&lt;script&gt;/);
});
