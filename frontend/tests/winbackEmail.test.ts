import test from 'node:test';
import assert from 'node:assert/strict';
import { renderWinbackEmail, sendWinbackEmail, DEFAULT_WINBACK_HIGHLIGHTS } from '../core/mailer.ts';

// The win-back carries a discount only when one redeems itself at checkout.
// It used to have a third variant that asked the member to reply "discount" so
// it could be applied by hand — offered exactly when neither coupon was
// configured, i.e. when the plumbing it stood in for was the missing thing. It
// also put that member on different terms from everyone else who got this mail.

// Read lazily by the mailer, at send time. Resend itself is never reached: the
// header test below stubs the SDK's fetch.
process.env.RESEND_API_KEY = 're_test_key';
process.env.RESEND_FROM_EMAIL = 'ZeroGEX <hello@zerogex.test>';

const HIGHLIGHTS = [{ title: 'Trade Bias', body: 'one signed directional call.' }];
const UNSUB = 'https://zerogex.test/unsubscribe?u=user_x&t=token';

test('the auto variant promises a coupon that is already applied', () => {
  const { subject, text, html } = renderWinbackEmail({
    winbackAutoApply: true,
    discountLabel: '25% off your first year',
    highlights: HIGHLIGHTS,
    unsubUrl: UNSUB,
  });

  assert.match(subject, /your discount's ready/);
  for (const body of [text, html]) {
    assert.match(body, /25% off your first year/);
    assert.match(body, /No code to type, nothing to reply to/);
  }
  // The coupon attaches via the winback-tagged pricing link, not a plain one.
  assert.match(text, /\/pricing\?winback=1/);
  assert.match(html, /pricing\?winback=1/);
});

test('the promo variant names its deadline and auto-applies too', () => {
  const { subject, text, html } = renderWinbackEmail({
    promoDeadlineLabel: 'October 1, 2026',
    highlights: HIGHLIGHTS,
    unsubUrl: UNSUB,
  });

  assert.match(subject, /intro rate is open again - through October 1, 2026/);
  for (const body of [text, html]) {
    assert.match(body, /applies automatically at checkout/);
    assert.match(body, /October 1, 2026/);
  }
});

test('the auto coupon outranks a live promo', () => {
  // Both configured: the targeted per-user offer wins, and the promo deadline
  // must not leak into the copy alongside it.
  const { text } = renderWinbackEmail({
    winbackAutoApply: true,
    promoDeadlineLabel: 'October 1, 2026',
    highlights: HIGHLIGHTS,
    unsubUrl: UNSUB,
  });

  assert.match(text, /already on your account/);
  assert.doesNotMatch(text, /October 1, 2026/);
});

test('with no coupon configured the email makes no discount offer at all', () => {
  const { subject, text, html } = renderWinbackEmail({ highlights: HIGHLIGHTS, unsubUrl: UNSUB });

  assert.equal(subject, 'A lot has changed at ZeroGEX since you left');
  for (const body of [text, html]) {
    // No manual route...
    assert.doesNotMatch(body, /reply with the word/i);
    assert.doesNotMatch(body, /discount/i);
    // ...and no orphaned price talk left behind by removing it.
    assert.doesNotMatch(body, /% off/);
    assert.doesNotMatch(body, /intro rate|introductory pricing/i);
  }
});

test('dropping the discount leaves the rest of the email intact', () => {
  // The guard on the branch above: what carries this variant is the what's-new
  // list and the open door, and both have to survive.
  const { text, html } = renderWinbackEmail({ highlights: HIGHLIGHTS, unsubUrl: UNSUB });

  for (const body of [text, html]) {
    assert.match(body, /Trade Bias/);
    assert.match(body, /No pressure at all/);
    assert.match(body, /your account is still here exactly as you left it/);
    // The marketing opt-out is not optional on this email.
    assert.match(body, /Unsubscribe from emails like this/);
  }
});

test('the opt-out is the signed unsubscribe link, not account deletion', () => {
  // The footer used to offer only /account#delete-account, so the one way out
  // of a discount pitch was closing the account. The link is the caller's
  // signed per-member URL (core/unsubToken.ts), which app/unsubscribe honors.
  const { text, html } = renderWinbackEmail({ highlights: HIGHLIGHTS, unsubUrl: UNSUB });

  assert.match(
    text,
    /^You're receiving this because you created a ZeroGEX account\. Unsubscribe from emails like this:\nhttps:\/\/zerogex\.test\/unsubscribe\?u=user_x&t=token$/m,
  );
  assert.match(
    html,
    /<a href="https:\/\/zerogex\.test\/unsubscribe\?u=user_x&amp;t=token"[^>]*>Unsubscribe from emails like this<\/a>/,
  );
  for (const body of [text, html]) {
    assert.doesNotMatch(body, /delete-account|delete your account/i);
  }
});

test('the send carries the RFC 8058 one-click unsubscribe headers', async () => {
  // Same technique as tests/welcomeEmailApiKey.test.ts: stub the Resend SDK's
  // fetch and read the payload that would have gone on the wire. The headers
  // are what put the native "Unsubscribe" button in Gmail and Apple Mail.
  const realFetch = globalThis.fetch;
  let sent: { headers?: Record<string, string> } | null = null;
  globalThis.fetch = (async (_input: unknown, init?: { body?: unknown }) => {
    sent = JSON.parse(String(init?.body ?? '{}'));
    return new Response(JSON.stringify({ id: 'email_test' }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }) as typeof globalThis.fetch;
  try {
    await sendWinbackEmail('member@zerogex.test', {
      winbackAutoApply: true,
      highlights: HIGHLIGHTS,
      unsubUrl: UNSUB,
    });
  } finally {
    globalThis.fetch = realFetch;
  }

  assert.ok(sent, 'expected the mailer to issue a send request');
  assert.deepEqual((sent as { headers?: Record<string, string> }).headers, {
    'List-Unsubscribe': `<${UNSUB}>`,
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
  });
});

test('highlights fall back to the built-in list when the caller passes none', () => {
  const { text } = renderWinbackEmail({ winbackAutoApply: true, unsubUrl: UNSUB });

  for (const h of DEFAULT_WINBACK_HIGHLIGHTS) {
    assert.match(text, new RegExp(h.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});

test('dynamic values are HTML-escaped, never interpolated raw', () => {
  const { html } = renderWinbackEmail({
    promoDeadlineLabel: '<script>alert(1)</script>',
    highlights: [{ title: '<img src=x onerror=1>', body: 'ok' }],
    unsubUrl: 'https://zerogex.test/unsubscribe?u="><script>',
  });

  assert.doesNotMatch(html, /<script>/);
  assert.doesNotMatch(html, /<img src=x/);
  assert.match(html, /&lt;script&gt;/);
});
