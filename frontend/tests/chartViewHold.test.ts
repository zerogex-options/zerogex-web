// The Gamma Chart fits itself to the tape until the reader first zooms or pans,
// and from then on holds still. Before this, the price axis re-fitted on every
// live tick (and every flip or wall that moved, and every pan through time), so
// a zoom was re-scaled under the reader's hand about once a second, and a view
// panned back in time slid one bar left every time a bar printed.
//
// Three layers are pinned here: the time rule (core/chartViewHold), the linked
// dashboard axis (core/linkedPriceAxisState), and the chart's own wiring, which
// is checked at the source the way tests/gammaTerminal.test.ts checks it.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { barsPrintedSince } from '../core/chartViewHold.ts';
import {
  INITIAL_LINK_STATE,
  UNMOVED_VIEW,
  holdLinkView,
  linkDomains,
  reportLinkDomain,
  setLinkView,
  type LinkState,
} from '../core/linkedPriceAxisState.ts';

const chart = readFileSync(new URL('../components/GammaTerminalChart.tsx', import.meta.url), 'utf8');

// ── Time: a panned-back view stays on its bars ────────────────────────────

/** Bars stamped t0, t1, … — only the timestamp matters to the rule. */
const series = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => ({ timestamp: `t${from + i}` }));

/** The chart's own windowing: `offset` bars hidden right of the view. */
const visible = (bars: Array<{ timestamp: string }>, count: number, offset: number) => {
  const end = bars.length - offset;
  return bars.slice(Math.max(0, end - count), end).map((b) => b.timestamp);
};

test('nothing printed, nothing to move', () => {
  const bars = series(0, 9);
  assert.equal(barsPrintedSince(bars, 't9'), 0);
  // No previous newest bar (first load): there is no window to keep yet.
  assert.equal(barsPrintedSince(bars, null), 0);
});

test('counts the bars that printed after the old newest one', () => {
  assert.equal(barsPrintedSince(series(0, 10), 't9'), 1);
  assert.equal(barsPrintedSince(series(0, 12), 't9'), 3);
});

test('a pool that rolls off its oldest bar still counts only what printed', () => {
  // A full pool drops t0 as t10 arrives. The offset is measured from the
  // right, so only the new bar on the right moves it.
  assert.equal(barsPrintedSince(series(1, 10), 't9'), 1);
});

test('a replaced series is not treated as bars printing', () => {
  assert.equal(barsPrintedSince(series(20, 29), 't9'), 0);
  assert.equal(barsPrintedSince([], 't9'), 0);
});

test('widening the offset by what printed keeps a panned view on the same bars', () => {
  const count = 5;
  const offset = 3;
  const before = series(0, 19);
  const shown = visible(before, count, offset);

  // The pool grows by one…
  const grown = series(0, 20);
  assert.deepEqual(visible(grown, count, offset + barsPrintedSince(grown, 't19')), shown);
  // …or rolls, dropping its oldest bar as the new one prints…
  const rolled = series(1, 20);
  assert.deepEqual(visible(rolled, count, offset + barsPrintedSince(rolled, 't19')), shown);
  // …and without the correction the window creeps, which was the bug.
  assert.notDeepEqual(visible(grown, count, offset), shown);
});

// ── A linked board's shared axis ────────────────────────────────────────────

const spy = (min: number, max: number) => ({ symbol: 'SPY', min, max });
const qqq = (min: number, max: number) => ({ symbol: 'QQQ', min, max });

/** Two SPY charts on one linked board, both fitting themselves. */
const twoSpyCharts = (): LinkState =>
  reportLinkDomain(reportLinkDomain(INITIAL_LINK_STATE, 'a', spy(600, 610)), 'b', spy(602, 614));

test('untouched, the shared window follows the data', () => {
  let s = twoSpyCharts();
  assert.deepEqual(linkDomains(s).get('SPY'), { min: 600, max: 614 });
  s = reportLinkDomain(s, 'a', spy(598, 610));
  assert.deepEqual(linkDomains(s).get('SPY'), { min: 598, max: 614 }, 'auto-fit keeps fitting');
});

test('the first zoom or pan holds the window, and the data no longer moves it', () => {
  let s = setLinkView(twoSpyCharts(), { zoom: 0.5, centerRel: 0 });
  const heldAt = linkDomains(s).get('SPY');
  assert.deepEqual(heldAt, { min: 600, max: 614 });

  s = reportLinkDomain(s, 'a', spy(590, 612));
  s = reportLinkDomain(s, 'b', spy(605, 630));
  assert.deepEqual(linkDomains(s).get('SPY'), heldAt, 'ticks, walls and time pans do not re-scale it');

  // Further zooms and pans are the reader's, and keep the held window.
  s = setLinkView(s, { zoom: 0.4, centerRel: 0.2 });
  assert.deepEqual(linkDomains(s).get('SPY'), heldAt);
});

test('a zoom or pan through time takes the axis over without moving it', () => {
  const auto = twoSpyCharts();
  const s = holdLinkView(auto);
  assert.equal(s.view, UNMOVED_VIEW);
  assert.deepEqual(linkDomains(s), linkDomains(auto), 'held exactly where it was');
  // Once the reader is steering, it keeps their zoom / pan as it is.
  const zoomed = setLinkView(s, { zoom: 0.5, centerRel: 0.1 });
  assert.equal(holdLinkView(zoomed), zoomed);
});

test('a symbol that arrives while held opens on its own fit, then holds', () => {
  let s = setLinkView(twoSpyCharts(), UNMOVED_VIEW);
  // Half b switches to QQQ: its SPY report is withdrawn, its QQQ one arrives.
  s = reportLinkDomain(s, 'b', null);
  s = reportLinkDomain(s, 'b', qqq(520, 530));
  assert.deepEqual(linkDomains(s).get('QQQ'), { min: 520, max: 530 });
  s = reportLinkDomain(s, 'b', qqq(515, 540));
  assert.deepEqual(linkDomains(s).get('QQQ'), { min: 520, max: 530 });
  // SPY keeps the window it was held at, withdrawn report or not.
  assert.deepEqual(linkDomains(s).get('SPY'), { min: 600, max: 614 });
});

test('Reset hands the window back to the auto-fit', () => {
  let s = setLinkView(twoSpyCharts(), { zoom: 0.5, centerRel: 0 });
  s = reportLinkDomain(s, 'a', spy(590, 612));
  s = setLinkView(s, null);
  assert.equal(s.view, null);
  assert.equal(s.held, null);
  assert.deepEqual(linkDomains(s).get('SPY'), { min: 590, max: 614 }, 'the live union again');
});

test('repeated reports and views are no-ops, so nothing can loop', () => {
  const s = twoSpyCharts();
  assert.equal(reportLinkDomain(s, 'a', spy(600, 610)), s);
  assert.equal(reportLinkDomain(s, 'nobody', null), s);
  assert.equal(setLinkView(INITIAL_LINK_STATE, null), INITIAL_LINK_STATE);
  const manual = setLinkView(s, UNMOVED_VIEW);
  assert.equal(setLinkView(manual, manual.view), manual);
  // Held, a moving report changes the reports but not the window charts see.
  const moved = reportLinkDomain(manual, 'a', spy(590, 612));
  assert.equal(linkDomains(moved), linkDomains(manual));
});

// ── The chart's wiring ──────────────────────────────────────────────────────

/** The body of a `const name = (…) => { … };` handler in the chart. */
const handler = (name: string) => {
  const start = chart.indexOf(`const ${name} = (`);
  assert.ok(start >= 0, `${name} exists`);
  return chart.slice(start, chart.indexOf('\n  };\n', start));
};

test('the layout draws from the held window before the link or the auto-fit', () => {
  assert.match(chart, /const held = frozen \?\? \(priceLink \? null : pinnedAxis\);/);
  assert.match(chart, /const shared = held \? null : linkedBase;/);
  assert.match(chart, /const baseMid = held \? held\.mid : shared \? \(shared\.min \+ shared\.max\) \/ 2 : autoMid;/);
});

test('every price zoom and pan holds the axis first', () => {
  for (const name of ['commitPriceZoom', 'commitPriceCenter']) {
    assert.match(handler(name), /holdPriceAxis\(\);\s*setPriceView/, name);
  }
  // Holding pins what is on screen, once, and on a linked board goes to the link.
  const hold = handler('holdPriceAxis');
  assert.match(hold, /priceLink\.hold\(\);/);
  assert.match(hold, /setPinnedAxis\(\(pa\) => pa \?\? \{ mid: baseMid, half: baseHalf \}\);/);
});

test('every zoom and pan through time holds the axis too', () => {
  assert.match(handler('zoomTimeCentered'), /holdPriceAxis\(\);/);
  // Mouse drag: as soon as the pointer has really moved.
  assert.match(handler('handlePointerMove'), /drag\.moved = true;\s*setDragging\(true\);\s*setHover\(null\);\s*holdPriceAxis\(\);/);
  // Touch: a one-finger pan, and a two-finger pinch.
  assert.match(handler('handleTouchMove'), /t\.mode = "pan";[\s\S]*?holdPriceAxis\(\);\s*return;/);
  assert.match(handler('handleTouchDown'), /t\.mode = "pinch";[\s\S]*?holdPriceAxis\(\);/);
  // Wheel: attached natively, so it reaches the current handler through a ref.
  assert.match(chart, /holdPriceAxisRef\.current = holdPriceAxis;/);
  assert.match(chart, /setHover\(null\);\s*holdPriceAxisRef\.current\(\);/);
});

test('Reset and a new symbol or timeframe hand the axis back to the auto-fit', () => {
  assert.match(handler('resetView'), /setPinnedAxis\(null\);/);
  const keyReset = chart.slice(chart.indexOf('if (viewKey !== '), chart.indexOf('\n  }\n', chart.indexOf('if (viewKey !== ')));
  assert.match(keyReset, /setPinnedAxis\(null\);/);
  // The Reset button shows whenever the axis is held, so the way back is visible.
  assert.match(chart, /: pinnedAxis !== null \|\| priceView\.center !== null \|\| priceView\.zoom !== 1;/);
  assert.match(chart, /const isCustomView = view\.offset !== 0 \|\| view\.count !== defaultCount \|\| priceIsManual;/);
});

test('a jump back to the live edge keeps the scale but always shows the latest bar', () => {
  const keep = handler('keepLatestInHeldWindow');
  assert.match(keep, /if \(!priceIsManual \|\| !layout\) return;/);
  assert.match(keep, /if \(latest < layout\.dMin \|\| latest > layout\.dMax\) commitPriceCenter\(latest\);/);
  assert.match(handler('exitRewind'), /keepLatestInHeldWindow\(\);/);
  assert.match(chart, /setView\(\(v\) => \(\{ \.\.\.v, offset: 0 \}\)\);\s*setHover\(null\);\s*keepLatestInHeldWindow\(\);/);
});

test('a panned-back view is re-anchored as bars print, and the live edge is not', () => {
  assert.match(chart, /const printed = barsPrintedSince\(allBars, seenNewestBarTs\);/);
  assert.match(chart, /setView\(\(v\) => \(v\.offset > 0 \? \{ \.\.\.v, offset: v\.offset \+ printed \} : v\)\)/);
});
