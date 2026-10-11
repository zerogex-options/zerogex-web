import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

import { BLOG_IMAGE_DIMENSIONS } from '../core/blogImageManifest.ts';

// Article screenshots render through next/image with a width and height read
// from core/blogImageManifest.ts, a file scripts/blog-image-manifest.js
// generates from the PNGs in assets/blog. Two things can drift and neither
// fails a build:
//
// 1. An article links a /blog/<name>.png the manifest does not know. The
//    renderer falls back to a plain <img> with no size, which is the layout
//    shift this whole arrangement exists to remove.
// 2. A screenshot is re-shot at a different size and committed without
//    re-running the script. next/image then reserves the old box and the page
//    jumps when the real picture arrives.
//
// These checks read the sizes straight out of each PNG's IHDR chunk, the same
// way the script does, so they follow the files rather than a second list.

const HERE = path.dirname(new URL(import.meta.url).pathname);
const ROOT = path.join(HERE, '..');
const REPO = path.join(ROOT, '..');
const ARTICLES = path.join(ROOT, 'content/articles');
const ASSETS = path.join(REPO, 'assets/blog');
const TRADING_MISTAKES = path.join(ROOT, 'app/trading-mistakes/Client.tsx');

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

// IHDR is required to be the first chunk: 8-byte signature, 4-byte length,
// 4-byte "IHDR", then width and height as big-endian uint32.
function readPngSize(file: string): { width: number; height: number } {
  const buf = readFileSync(file);
  assert.ok(buf.length >= 24 && buf.subarray(0, 8).equals(PNG_SIGNATURE), `${file} is not a PNG`);
  assert.equal(buf.subarray(12, 16).toString('ascii'), 'IHDR', `${file} does not start with IHDR`);
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

// The English markdown only. The .de/.es/.fr/.it translations reuse the same
// screenshots, so the English set is the complete set, and a translation is
// not where a new image would be introduced.
const ENGLISH_ARTICLES = readdirSync(ARTICLES)
  .filter((name) => name.endsWith('.md') && !/\.(de|es|fr|it)\.md$/.test(name))
  .map((name) => path.join(ARTICLES, name));

function referencedImages(): Map<string, string[]> {
  const refs = new Map<string, string[]>();
  const add = (src: string, where: string) => {
    const list = refs.get(src) ?? [];
    list.push(where);
    refs.set(src, list);
  };
  for (const file of ENGLISH_ARTICLES) {
    for (const [, src] of readFileSync(file, 'utf8').matchAll(/\]\((\/blog\/[^)\s]+\.png)\)/g)) {
      add(src, path.relative(ROOT, file));
    }
  }
  for (const [, src] of readFileSync(TRADING_MISTAKES, 'utf8').matchAll(/'(\/blog\/[^']+\.png)'/g)) {
    add(src, path.relative(ROOT, TRADING_MISTAKES));
  }
  return refs;
}

const REFERENCED = referencedImages();

test('the scan finds the article images and the trading-mistakes ones', () => {
  assert.ok(ENGLISH_ARTICLES.length > 0, 'no English articles found');
  const fromArticles = [...REFERENCED.values()].some((where) => where.some((w) => w.startsWith('content/')));
  const fromMistakes = [...REFERENCED.values()].some((where) => where.some((w) => w.includes('trading-mistakes')));
  assert.ok(fromArticles, 'no /blog/*.png references found in content/articles');
  assert.ok(fromMistakes, 'no /blog/*.png references found in app/trading-mistakes/Client.tsx');
});

test('every /blog/*.png an English article or trading-mistakes references is in the manifest', () => {
  const missing = [...REFERENCED.entries()]
    .filter(([src]) => !(src in BLOG_IMAGE_DIMENSIONS))
    .map(([src, where]) => `${src} (${[...new Set(where)].join(', ')})`);
  assert.deepEqual(
    missing,
    [],
    'drop the PNG in assets/blog and run `node scripts/blog-image-manifest.js`, then commit the manifest',
  );
});

test('every manifest entry names a PNG in assets/blog and matches its IHDR size', () => {
  const problems: string[] = [];
  for (const [src, dims] of Object.entries(BLOG_IMAGE_DIMENSIONS)) {
    assert.match(src, /^\/blog\/[^/]+\.png$/, `${src} is not a /blog/<name>.png path`);
    const file = path.join(ASSETS, path.basename(src));
    if (!existsSync(file)) {
      problems.push(`${src}: no such file in assets/blog`);
      continue;
    }
    const actual = readPngSize(file);
    if (actual.width !== dims.width || actual.height !== dims.height) {
      problems.push(`${src}: manifest says ${dims.width}x${dims.height}, file is ${actual.width}x${actual.height}`);
    }
  }
  assert.deepEqual(problems, [], 'run `node scripts/blog-image-manifest.js` and commit the result');
});

test('every PNG in assets/blog has a manifest entry', () => {
  const unlisted = readdirSync(ASSETS)
    .filter((name) => name.endsWith('.png'))
    .map((name) => `/blog/${name}`)
    .filter((src) => !(src in BLOG_IMAGE_DIMENSIONS));
  assert.deepEqual(unlisted, [], 'run `node scripts/blog-image-manifest.js` and commit the result');
});

test('every referenced image exists in assets/blog', () => {
  // The manifest check above would catch this too, but a direct message
  // ("the file is missing") is more useful than "not in the manifest".
  const missing = [...REFERENCED.keys()].filter((src) => !existsSync(path.join(ASSETS, path.basename(src))));
  assert.deepEqual(missing, [], 'these /blog links 404 on the deployed site');
});
