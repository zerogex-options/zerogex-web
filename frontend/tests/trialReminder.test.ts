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

// The other half of fair notice: WHAT happens at the cutoff. A trial that
// converts by itself has to be described as converting by itself. The failure
// mode this guards is not a missing sentence but a contradicting one — a
// discount CTA reading "keep my access" tells a skimmer their access is
// conditional on clicking it, which is the opposite of the truth and the
// shortest path from "I never clicked that" to a chargeback.

const OFFER_URL = 'https://zerogex.io/convert?u=user_123&t=tok';

test('the reminder says the trial converts on its own', () => {
  for (const dormant of [false, true]) {
    const { text, html } = buildTrialReminderEmail({
      trialEndIso: TRIAL_END_EDT,
      billing: { chargeLabel: '$59.00/month', cardBrand: 'Visa', cardLast4: '4242' },
      convertOfferUrl: OFFER_URL,
      dormant,
    });

    for (const body of [text, html]) {
      assert.match(body, /turns into a paid subscription automatically/, `dormant=${dormant}`);
    }
  }
});

test('nothing in the reminder makes access conditional on clicking the offer', () => {
  const { text, html } = buildTrialReminderEmail({
    trialEndIso: TRIAL_END_EDT,
    billing: { chargeLabel: '$59.00/month', cardBrand: 'Visa', cardLast4: '4242' },
    convertOfferUrl: OFFER_URL,
  });

  for (const body of [text, html]) {
    // Retention framing belongs on a CANCELLATION save (app/save), where access
    // really is at stake. Here it is simply false.
    assert.doesNotMatch(body, /keep (my|your) access/i);
    assert.doesNotMatch(body, /keep going/i);
    // ...and the offer says outright which of the two things it moves.
    assert.match(body, /changes the price only/);
    assert.match(body, /your subscription starts either way/i);
  }
});

test('the auto-renew reassurance is read before the offer, not after it', () => {
  // Ordering is the whole point: below the yellow button, "there's nothing you
  // need to do" reads as a contradiction of it, and the button wins.
  const { text, html } = buildTrialReminderEmail({
    trialEndIso: TRIAL_END_EDT,
    billing: { chargeLabel: '$59.00/month', cardBrand: 'Visa', cardLast4: '4242' },
    convertOfferUrl: OFFER_URL,
  });

  const reassurance = /there(?:'|&rsquo;)s nothing you need to do/;
  // In text the offer is its bare URL; in HTML it's the button label (the href
  // itself is escaped, so match the thing the reader actually sees).
  for (const [body, offerMarker] of [
    [text, OFFER_URL],
    [html, 'Take 25% off my subscription'],
  ] as const) {
    const at = body.search(reassurance);
    const offerAt = body.indexOf(offerMarker);
    assert.ok(at >= 0, 'the reassurance must be present');
    assert.ok(offerAt >= 0, 'the offer must be present');
    assert.ok(at < offerAt, 'the reassurance must come before the offer');
  }
});

// The dormant variant goes to someone who signed up and never came back. It
// used to open by telling them so, then put the exit straight after the price,
// sold as "one click, no email or support request needed" — friction-free and
// ahead of any reason to stay. For a member who has not used the product that
// is not neutral disclosure, it is a recommendation to cancel.

test('the dormant reminder says no action is needed before it says anything else', () => {
  const { text, html } = buildTrialReminderEmail({
    trialEndIso: TRIAL_END_EDT,
    billing: { chargeLabel: '$59.00/month', cardBrand: 'Visa', cardLast4: '4242' },
    dormant: true,
  });

  for (const body of [text, html]) {
    const noAction = body.search(/nothing you need to do/);
    const cancel = body.search(/cancel your subscription/);
    assert.ok(noAction >= 0, 'the reassurance must be present');
    assert.ok(cancel >= 0, 'the cancel route must still be present');
    assert.ok(noAction < cancel, 'the reassurance must come first');
  }
  // And in the subject, where a member who opens nothing still reads it.
  assert.match(
    buildTrialReminderEmail({ trialEndIso: TRIAL_END_EDT, dormant: true }).subject,
    /nothing you need to do/,
  );
});

test('the dormant reminder states the exit without selling it', () => {
  const { text, html } = buildTrialReminderEmail({
    trialEndIso: TRIAL_END_EDT,
    billing: { chargeLabel: '$59.00/month', cardBrand: 'Visa', cardLast4: '4242' },
    dormant: true,
  });

  for (const body of [text, html]) {
    // The friction-removing pitch is gone.
    assert.doesNotMatch(body, /no email or support request needed/i);
    assert.doesNotMatch(body, /rather not be charged/i);
    // Replaced by a conditional the member has to opt into.
    assert.match(body, /if you've decided ZeroGEX isn't for you/i);
  }
  // An email claiming nothing is needed must not end in a call to action; the
  // cancel route is linked inline in its own sentence instead.
  assert.doesNotMatch(html, /Manage subscription/);
  assert.match(html, /billing portal/);
});

test('softening the dormant copy does not soften the charge disclosure', () => {
  // The guard on the change above: the amount, the card and the exact instant
  // still land in the first two paragraphs, before any of the retention copy.
  const { text } = buildTrialReminderEmail({
    trialEndIso: TRIAL_END_EDT,
    billing: { chargeLabel: '$59.00/month', cardBrand: 'Visa', cardLast4: '4242' },
    dormant: true,
  });

  assert.match(text, /turns into a paid subscription automatically/);
  assert.match(text, /\$59\.00\/month/);
  assert.match(text, /your Visa card ending in 4242/);
  assert.ok(
    text.indexOf('$59.00/month') < text.indexOf("if you've decided"),
    'the price must be stated before the retention copy, not after it',
  );
  assert.match(text, /September 14, 2026 at 6:03 AM EDT/);
});

test('a dormant member is never shown the discount offer', () => {
  // Unchanged behaviour, guarded while the offer copy moves around it.
  const { text, html } = buildTrialReminderEmail({
    trialEndIso: TRIAL_END_EDT,
    convertOfferUrl: OFFER_URL,
    dormant: true,
  });

  assert.doesNotMatch(text, /25% off/);
  assert.doesNotMatch(html, /25% off/);
  assert.ok(!text.includes(OFFER_URL));
});
