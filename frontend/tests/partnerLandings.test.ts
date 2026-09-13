import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { INTEGRATIONS, integrationRoutes } from '../core/integrations.ts';
import { requiredTierForRoute } from '../core/auth.ts';

process.env.NEXT_PUBLIC_AUTH_ENABLED = '1';

// Landings aimed at an AUDIENCE rather than a platform.
//
// /collective2-strategy-data sells the existing Pro API to people who already
// publish a systematic strategy on Collective2. It ships no integration: no C2
// credential, nothing submitted on anyone's behalf, no ZeroGEX strategy
// published there. That is the whole reason it was the cheap option — it adds
// no channel data leaves through, because the data still leaves through the
// API the reader has to buy.
//
// It therefore lives outside core/integrations.ts and gets none of the
// registry's guarantees for free. These are the three that actually matter,
// plus the two claims a well-meaning edit could quietly break.

const HERE = path.dirname(new URL(import.meta.url).pathname);
const APP_DIR = path.join(HERE, '../app');

const AUDIENCE_LANDINGS = ['/collective2-strategy-data'] as const;

test('every audience landing has a page on disk', () => {
  for (const route of AUDIENCE_LANDINGS) {
    const page = path.join(APP_DIR, route.replace(/^\//, ''), 'page.tsx');
    assert.ok(existsSync(page), `${route} is listed here but ${path.relative(HERE, page)} does not exist`);
  }
});

test('every audience landing is public', () => {
  // Same reasoning as the integration landings: this is marketing copy with
  // no member data on it, and routing it to /login would cost it the only
  // thing it is for. Everything it sells is gated by the API key, not by the
  // page.
  for (const route of AUDIENCE_LANDINGS) {
    assert.equal(
      requiredTierForRoute(route),
      null,
      `${route} is tier-gated; an audience landing must stay public and crawlable`,
    );
  }
});

test('core/auth.ts lists every audience landing as public', () => {
  // requiredTierForRoute returns null for a route with NO rule at all, so the
  // check above passes for a page core/auth.ts has never heard of. This is the
  // one that rules that out. Asserted as text because core/auth.ts imports
  // nothing — it is the edge middleware's module.
  const auth = readFileSync(path.join(HERE, '../core/auth.ts'), 'utf8');
  const start = auth.indexOf('const PUBLIC_ROUTE_PATTERNS');
  const publicBlock = auth.slice(start, auth.indexOf('];', start));
  for (const route of AUDIENCE_LANDINGS) {
    assert.ok(
      publicBlock.includes(`'${route}'`),
      `${route} is missing from PUBLIC_ROUTE_PATTERNS in core/auth.ts`,
    );
  }
});

test('the sitemap config lists every audience landing', () => {
  // next-sitemap.config.mjs runs as plain ESM outside the Next build, so it
  // cannot resolve the '@/…' alias and repeats routes as literals. Checked as
  // text for the same reason integrations.test.ts checks it that way.
  const config = readFileSync(path.join(HERE, '../next-sitemap.config.mjs'), 'utf8');
  for (const route of AUDIENCE_LANDINGS) {
    assert.ok(
      config.includes(`'${route}'`),
      `${route} is missing from next-sitemap.config.mjs — it would ship unlisted`,
    );
  }
});

test('an audience landing is never also a chart integration', () => {
  // The distinction these pages depend on: an Integration is a platform that
  // RUNS OUR CODE and has something to download. Collective2 runs none of it.
  // Promoting this route into the registry would put a fifth card on the hub
  // that someone clicks expecting a study, and would make the page's own
  // "we are not an integration" copy false.
  const routes = integrationRoutes();
  for (const route of AUDIENCE_LANDINGS) {
    assert.ok(!routes.includes(route), `${route} is in integrationRoutes(); it is not a chart integration`);
    assert.ok(
      !INTEGRATIONS.some((entry) => entry.href === route),
      `${route} has a registry entry in core/integrations.ts; it must not`,
    );
  }
});

test('the Collective2 landing keeps the claims that make it safe to publish', () => {
  // The page addresses people whose subscribers trade real money on what they
  // publish, so the fence around what ZeroGEX is matters more here than on any
  // other marketing page. An edit that tightened the copy and lost one of
  // these would change what the page is asserting about the business, not just
  // how it reads.
  const page = readFileSync(path.join(APP_DIR, 'collective2-strategy-data/page.tsx'), 'utf8');
  for (const [claim, needle] of [
    ['non-affiliation', 'Not affiliated with Collective2'],
    ['no signal relay', 'Not a signal service to relay'],
    ['no C2 bridge', 'Not a bridge to Collective2'],
    ['not advice', 'Not investment advice'],
  ] as const) {
    assert.ok(page.includes(needle), `the ${claim} statement is gone from the Collective2 landing`);
  }
});
