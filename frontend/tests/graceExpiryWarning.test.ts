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
import { buildPayUrl } from '../core/payLink.ts';

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

// 'window-elapsed' drives an operational alarm meaning "this member lost their
// window with no warning sent". A member who WAS warned reaches the same
// elapsed state a day later — decidePaymentGrace keeps the anchor while the
// subscription stays past_due — so counting them here would make the alarm
// climb forever and bury the real misses.
test('a warned member whose window later elapsed is not counted as a miss', () => {
  const anchor = openedHoursAgo(100);
  const d = decideGraceExpiryWarning(input({ graceStartedAt: anchor, warnedFor: anchor }));
  assert.equal(d.send, false);
  assert.equal(d.skip, 'already-warned');
});

// The latch still has to match THIS window: a stale value from an earlier
// window must not disguise a genuine miss as handled.
test('a stale latch from an earlier window still reports an elapsed miss', () => {
  const d = decideGraceExpiryWarning(
    input({ graceStartedAt: openedHoursAgo(100), warnedFor: openedHoursAgo(900) }),
  );
  assert.equal(d.send, false);
  assert.equal(d.skip, 'window-elapsed');
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

// A pending retry used to be sold as a reason to wait ("may still clear on its
// own"). Now it is mentioned only where waiting can work, a short balance, and
// then as a date to have the money in by.
test('a pending retry is a deadline for a short balance, not a reason to wait', () => {
  const funds = buildGraceExpiryWarningEmail({
    reason: 'trial',
    graceUntilIso: DEADLINE,
    nextAttemptIso: RETRY,
    declineCategory: 'insufficient_funds',
  });
  assert.match(funds.text, /funds are in the account before July 26, 2026/);

  for (const declineCategory of ['issuer_block', 'card_problem', null] as const) {
    const { text } = buildGraceExpiryWarningEmail({
      reason: 'trial',
      graceUntilIso: DEADLINE,
      nextAttemptIso: RETRY,
      declineCategory,
    });
    assert.doesNotMatch(text, /July 26, 2026|try again automatically|on its own/, String(declineCategory));
  }
});

test('says the retries have run out only when Stripe says so', () => {
  const exhausted = buildGraceExpiryWarningEmail({ reason: 'trial', graceUntilIso: DEADLINE, nextAttemptIso: null });
  assert.match(exhausted.text, /no automatic retries left/i);
  assert.match(exhausted.text, /canceled/);

  // The sweeper runs without a Stripe key too. Not knowing is not "none left".
  const unknown = buildGraceExpiryWarningEmail({ reason: 'trial', graceUntilIso: DEADLINE });
  assert.doesNotMatch(unknown.text, /retries left|canceled/i);
});

test('repeats the bank\'s reason and gives the same instruction as the first email', () => {
  const funds = buildGraceExpiryWarningEmail({
    reason: 'renewal',
    graceUntilIso: DEADLINE,
    declineCategory: 'insufficient_funds',
  });
  assert.match(funds.text, /insufficient funds/);
  assert.match(funds.text, /pay with a different card/i);
  assert.doesNotMatch(funds.text, /call your bank|update your card/i);

  const bank = buildGraceExpiryWarningEmail({ reason: 'renewal', graceUntilIso: DEADLINE, declineCategory: 'issuer_block' });
  assert.match(bank.text, /call your bank/i);

  // Nothing recorded: both instructions, and no guessed reason.
  const neutral = buildGraceExpiryWarningEmail({ reason: 'renewal', graceUntilIso: DEADLINE });
  assert.match(neutral.text, /different card/i);
  assert.match(neutral.text, /call your bank/i);
  assert.doesNotMatch(neutral.text, /insufficient|expired|declined the charge/i);
});

test('the deadline and the instruction come before the reassurance', () => {
  const { text } = buildGraceExpiryWarningEmail({
    reason: 'trial',
    graceUntilIso: DEADLINE,
    declineCategory: 'insufficient_funds',
  });
  const lines = text.split('\n');
  assert.match(lines[2], /Your access ends on July 27, 2026 unless it's paid\./);
  assert.match(lines[4], /^Please /);
  assert.ok(text.indexOf('Please ') < text.indexOf('Nothing is deleted'));
  assert.doesNotMatch(text, /nothing to fix|nothing changes|is fine|good news|simply moves/i);
});

test('the button pays the invoice in one click, or falls back to the account page', () => {
  const appUrl = 'https://zerogex.test';
  const previous = {
    appUrl: process.env.NEXT_PUBLIC_APP_URL,
    secret: process.env.ZEROGEX_END_USER_TOKEN_SECRET,
  };
  process.env.NEXT_PUBLIC_APP_URL = appUrl;
  process.env.ZEROGEX_END_USER_TOKEN_SECRET = 'test-secret-for-pay-links';
  try {
    const payUrl = buildPayUrl(appUrl, 'in_test123');
    const paid = buildGraceExpiryWarningEmail({
      reason: 'trial',
      graceUntilIso: DEADLINE,
      declineCategory: 'insufficient_funds',
      payUrl,
    });
    assert.ok(paid.html.includes(`href="${payUrl.replace(/&/g, '&amp;')}"`), 'button is not the pay link');
    assert.ok(paid.text.includes(payUrl), 'plain text lacks the pay link');
    assert.match(paid.html, />Pay with a different card</);

    // A card fault updates the card instead, even with a pay link to hand.
    const dead = buildGraceExpiryWarningEmail({
      reason: 'trial',
      graceUntilIso: DEADLINE,
      declineCategory: 'card_problem',
      payUrl,
    });
    assert.ok(dead.html.includes(`href="${appUrl}/account"`));
    assert.match(dead.html, />Update your card</);
    assert.doesNotMatch(dead.html + dead.text, /\/pay\?/);

    // No signed link, or somebody else's: the account page, never Stripe.
    for (const bad of [null, 'https://invoice.stripe.com/i/acct_123/live_abc']) {
      const fallback = buildGraceExpiryWarningEmail({
        reason: 'trial',
        graceUntilIso: DEADLINE,
        declineCategory: 'insufficient_funds',
        payUrl: bad,
      });
      assert.ok(fallback.html.includes(`href="${appUrl}/account"`), String(bad));
      assert.match(fallback.text, /billing portal/, String(bad));
      assert.doesNotMatch(fallback.html + fallback.text, /stripe\.com/, String(bad));
    }
  } finally {
    if (previous.appUrl === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
    else process.env.NEXT_PUBLIC_APP_URL = previous.appUrl;
    if (previous.secret === undefined) delete process.env.ZEROGEX_END_USER_TOKEN_SECRET;
    else process.env.ZEROGEX_END_USER_TOKEN_SECRET = previous.secret;
  }
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
