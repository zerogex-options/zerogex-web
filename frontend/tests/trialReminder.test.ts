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
// converts by itself has to be described as converting by itself, and the
// member has to be told they need do nothing about it.

test('the reminder says the trial converts on its own', () => {
  for (const dormant of [false, true]) {
    const { text, html } = buildTrialReminderEmail({
      trialEndIso: TRIAL_END_EDT,
      billing: { chargeLabel: '$59.00/month', cardBrand: 'Visa', cardLast4: '4242' },
      dormant,
    });

    for (const body of [text, html]) {
      assert.match(body, /turns into a paid subscription automatically/, `dormant=${dormant}`);
      assert.match(body, /nothing you need to do/, `dormant=${dormant}`);
    }
  }
});

// This email carries NO discount, in either variant. It used to offer 25% off
// for a year to a trialer with a card on file who was about to be charged
// anyway — nobody asked for it, and the 25% is latched once per account
// (retention_offer_claimed_at, shared with /save), so taking it here spent the
// save the cancellation email needs. The discount is a win-back lever.

test('the reminder never offers a discount, in either variant', () => {
  for (const dormant of [false, true]) {
    const { subject, text, html } = buildTrialReminderEmail({
      trialEndIso: TRIAL_END_EDT,
      billing: { chargeLabel: '$59.00/month', cardBrand: 'Visa', cardLast4: '4242' },
      dormant,
    });

    for (const body of [subject, text, html]) {
      assert.doesNotMatch(body, /discount/i, `dormant=${dormant}`);
      assert.doesNotMatch(body, /% off/, `dormant=${dormant}`);
      assert.doesNotMatch(body, /\/convert/, `dormant=${dormant}`);
      // Nor any of the framing that used to sit around the offer.
      assert.doesNotMatch(body, /lock in/i, `dormant=${dormant}`);
      assert.doesNotMatch(body, /keep (my|your) access/i, `dormant=${dormant}`);
    }
  }
});

test('the promo intro rate is not a discount offer and still renders', () => {
  // The guard on the rule above: promoIntroLabel names a rate the member ALREADY
  // locked in at signup. It is a statement about their price, not an offer, and
  // removing the conversion discount must not have taken it with it.
  const { text, html } = buildTrialReminderEmail({
    trialEndIso: TRIAL_END_EDT,
    billing: { chargeLabel: '$29.00/month', cardBrand: 'Visa', cardLast4: '4242' },
    promoIntroLabel: 'first 6 months',
  });

  for (const body of [text, html]) {
    assert.match(body, /first 6 months/);
    assert.match(body, /introductory rate/);
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

test('the dormant variant carries no CTA button at all', () => {
  // With the discount gone there is no yellow button left in this variant, and
  // that is the point — an email claiming nothing is needed should not end in
  // one. The cancel route stays linked inline in its own sentence.
  const { html } = buildTrialReminderEmail({ trialEndIso: TRIAL_END_EDT, dormant: true });

  assert.doesNotMatch(html, /display: inline-block; padding: 12px 20px/);
  assert.match(html, /billing portal/);
});

// ---------------------------------------------------------------------------
// Telling the member what the bank will see, BEFORE the charge.
//
// A live audit of the trial-to-paid step found the two structural drivers of a
// declined first charge: an issuer that does not recognise the merchant, and a
// debit card that simply has nothing in it on the day. Both are addressable in
// this email and nowhere else — after the charge fails it is too late.
// ---------------------------------------------------------------------------

test('the reminder names the statement descriptor so the charge is recognised', () => {
  const { text, html } = buildTrialReminderEmail({
    trialEndIso: '2026-10-01T12:00:00Z',
    billing: { chargeLabel: '$29.00/month', cardBrand: 'Visa', cardLast4: '4242', statementDescriptor: 'ZEROGEX' },
  });
  assert.match(text, /ZEROGEX/);
  assert.match(html, /ZEROGEX/);
  // It must tell them what to DO about a query, not merely name the word.
  assert.match(text, /confirming it rather than declining it/i);
});

test('a debit member is told the funds need to be there on the day', () => {
  const { text } = buildTrialReminderEmail({
    trialEndIso: '2026-10-01T12:00:00Z',
    billing: { chargeLabel: '$29.00/month', cardBrand: 'Visa', cardLast4: '4242', cardFunding: 'debit' },
  });
  assert.match(text, /debit card/i);
  assert.match(text, /available on the day/i);
});

test('a credit member is told nothing about funds — the sentence is not for them', () => {
  const { text } = buildTrialReminderEmail({
    trialEndIso: '2026-10-01T12:00:00Z',
    billing: { chargeLabel: '$29.00/month', cardBrand: 'Visa', cardLast4: '4242', cardFunding: 'credit' },
  });
  assert.doesNotMatch(text, /available on the day/i);
});

test('the dormant variant stays silent: its whole premise is that nothing is being asked', () => {
  const { text } = buildTrialReminderEmail({
    trialEndIso: '2026-10-01T12:00:00Z',
    dormant: true,
    billing: { chargeLabel: '$29.00/month', cardLast4: '4242', cardFunding: 'debit', statementDescriptor: 'ZEROGEX' },
  });
  assert.doesNotMatch(text, /available on the day/i);
  assert.doesNotMatch(text, /confirming it rather than declining it/i);
});

test('neither line appears when there is nothing true to say', () => {
  const { text } = buildTrialReminderEmail({
    trialEndIso: '2026-10-01T12:00:00Z',
    billing: { chargeLabel: '$29.00/month', cardBrand: 'Visa', cardLast4: '4242' },
  });
  assert.doesNotMatch(text, /available on the day/i);
  assert.doesNotMatch(text, /statement it will read/i);
});
