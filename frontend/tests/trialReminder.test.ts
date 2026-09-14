import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTrialReminderEmail } from '../core/mailer.ts';

// The 48h reminder is the one email that exists purely to state a deadline, and
// the whole trial policy rests on it being fair notice: the trial ran its full
// term, the member was warned, so a cancel after the cutoff still owes the
// period. That argument only holds if the cutoff we gave them was the cutoff we
// enforce.
//
// A trial ends at the instant it began, seven days on — 6:03 AM ET for a
// mid-morning signup, not midnight. A member told only "ends on September 14"
// who cancels at 6:33 AM on September 14 did what the email said and is charged
// anyway. Naming the hour costs nothing and closes that reading.

const TRIAL_END_EDT = new Date(Date.UTC(2026, 8, 14, 10, 3, 14)).toISOString();
const TRIAL_END_EST = new Date(Date.UTC(2026, 0, 14, 10, 3, 14)).toISOString();

test('the deadline names the exact time, not just the day', () => {
  const { text, html } = buildTrialReminderEmail({ trialEndIso: TRIAL_END_EDT });

  assert.match(text, /September 14, 2026 at 6:03 AM EDT/);
  assert.match(html, /September 14, 2026 at 6:03 AM EDT/);
  // A bare date is exactly the ambiguity being removed.
  assert.doesNotMatch(text, /ends on September 14, 2026,/);
});

test('the cutoff is stated in the member\'s terms — ET, and DST-correct', () => {
  // Same clock time in January is EST, not EDT. Getting this wrong would put
  // the stated deadline an hour off the enforced one, which is worse than a
  // bare date.
  const { text } = buildTrialReminderEmail({ trialEndIso: TRIAL_END_EST });

  assert.match(text, /January 14, 2026 at 5:03 AM EST/);
  assert.doesNotMatch(text, /EDT/);
});

test('the precise cutoff carries into the cancel instruction too', () => {
  // "Cancel before X" and "ends on X" have to name the same instant, or the
  // email argues with itself.
  const { text } = buildTrialReminderEmail({
    trialEndIso: TRIAL_END_EDT,
    billing: { chargeLabel: '$59.00/month', cardBrand: null, cardLast4: null },
  });

  const mentions = text.match(/September 14, 2026 at 6:03 AM EDT/g) ?? [];
  assert.ok(mentions.length >= 1, 'the cutoff must appear in the body');
  // Every trial-end mention is precise — no bare-date variant survives.
  assert.doesNotMatch(text, /September 14, 2026(?! at)/);
});

test('the reminder still states the amount and the charge warning', () => {
  // Guard the rest of the notice while changing how the date renders.
  const { subject, text } = buildTrialReminderEmail({
    trialEndIso: TRIAL_END_EDT,
    billing: { chargeLabel: '$59.00/month', cardBrand: 'Visa', cardLast4: '4242' },
  });

  assert.equal(subject, 'Your ZeroGEX free trial ends in 2 days');
  assert.match(text, /\$59\.00\/month/);
  assert.match(text, /your Visa card ending in 4242/);
  assert.match(text, /unless you cancel before that/);
});
