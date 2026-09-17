import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_COOLDOWN_DAYS,
  decideReturnIntent,
  returnIntentAngle,
  type ReturnIntentInput,
} from '../core/returnIntent.ts';

// This sweep mails a cohort that has already been mailed two or three times, so
// the eligibility matrix is the whole safety story. Two properties matter most
// and are asserted from several directions below:
//
//   1. It only ever fires in response to a NEW visit. Nothing about an expiring
//      cooldown, on its own, may produce a send.
//   2. It cannot fire on someone who never actually came back — in particular on
//      the last logged-in session of the subscription they were still paying for,
//      which would qualify the entire churned book on day one.

const DAY = 86_400_000;
const HOUR = 3_600_000;
const NOW = Date.parse('2026-09-15T12:00:00.000Z');
const iso = (ms: number) => new Date(ms).toISOString();

function input(over: Partial<ReturnIntentInput> = {}): ReturnIntentInput {
  return {
    subscriptionLapsed: true,
    hasSubscriptionOnFile: false,
    emailVerified: true,
    deleted: false,
    marketingUnsubscribed: false,
    tier: 'public',
    churnedAt: iso(NOW - 120 * DAY),
    lastLoginAt: iso(NOW - 3 * DAY),
    lastSentAt: null,
    nowMs: NOW,
    ...over,
  };
}

test('a churned member who came back and has never been answered qualifies', () => {
  const decision = decideReturnIntent(input());
  assert.equal(decision.send, true);
  if (decision.send) {
    assert.equal(decision.loginAt, iso(NOW - 3 * DAY));
    assert.equal(decision.churnedAt, iso(NOW - 120 * DAY));
  }
});

test('a login from before they churned is not a return', () => {
  // The tail of the subscription they were still paying for. Without this guard
  // every churned account qualifies off its final session.
  const decision = decideReturnIntent(
    input({ churnedAt: iso(NOW - 30 * DAY), lastLoginAt: iso(NOW - 40 * DAY) }),
  );
  assert.deepEqual(decision, { send: false, reason: 'login-predates-churn' });
});

test('a login exactly at the churn instant is not a return either', () => {
  const at = iso(NOW - 30 * DAY);
  const decision = decideReturnIntent(input({ churnedAt: at, lastLoginAt: at }));
  assert.deepEqual(decision, { send: false, reason: 'login-predates-churn' });
});

test('a visit is left alone until the quiet window has passed', () => {
  // They may still convert on their own, and a same-day note reads as surveillance.
  const decision = decideReturnIntent(input({ lastLoginAt: iso(NOW - 2 * HOUR) }));
  assert.deepEqual(decision, { send: false, reason: 'visit-too-recent' });
});

test('a stale visit is no longer worth answering', () => {
  const decision = decideReturnIntent(input({ lastLoginAt: iso(NOW - 30 * DAY) }));
  assert.deepEqual(decision, { send: false, reason: 'visit-too-old' });
});

test('an expiring cooldown alone never re-fires on the same old visit', () => {
  // THE property that separates this from a recurring newsletter: the cooldown
  // has lapsed, but the member has not been back since we last wrote, so there
  // is nothing to reply to.
  //
  // Reaching it needs a widened visit window on purpose. Under the DEFAULTS the
  // guard is unreachable — a visit older than a 90-day-old send is necessarily
  // older than the 14-day visit window, so 'visit-too-old' catches it first. It
  // is kept as defence for a tuned run (a long --max-login-age-days against a
  // short --cooldown-days), which is exactly the configuration where an
  // expiring cooldown COULD otherwise re-fire on a stale login.
  const decision = decideReturnIntent(
    input({
      cooldownDays: 30,
      maxLoginAgeDays: 120,
      lastSentAt: iso(NOW - 40 * DAY),
      lastLoginAt: iso(NOW - 60 * DAY),
      churnedAt: iso(NOW - 200 * DAY),
    }),
  );
  assert.deepEqual(decision, { send: false, reason: 'already-answered' });
});

test('under default windows a stale visit is caught as stale, not as answered', () => {
  // Pins the ordering the dry-run tally depends on: the most informative reason
  // wins, and for a months-old visit that is its age.
  const decision = decideReturnIntent(
    input({
      lastSentAt: iso(NOW - (DEFAULT_COOLDOWN_DAYS + 30) * DAY),
      lastLoginAt: iso(NOW - (DEFAULT_COOLDOWN_DAYS + 60) * DAY),
      churnedAt: iso(NOW - (DEFAULT_COOLDOWN_DAYS + 90) * DAY),
    }),
  );
  assert.deepEqual(decision, { send: false, reason: 'visit-too-old' });
});

test('a fresh visit inside the cooldown still waits', () => {
  const decision = decideReturnIntent(
    input({ lastSentAt: iso(NOW - 10 * DAY), lastLoginAt: iso(NOW - 2 * DAY) }),
  );
  assert.deepEqual(decision, { send: false, reason: 'within-cooldown' });
});

test('a new visit after the cooldown lapses qualifies again', () => {
  // The re-arm that a permanent latch would forbid: same member, a genuinely
  // new return, months later.
  const decision = decideReturnIntent(
    input({
      lastSentAt: iso(NOW - (DEFAULT_COOLDOWN_DAYS + 5) * DAY),
      lastLoginAt: iso(NOW - 2 * DAY),
    }),
  );
  assert.equal(decision.send, true);
});

test('hard disqualifiers are refused whatever the timing says', () => {
  const cases: Array<[Partial<ReturnIntentInput>, string]> = [
    [{ subscriptionLapsed: false }, 'not-churned'],
    [{ hasSubscriptionOnFile: true }, 'subscription-on-file'],
    [{ deleted: true }, 'deleted'],
    [{ marketingUnsubscribed: true }, 'unsubscribed'],
    [{ emailVerified: false }, 'unverified'],
    [{ tier: 'admin' }, 'operator'],
  ];
  for (const [over, reason] of cases) {
    assert.deepEqual(decideReturnIntent(input(over)), { send: false, reason }, reason);
  }
});

test('a deleted or opted-out account is refused before its verification state', () => {
  // Ordering matters for the dry-run tally: "they asked to be forgotten" is the
  // useful answer, not "their email was never verified".
  assert.deepEqual(decideReturnIntent(input({ deleted: true, emailVerified: false })), {
    send: false,
    reason: 'deleted',
  });
  assert.deepEqual(
    decideReturnIntent(input({ marketingUnsubscribed: true, emailVerified: false })),
    { send: false, reason: 'unsubscribed' },
  );
});

test('an undated departure is skipped rather than guessed at', () => {
  for (const churnedAt of [null, '', 'nonsense']) {
    assert.deepEqual(decideReturnIntent(input({ churnedAt })), {
      send: false,
      reason: 'no-churn-date',
    });
  }
});

test('a member who never logged back in is skipped', () => {
  for (const lastLoginAt of [null, '', 'nonsense']) {
    assert.deepEqual(decideReturnIntent(input({ lastLoginAt })), {
      send: false,
      reason: 'never-returned',
    });
  }
});

test('an unparseable last-sent stamp is treated as never sent', () => {
  // Degrading to "send" is right: the cooldown exists to avoid pestering, and a
  // corrupt stamp should not silently retire a member from the sweep forever.
  const decision = decideReturnIntent(input({ lastSentAt: 'garbage' }));
  assert.equal(decision.send, true);
});

test('window overrides are honored', () => {
  const tight = decideReturnIntent(input({ lastLoginAt: iso(NOW - 2 * DAY), maxLoginAgeDays: 1 }));
  assert.deepEqual(tight, { send: false, reason: 'visit-too-old' });

  const patient = decideReturnIntent(input({ lastLoginAt: iso(NOW - 2 * HOUR), quietHours: 1 }));
  assert.equal(patient.send, true);
});

test('the angle comes from the survey, and is never invented', () => {
  assert.equal(returnIntentAngle('too_expensive'), 'price');
  assert.equal(returnIntentAngle('missing_features'), 'features');
  assert.equal(returnIntentAngle('too_complex'), 'complexity');
  assert.equal(returnIntentAngle('unused'), 'unused');
  assert.equal(returnIntentAngle('switched_service'), 'switched');
  // Addressing an objection the member never raised is worse than addressing none.
  for (const unknown of [null, undefined, '', 'other', 'low_quality', 'customer_service', 'new_enum']) {
    assert.equal(returnIntentAngle(unknown), 'neutral', `${String(unknown)} → neutral`);
  }
});
