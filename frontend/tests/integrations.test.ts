import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import {
  INTEGRATIONS,
  INTEGRATIONS_HUB,
  integrationById,
  integrationRoutes,
  otherIntegrations,
} from '../core/integrations.ts';
import { requiredTierForRoute } from '../core/auth.ts';

process.env.NEXT_PUBLIC_AUTH_ENABLED = '1';

// core/integrations.ts is the single list the menus, the footer, the hub page,
// the cross-link strip and the public-route allowlist all derive from. That is
// the point of it — before, the same four facts were written out in five
// places and drifted.
//
// Deriving them removes most of the drift, but not all of it: two consumers
// still cannot import the registry, and a registry entry is only as good as
// the page it names. This suite covers exactly those gaps.

const HERE = path.dirname(new URL(import.meta.url).pathname);
const APP_DIR = path.join(HERE, '../app');
const PUBLIC_DIR = path.join(HERE, '../public');

// ---------------------------------------------------------------------------
// Registry shape
// ---------------------------------------------------------------------------

test('ids and routes are unique', () => {
  const ids = INTEGRATIONS.map((entry) => entry.id);
  const hrefs = INTEGRATIONS.map((entry) => entry.href);
  assert.equal(new Set(ids).size, ids.length, 'duplicate integration id');
  assert.equal(new Set(hrefs).size, hrefs.length, 'duplicate integration href');
  assert.ok(!hrefs.includes(INTEGRATIONS_HUB.href), 'the hub must not also be listed as an integration');
});

test('integrationRoutes covers the hub and every landing', () => {
  const routes = integrationRoutes();
  assert.ok(routes.includes(INTEGRATIONS_HUB.href));
  for (const entry of INTEGRATIONS) {
    assert.ok(routes.includes(entry.href), `${entry.id} is missing from integrationRoutes()`);
  }
  assert.equal(routes.length, INTEGRATIONS.length + 1);
});

test('integrationById throws on an unknown id rather than returning undefined', () => {
  // Every call site passes a literal, so a miss is a typo. Returning undefined
  // would render a page with a blank breadcrumb and no heading instead.
  assert.throws(() => integrationById('nonexistent' as never), /Unknown integration id/);
});

test('otherIntegrations excludes what it is given, and nothing else', () => {
  const single = otherIntegrations('tradingview');
  assert.equal(single.length, INTEGRATIONS.length - 1);
  assert.ok(!single.some((entry) => entry.id === 'tradingview'));

  // The gamma-levels pages pass two — they already render the TradingView and
  // NinjaTrader sections in full above the strip.
  const pair = otherIntegrations(['tradingview', 'ninjatrader']);
  assert.equal(pair.length, INTEGRATIONS.length - 2);
  assert.deepEqual(
    pair.map((entry) => entry.id),
    ['thinkorswim', 'sierrachart'],
  );
});

// ---------------------------------------------------------------------------
// The registry vs. the things it cannot reach
// ---------------------------------------------------------------------------

test('every integration route has a page on disk', () => {
  // The nav now links only the hub, so a landing that is listed but missing is
  // no longer something you would trip over while clicking around — the hub
  // renders a card for it and the card 404s.
  for (const route of integrationRoutes()) {
    const page = path.join(APP_DIR, route.replace(/^\//, ''), 'page.tsx');
    assert.ok(existsSync(page), `${route} is in the registry but ${path.relative(HERE, page)} does not exist`);
  }
});

test('every integration route is public', () => {
  // These pages exist to be crawled and read by non-members. A rule that
  // gates one of them — a route added to core/auth.ts, a prefix pattern that
  // happens to match — would send Googlebot to /login and cost the landing
  // its whole purpose. The Pro gates on two of them live in their section
  // components instead, which render no download link below Pro.
  for (const route of integrationRoutes()) {
    assert.equal(
      requiredTierForRoute(route),
      null,
      `${route} is tier-gated; the integration landings must stay public and crawlable`,
    );
  }
});

test('core/auth.ts lists every integration route as public', () => {
  // The check above passes for a route with NO rule at all, because "no rule"
  // also resolves to null. That is exactly the state this one rules out:
  // PUBLIC_ROUTE_PATTERNS is what isPublicRoute() matches on, so a landing
  // missing from it is not merely ungated, it is not *known* to be public —
  // and the file's own comment says every route should have a definitive
  // tier rather than relying on "no rule = open".
  //
  // Asserted as text because core/auth.ts deliberately imports nothing: it is
  // the edge middleware's module. See the comment beside the list there.
  const auth = readFileSync(path.join(HERE, '../core/auth.ts'), 'utf8');
  const publicBlock = auth.slice(
    auth.indexOf('const PUBLIC_ROUTE_PATTERNS'),
    auth.indexOf('];', auth.indexOf('const PUBLIC_ROUTE_PATTERNS')),
  );
  for (const route of integrationRoutes()) {
    assert.ok(
      publicBlock.includes(`'${route}'`),
      `${route} is missing from PUBLIC_ROUTE_PATTERNS in core/auth.ts`,
    );
  }
});

test('the sitemap config lists every integration route', () => {
  // next-sitemap.config.mjs is loaded as plain ESM outside the Next build, so
  // it cannot use the '@/...' alias and has to repeat these as literals. That
  // is the one place the registry cannot reach, so it is checked as text.
  const config = readFileSync(path.join(HERE, '../next-sitemap.config.mjs'), 'utf8');
  for (const route of integrationRoutes()) {
    assert.ok(
      config.includes(`'${route}'`),
      `${route} is missing from next-sitemap.config.mjs — the page would ship unlisted in the sitemap`,
    );
  }
});

// ---------------------------------------------------------------------------
// Claims the registry makes about the world
// ---------------------------------------------------------------------------

test('the two auto-updating integrations are the two Pro ones', () => {
  // Not a coincidence worth losing: a study can only keep itself current if it
  // can call the API, and calling the API needs a key, and the key is the Pro
  // entitlement. If these ever diverge, either a free integration is being
  // advertised as auto-updating (it cannot be) or a Pro one as manual (in
  // which case it should not be gated).
  for (const entry of INTEGRATIONS) {
    assert.equal(
      entry.updates === 'auto',
      entry.tier === 'pro',
      `${entry.id} claims updates=${entry.updates} with tier=${entry.tier}`,
    );
  }
});

test('every integration carries the copy each surface renders', () => {
  for (const entry of INTEGRATIONS) {
    for (const field of ['platform', 'navLabel', 'cardTitle', 'blurb', 'updatesNote', 'language', 'levels'] as const) {
      assert.ok(entry[field].trim().length > 0, `${entry.id}.${field} is empty`);
    }
    assert.ok(entry.href.startsWith('/'), `${entry.id}.href must be site-relative`);
  }
});

test('the study sources the pages hand out are tracked in public/', () => {
  // The two free scripts are copied/downloaded straight off these paths, and
  // the two Pro ones are the sources of record the manifest hashes. A rename
  // that missed one would ship a download button pointing at nothing.
  for (const relative of [
    'tradingview/zerogex-daily-gamma-levels.pine',
    'thinkorswim/zerogex-daily-gamma-levels.thinkscript',
    'ninjatrader/ZeroGexGammaLevels.cs',
    'sierrachart/ZeroGexGammaLevels.cpp',
  ]) {
    assert.ok(existsSync(path.join(PUBLIC_DIR, relative)), `public/${relative} is missing`);
  }
});
