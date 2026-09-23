import test from 'node:test';
import assert from 'node:assert/strict';

import { buildOpenInvoiceRecoveryEmail, buildPaymentFailedEmail, buildTrialConversionFailedEmail } from '../core/mailer.ts';
import { buildPayUrl } from '../core/payLink.ts';

// The emails that ask a member to pay, rendered, locked to one rule: every link
// stays on our own domain. They used to button straight to Stripe's hosted
// invoice page, and a long tokenized invoice.stripe.com payment link inside a
// "your payment failed" email is the shape spam filters look for in phishing.
// An email in the spam folder collects nothing, however good its link. The pay
// button is now our signed /pay link, which redirects to that same Stripe page
// at click time (core/payLink.ts). core/declineEmailCopy.ts covers the
// sentences; this covers the URLs, which no assertion on the copy fragments can
// see.

const APP_URL = 'https://zerogex.test';
process.env.NEXT_PUBLIC_APP_URL = APP_URL;
process.env.ZEROGEX_END_USER_TOKEN_SECRET = 'test-secret-for-pay-links';

const PAY_URL = buildPayUrl(APP_URL, 'in_test123');
const STRIPE_URL = 'https://invoice.stripe.com/i/acct_123/live_abc?s=ap';
const escapeAttr = (s: string) => s.replace(/&/g, '&amp;');

const CATEGORIES = [
  'insufficient_funds', 'issuer_block', 'card_problem',
  'authentication_required', 'try_again', 'blocked_by_risk', 'unknown', null,
] as const;
const PAYABLE = CATEGORIES.filter((c) => c !== 'card_problem');

const BUILDERS = [
  ['renewal', buildPaymentFailedEmail],
  ['trial conversion', buildTrialConversionFailedEmail],
] as const;

type Rendered = ReturnType<typeof buildPaymentFailedEmail>;

function everyVariant(): Array<{ label: string; email: Rendered }> {
  const variants: Array<{ label: string; email: Rendered }> = [];
  for (const [kind, build] of BUILDERS) {
    for (const declineCategory of CATEGORIES) {
      for (const nextAttemptIso of ['2026-10-01T12:00:00.000Z', null]) {
        for (const graceUntilIso of ['2026-09-30T12:00:00.000Z', null]) {
          for (const payUrl of [PAY_URL, null]) {
            const email = build({
              amountFormatted: '$59.00',
              cardBrand: 'Visa',
              cardLast4: '4242',
              nextAttemptIso,
              graceUntilIso,
              declineCategory,
              payUrl,
            });
            variants.push({
              label: `${kind} / ${declineCategory} / retry=${!!nextAttemptIso} / grace=${!!graceUntilIso} / pay=${!!payUrl}`,
              email,
            });
          }
        }
      }
    }
  }
  return variants;
}

function assertOnSite(label: string, email: { html: string; text: string }) {
  const hrefs = [...email.html.matchAll(/href="([^"]*)"/g)].map((m) => m[1]);
  assert.ok(hrefs.length > 0, `${label}: no link at all`);
  for (const href of hrefs) {
    assert.ok(href.startsWith(`${APP_URL}/`), `${label}: off-site link ${href}`);
  }
  const textUrls = email.text.match(/https?:\/\/\S+/g) ?? [];
  assert.ok(textUrls.length > 0, `${label}: plain-text part has no link`);
  for (const url of textUrls) {
    assert.ok(url.startsWith(`${APP_URL}/`), `${label}: off-site link in text ${url}`);
  }
  assert.doesNotMatch(email.html + email.text, /stripe\.com/i, label);
}

test('every link in both dunning emails points at our own site', () => {
  for (const { label, email } of everyVariant()) assertOnSite(label, email);
});

test('the pay button is the signed /pay link for that invoice', () => {
  // One click to the payment page, as before the move off Stripe's URL, and no
  // sign-in on the way: Google and Apple sign-in drop ?next=.
  for (const [kind, build] of BUILDERS) {
    for (const declineCategory of PAYABLE) {
      const { html, text } = build({ declineCategory, payUrl: PAY_URL });
      const label = `${kind} / ${declineCategory}`;
      assert.ok(html.includes(`href="${escapeAttr(PAY_URL)}"`), `${label}: button is not the pay link`);
      assert.ok(text.includes(PAY_URL), `${label}: plain text lacks the pay link`);
    }
  }
});

test('a Stripe URL handed to either email is never rendered', () => {
  // hostedInvoiceUrl no longer exists on either type, and payUrl must be our own
  // /pay link. Either way a caller that slips Stripe's URL in gets the account
  // page, not a phishing-shaped link.
  for (const [kind, build] of BUILDERS) {
    const email = build({ declineCategory: 'insufficient_funds', payUrl: STRIPE_URL, hostedInvoiceUrl: STRIPE_URL } as never);
    assertOnSite(kind, email);
    assert.ok(email.html.includes(`href="${APP_URL}/account"`), `${kind}: no account-page fallback`);
  }
});

test('without a signed link the email still reaches the invoice, via the account page', () => {
  for (const [kind, build] of BUILDERS) {
    const { html, text } = build({ declineCategory: 'insufficient_funds', payUrl: null });
    assert.match(text, /billing portal/i, kind);
    assert.ok(html.includes(`href="${APP_URL}/account"`), kind);
    assert.doesNotMatch(html + text, /\/pay\?/, kind);
  }
});

test('an empty account is sent to pay the open invoice, not to fix its card', () => {
  // The rendered-email half of the rule core/declineEmailCopy.ts enforces on
  // its fragments: the sentences mailer.ts adds around them must not undo it.
  for (const [kind, build] of BUILDERS) {
    for (const graceUntilIso of ['2026-09-30T12:00:00.000Z', null]) {
      for (const payUrl of [PAY_URL, null]) {
        const { subject, text } = build({
          declineCategory: 'insufficient_funds',
          nextAttemptIso: '2026-10-01T12:00:00.000Z',
          graceUntilIso,
          payUrl,
        });
        assert.match(text, /open invoice/i, kind);
        assert.doesNotMatch(`${subject}\n${text}`, /update your (card|payment method)|card fix/i, kind);
      }
    }
  }
});

test('a genuine card fault is still sent to update the card', () => {
  // Paying the invoice would clear this month and leave the dead card on file
  // for the next renewal, so even with a pay link available the button goes to
  // the account page.
  for (const [kind, build] of BUILDERS) {
    const { html, text } = build({ declineCategory: 'card_problem', payUrl: PAY_URL });
    assert.match(text, /update your (card|payment method)/i, kind);
    assert.match(html, />Update your card</, kind);
    assert.doesNotMatch(html + text, /\/pay\?/, kind);
  }
});

test('the open-invoice recovery email links our /pay page and nothing else', () => {
  const email = buildOpenInvoiceRecoveryEmail({
    amountFormatted: '$29.00',
    payUrl: PAY_URL,
    planLabel: 'Pro monthly',
    raisedLabel: null,
  });
  assertOnSite('recovery', email);
  assert.ok(email.html.includes(`href="${escapeAttr(PAY_URL)}"`));
  assert.ok(email.text.includes(PAY_URL));
});

test('the recovery email refuses a link that is not ours', () => {
  // No fallback here: a lapsed member's account page never mentions the
  // invoice, so without a working pay link the email is not worth sending.
  for (const payUrl of [STRIPE_URL, `${APP_URL}/account`, '']) {
    assert.throws(
      () => buildOpenInvoiceRecoveryEmail({ amountFormatted: '$29.00', payUrl, planLabel: null, raisedLabel: null }),
      /\/pay link/,
      payUrl,
    );
  }
});
