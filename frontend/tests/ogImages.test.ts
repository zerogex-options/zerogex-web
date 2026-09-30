import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

// Shared-link cards (every file that renders through next/og) are laid out by
// Satori, not a browser, and it breaks three things a browser would forgive.
// Each one shipped on the forecast, scorecard and replay cards that go out with
// the automated X posts, and nothing failed: the route still returned a 200
// PNG, it was just unreadable. These assertions are the only thing that notices.
//
// 1. No JSX fragments. Satori lays a fragment's children out in a row, so a
//    <>...</> meant to stack sections inside a column squeezed them into
//    overlapping slivers beside the hero number.
// 2. No character the bundled font cannot draw. OG_FONTS is the Latin subset
//    of Noto Sans. For anything outside it (✓, ✗, arrows) next/og tries a
//    dynamic font download that fails, and the card shows an empty box.
// 3. A card under a [symbol] route prints a permalink that includes the
//    symbol. /forecast/<date> and /scorecard/<date> are 404s.

const HERE = path.dirname(new URL(import.meta.url).pathname);
const ROOT = path.join(HERE, '..');

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === 'node_modules' ? [] : walk(full);
    return /\.tsx?$/.test(entry.name) ? [full] : [];
  });
}

const OG_FILES = ['app', 'core']
  .flatMap((dir) => walk(path.join(ROOT, dir)))
  .filter((file) => readFileSync(file, 'utf8').includes("from 'next/og'"));

const rel = (file: string) => path.relative(ROOT, file);

// Comments explain the rules above and may name the very glyphs they forbid.
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

// The code points the shipped font actually maps, read from its own cmap
// (format 4, Unicode BMP) so the check follows the file rather than a list.
function fontCodePoints(file: string): Set<number> {
  const buf = readFileSync(file);
  let cmap = -1;
  for (let i = 0; i < buf.readUInt16BE(4); i += 1) {
    const rec = 12 + i * 16;
    if (buf.toString('latin1', rec, rec + 4) === 'cmap') cmap = buf.readUInt32BE(rec + 8);
  }
  assert.ok(cmap >= 0, `${file} has no cmap table`);
  for (let i = 0; i < buf.readUInt16BE(cmap + 2); i += 1) {
    const rec = cmap + 4 + i * 8;
    const platform = buf.readUInt16BE(rec);
    const encoding = buf.readUInt16BE(rec + 2);
    const sub = cmap + buf.readUInt32BE(rec + 4);
    const unicodeBmp = (platform === 3 && encoding === 1) || platform === 0;
    if (!unicodeBmp || buf.readUInt16BE(sub) !== 4) continue;
    const segments = buf.readUInt16BE(sub + 6) / 2;
    const ends = sub + 14;
    const starts = ends + segments * 2 + 2;
    const deltas = starts + segments * 2;
    const rangeOffsets = deltas + segments * 2;
    const points = new Set<number>();
    for (let s = 0; s < segments; s += 1) {
      const start = buf.readUInt16BE(starts + s * 2);
      const end = buf.readUInt16BE(ends + s * 2);
      const delta = buf.readInt16BE(deltas + s * 2);
      const offsetAt = rangeOffsets + s * 2;
      const offset = buf.readUInt16BE(offsetAt);
      for (let c = start; c <= end && c !== 0xffff; c += 1) {
        const indexed = offset === 0 ? c : buf.readUInt16BE(offsetAt + offset + (c - start) * 2);
        const glyph = indexed === 0 ? 0 : (indexed + delta) & 0xffff;
        if (glyph !== 0) points.add(c);
      }
    }
    return points;
  }
  throw new Error(`${file} has no Unicode BMP format-4 cmap`);
}

const fontFile = /'(assets\/og\/[^']+\.ttf)'/.exec(readFileSync(path.join(ROOT, 'core/ogFonts.ts'), 'utf8'))?.[1];

test('the scan finds the OG cards, including the three dated ones', () => {
  const found = OG_FILES.map(rel);
  for (const card of [
    'app/forecast/[symbol]/[date]/opengraph-image.tsx',
    'app/scorecard/[symbol]/[date]/opengraph-image.tsx',
    'app/replay/[symbol]/[date]/snapshot/[time]/opengraph-image.tsx',
  ]) {
    assert.ok(found.includes(card), `${card} is not being checked`);
  }
});

test('no OG card uses a JSX fragment', () => {
  const offenders = OG_FILES.filter((file) =>
    /<>|<\/>|<(React\.)?Fragment[\s>]/.test(stripComments(readFileSync(file, 'utf8'))),
  ).map(rel);
  assert.deepEqual(
    offenders,
    [],
    'Satori lays a fragment out as a row; wrap the sections in a flex column div instead',
  );
});

test('every character on an OG card is one the bundled font can draw', () => {
  assert.ok(fontFile, 'could not find the .ttf path in core/ogFonts.ts');
  const drawable = fontCodePoints(path.join(ROOT, fontFile));
  // Sanity: the parse found the Latin set the cards use (A, ×, −) and does not
  // claim coverage the subset cannot have (一).
  assert.ok(drawable.has(0x41) && drawable.has(0xd7) && drawable.has(0x2212), 'cmap parse failed');
  assert.ok(!drawable.has(0x4e00), 'cmap parse claims CJK coverage; it is reading the wrong table');

  const missing: string[] = [];
  for (const file of OG_FILES) {
    for (const ch of new Set(stripComments(readFileSync(file, 'utf8')))) {
      const cp = ch.codePointAt(0) ?? 0;
      if (cp > 0x7e && !drawable.has(cp)) {
        missing.push(`${rel(file)}: U+${cp.toString(16).toUpperCase().padStart(4, '0')} ${ch}`);
      }
    }
  }
  assert.deepEqual(missing, [], 'draw these as SVG (see ReceiptMark in the forecast card) or use plain text');
});

test('a card under a [symbol] route prints a permalink that includes the symbol', () => {
  const broken: string[] = [];
  for (const file of OG_FILES.filter((f) => f.includes('[symbol]'))) {
    for (const [printed] of stripComments(readFileSync(file, 'utf8')).matchAll(/zerogex\.io\/[^\s<]*/g)) {
      if (!/symbol/.test(printed)) broken.push(`${rel(file)}: ${printed}`);
    }
  }
  assert.deepEqual(broken, [], 'without the symbol these print a URL that 404s');
});
