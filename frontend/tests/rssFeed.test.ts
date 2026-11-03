import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { FEED_PATH, buildRssFeed, isFeedArticle, rfc822, xmlEscape, type FeedArticle } from '../core/rssFeed.ts';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const ROOT = path.join(HERE, '..');

// core/articleRegistry.ts pulls in an '@/' alias bare node cannot resolve, so
// (like tests/articleRegistry.test.ts) it is read as text here.
const registry = readFileSync(path.join(ROOT, 'core/articleRegistry.ts'), 'utf8');
const decode = (raw: string) => raw.replace(/\\u00a0/g, ' ').replace(/\\'/g, "'");

function registryArticles(): FeedArticle[] {
  const out: FeedArticle[] = [];
  for (const m of registry.matchAll(/^  '([a-z0-9-]+)': \{\n([\s\S]*?)\n  \},/gm)) {
    const body = `\n${m[2]}`;
    if (!/\n\s+slug: /.test(body)) continue;
    const field = (name: string) => {
      const f = new RegExp(`\\n\\s+${name}:\\s*\\n?\\s*'((?:[^'\\\\]|\\\\.)*)'`).exec(body);
      return f ? decode(f[1]) : undefined;
    };
    out.push({
      slug: m[1],
      href: field('href') ?? '',
      title: field('title') ?? '',
      blurb: field('blurb') ?? '',
      datePublished: field('datePublished') ?? '',
      dateModified: field('dateModified'),
      kind: field('kind') ?? '',
    });
  }
  return out;
}

const FIXTURE: FeedArticle[] = [
  { slug: 'older', href: '/education/older', title: 'Older', blurb: 'An older one.', datePublished: '2026-05-01', dateModified: '2026-10-20', kind: 'tier1' },
  { slug: 'newer', href: '/education/newer', title: 'S&P "walls" <tested>', blurb: 'It\'s new & improved.', datePublished: '2026-09-15', kind: 'article' },
  { slug: 'landing', href: '/real-time-gex-0dte', title: 'A landing', blurb: 'Not an article.', datePublished: '2026-10-30', kind: 'landing' },
];

const items = (xml: string) => [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((m) => m[1]);

test('one item per education article, newest first, landings left out', () => {
  const xml = buildRssFeed(FIXTURE);
  const all = items(xml);
  assert.equal(all.length, 2);
  assert.match(all[0], /<link>https:\/\/zerogex\.io\/education\/newer<\/link>/);
  assert.match(all[1], /<link>https:\/\/zerogex\.io\/education\/older<\/link>/);
  assert.ok(!xml.includes('real-time-gex-0dte'));
  assert.equal(isFeedArticle(FIXTURE[2]), false);
});

test('text is escaped and every item has the RSS essentials', () => {
  const xml = buildRssFeed(FIXTURE);
  assert.match(xml, /<title>S&amp;P &quot;walls&quot; &lt;tested&gt;<\/title>/);
  assert.match(xml, /<description>It&apos;s new &amp; improved\.<\/description>/);
  assert.ok(!/&(?!amp;|lt;|gt;|quot;|apos;)/.test(xml), 'a bare & would make the feed invalid XML');
  for (const item of items(xml)) {
    for (const tag of ['title', 'link', 'guid isPermaLink="true"', 'pubDate', 'dc:creator', 'description']) {
      assert.ok(item.includes(`<${tag}>`), `item is missing <${tag}>`);
    }
  }
});

test('pubDate is the publication date; lastBuildDate is the newest publish or update', () => {
  const xml = buildRssFeed(FIXTURE);
  assert.equal(rfc822('2026-09-15'), 'Tue, 15 Sep 2026 16:00:00 GMT');
  assert.match(items(xml)[1], /<pubDate>Fri, 01 May 2026 16:00:00 GMT<\/pubDate>/);
  // The older article's October update is the newest date in the feed.
  assert.match(xml, /<lastBuildDate>Tue, 20 Oct 2026 16:00:00 GMT<\/lastBuildDate>/);
  // Deterministic: the same registry builds the same bytes.
  assert.equal(buildRssFeed(FIXTURE), xml);
});

test('the channel declares its own URL and the namespaces it uses', () => {
  const xml = buildRssFeed(FIXTURE);
  assert.ok(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0"'));
  assert.match(xml, /xmlns:atom="http:\/\/www\.w3\.org\/2005\/Atom"/);
  assert.match(xml, /xmlns:dc="http:\/\/purl\.org\/dc\/elements\/1\.1\/"/);
  assert.match(xml, new RegExp(`<atom:link href="https://zerogex\\.io${FEED_PATH.replace('.', '\\.')}" rel="self" type="application/rss\\+xml"/>`));
  assert.equal(xmlEscape(`a&b<c>"d'`), 'a&amp;b&lt;c&gt;&quot;d&apos;');
});

test('the real registry: every education article is in the feed and has a page', () => {
  const articles = registryArticles();
  assert.ok(articles.length >= 40, `parsed only ${articles.length} registry entries`);
  const expected = articles.filter(isFeedArticle);
  for (const a of expected) {
    assert.ok(a.blurb.length > 0, `${a.slug}: no blurb parsed`);
    assert.match(a.datePublished, /^\d{4}-\d{2}-\d{2}$/, `${a.slug}: no datePublished parsed`);
  }
  const xml = buildRssFeed(articles);
  assert.equal(items(xml).length, expected.length);
  for (const m of xml.matchAll(/<link>https:\/\/zerogex\.io\/education\/([a-z0-9-]+)<\/link>/g)) {
    assert.ok(existsSync(path.join(ROOT, 'app/education', m[1], 'page.tsx')), `/education/${m[1]} has no page`);
  }
});

test('every page links the feed, and the sitemap leaves it out', () => {
  const layout = readFileSync(path.join(ROOT, 'app/layout.tsx'), 'utf8');
  assert.match(layout, /<link\s+rel="alternate"\s+type="application\/rss\+xml"\s+title=\{FEED_TITLE\}\s+href=\{`https:\/\/zerogex\.io\$\{FEED_PATH\}`\}/);
  assert.equal(FEED_PATH, '/feed.xml');
  const sitemapConfig = readFileSync(path.join(ROOT, 'next-sitemap.config.mjs'), 'utf8');
  assert.match(sitemapConfig, /'\/feed\.xml',/);
  assert.ok(existsSync(path.join(ROOT, 'app/feed.xml/route.ts')));
});
