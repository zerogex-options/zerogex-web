import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyTrialEngagement,
  shouldSendDormantTrialCopy,
  daysSinceLastSeen,
  RETURN_VISIT_AFTER_HOURS,
} from '../core/trialEngagement.ts';

// Trial engagement decides which 48h reminder a member receives. The costly
// mistake is calling an engaged member dormant — that mails "you haven't had a
// chance to use ZeroGEX" to someone who uses it daily — so every ambiguous
// case must land on 'unknown', which callers treat as engaged.

const START = '2026-08-06T21:06:35.000Z';
const hoursAfterStart = (h: number) => new Date(Date.parse(START) + h * 3600_000).toISOString();

test('a member who never returned after signup is dormant', () => {
  // The real case: signed up 21:06, last request 21:34 the same evening, never
  // came back, charged on trial conversion, disputed. See
  // docs/disputes/du_1U6cn34AOiqteMYYYCr2OaKn.md.
  assert.equal(
    classifyTrialEngagement({ trialStartIso: START, lastSeenAtIso: '2026-08-06T21:34:34.788Z' }),
    'dormant',
  );
});

test('a member who came back the next day is engaged', () => {
  assert.equal(
    classifyTrialEngagement({ trialStartIso: START, lastSeenAtIso: hoursAfterStart(30) }),
    'engaged',
  );
});

test('the return-visit boundary is exclusive', () => {
  // Exactly at the cutoff is still the signup session; a moment past it is a
  // return visit. Pinned because the whole classification turns on this line.
  assert.equal(
    classifyTrialEngagement({
      trialStartIso: START,
      lastSeenAtIso: hoursAfterStart(RETURN_VISIT_AFTER_HOURS),
    }),
    'dormant',
  );
  assert.equal(
    classifyTrialEngagement({
      trialStartIso: START,
      lastSeenAtIso: hoursAfterStart(RETURN_VISIT_AFTER_HOURS + 0.01),
    }),
    'engaged',
  );
});

test('a null last_seen_at is unknown, never dormant', () => {
  // Every account created before the column shipped has NULL here. Reading
  // that as dormancy would mail the wrong copy to the entire legacy cohort at
  // once — the single worst outcome this function can produce.
  assert.equal(
    classifyTrialEngagement({ trialStartIso: START, lastSeenAtIso: null }),
    'unknown',
  );
});

test('an unknown trial start is unknown', () => {
  assert.equal(
    classifyTrialEngagement({ trialStartIso: null, lastSeenAtIso: hoursAfterStart(30) }),
    'unknown',
  );
});

test('unparseable timestamps are unknown, not dormant', () => {
  assert.equal(
    classifyTrialEngagement({ trialStartIso: 'not-a-date', lastSeenAtIso: hoursAfterStart(30) }),
    'unknown',
  );
  assert.equal(
    classifyTrialEngagement({ trialStartIso: START, lastSeenAtIso: 'not-a-date' }),
    'unknown',
  );
});

test('activity recorded before trial start stays dormant', () => {
  // Clock skew, or a mirror written slightly behind. Still the signup session.
  assert.equal(
    classifyTrialEngagement({ trialStartIso: START, lastSeenAtIso: hoursAfterStart(-1) }),
    'dormant',
  );
});

test('only dormant triggers the dormant copy', () => {
  assert.equal(shouldSendDormantTrialCopy('dormant'), true);
  assert.equal(shouldSendDormantTrialCopy('engaged'), false);
  // The load-bearing one: unknown must never take the dormant path.
  assert.equal(shouldSendDormantTrialCopy('unknown'), false);
});

test('daysSinceLastSeen floors to whole days and tolerates missing data', () => {
  assert.equal(daysSinceLastSeen(START, hoursAfterStart(47)), 1);
  assert.equal(daysSinceLastSeen(START, hoursAfterStart(48)), 2);
  assert.equal(daysSinceLastSeen(null, hoursAfterStart(48)), null);
  assert.equal(daysSinceLastSeen(START, 'not-a-date'), null);
});
