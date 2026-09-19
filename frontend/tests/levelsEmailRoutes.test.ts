// Covers the parts of the levels-email click-through surface that can be
// exercised outside a Next runtime: the middleware allowlist entry the links
// depend on, and the HTML shell they render.
//
// The route handlers themselves import next/server and are verified by
// `next build` plus the storage suite underneath them
// (tests/levelsSubscribers.test.ts), which is where the confirm / unsubscribe
// decisions actually live — the handlers only translate an outcome into a
// page, and the token check is enforced in storage precisely so it cannot be
// lost here.

import test from 'node:test';
import assert from 'node:assert/strict';

import { isPublicRoute, requiredTierForRoute } from '../core/auth.ts';
import { levelsEmailPage } from '../app/levels-email/shell.ts';

// ── Middleware allowlist ────────────────────────────────────────────────────

test('the click-through pages are anonymous-accessible', () => {
  // If this regresses, every confirmation and — far worse — every unsubscribe
  // link in every digest starts bouncing to /login. An unsubscribe link that
  // demands an account is not an unsubscribe link, and the recipient has no
  // account by construction.
  for (const path of ['/levels-email/confirm', '/levels-email/unsubscribe']) {
    assert.equal(isPublicRoute(path), true, `${path} must be public`);
    assert.equal(requiredTierForRoute(path), null, `${path} must carry no tier gate`);
  }
});

test('the allowlist entry does not over-match adjacent paths', () => {
  // '/levels-email/*' must not accidentally open something merely prefixed
  // with the same characters.
  assert.equal(isPublicRoute('/levels-emailX'), false);
  assert.equal(isPublicRoute('/levels-email-admin'), false);
});

test('adding the entry did not open anything that was gated', () => {
  assert.equal(requiredTierForRoute('/dashboard'), 'basic');
  assert.equal(requiredTierForRoute('/trading-signals'), 'pro');
  assert.equal(requiredTierForRoute('/admin/monitoring'), 'admin');
  assert.equal(isPublicRoute('/dashboard'), false);
});

// ── The rendered page ───────────────────────────────────────────────────────

async function render(opts: Parameters<typeof levelsEmailPage>[0]) {
  const res = levelsEmailPage(opts);
  return { res, html: await res.text() };
}

test('the page is noindex in both the header and the markup', () => {
  // Header as well as meta: a crawler that reads only headers and never parses
  // the body still gets the directive. These pages are reachable only from a
  // link in an email and must never appear in a search result.
  const res = levelsEmailPage({ status: 200, heading: 'x', body: 'y' });
  assert.equal(res.headers.get('X-Robots-Tag'), 'noindex, nofollow');
  assert.equal(res.headers.get('Cache-Control'), 'no-store');
  assert.match(res.headers.get('Content-Type') ?? '', /text\/html/);
});

test('the rendered markup carries the meta directive and the heading', async () => {
  const { html } = await render({ status: 200, heading: "You're on the list", body: 'Body copy.' });
  assert.match(html, /<meta name="robots" content="noindex, nofollow">/);
  assert.match(html, /You&#39;re on the list|You're on the list/);
  assert.match(html, /Body copy\./);
  assert.match(html, /<!doctype html>/i);
  assert.match(html, /<meta name="viewport"/);
});

test('the status code is whatever the caller asked for', async () => {
  assert.equal((await render({ status: 200, heading: 'a', body: 'b' })).res.status, 200);
  assert.equal((await render({ status: 400, heading: 'a', body: 'b' })).res.status, 400);
});

test('the optional CTA renders as an absolute link, and is absent when omitted', async () => {
  const withCta = await render({
    status: 200, heading: 'a', body: 'b',
    cta: { href: '/spx-gamma-levels', label: 'See levels' },
  });
  assert.match(withCta.html, /href="https?:\/\/[^"]*\/spx-gamma-levels"/);
  assert.match(withCta.html, /See levels/);

  const without = await render({ status: 200, heading: 'a', body: 'b' });
  assert.ok(!without.html.includes('spx-gamma-levels'));
});
