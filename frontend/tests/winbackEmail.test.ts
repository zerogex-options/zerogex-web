import test from 'node:test';
import assert from 'node:assert/strict';
import { renderWinbackEmail, DEFAULT_WINBACK_HIGHLIGHTS } from '../core/mailer.ts';

// The win-back carries a discount only when one redeems itself at checkout.
// It used to have a third variant that asked the member to reply "discount" so
// it could be applied by hand — offered exactly when neither coupon was
// configured, i.e. when the plumbing it stood in for was the missing thing. It
// also put that member on different terms from everyone else who got this mail.

const HIGHLIGHTS = [{ title: 'Trade Bias', body: 'one signed directional call.' }];

test('the auto variant promises a coupon that is already applied', () => {
  const { subject, text, html } = renderWinbackEmail({
    winbackAutoApply: true,
    discountLabel: '25% off your first year',
    highlights: HIGHLIGHTS,
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
  });

  assert.match(text, /already on your account/);
  assert.doesNotMatch(text, /October 1, 2026/);
});

test('with no coupon configured the email makes no discount offer at all', () => {
  const { subject, text, html } = renderWinbackEmail({ highlights: HIGHLIGHTS });

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
  const { text, html } = renderWinbackEmail({ highlights: HIGHLIGHTS });

  for (const body of [text, html]) {
    assert.match(body, /Trade Bias/);
    assert.match(body, /No pressure at all/);
    assert.match(body, /your account is still here exactly as you left it/);
    // The marketing opt-out is not optional on this email.
    assert.match(body, /delete your account/i);
  }
});

test('highlights fall back to the built-in list when the caller passes none', () => {
  const { text } = renderWinbackEmail({ winbackAutoApply: true });

  for (const h of DEFAULT_WINBACK_HIGHLIGHTS) {
    assert.match(text, new RegExp(h.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});

test('dynamic values are HTML-escaped, never interpolated raw', () => {
  const { html } = renderWinbackEmail({
    promoDeadlineLabel: '<script>alert(1)</script>',
    highlights: [{ title: '<img src=x onerror=1>', body: 'ok' }],
  });

  assert.doesNotMatch(html, /<script>/);
  assert.doesNotMatch(html, /<img src=x/);
  assert.match(html, /&lt;script&gt;/);
});
