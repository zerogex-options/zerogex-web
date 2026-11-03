import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

// The root layout's `robots` metadata lets Google show large image previews
// (Discover's large cards need `max-image-preview:large` on a non-AMP page).
// Next merges metadata per top-level key, so any page that sets its own
// `robots` replaces that object whole. That is right for a noindex page and
// wrong for anything else, which would silently lose the large preview. These
// checks keep the default in place and every override a deliberate noindex.

const HERE = path.dirname(new URL(import.meta.url).pathname);
const ROOT = path.join(HERE, '..');

test('the root layout allows large image previews and says nothing about indexing', () => {
  const layout = readFileSync(path.join(ROOT, 'app/layout.tsx'), 'utf8');
  const at = layout.indexOf('  robots: {');
  assert.ok(at > 0, 'root metadata has no robots block');
  const block = layout.slice(at, layout.indexOf('},', at));
  assert.match(block, /'max-image-preview': 'large'/);
  assert.match(block, /'max-snippet': -1/);
  assert.match(block, /'max-video-preview': -1/);
  assert.ok(!/\bindex\b|\bfollow\b/.test(block.replace(/\/\/.*$/gm, '')), 'the site-wide default must not set index or follow');
});

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...sourceFiles(full));
    else if (/\.(ts|tsx)$/.test(entry.name)) out.push(full);
  }
  return out;
}

test('every page-level robots override is a noindex, and none is set to undefined', () => {
  const overrides: string[] = [];
  for (const file of sourceFiles(path.join(ROOT, 'app'))) {
    if (file.endsWith(path.join('app', 'layout.tsx')) || file.endsWith('robots.ts')) continue;
    const lines = readFileSync(file, 'utf8').split('\n');
    lines.forEach((line, i) => {
      if (!/\brobots:\s/.test(line) || line.trim().startsWith('//')) return;
      const where = `${path.relative(ROOT, file)}:${i + 1}`;
      overrides.push(where);
      // `robots: undefined` (or a ternary ending in it) resets the inherited
      // default to nothing; spread the key in only when it applies.
      assert.ok(!/:\s*undefined\b/.test(line), `${where} sets robots to undefined`);
      assert.match(line, /index:\s*false/, `${where} overrides robots without noindex`);
    });
  }
  assert.ok(overrides.length >= 5, `expected the known noindex overrides, found ${overrides.length}`);
});
