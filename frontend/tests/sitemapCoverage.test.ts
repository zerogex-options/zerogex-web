import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { requiredTierForRoute } from '../core/auth.ts';

// The sitemap is a hand-maintained list (next-sitemap only auto-discovers the
// force-static pages, because the root layout reads cookies), so it drifts in
// two directions and nothing noticed either: public pages that were never
// added (/help/platform, /forecast/cone, /hedging-flow/sessions all shipped
// unlisted at some point), and listed pages that turned out to be gated, which
// Search Console reports as "Page with redirect" on a sitemap URL.
//
// next-sitemap.config.mjs is read as text: importing it would shell out to git.

const HERE = path.dirname(new URL(import.meta.url).pathname);
const ROOT = path.join(HERE, '..');
const config = readFileSync(path.join(ROOT, 'next-sitemap.config.mjs'), 'utf8');

function literalArray(source: string, marker: string): string[] {
  const at = source.indexOf(marker);
  assert.ok(at >= 0, `marker not found: ${marker}`);
  const open = source.indexOf('[', at);
  let depth = 0;
  let close = open;
  for (; close < source.length; close += 1) {
    if (source[close] === '[') depth += 1;
    if (source[close] === ']') depth -= 1;
    if (depth === 0) break;
  }
  const body = source.slice(open + 1, close).replace(/\/\/.*$/gm, '');
  return [...body.matchAll(/'([^']+)'/g)].map((m) => m[1]);
}

const LISTED = new Set([
  ...literalArray(config, 'const routes = ['),
  ...literalArray(config, 'const GAMMA_LEVEL_PATHS = ['),
]);
const EXCLUDED = literalArray(config, 'exclude: [');

function excluded(route: string): boolean {
  return EXCLUDED.some((pattern) =>
    pattern.endsWith('/*') ? route === pattern.slice(0, -2) || route.startsWith(pattern.slice(0, -1)) : route === pattern,
  );
}

// Pages that are public but correctly kept out of the sitemap: noindex utility
// pages and redirects.
const ALLOWED_UNLISTED = new Set([
  '/search',
  '/founding',
  '/forecast/today',
  '/scorecard/today',
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/unauthorized',
]);

/** Every non-dynamic app route that has a page.tsx. */
function staticPageRoutes(): string[] {
  const out: string[] = [];
  const walk = (dir: string, segments: string[]) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (entry.name.startsWith('[') || entry.name.startsWith('_') || entry.name === 'api') continue;
        const next = entry.name.startsWith('(') ? segments : [...segments, entry.name];
        walk(path.join(dir, entry.name), next);
      } else if (entry.name === 'page.tsx') {
        out.push(segments.length ? `/${segments.join('/')}` : '/');
      }
    }
  };
  walk(path.join(ROOT, 'app'), []);
  return out;
}

/** Markdown-backed routes are listed by addDir() from the content directory. */
function listedByContentDir(route: string): boolean {
  const article = /^\/education\/([a-z0-9-]+)$/.exec(route);
  if (article) return existsSync(path.join(ROOT, 'content/articles', `${article[1]}.md`));
  const guide = /^\/guides\/([a-z0-9-]+)$/.exec(route);
  if (guide) return existsSync(path.join(ROOT, 'content/guides', `${guide[1]}.md`));
  return false;
}

test('the sitemap literals parse', () => {
  assert.ok(LISTED.has('/'), 'homepage missing from the parsed sitemap list');
  assert.ok(LISTED.has('/spx-gamma-levels'), 'gamma-levels paths not parsed');
  assert.ok(EXCLUDED.includes('/login'), 'exclude list not parsed');
});

test('every page the sitemap lists is public', () => {
  for (const route of LISTED) {
    assert.equal(requiredTierForRoute(route), null, `${route} is in the sitemap but tier-gated`);
  }
});

test('every public page is in the sitemap, excluded on purpose, or a known utility page', () => {
  const missing = staticPageRoutes().filter(
    (route) =>
      requiredTierForRoute(route) === null &&
      !LISTED.has(route) &&
      !listedByContentDir(route) &&
      !excluded(route) &&
      !ALLOWED_UNLISTED.has(route) &&
      !route.startsWith('/admin') &&
      !route.startsWith('/account'),
  );
  assert.deepEqual(missing, [], `public pages missing from next-sitemap.config.mjs: ${missing.join(', ')}`);
});
