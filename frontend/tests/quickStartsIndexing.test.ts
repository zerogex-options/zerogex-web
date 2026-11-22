import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { HAS_LIVE_QUICK_STARTS } from '../core/quickStarts.ts';

// /help/quickstarts is noindex, and left out of the sitemap, until a Quick
// Start video is published. The page reads HAS_LIVE_QUICK_STARTS; the sitemap
// config is plain ESM that cannot import it, so it tests the module's source
// text instead. A sitemap that lists a noindex page is a Search Console error,
// and a noindex page left out of it is no error at all, so the one thing that
// matters is that the two answers agree, today and after the first video ships.
// The config is read as text, as tests/sitemapCoverage.test.ts reads it:
// importing it runs its top-level code.

const HERE = path.dirname(new URL(import.meta.url).pathname);
const ROOT = path.join(HERE, '..');
const read = (rel: string) => readFileSync(path.join(ROOT, rel), 'utf8');

function sitemapPattern(): RegExp {
  const config = read('next-sitemap.config.mjs');
  const m = config.match(/const LIVE_QUICK_START_PATTERN = \/(.+)\/;/);
  assert.ok(m, 'LIVE_QUICK_START_PATTERN not found in next-sitemap.config.mjs');
  return new RegExp(m[1]);
}

test('the sitemap and the page agree on whether a Quick Start video is live', () => {
  assert.equal(sitemapPattern().test(read('core/quickStarts.ts')), HAS_LIVE_QUICK_STARTS);
});

test('the sitemap pattern matches a published walkthrough and nothing else', () => {
  const pattern = sitemapPattern();
  // The type declaration names both statuses and must not count as a video.
  assert.equal(pattern.test(`  status: 'live' | 'coming-soon';`), false);
  assert.equal(pattern.test(`        status: 'coming-soon',`), false);
  assert.equal(pattern.test(`        status: 'live',`), true);
});

test('the page spreads in noindex only while no walkthrough is live', () => {
  const page = read('app/help/quickstarts/page.tsx');
  assert.match(page, /\.\.\.\(HAS_LIVE_QUICK_STARTS \? \{\} : \{ robots: \{ index: false, follow: true \} \}\)/);
});

test('the sitemap skips the page only while no walkthrough is live', () => {
  const config = read('next-sitemap.config.mjs');
  assert.match(config, /\.\.\.\(QUICK_STARTS_LIVE \? \[\] : \['\/help\/quickstarts'\]\)/);
});
