import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import {
  flattenSnapshotCss,
  keepStyleRule,
  resolveNestedSelector,
  resolveSnapshotTitle,
  rewriteRootSelector,
  type SnapshotRule,
  snapshotFileName,
  splitSelectorList,
} from '../core/pageSnapshotCss.ts';

// The page-snapshot camera in the app header (components/PageSnapshotButton)
// rasterizes a page by serializing a clone of it into an SVG <foreignObject>
// and shipping the page's CSS alongside it. The DOM half of that needs a
// browser; the CSS selection half is where every subtle failure has actually
// lived, and it is pure — so it is tested here.
//
// Each case below stands for a way the export has broken or could break
// silently: silence is the whole problem with this feature. A dropped rule
// does not throw, it produces a PNG that is merely wrong, and nobody finds out
// until they have already posted it.

const HERE = path.dirname(new URL(import.meta.url).pathname);
const ROOT = path.join(HERE, '..');
const ROOT_SELECTOR = '.zgx-snapshot-root';

/** Match nothing unless told otherwise — the strictest default for a filter. */
const matchesNothing = () => false;
const matchesEverything = () => true;

test('splitSelectorList splits on top-level commas only', () => {
  assert.deepEqual(splitSelectorList('.a, .b'), ['.a', '.b']);
  // The one that matters: a naive split(',') breaks every :is()/:where() list,
  // which in a utility framework's output is most of the interesting rules.
  assert.deepEqual(splitSelectorList(':is(.a, .b) .c, .d'), [':is(.a, .b) .c', '.d']);
  assert.deepEqual(splitSelectorList('[data-x="a,b"], .c'), ['[data-x="a,b"]', '.c']);
  assert.deepEqual(splitSelectorList('  .a  '), ['.a']);
  assert.deepEqual(splitSelectorList(''), []);
});

test('rewriteRootSelector repoints document-level selectors at the frame', () => {
  assert.equal(rewriteRootSelector(':root', ROOT_SELECTOR), ROOT_SELECTOR);
  // The theme and palette ride on classes beside :root, so the compound has to
  // survive the rewrite or every capture comes out in the default palette.
  assert.equal(rewriteRootSelector(':root.dark', ROOT_SELECTOR), `${ROOT_SELECTOR}.dark`);
  assert.equal(
    rewriteRootSelector(':root.palette-ember .x', ROOT_SELECTOR),
    `${ROOT_SELECTOR}.palette-ember .x`,
  );
  assert.equal(rewriteRootSelector('body .card', ROOT_SELECTOR), `${ROOT_SELECTOR} .card`);
  assert.equal(rewriteRootSelector('html', ROOT_SELECTOR), ROOT_SELECTOR);
  // The frame stands in for BOTH <html> and <body>, so `html body` has to
  // collapse — left alone it asks for the frame inside itself and matches
  // nothing.
  assert.equal(rewriteRootSelector('html body', ROOT_SELECTOR), ROOT_SELECTOR);
  assert.equal(rewriteRootSelector('html > body .x', ROOT_SELECTOR), `${ROOT_SELECTOR} .x`);
  // Only the leftmost compound is a document-level selector. `.card :root` is
  // meaningless CSS and is left exactly as it was found.
  assert.equal(rewriteRootSelector('.card :root', ROOT_SELECTOR), '.card :root');
  assert.equal(rewriteRootSelector('.bodycopy', ROOT_SELECTOR), '.bodycopy');
});

test('resolveNestedSelector resolves & against the enclosing rule', () => {
  assert.equal(resolveNestedSelector('&:disabled', '.btn'), ':is(.btn):disabled');
  // A nested selector with no & is a descendant, per the nesting spec.
  assert.equal(resolveNestedSelector('.icon', '.btn'), ':is(.btn) .icon');
  // A selector LIST parent is why & becomes :is(…) rather than the parent
  // verbatim: spliced in raw, `.a, .b` would re-cut the selector list and hand
  // the declarations to a different rule than the author wrote.
  assert.equal(resolveNestedSelector('&:checked', '.a, .b'), ':is(.a, .b):checked');
  assert.equal(resolveNestedSelector('&', '.a'), ':is(.a)');
  assert.equal(resolveNestedSelector('.a', ''), '.a');
});

test('keepStyleRule keeps every rule aimed at the frame, without a match test', () => {
  // This is the rule that carries the custom properties — the entire palette —
  // so it must never depend on a selector match that could go wrong.
  const verdict = keepStyleRule(':root, :host', {
    matchesCapture: matchesNothing,
    rootSelector: ROOT_SELECTOR,
  });
  assert.equal(verdict.keep, true);
  assert.equal(verdict.selectorText, ROOT_SELECTOR);
});

test('keepStyleRule drops state that cannot exist in a still image', () => {
  for (const selector of ['.btn:hover', '.btn:focus-visible', 'a:visited', '.x:focus-within']) {
    assert.equal(
      keepStyleRule(selector, { matchesCapture: matchesEverything, rootSelector: ROOT_SELECTOR })
        .keep,
      false,
      `${selector} should not travel with a raster`,
    );
  }
});

test('keepStyleRule keeps only the selectors present in the capture', () => {
  const seen: string[] = [];
  const verdict = keepStyleRule('.present, .absent', {
    matchesCapture: (selector) => {
      seen.push(selector);
      return selector === '.present';
    },
    rootSelector: ROOT_SELECTOR,
  });
  assert.equal(verdict.keep, true);
  assert.equal(verdict.selectorText, '.present');
  assert.deepEqual(seen, ['.present', '.absent']);
});

test('keepStyleRule probes without the pseudo-element but emits it', () => {
  // ::before/::after carry real paint (a framework's preflight leans on them),
  // but querySelector cannot be asked about a pseudo-element — so the probe is
  // stripped and the rule keeps its original selector.
  let probed = '';
  const verdict = keepStyleRule('.badge::after', {
    matchesCapture: (selector) => {
      probed = selector;
      return true;
    },
    rootSelector: ROOT_SELECTOR,
  });
  assert.equal(probed, '.badge');
  assert.equal(verdict.selectorText, '.badge::after');
});

test('flattenSnapshotCss unwraps layers and resolves conditions', () => {
  const rules: SnapshotRule[] = [
    {
      kind: 'group',
      conditionKind: 'none',
      conditionText: '',
      rules: [
        { kind: 'style', selectorText: '.kept', declarations: 'color:red' },
        {
          kind: 'group',
          conditionKind: 'media',
          conditionText: '(min-width: 64rem)',
          rules: [{ kind: 'style', selectorText: '.wide', declarations: 'padding:2rem' }],
        },
        {
          kind: 'group',
          conditionKind: 'media',
          conditionText: 'print',
          rules: [{ kind: 'style', selectorText: '.printed', declarations: 'color:black' }],
        },
        {
          kind: 'group',
          conditionKind: 'supports',
          conditionText: '(display: grid)',
          rules: [{ kind: 'style', selectorText: '.grid', declarations: 'display:grid' }],
        },
      ],
    },
    { kind: 'verbatim', cssText: '@property --tw-shadow { syntax: "*"; inherits: false; }' },
  ];

  const css = flattenSnapshotCss(rules, {
    rootSelector: ROOT_SELECTOR,
    matchesCapture: matchesEverything,
    // A snapshot is taken at one viewport in one colour scheme; the breakpoint
    // that was actually on screen is baked in rather than shipped as a query.
    conditionHolds: (kind, condition) =>
      kind === 'supports' ? condition === '(display: grid)' : condition === '(min-width: 64rem)',
  });

  assert.match(css, /\.kept\{color:red\}/);
  assert.match(css, /\.wide\{padding:2rem\}/);
  assert.match(css, /\.grid\{display:grid\}/);
  assert.doesNotMatch(css, /\.printed/, 'a non-matching media block must not travel');
  assert.doesNotMatch(css, /@media|@layer/, 'conditional groups are resolved, not carried');
  assert.match(css, /@property --tw-shadow/, '@property carries registered defaults');
});

test('flattenSnapshotCss skips empty declaration blocks and honours the budget', () => {
  const empty = flattenSnapshotCss(
    [{ kind: 'style', selectorText: '.x', declarations: '' }],
    {
      rootSelector: ROOT_SELECTOR,
      matchesCapture: matchesEverything,
      conditionHolds: () => true,
    },
  );
  assert.equal(empty, '');

  const many: SnapshotRule[] = Array.from({ length: 50 }, (_, i) => ({
    kind: 'style',
    selectorText: `.r${i}`,
    declarations: 'color:red',
  }));
  const capped = flattenSnapshotCss(many, {
    rootSelector: ROOT_SELECTOR,
    matchesCapture: matchesEverything,
    conditionHolds: () => true,
    ruleBudget: 5,
  });
  assert.equal(capped.split('}').length - 1, 5);
});

test('resolveSnapshotTitle prefers the menu label over the heading', () => {
  // `<h2>Hedging Flow<BetaBadge/></h2>` reads out of the DOM as one run of
  // text. A frame printing "Hedging FlowBeta" looks broken rather than beta,
  // so the curated menu label leads.
  assert.equal(
    resolveSnapshotTitle({ headingText: 'Hedging FlowBeta', navLabel: 'Hedging Flow' }),
    'Hedging Flow',
  );
  assert.equal(
    resolveSnapshotTitle({ headingText: '  Scrub through\n  any past session  ' }),
    'Scrub through any past session',
  );
  // A document title is written for a tab and a search result, so it is cut at
  // its first separator rather than printed whole.
  assert.equal(resolveSnapshotTitle({ documentTitle: 'GEX Replay — ZeroGEX' }), 'GEX Replay');
  assert.equal(resolveSnapshotTitle({ documentTitle: 'Daily Scorecard | ZeroGEX' }), 'Daily Scorecard');
  assert.equal(resolveSnapshotTitle({}), 'ZeroGEX');
});

test('snapshotFileName is built from the route, not the heading', () => {
  assert.equal(
    snapshotFileName('/hedging-flow', 'SPY', '2026-09-17'),
    'zerogex-spy-hedging-flow-2026-09-17.png',
  );
  // Two symbols on one page must not overwrite each other in a downloads folder.
  assert.notEqual(
    snapshotFileName('/hedging-flow', 'SPY', '2026-09-17'),
    snapshotFileName('/hedging-flow', 'QQQ', '2026-09-17'),
  );
  assert.equal(snapshotFileName('/account', null, '2026-09-17'), 'zerogex-account-2026-09-17.png');
  assert.equal(snapshotFileName('/', null, '2026-09-17'), 'zerogex-home-2026-09-17.png');
  assert.equal(
    snapshotFileName('/replay/SPY/2026-09-16', null, '2026-09-17'),
    'zerogex-replay-spy-2026-09-16-2026-09-17.png',
  );
  assert.equal(
    snapshotFileName('/gex?x=1', 'SPY', '2026-09-17'),
    'zerogex-spy-gex-x-1-2026-09-17.png',
  );
});

test('the app header still mounts the camera', () => {
  // The button is in the header rather than on each page precisely so it cannot
  // be forgotten when a page is added — which only holds while the header keeps
  // rendering it. A refactor that drops it takes the feature off all 100+ pages
  // at once and nothing else notices.
  const source = readFileSync(path.join(ROOT, 'components/Header.tsx'), 'utf8');
  assert.match(source, /import PageSnapshotButton from "\.\/PageSnapshotButton"/);
  const mounts = source.match(/<PageSnapshotButton\b/g) ?? [];
  assert.ok(
    mounts.length >= 3,
    `expected the camera in all three header layouts (expanded, collapsed, mobile), found ${mounts.length}`,
  );
});

test('font embedding resolves src against the stylesheet, not the document', () => {
  // next/font writes `src: url(../media/x.woff2)`, which is relative to the
  // emitted CSS file under /_next/static/css/. Resolved against the document it
  // becomes /media/x.woff2, 404s, and BOTH exporters fall back to a generic
  // face — a chart of tabular numbers rendered in a proportional serif, with
  // nothing thrown and nothing logged. Asserted here because the only other
  // way to notice is to look at the file.
  const source = readFileSync(path.join(ROOT, 'core/chartImageExport.ts'), 'utf8');
  assert.match(source, /new URL\(url, rule\.parentStyleSheet\?\.href \?\? document\.baseURI\)/);
});
