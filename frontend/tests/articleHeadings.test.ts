import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

// Every article, in every language, has one H1 and an outline with no skipped
// levels. eod-pressure-and-trap-detection used to render four H1s (its part
// headings were written as '# '), which leaves Google and answer engines four
// candidate topics for one page.

const HERE = path.dirname(new URL(import.meta.url).pathname);
const ARTICLES = path.join(HERE, '..', 'content', 'articles');

function headingLevels(md: string): number[] {
  const levels: number[] = [];
  let fence = false;
  for (const line of md.split('\n')) {
    const t = line.trim();
    if (t.startsWith('```')) {
      fence = !fence;
      continue;
    }
    if (fence) continue;
    const m = /^(#{1,6}) \S/.exec(t);
    if (m) levels.push(m[1].length);
  }
  return levels;
}

for (const file of readdirSync(ARTICLES).filter((f) => f.endsWith('.md'))) {
  test(`${file}: one H1 and no skipped heading levels`, () => {
    const levels = headingLevels(readFileSync(path.join(ARTICLES, file), 'utf8'));
    assert.equal(levels.filter((l) => l === 1).length, 1, 'exactly one H1');
    assert.equal(levels[0], 1, 'the H1 comes first');
    for (let i = 1; i < levels.length; i += 1) {
      assert.ok(levels[i] <= levels[i - 1] + 1, `heading ${i + 1} jumps from h${levels[i - 1]} to h${levels[i]}`);
    }
  });
}
