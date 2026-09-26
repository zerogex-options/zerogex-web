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

test('an empty account is told to pay with a different card, not to fix its card', () => {
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
        assert.match(text, /pay with a different card/i, kind);
        assert.doesNotMatch(`${subject}\n${text}`, /update your (card|payment method)|card fix|call your bank/i, kind);
      }
    }
  }
});

test('a bank refusal is told to call the bank', () => {
  for (const [kind, build] of BUILDERS) {
    const { text } = build({ declineCategory: 'issuer_block', payUrl: PAY_URL });
    assert.match(text, /call your bank/i, kind);
    assert.match(text, /different card/i, kind);
  }
});

test('the email opens with what happened and what to do, then the button', () => {
  // An inbox shows the subject and the start of the body. The old wording
  // spent that space on reassurance; now the failure and the instruction come
  // first, the link straight after, and the access date only then.
  for (const { label, email } of everyVariant()) {
    const lines = email.text.split('\n');
    assert.equal(lines[0], 'Hello,', label);
    const headline = lines[2];
    assert.match(headline, /didn't go through/, label);
    assert.match(headline, /Please /, `${label}: no instruction in the opening paragraph`);
    const link = email.text.search(/https?:\/\//);
    const access = email.text.search(/Your access stays on until|Without this payment/);
    assert.ok(link > email.text.indexOf(headline), `${label}: link before the instruction`);
    assert.ok(access > link, `${label}: access sentence before the link`);
  }
});

test('no rendered variant tells the member there is nothing to do', () => {
  for (const { label, email } of everyVariant()) {
    assert.doesNotMatch(
      `${email.subject}\n${email.text}`,
      /nothing to (fix|do)|nothing changes|is fine|good news|try again automatically|on its own|won't miss a beat/i,
      label,
    );
    // Hyphens with a no-break space in the body, a plain space in the subject,
    // and no long dashes anywhere.
    assert.doesNotMatch(`${email.subject}\n${email.text}\n${email.html}`, /[–—]|&mdash;|&ndash;/, label);
    assert.doesNotMatch(email.subject, / /, label);
  }
});

test('trial conversions and renewals are framed as what they are', () => {
  const trial = buildTrialConversionFailedEmail({ declineCategory: 'insufficient_funds', payUrl: PAY_URL });
  assert.match(trial.subject, /trial ended/i);
  assert.match(trial.text, /free trial has ended, and the first payment/);
  const renewal = buildPaymentFailedEmail({ declineCategory: 'insufficient_funds', payUrl: PAY_URL });
  assert.doesNotMatch(`${renewal.subject}\n${renewal.text}`, /trial/i);
  assert.match(renewal.text, /Your ZeroGEX payment/);
});

test('names the date access ends when a grace window is open', () => {
  for (const [kind, build] of BUILDERS) {
    const open = build({ declineCategory: 'insufficient_funds', graceUntilIso: '2026-09-30T16:00:00.000Z' });
    assert.match(open.text, /Your access stays on until September 30, 2026\./, kind);
    assert.match(open.text, /moves to the free Public tier/, kind);
    // Without a confirmed window the access line must be true whether or not
    // the past_due sync has already dropped the account.
    const unknown = build({ declineCategory: 'insufficient_funds', graceUntilIso: null });
    assert.doesNotMatch(unknown.text, /stays on until/, kind);
    assert.match(unknown.text, /switches back on automatically/, kind);
  }
});

test('says the retries have run out only when Stripe says so', () => {
  for (const [kind, build] of BUILDERS) {
    const exhausted = build({ declineCategory: 'issuer_block', nextAttemptIso: null });
    assert.match(exhausted.text, /no automatic retries left/i, kind);
    const unknown = build({ declineCategory: 'issuer_block' });
    assert.doesNotMatch(unknown.text, /retries left/i, kind);
    const pending = build({ declineCategory: 'issuer_block', nextAttemptIso: '2026-10-01T12:00:00.000Z' });
    assert.doesNotMatch(pending.text, /retries left/i, kind);
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

test('the recovery email says what happened and what to do, and still offers a way out', () => {
  const base = { amountFormatted: '$59.00', payUrl: PAY_URL, planLabel: 'Pro monthly', raisedLabel: null };
  const funds = buildOpenInvoiceRecoveryEmail({ ...base, declineCategory: 'insufficient_funds' });
  assert.match(funds.subject, /access ended/i);
  const lines = funds.text.split('\n');
  assert.match(lines[2], /didn't go through, so your ZeroGEX access ended/);
  assert.match(lines[2], /insufficient funds/);
  assert.match(lines[2], /Please pay with a different card/);
  // The soft wording this replaced, and the retry talk a canceled plan has no use for.
  assert.doesNotMatch(funds.text, /chase you|you don't need to do anything at all|try it again|will be canceled/i);
  // Honest about the lapse: nothing is owed and nothing more will be charged.
  assert.match(funds.text, /nothing more will be charged/i);

  // No reason on record: both instructions, no guessed cause.
  const unknown = buildOpenInvoiceRecoveryEmail({ ...base });
  assert.match(unknown.text, /different card/i);
  assert.match(unknown.text, /call your bank/i);
  assert.doesNotMatch(unknown.text, /insufficient|expired/i);

  // Our own Radar block never sends anyone to their bank.
  const radar = buildOpenInvoiceRecoveryEmail({ ...base, declineCategory: 'blocked_by_risk' });
  assert.doesNotMatch(radar.text, /bank/i);

  // A dead card still pays the invoice here: there is no subscription left to
  // put a new card on, and the only link is /pay.
  const dead = buildOpenInvoiceRecoveryEmail({ ...base, declineCategory: 'card_problem' });
  assert.match(dead.text, /pay with a different card/i);
  assert.doesNotMatch(dead.text, /update your card/i);
  assertOnSite('recovery / card_problem', dead);
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
