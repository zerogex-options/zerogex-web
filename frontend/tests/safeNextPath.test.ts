import test from 'node:test';
import assert from 'node:assert/strict';

import { postSignInDestination, safeNextPath } from '../core/safeNextPath.ts';

// ?next= decides where a signed-in visitor is sent. Anything that resolves off
// our origin turns zerogex.io/login into a redirect to someone else's site, so
// every value is judged by where the browser would actually take it.

const ORIGIN = 'https://zerogex.io';

const OFF_SITE = [
  '//evil.example',
  '//evil.example/login',
  '/\\evil.example',
  '/\t/evil.example',
  '/\n/evil.example',
  '/\r/evil.example',
  '/..//evil.example',
  '/.//evil.example',
  '/../..//evil.example/x',
  'https://evil.example',
  'http:evil.example',
  'javascript:alert(1)',
  'evil.example',
  ' /dashboard',
  '',
];

test('anything that would leave the site is refused', () => {
  for (const raw of OFF_SITE) {
    assert.equal(safeNextPath(raw), null, JSON.stringify(raw));
  }
  assert.equal(safeNextPath(null), null);
  assert.equal(safeNextPath(undefined), null);
});

test('whatever is accepted stays on our site when the browser follows it', () => {
  // The property the login page relies on, checked against a real origin: an
  // accepted value, resolved the way router.replace and window.location
  // resolve it, never changes host.
  const inputs = [
    ...OFF_SITE,
    '/dashboard',
    '/%2F%2Fevil.example',
    '/%5Cevil.example',
    '/./../evil.example',
    '/account/pay?i=in_1&t=abc',
    '/pricing?trial=1&plan=pro#faq',
  ];
  for (const raw of inputs) {
    const path = safeNextPath(raw);
    if (path === null) continue;
    assert.equal(new URL(path, ORIGIN).origin, ORIGIN, `${JSON.stringify(raw)} → ${path}`);
  }
});

test('ordinary app paths come through intact', () => {
  assert.equal(safeNextPath('/dashboard'), '/dashboard');
  assert.equal(safeNextPath('/account'), '/account');
  assert.equal(safeNextPath('/account/pay?i=in_1&t=abc'), '/account/pay?i=in_1&t=abc');
  assert.equal(
    safeNextPath('/pricing?trial=1&plan=pro&cadence=monthly'),
    '/pricing?trial=1&plan=pro&cadence=monthly',
  );
  assert.equal(safeNextPath('/help/faqs#billing'), '/help/faqs#billing');
});

test('never back to an auth page, which would loop the signed-in forward', () => {
  for (const raw of ['/login', '/login?next=/account', '/register', '/register?next=/pricing']) {
    assert.equal(safeNextPath(raw), null, raw);
  }
});

test('a sign-in with somewhere to go goes there; otherwise the old defaults', () => {
  assert.equal(postSignInDestination('/account', 'public'), '/account');
  assert.equal(postSignInDestination('/gex-heatmap', 'pro'), '/gex-heatmap');
  // No next, or one that would leave the site: unchanged behavior.
  assert.equal(postSignInDestination(null, 'public'), '/pricing');
  assert.equal(postSignInDestination(null, 'pro'), '/dashboard');
  assert.equal(postSignInDestination('//evil.example', 'pro'), '/dashboard');
  assert.equal(postSignInDestination('//evil.example', 'public'), '/pricing');
});
