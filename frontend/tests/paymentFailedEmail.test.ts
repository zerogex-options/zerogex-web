import test from 'node:test';
import assert from 'node:assert/strict';

import { buildPaymentFailedEmail, buildTrialConversionFailedEmail } from '../core/mailer.ts';

// The two payment-failed emails, rendered, locked to one rule: every link stays
// on our own domain. They used to button straight to Stripe's hosted invoice
// page, and a long tokenized invoice.stripe.com payment link inside a "your
// payment failed" email is the shape spam filters look for in phishing. An
// email in the spam folder collects nothing, however good its link. The member
// now pays from the billing portal on the account page, which lists the same
// open invoice. core/declineEmailCopy.ts covers the sentences; this covers the
// URLs, which no assertion on the copy fragments can see.

const APP_URL = 'https://zerogex.test';
process.env.NEXT_PUBLIC_APP_URL = APP_URL;

const CATEGORIES = [
  'insufficient_funds', 'issuer_block', 'card_problem',
  'authentication_required', 'try_again', 'blocked_by_risk', 'unknown', null,
] as const;

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
          const email = build({
            amountFormatted: '$59.00',
            cardBrand: 'Visa',
            cardLast4: '4242',
            nextAttemptIso,
            graceUntilIso,
            declineCategory,
          });
          variants.push({ label: `${kind} / ${declineCategory} / retry=${!!nextAttemptIso} / grace=${!!graceUntilIso}`, email });
        }
      }
    }
  }
  return variants;
}

test('every link in both emails points at our own site', () => {
  for (const { label, email } of everyVariant()) {
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
});

test('a hosted invoice URL passed by a caller is not rendered', () => {
  // The option no longer exists on either email's type, so this only happens
  // if someone re-adds it. It must not quietly start linking Stripe again.
  const hostedInvoiceUrl = 'https://invoice.stripe.com/i/acct_123/live_abc?s=ap';
  for (const [kind, build] of BUILDERS) {
    const email = build({ declineCategory: 'insufficient_funds', hostedInvoiceUrl } as never);
    assert.doesNotMatch(email.html + email.text, /invoice\.stripe\.com/, kind);
  }
});

test('an empty account is sent to pay the open invoice, not to fix its card', () => {
  // The rendered-email half of the rule core/declineEmailCopy.ts enforces on
  // its fragments: the sentences mailer.ts adds around them must not undo it.
  for (const [kind, build] of BUILDERS) {
    for (const graceUntilIso of ['2026-09-30T12:00:00.000Z', null]) {
      const { subject, text } = build({
        declineCategory: 'insufficient_funds',
        nextAttemptIso: '2026-10-01T12:00:00.000Z',
        graceUntilIso,
      });
      assert.match(text, /open invoice/i, kind);
      assert.match(text, /billing portal/i, kind);
      assert.doesNotMatch(`${subject}\n${text}`, /update your (card|payment method)|card fix/i, kind);
    }
  }
});

test('a genuine card fault is still sent to update the card', () => {
  for (const [kind, build] of BUILDERS) {
    const { html, text } = build({ declineCategory: 'card_problem' });
    assert.match(text, /update your (card|payment method)/i, kind);
    assert.match(html, />Update your card</, kind);
  }
});
