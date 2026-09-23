import test from 'node:test';
import assert from 'node:assert/strict';

import { buildPayUrl, decidePayRedirect, onSitePayUrl, payToken, verifyPayToken } from '../core/payLink.ts';
import { saveToken } from '../core/retentionToken.ts';

process.env.ZEROGEX_END_USER_TOKEN_SECRET = 'test-secret-for-pay-links';

// /pay is a signed link that lands a member on Stripe's payment page for ONE
// invoice without signing in. What it may grant is exactly what Stripe's own
// hosted URL granted — that invoice, nothing else — so the signature has to be
// specific to the invoice and to this use.

const APP_URL = 'https://zerogex.test';

test('a link verifies for its own invoice and no other', () => {
  const token = payToken('in_A');
  assert.equal(verifyPayToken('in_A', token), true);
  assert.equal(verifyPayToken('in_B', token), false);
  assert.equal(verifyPayToken('in_A', `${token}x`), false);
  assert.equal(verifyPayToken('in_A', ''), false);
  assert.equal(verifyPayToken('', token), false);
});

test('a save token is never a pay token', () => {
  // Same secret, different namespace: a leaked cancellation link must not be
  // replayable as a payment link, even for an id that happens to match.
  assert.equal(verifyPayToken('in_A', saveToken('in_A')), false);
});

test('the built URL is on our domain and carries a token that verifies', () => {
  const url = new URL(buildPayUrl(`${APP_URL}/`, 'in_A'));
  assert.equal(url.origin, APP_URL);
  assert.equal(url.pathname, '/pay');
  assert.equal(url.searchParams.get('i'), 'in_A');
  assert.equal(verifyPayToken('in_A', url.searchParams.get('t') ?? ''), true);
});

test('only our own /pay link survives to the email', () => {
  const ours = buildPayUrl(APP_URL, 'in_A');
  assert.equal(onSitePayUrl(APP_URL, ours), ours);
  for (const other of [
    'https://invoice.stripe.com/i/acct_123/live_abc?s=ap',
    `${APP_URL}/account`,
    `https://zerogex.test.evil.example/pay?i=in_A&t=x`,
    null,
    undefined,
    '',
  ]) {
    assert.equal(onSitePayUrl(APP_URL, other), null, String(other));
  }
});

test('an open invoice with money owed redirects to its payment page', () => {
  const url = 'https://invoice.stripe.com/i/acct_123/live_abc';
  assert.deepEqual(decidePayRedirect({ status: 'open', amount_due: 5900, hosted_invoice_url: url }), {
    kind: 'redirect',
    url,
  });
});

test('nothing to pay says so instead of sending them to a dead page', () => {
  assert.equal(decidePayRedirect({ status: 'paid', amount_due: 0, hosted_invoice_url: 'https://x' }).kind, 'paid');
  assert.equal(decidePayRedirect({ status: 'open', amount_due: 0, hosted_invoice_url: 'https://x' }).kind, 'paid');
  for (const status of ['void', 'uncollectible', 'draft', null]) {
    assert.equal(decidePayRedirect({ status, amount_due: 5900, hosted_invoice_url: 'https://x' }).kind, 'closed', String(status));
  }
  // An open invoice with no payment page, or a non-https one, is not followed.
  assert.equal(decidePayRedirect({ status: 'open', amount_due: 5900, hosted_invoice_url: null }).kind, 'closed');
  assert.equal(decidePayRedirect({ status: 'open', amount_due: 5900, hosted_invoice_url: 'http://x' }).kind, 'closed');
});

test('no signing secret means no link, not an unsigned one', () => {
  const saved = process.env.ZEROGEX_END_USER_TOKEN_SECRET;
  delete process.env.ZEROGEX_END_USER_TOKEN_SECRET;
  try {
    assert.throws(() => buildPayUrl(APP_URL, 'in_A'));
  } finally {
    process.env.ZEROGEX_END_USER_TOKEN_SECRET = saved;
  }
});
