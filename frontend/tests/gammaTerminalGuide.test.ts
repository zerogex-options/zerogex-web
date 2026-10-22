import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

import { HELP_ARTICLES, getHelpArticleBySlug } from '../core/helpRegistry.ts';
import { NAV_GROUPS } from '../core/navigation.ts';

// The Gamma Terminal's user guide (content/help/platform/gamma-terminal.md) and
// the three ways in: the "How to use it" link beside the terminal's About fold,
// the Platform Guide index, and the Education > Help menu. The index and the
// menu are hand-listed, so either can drift from the registry on its own.
//
// It also holds the guide to the chart: every overlay pill the chart draws must
// have a row in the guide's overlay table, so a new overlay ships with its
// description rather than leaving the guide quietly incomplete, the way the
// older help pages missed Centroids and NVDA.

const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), 'utf8');

const SLUG = 'gamma-terminal';
const HREF = `/help/platform/${SLUG}`;
const GUIDE_PATH = `../content/help/platform/${SLUG}.md`;

test('the guide is a registered Core Pages help article whose page exists', () => {
  const article = getHelpArticleBySlug(SLUG);
  assert.ok(article, 'the article must be in HELP_ARTICLES or the route 404s');
  assert.equal(article.section, 'Core Pages');
  assert.equal(HELP_ARTICLES.filter((a) => a.slug === SLUG).length, 1);
  assert.ok(existsSync(new URL(GUIDE_PATH, import.meta.url)), 'the markdown the route renders must exist');
  assert.match(read(GUIDE_PATH), new RegExp(`^# ${article.title}\\n`), 'the page H1 and the registry title must agree');
});

test('the Platform Guide index and the Education > Help menu both list it', () => {
  assert.match(read('../app/help/platform/page.tsx'), new RegExp(`href: '${HREF}'`));

  const ids: string[] = [];
  const collect = (node: unknown): void => {
    if (Array.isArray(node)) node.forEach(collect);
    else if (node && typeof node === 'object') {
      for (const [key, value] of Object.entries(node)) {
        if (key === 'id' && typeof value === 'string') ids.push(value);
        else collect(value);
      }
    }
  };
  collect(NAV_GROUPS);
  assert.ok(ids.includes(HREF), 'the sidebar should carry the guide');
});

test('the terminal links to the guide outside its About fold', () => {
  // Members start with the fold closed, and they are the readers the guide is
  // for, so the link has to sit beside the toggle rather than inside it.
  const client = read('../app/chart/ChartClient.tsx');
  const link = client.indexOf(`href="${HREF}"`);
  assert.ok(link >= 0, 'ChartClient should link to the guide');
  assert.ok(link < client.indexOf('<div id="chart-hero-intro"'), 'the link must not be inside the folded region');
});

test('every overlay pill the chart draws has a row in the guide', () => {
  const chart = read('../components/GammaTerminalChart.tsx');
  const guide = read(GUIDE_PATH);
  const labels = new Set([...chart.matchAll(/<OverlayPill label="([^"]+)"/g)].map((m) => m[1]));
  // The rail's pill and its Labels toggle are not drawn on the terminal, which
  // hides the inline rail; the guide covers the rail as the Strike Panel.
  labels.delete('Gamma Rail');
  labels.delete('Labels');
  assert.ok(labels.size >= 10, `expected the chart's overlay pills, found ${[...labels].join(', ')}`);
  for (const label of labels) {
    assert.match(guide, new RegExp(`^\\| ${label.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')} \\|`, 'm'), `the overlay table has no row for ${label}`);
    assert.match(guide, new RegExp(`^### ${label.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}$`, 'm'), `the guide has no section for ${label}`);
  }
  assert.match(guide, /^### Strike Panel$/m);
});
