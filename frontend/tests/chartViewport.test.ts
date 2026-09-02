// Unit tests for the visible-edge maths behind the Strike Profile's key-level
// price pills. The chart draws into a fixed 1200×648 viewBox scaled to its
// container, with a 760px `min-width` floor that keeps it legible on a phone.
// In any container narrower than that floor the SVG overflows its scroll box
// and its right-hand edge is off-screen — which used to slice the Spot / Flip /
// Call Wall / Put Wall pills down to their first letter or two inside a My
// Dashboard tile. `visibleViewBoxRight` maps the container's visible right edge
// back into viewBox units so the pills can ride it instead.
import test from 'node:test';
import assert from 'node:assert/strict';

import { visibleViewBoxRight } from '../core/chartViewport.ts';

const CW = 1200;
const CH = 648;

/** The chart's own aspect ratio — height a `width: 100%` SVG resolves to. */
const heightFor = (width: number) => (width * CH) / CW;

const base = (width: number, visibleRightPx: number) => ({
  svgWidth: width,
  svgHeight: heightFor(width),
  viewBoxWidth: CW,
  viewBoxHeight: CH,
  visibleRightPx,
});

test('a fully visible chart reports the whole viewBox', () => {
  assert.equal(visibleViewBoxRight(base(900, 900)), CW);
  assert.equal(visibleViewBoxRight(base(1200, 1200)), CW);
});

test('a container wider than the SVG still reports the whole viewBox', () => {
  // `visibleRightPx` runs past the drawing; nothing is clipped.
  assert.equal(visibleViewBoxRight(base(760, 1400)), CW);
});

test('an overflowing chart reports the clipped edge in viewBox units', () => {
  // 760px SVG (the min-width floor) inside a 704px visible box.
  const x = visibleViewBoxRight(base(760, 704));
  assert.ok(Math.abs(x - (704 * CW) / 760) < 1e-9, `got ${x}`);
  assert.ok(x < CW);
});

test('the reported tile: a level pill now lands fully inside the visible edge', () => {
  // Reproduces the widths measured off the customer screenshot — a My
  // Dashboard tile whose chart area is ~704 CSS px, so the SVG sits at its
  // 760px floor and ~56px of its right edge is hidden.
  const edge = visibleViewBoxRight(base(760, 704));
  const text = 'Gamma Flip 771.50';
  const pillW = Math.max(72, text.length * 5.6);

  // Old placement: pinned to the far edge of the viewBox, so the pill ran off
  // the visible area and only its first letter or two survived.
  const oldPillX = CW - pillW - 2;
  assert.ok(oldPillX + pillW > edge, 'expected the old placement to overflow');
  assert.ok(edge - oldPillX < 12, 'expected almost the whole pill to be hidden');

  // New placement: right-aligned to the visible edge, so the pill fits.
  const newPillX = Math.max(0, edge - pillW - 2);
  assert.ok(newPillX >= 0);
  assert.ok(newPillX + pillW <= edge, 'expected the pill to fit inside the visible edge');
});

test('scrolling the chart right moves the edge deeper into the viewBox', () => {
  // Same 760px SVG; the scroll container has been scrolled 56px right, so more
  // of the drawing's right-hand side is on screen.
  const atRest = visibleViewBoxRight(base(760, 704));
  const scrolled = visibleViewBoxRight(base(760, 760));
  assert.ok(scrolled > atRest);
  assert.equal(scrolled, CW);
});

test('a letterboxed box (compact tile) is never reported as clipped', () => {
  // Box wider than the viewBox aspect: `meet` fits to height and centres the
  // drawing, so the visible edge sits past the drawing's own right edge.
  const x = visibleViewBoxRight({
    svgWidth: 1000,
    svgHeight: 400,
    viewBoxWidth: CW,
    viewBoxHeight: CH,
    visibleRightPx: 1000,
  });
  assert.equal(x, CW);
});

test('a letterboxed box still reports a genuine clip', () => {
  // Same letterboxed geometry, but only the left 300px is visible.
  const scale = Math.min(1000 / CW, 400 / CH);
  const contentLeft = (1000 - CW * scale) / 2;
  const x = visibleViewBoxRight({
    svgWidth: 1000,
    svgHeight: 400,
    viewBoxWidth: CW,
    viewBoxHeight: CH,
    visibleRightPx: 300,
  });
  assert.ok(Math.abs(x - (300 - contentLeft) / scale) < 1e-9, `got ${x}`);
  assert.ok(x > 0 && x < CW);
});

test('the result never leaves the viewBox', () => {
  assert.equal(visibleViewBoxRight(base(760, -50)), 0);
  assert.equal(visibleViewBoxRight(base(760, 0)), 0);
  assert.equal(visibleViewBoxRight(base(760, 99999)), CW);
});

test('degenerate geometry falls back to the full viewBox', () => {
  // A first paint, a display:none tile and jsdom all measure zero.
  assert.equal(visibleViewBoxRight(base(0, 0)), CW);
  assert.equal(
    visibleViewBoxRight({
      svgWidth: NaN,
      svgHeight: NaN,
      viewBoxWidth: CW,
      viewBoxHeight: CH,
      visibleRightPx: NaN,
    }),
    CW,
  );
  assert.equal(
    visibleViewBoxRight({
      svgWidth: 760,
      svgHeight: 410,
      viewBoxWidth: CW,
      viewBoxHeight: CH,
      visibleRightPx: NaN,
    }),
    CW,
  );
  assert.equal(
    visibleViewBoxRight({
      svgWidth: 760,
      svgHeight: 410,
      viewBoxWidth: 0,
      viewBoxHeight: CH,
      visibleRightPx: 704,
    }),
    0,
  );
});
