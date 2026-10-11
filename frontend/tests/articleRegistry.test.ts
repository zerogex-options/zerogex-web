import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

// core/articleRegistry.ts is the one source for every article's title,
// description, dates and related-reading links. It cannot be imported here (it
// pulls in an '@/' alias that bare node does not resolve), so these checks read
// it as text. They pin the three things that drifted before this test existed:
// articles the related-reading graph never pointed at, titles and descriptions
// too long for a search result, and a /articles listing typed out by hand.

const HERE = path.dirname(new URL(import.meta.url).pathname);
const ROOT = path.join(HERE, '..');
const registry = readFileSync(path.join(ROOT, 'core/articleRegistry.ts'), 'utf8');

const decode = (raw: string) => raw.replace(/\\u00a0/g, ' ').replace(/\\'/g, "'");

type Entry = { slug: string; href: string; title: string; description: string; kind: string };

function entries(): Entry[] {
  const out: Entry[] = [];
  const re = /^  '([a-z0-9-]+)': \{\n([\s\S]*?)\n  \},/gm;
  for (const m of registry.matchAll(re)) {
    const body = m[2];
    if (!/^\s+slug: /m.test(body)) continue;
    const field = (name: string) => {
      const f = new RegExp(`\\n\\s+${name}:\\s*\\n?\\s*'((?:[^'\\\\]|\\\\.)*)'`).exec(`\n${body}`);
      return f ? decode(f[1]) : '';
    };
    out.push({ slug: m[1], href: field('href'), title: field('title'), description: field('description'), kind: field('kind') });
  }
  return out;
}

function relatedGraph(): Record<string, string[]> {
  const start = registry.indexOf('const RELATED_BY_SLUG');
  assert.ok(start > 0, 'RELATED_BY_SLUG not found');
  const block = registry.slice(start, registry.indexOf('\n};', start));
  const graph: Record<string, string[]> = {};
  for (const m of block.matchAll(/^  '([a-z0-9-]+)': \[\n((?:\s+'[a-z0-9-]+',\n)*)\s+\],/gm)) {
    graph[m[1]] = [...m[2].matchAll(/'([a-z0-9-]+)'/g)].map((x) => x[1]);
  }
  return graph;
}

// An announcement is a dated notice, not a reading-path destination.
const NOT_IN_GRAPH = new Set(['announcing-folds-of-honor-pledge']);

test('the registry parses into every article it declares', () => {
  const all = entries();
  assert.ok(all.length >= 40, `expected 40+ registry entries, parsed ${all.length}`);
  for (const e of all) {
    assert.ok(e.href.startsWith('/'), `${e.slug}: no href parsed`);
    assert.ok(e.title.length > 0, `${e.slug}: no title parsed`);
    assert.ok(e.description.length > 0, `${e.slug}: no description parsed`);
  }
});

test('every article has related reading out and at least two links in', () => {
  const graph = relatedGraph();
  const inbound: Record<string, number> = {};
  for (const targets of Object.values(graph)) for (const t of targets) inbound[t] = (inbound[t] ?? 0) + 1;
  const slugs = new Set(entries().map((e) => e.slug));
  for (const [from, targets] of Object.entries(graph)) {
    for (const t of targets) assert.ok(slugs.has(t), `${from} relates to unknown slug ${t}`);
    assert.equal(new Set(targets).size, targets.length, `${from} lists a related article twice`);
  }
  for (const e of entries()) {
    if (e.kind === 'landing' || NOT_IN_GRAPH.has(e.slug)) continue;
    assert.ok(graph[e.slug]?.length, `${e.slug} has no related-reading entry, so its block renders nothing`);
    assert.ok((inbound[e.slug] ?? 0) >= 2, `${e.slug} has ${inbound[e.slug] ?? 0} inbound related links; needs 2+`);
  }
});

test('titles and descriptions fit a search result', () => {
  // Google cuts titles by pixel width (about 60 characters) and descriptions
  // around 155-160. A little slack here so a careful edit is not blocked by a
  // character, while the 70-80 character titles that used to ship are.
  for (const e of entries()) {
    assert.ok(e.title.length <= 70, `${e.slug} title is ${e.title.length} chars: ${e.title}`);
    assert.ok(e.description.length <= 165, `${e.slug} description is ${e.description.length} chars`);
  }
});

test('every education article in the registry has a route', () => {
  for (const e of entries()) {
    const m = /^\/education\/([a-z0-9-]+)$/.exec(e.href);
    if (!m) continue;
    assert.ok(existsSync(path.join(ROOT, 'app/education', m[1], 'page.tsx')), `${e.href} has no page.tsx`);
  }
});

test('/articles is derived from the registry, not typed out', () => {
  const page = readFileSync(path.join(ROOT, 'app/articles/page.tsx'), 'utf8');
  assert.match(page, /Object\.values\(ARTICLE_REGISTRY\)/);
  assert.ok(!/href: '\/education\//.test(page), '/articles carries a hand-typed article list again');
});
