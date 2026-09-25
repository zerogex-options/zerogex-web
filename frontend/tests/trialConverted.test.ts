import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTrialConvertedEmail } from '../core/mailer.ts';

// The trial-conversion confirmation is the one automated email whose entire job
// is being accurate about money: it goes out at the moment a member is charged
// for the first time. Every claim it makes about that charge has to be true for
// the inputs it was given, and it must degrade to neutral wording rather than
// guess when Stripe didn't hand us a detail. Lock the branch matrix.

const NEXT_CHARGE = new Date(Date.UTC(2026, 8, 14, 4, 0, 0)).toISOString(); // 2026-09-14 00:00 ET

test('names the exact amount and card when both resolved', () => {
  const { subject, text, html } = buildTrialConvertedEmail({
    amountFormatted: '$29.00',
    cardBrand: 'Visa',
    cardLast4: '4242',
  });

  assert.equal(subject, 'Your ZeroGEX trial just became a full membership');
  assert.match(text, /\$29\.00 on your Visa card ending in 4242/);
  assert.match(html, /\$29\.00 on your Visa card ending in 4242/);
  assert.match(text, /You're now a full ZeroGEX member/);
});

test('an unnameable payment method (wallet/Link) keeps the amount, drops the card', () => {
  const { text } = buildTrialConvertedEmail({ amountFormatted: '$29.00', cardLast4: null });

  assert.match(text, /\$29\.00 on your payment method on file/);
  assert.doesNotMatch(text, /card ending in/);
});

test('a known last4 with an unmapped brand stays neutral about the brand', () => {
  const { text } = buildTrialConvertedEmail({
    amountFormatted: '$29.00',
    cardBrand: null,
    cardLast4: '4242',
  });

  assert.match(text, /the card ending in 4242/);
});

test('no amount resolved → still confirms the charge without inventing a figure', () => {
  const { text } = buildTrialConvertedEmail({ cardBrand: 'Visa', cardLast4: '4242' });

  assert.match(text, /the first payment went through on your Visa card ending in 4242/);
  assert.doesNotMatch(text, /\$/);
});

test('no detail at all resolved → plain, still-true confirmation', () => {
  const { text } = buildTrialConvertedEmail();

  assert.match(text, /the first payment went through\./);
  assert.doesNotMatch(text, /card ending in/);
  assert.doesNotMatch(text, /payment method on file\b.*\$/);
});

// The referral system can bank a free month that lands exactly here, so a
// conversion invoice settling at $0 is a real path — and telling that member a
// payment "went through" would be a false statement about their money.
test('a fully credited conversion never claims a payment was taken', () => {
  const { text, html } = buildTrialConvertedEmail({
    amountFormatted: '$0.00',
    cardBrand: 'Visa',
    cardLast4: '4242',
    fullyCredited: true,
  });

  assert.doesNotMatch(text, /payment went through/);
  assert.doesNotMatch(html, /payment went through/);
  assert.match(text, /credit on your account covered this first period in full/);
  assert.match(text, /nothing to pay/);
});

test('the next charge date renders in ET, and is omitted rather than hedged', () => {
  const withDate = buildTrialConvertedEmail({ nextChargeIso: NEXT_CHARGE });
  assert.match(withDate.text, /Your next charge is on September 14, 2026/);
  assert.match(withDate.html, /Your next charge is on September 14, 2026/);

  const withoutDate = buildTrialConvertedEmail();
  assert.doesNotMatch(withoutDate.text, /next charge/);
  assert.doesNotMatch(withoutDate.html, /next charge/);
});

test('always routes to self-service billing and carries the FOH footer', () => {
  const { text, html } = buildTrialConvertedEmail({ amountFormatted: '$29.00' });

  // Cancel/manage has to be one click from the charge notice — that is what
  // keeps a surprise-charge reply from becoming a dispute.
  assert.match(text, /\/account/);
  assert.match(html, /href="[^"]*\/account"/);
  assert.match(text, /cancel/i);
  assert.match(html, /\/dashboard/);
  // Positive subscriber-facing email → carries the Folds of Honor block.
  assert.match(text, /Folds of Honor Proud Supporter/);
  assert.match(html, /Folds of Honor Proud Supporter/);
});

test('dynamic values are HTML-escaped, never interpolated raw', () => {
  const { html } = buildTrialConvertedEmail({
    amountFormatted: '<script>alert(1)</script>',
    cardBrand: 'Visa "&" Co',
    cardLast4: '4242',
  });

  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /Visa &quot;&amp;&quot; Co/);
});

// A member who cancels in the hour between trial end and Stripe finalizing the
// draft cycle invoice still gets charged — the trial ran its full term, so that
// charge stands. But this email then arrives ~30 minutes after we acknowledged
// their cancellation, and in its default form it congratulates them on becoming
// a "full member" and tells them the plan "renews automatically from there
// until you cancel". The second claim is simply false — they HAVE canceled —
// and it is the one that reads as a surprise recurring charge.

const ACCESS_END = new Date(Date.UTC(2026, 9, 14, 10, 3, 14)).toISOString();

test('an already-canceled member gets a receipt, not a welcome', () => {
  const { subject, text, html } = buildTrialConvertedEmail({
    amountFormatted: '$59.00',
    cardLast4: null,
    nextChargeIso: ACCESS_END,
    alreadyCanceled: true,
  });

  assert.equal(subject, 'Your ZeroGEX trial ended - your receipt, and your cancellation');
  assert.doesNotMatch(subject, /full membership/);
  assert.doesNotMatch(text, /You're now a full ZeroGEX member/);
  assert.doesNotMatch(html, /You're now a full ZeroGEX member/);
  // Celebrating the member's "early backing" as they walk out the door.
  assert.doesNotMatch(text, /Thank you for backing ZeroGEX this early/);

  // The charge is still stated exactly — this email's whole job.
  assert.match(text, /\$59\.00 on your payment method on file/);
  assert.match(html, /\$59\.00 on your payment method on file/);
});

test('an already-canceled member is never told the plan renews', () => {
  const { text, html } = buildTrialConvertedEmail({
    amountFormatted: '$59.00',
    nextChargeIso: ACCESS_END,
    alreadyCanceled: true,
  });

  // The false claim, in both bodies.
  assert.doesNotMatch(text, /renews automatically/);
  assert.doesNotMatch(html, /renews automatically/);
  assert.doesNotMatch(text, /Your next charge is on/);
  assert.doesNotMatch(html, /Your next charge is on/);

  // The correction: same date, opposite meaning.
  assert.match(text, /access stays on until October 14, 2026/);
  assert.match(html, /access stays on until October 14, 2026/);
  assert.match(text, /no next charge and nothing renews/);
  assert.match(html, /no next charge and nothing renews/);
  assert.match(text, /cancellation is confirmed/);
});

test('the "nothing renews" correction survives a missing period end', () => {
  // The date is nice to have; "you will not be billed again" is not optional.
  const { text } = buildTrialConvertedEmail({
    amountFormatted: '$59.00',
    alreadyCanceled: true,
  });

  assert.match(text, /no next charge and nothing renews/);
  assert.match(text, /end of this billing period/);
  assert.doesNotMatch(text, /renews automatically/);
});

test('a canceled member whose final period was fully credited is told the truth', () => {
  const { text } = buildTrialConvertedEmail({
    amountFormatted: '$0.00',
    fullyCredited: true,
    nextChargeIso: ACCESS_END,
    alreadyCanceled: true,
  });

  assert.doesNotMatch(text, /payment went through/);
  assert.match(text, /covered this final period in full/);
  assert.match(text, /nothing to pay/);
  assert.match(text, /no next charge and nothing renews/);
});

test('a continuing member is completely unaffected by the cancel branch', () => {
  const { subject, text } = buildTrialConvertedEmail({
    amountFormatted: '$59.00',
    nextChargeIso: ACCESS_END,
  });

  assert.equal(subject, 'Your ZeroGEX trial just became a full membership');
  assert.match(text, /You're now a full ZeroGEX member/);
  assert.match(text, /Your next charge is on October 14, 2026/);
  assert.match(text, /renews automatically/);
  assert.doesNotMatch(text, /nothing renews/);
});
