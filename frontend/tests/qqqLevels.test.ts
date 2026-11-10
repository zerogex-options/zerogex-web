import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

// /qqq-gamma-levels carries copy that is true of QQQ only (SYMBOL_EXTRAS in
// the shared levels template). These checks hold two lines: the QQQ facts
// match the wall study they quote, and no other ticker page changes, which
// matters most for /spx-gamma-levels while its title test is being read
// (docs/seo/2026-10-11-organic-acquisition-workstream.md, "The SPX title rule").

const HERE = path.dirname(new URL(import.meta.url).pathname);
const ROOT = path.join(HERE, '..');
const read = (p: string) => readFileSync(path.join(ROOT, p), 'utf8');
const template = read('app/spx-gamma-levels/gammaLevels.tsx');
const study = read('content/articles/how-often-do-gamma-walls-break.md');

function extrasBlock(): string {
  const start = template.indexOf('const SYMBOL_EXTRAS: Partial<Record<');
  assert.ok(start > 0, 'SYMBOL_EXTRAS not found');
  return template.slice(start, template.indexOf('\n};', start));
}

test('only QQQ and the stock pages have symbol-specific copy, so the other five market pages render as before', () => {
  // Written out for QQQ and NVDA; every other stock page gets stockExtras,
  // filled in for LEVELS_PAGE_STOCKS only, never for a market symbol.
  const keys = [...extrasBlock().matchAll(/^  ([A-Z]+): \{$/gm)].map((m) => m[1]);
  assert.deepEqual(keys, ['QQQ', 'NVDA']);
  assert.match(template, /for \(const stock of LEVELS_PAGE_STOCKS\) \{\n  SYMBOL_EXTRAS\[stock\] \?\?= stockExtras\(stock\);\n\}/);
  // Both hooks fall back to nothing for a symbol without an entry.
  assert.match(template, /\$\{derivationNote\(primary\)\}\$\{SYMBOL_EXTRAS\[primary\]\?\.introNote \?\? ''\}`,/);
  assert.match(template, /\.\.\.\(SYMBOL_EXTRAS\[primary\]\?\.faq \?\? \[\]\),/);
});

test('the shared title and description templates are untouched', () => {
  // The SPX title changed on November 10, 2026 and is under test again until
  // the December reading (docs/seo/2026-10-11-organic-acquisition-workstream.md);
  // any change here would land in the middle of it.
  assert.match(template, /title: `\$\{primary\} Gamma Levels Today \(Free\): Net GEX, Gamma Flip & Walls`,/);
  assert.match(
    template,
    /description: `Free daily \$\{primary\} gamma levels: the \$\{primary\} gamma flip, call wall, put wall, max pain and net dealer GEX, on a 15-minute delay\. No signup required\.`,/,
  );
  assert.match(template, /h1: `\$\{primary\} Gamma Levels Today`,/);
});

test('the QQQ wall figures are the ones the wall study publishes', () => {
  const extras = extrasBlock();
  // The study's QQQ row of the time-curve table: 15 / 30 / 45 / 60 minutes.
  const row = /\| 15 min \| [\d.]+% \| ([\d.]+)% \|[\s\S]*?\| 30 min \| [\d.]+% \| ([\d.]+)% \|[\s\S]*?\| 60 min \| \*\*[\d.]+%\*\* \| \*\*([\d.]+)%\*\* \|/.exec(study);
  assert.ok(row, 'the study table changed shape; re-check the QQQ answer');
  const [, q15, q30, q60] = row;
  assert.ok(extras.includes(`within 15 minutes ${q15}%`), `15-minute figure should be ${q15}%`);
  assert.ok(extras.includes(`within 30 minutes ${q30}%`), `30-minute figure should be ${q30}%`);
  assert.ok(extras.includes(`within an hour ${q60}%`), `60-minute figure should be ${q60}%`);
  // "about 31% for SPY and SPX": the product table's S&P rows.
  const spy = Number(/\| SPY \| \$1 \| S&P 500 \| ([\d.]+)% \|/.exec(study)?.[1]);
  const spx = Number(/\| SPX \| \$5 \| S&P 500 \| ([\d.]+)% \|/.exec(study)?.[1]);
  assert.ok(Math.round(spy) === 31 && Math.round(spx) === 31, `S&P break rates are ${spy}% and ${spx}%`);
  assert.match(extras, /737 wall tests/);
  assert.match(study, /737 wall tests/);
  assert.match(study, /QQQ and NDX are indistinguishable/);
  assert.match(study, /Call walls and put walls, incidentally, broke at the same rate/);
});

test('the QQQ copy keeps the house style and the modeled-not-certain register', () => {
  const extras = extrasBlock();
  assert.ok(!/—/.test(extras), 'house style: no em dashes in page copy');
  assert.ok(!/\b(always|guarantee[sd]?|will (hold|break))\b/i.test(extras), 'no certainty language about walls');
});
