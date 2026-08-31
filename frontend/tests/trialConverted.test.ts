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
