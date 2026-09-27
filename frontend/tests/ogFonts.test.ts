import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

// Every generated image on the site (the social cards and the /embed/image
// levels card) was laid out in Noto Sans. Next 16.2 changed next/og's default
// font to Geist, which sets wider and breaks the gamma-levels card title onto
// two lines. core/ogFonts.ts hands the old font back; an ImageResponse that
// does not pass it silently renders in the new default instead.

const HERE = path.dirname(new URL(import.meta.url).pathname);
const ROOT = path.join(HERE, '..');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.(ts|tsx)$/.test(name) ? [full] : [];
  });
}

test('every ImageResponse passes the pinned font', () => {
  const users = ['app', 'components', 'core']
    .flatMap((dir) => sourceFiles(path.join(ROOT, dir)))
    .filter((file) => readFileSync(file, 'utf8').includes('new ImageResponse('));
  assert.ok(users.length >= 15, `expected the site's image routes, found ${users.length}`);
  for (const file of users) {
    const source = readFileSync(file, 'utf8');
    const rel = path.relative(ROOT, file);
    assert.match(source, /import \{ OG_FONTS \} from '@\/core\/ogFonts';/, `${rel} must import OG_FONTS`);
    assert.match(source, /fonts: OG_FONTS/, `${rel} must pass fonts: OG_FONTS to ImageResponse`);
  }
});

test('the pinned font file is a real TrueType font', () => {
  const ogFonts = readFileSync(path.join(ROOT, 'core/ogFonts.ts'), 'utf8');
  const rel = ogFonts.match(/'(assets\/og\/[^']+\.ttf)'/)?.[1];
  assert.ok(rel, 'core/ogFonts.ts must read a .ttf under assets/og/');
  const font = readFileSync(path.join(ROOT, rel));
  assert.equal(font.readUInt32BE(0), 0x00010000, `${rel} must start with the TrueType signature`);
});
