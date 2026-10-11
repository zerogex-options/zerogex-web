import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { isPublicRoute, requiredTierForRoute } from '../core/auth.ts';

// /gex-levels is the broad "gex levels / gex data / gex charts" landing above
// the six ticker pages. These checks pin what makes it work as one: crawlable
// in the first HTML, public, listed, on the same data path as the ticker pages
// (so the two never disagree), and with every link pointing somewhere real.

const HERE = path.dirname(new URL(import.meta.url).pathname);
const ROOT = path.join(HERE, '..');
const read = (p: string) => readFileSync(path.join(ROOT, p), 'utf8');
const page = read('app/gex-levels/page.tsx');
const decode = (raw: string) => raw.replace(/\\u00a0/g, ' ');

test('server-rendered and refreshed like the ticker pages', () => {
  assert.ok(!/^'use client'/m.test(page), 'the page itself must be a server component');
  assert.match(page, /export const dynamic = 'force-static';/);
  assert.match(page, /export const revalidate = 60;/);
});

test('reads the same snapshot, freshness rules and cache as the ticker pages', () => {
  assert.match(page, /loadSnapshots\(\)/);
  assert.match(page, /snapshotFreshness\(snapshots, fromCache\)/);
  assert.ok(!/serverApiGet/.test(page), 'no second data path: reuse loadSnapshots');
  const levels = read('app/spx-gamma-levels/gammaLevels.tsx');
  assert.match(levels, /export async function loadSnapshots/);
  assert.match(levels, /export function snapshotFreshness/);
});

test('metadata: self-canonical, and a title and description that fit a result', () => {
  assert.match(page, /alternates: \{ canonical: PATH \}/);
  assert.match(page, /const PATH = '\/gex-levels';/);
  const title = decode(/const TITLE = '([^']+)';/.exec(page)?.[1] ?? '');
  const description = /const DESCRIPTION =\s*'([^']+)';/.exec(page)?.[1] ?? '';
  assert.ok(title.length > 0 && title.length <= 62, `title is ${title.length} chars`);
  assert.ok(description.length >= 120 && description.length <= 160, `description is ${description.length} chars`);
  assert.ok(!/—/.test(page), 'house style: no em dashes');
});

test('public, in the marketing shell, and in the sitemap', () => {
  assert.equal(isPublicRoute('/gex-levels'), true);
  assert.equal(requiredTierForRoute('/gex-levels'), null);
  assert.match(read('components/ClientLayout.tsx'), /'\/gex-levels'/);
  assert.match(read('next-sitemap.config.mjs'), /const LEVELS_HUB_PATHS = \['\/gex-levels'\];/);
});

test('the FAQ markup is built from the visible FAQ', () => {
  assert.match(page, /mainEntity: FAQ\.map\(/);
  assert.match(page, /\{FAQ\.map\(\(f\) => \(/);
});

test('every link on the page resolves', () => {
  const hrefs = new Set([...page.matchAll(/href(?:=|: )["'](\/[^"'#?]*)["']/g)].map((m) => m[1]));
  assert.ok(hrefs.size >= 25, `expected the page's links to parse, found ${hrefs.size}`);
  for (const href of hrefs) {
    const article = /^\/education\/([a-z0-9-]+)$/.exec(href);
    const help = /^\/help\/platform\/([a-z0-9-]+)$/.exec(href);
    const ok = article
      ? existsSync(path.join(ROOT, 'content/articles', `${article[1]}.md`))
      : help
        ? existsSync(path.join(ROOT, 'content/help/platform', `${help[1]}.md`))
        : existsSync(path.join(ROOT, 'app', href === '/' ? '' : href, 'page.tsx'));
    assert.ok(ok, `${href} does not resolve to a page`);
  }
});

test('the hub is linked from the pages that should send readers to it', () => {
  for (const file of [
    'components/Footer.tsx',
    'components/LiveLevelsCTA.tsx',
    'app/spx-gamma-levels/gammaLevels.tsx',
    'app/education/page.tsx',
    'app/LandingClient.tsx',
    'app/chart/ChartClient.tsx',
  ]) {
    assert.match(read(file), /href(?:=|: )["']\/gex-levels["']/, `${file} should link /gex-levels`);
  }
});
