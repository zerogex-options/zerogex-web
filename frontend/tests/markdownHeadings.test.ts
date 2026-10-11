import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { extractHeadings, slugifyHeading, wantsTableOfContents } from '../core/markdownHeadings.ts';

// Heading ids are public URLs the moment anyone links one ("…/gamma-exposure-
// explained#how-is-gamma-exposure-calculated"), so their shape is pinned here.

const HERE = path.dirname(new URL(import.meta.url).pathname);
const ARTICLES = path.join(HERE, '..', 'content', 'articles');

test('slugs are lowercase, dash-separated and free of inline markdown', () => {
  assert.equal(slugifyHeading('What is a gamma flip?'), 'what-is-a-gamma-flip');
  assert.equal(slugifyHeading('**Net GEX** versus `total` GEX'), 'net-gex-versus-total-gex');
  assert.equal(slugifyHeading('Call wall & put wall'), 'call-wall-and-put-wall');
  assert.equal(slugifyHeading('See [the flip](/education/x)'), 'see-the-flip');
  assert.equal(slugifyHeading('Réglage du flip'), 'reglage-du-flip');
  assert.equal(slugifyHeading('???'), 'section');
});

test('repeated headings get unique ids in document order', () => {
  const md = ['# T', '## Example', '### Setup', '## Example', '### Setup', '#### Detail'].join('\n');
  assert.deepEqual(
    extractHeadings(md).map((h) => `${h.level}:${h.id}`),
    ['2:example', '3:setup', '2:example-2', '3:setup-2', '4:detail'],
  );
});

test('headings inside fenced code are not headings', () => {
  const md = ['## Real', '```', '## not a heading', '```', '## Also real'].join('\n');
  assert.deepEqual(extractHeadings(md).map((h) => h.id), ['real', 'also-real']);
});

test('the pillar is long enough for a contents list and has its calculation anchor', () => {
  const md = readFileSync(path.join(ARTICLES, 'gamma-exposure-explained.md'), 'utf8');
  assert.ok(wantsTableOfContents(md));
  assert.ok(extractHeadings(md).some((h) => h.id === 'how-is-gamma-exposure-calculated'));
});

test('a short article gets no contents list', () => {
  const md = readFileSync(path.join(ARTICLES, 'what-is-a-gamma-wall.md'), 'utf8');
  assert.equal(wantsTableOfContents(md), false);
});

test('every English article id is unique within its page', () => {
  for (const file of readdirSync(ARTICLES).filter((f) => /^[a-z0-9-]+\.md$/.test(f))) {
    const ids = extractHeadings(readFileSync(path.join(ARTICLES, file), 'utf8')).map((h) => h.id);
    assert.equal(new Set(ids).size, ids.length, `${file} has duplicate heading ids`);
  }
});
