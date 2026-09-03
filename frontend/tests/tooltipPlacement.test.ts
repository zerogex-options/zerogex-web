// Unit tests for the hover-tooltip geometry — the pure part of TooltipWrapper,
// which ~190 call sites across the site depend on.
//
// The invariant that matters is one sentence: whatever is passed in, the box
// comes back inside the viewport on all four sides. It was violated by a height
// ESTIMATE capped at 160px — a ~250px tooltip was placed above a trigger with
// 214px of room and then lifted through the top of the window, which is what a
// customer-facing explainer looked like on /dashboard. So the cases below lean
// on the corners: no room above, no room below, no room either side, a viewport
// shorter than the tooltip itself, and a placement the caller pinned by hand.
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  estimateTooltipHeight,
  resolveTooltipGeometry,
  TOOLTIP_GAP,
  TOOLTIP_WIDTH,
  VIEWPORT_PADDING,
  type TooltipGeometry,
  type TooltipViewport,
} from '../core/tooltipPlacement.ts';

const DESKTOP: TooltipViewport = { width: 1920, height: 1050 };
/** The Key Levels strip's help mark: a 14px glyph, mid-page. */
const anchorAt = (top: number, left = 700) => ({ top, bottom: top + 15, left, width: 14 });
/** The unresolved-level explainer, ~460 characters, in a 360px box. */
const EXPLAINER_HEIGHT = 250;

function assertOnScreen(box: TooltipGeometry, viewport: TooltipViewport, what: string) {
  const height = Math.min(box.maxHeight, EXPLAINER_HEIGHT);
  assert.ok(box.top >= VIEWPORT_PADDING - 0.5, `${what}: top ${box.top} above the viewport`);
  assert.ok(
    box.top + height <= viewport.height - VIEWPORT_PADDING + 0.5,
    `${what}: bottom ${box.top + height} below the viewport`,
  );
  assert.ok(box.left >= VIEWPORT_PADDING - 0.5, `${what}: left ${box.left} off the viewport`);
  assert.ok(
    box.left + box.width <= viewport.width - VIEWPORT_PADDING + 0.5,
    `${what}: right ${box.left + box.width} off the viewport`,
  );
}

test('the reported case: a tall tooltip on the Key Levels strip stays on screen', () => {
  // 230px from the top is where the strip's cards sit on /dashboard. The old
  // code believed the box was 160px, found 214px of room above, and placed it
  // there — putting a 250px box 32px through the top of the window.
  const viewport = DESKTOP;
  const box = resolveTooltipGeometry({
    anchor: anchorAt(230),
    viewport,
    height: EXPLAINER_HEIGHT,
  });
  assert.equal(box.placement, 'bottom', 'it does not fit above, so it must go below');
  assertOnScreen(box, viewport, 'strip explainer');
});

test('a tall tooltip goes above when — and only when — it actually fits there', () => {
  const viewport = DESKTOP;
  const fits = resolveTooltipGeometry({
    anchor: anchorAt(EXPLAINER_HEIGHT + TOOLTIP_GAP + VIEWPORT_PADDING),
    viewport,
    height: EXPLAINER_HEIGHT,
  });
  assert.equal(fits.placement, 'top');
  assert.equal(fits.top, VIEWPORT_PADDING, 'it lands exactly against the padding');

  // One pixel less and the answer has to change.
  const doesNot = resolveTooltipGeometry({
    anchor: anchorAt(EXPLAINER_HEIGHT + TOOLTIP_GAP + VIEWPORT_PADDING - 1),
    viewport,
    height: EXPLAINER_HEIGHT,
  });
  assert.equal(doesNot.placement, 'bottom');
  assertOnScreen(doesNot, viewport, 'one pixel short');
});

test('a trigger jammed against either edge still gets a box on screen', () => {
  const viewport = DESKTOP;
  for (const [what, top] of [['top edge', 8], ['bottom edge', 1030]] as const) {
    const box = resolveTooltipGeometry({ anchor: anchorAt(top), viewport, height: EXPLAINER_HEIGHT });
    assertOnScreen(box, viewport, what);
    assert.equal(box.showArrow, true, `${what}: it moved to a side that fits, so the arrow still meets it`);
  }
});

test('with no room on either side the box is clamped, and drops its arrow', () => {
  // 520px of viewport around a mid-page trigger fits a 250px box on neither
  // side. Clamping is the honest answer; the arrow is not, because it is drawn
  // against the box's edge and the box is no longer beside the trigger.
  const viewport = { width: 1920, height: 520 };
  const box = resolveTooltipGeometry({ anchor: anchorAt(250), viewport, height: EXPLAINER_HEIGHT });
  assertOnScreen(box, viewport, 'no room either side');
  assert.equal(box.showArrow, false);
});

test('a viewport shorter than the tooltip keeps the top of the text reachable', () => {
  // The clamp's range inverts here (max < min). The top has to win: text you
  // can start reading beats text whose last line happens to be visible.
  const viewport = { width: 1920, height: 240 };
  const box = resolveTooltipGeometry({ anchor: anchorAt(100), viewport, height: EXPLAINER_HEIGHT });
  assert.equal(box.top, VIEWPORT_PADDING);
  assert.equal(box.clipped, true, 'and it is flagged so the renderer may scroll it');
  assert.ok(box.maxHeight <= viewport.height - VIEWPORT_PADDING * 2);
  assertOnScreen(box, viewport, 'viewport shorter than the box');
});

test('clipped is false for any ordinary tooltip — the arrow must not be scrolled away', () => {
  // overflow is gated on this flag. If it were ever set spuriously the arrow,
  // an absolutely positioned child outside the box's edge, would vanish.
  const box = resolveTooltipGeometry({ anchor: anchorAt(500), viewport: DESKTOP, height: EXPLAINER_HEIGHT });
  assert.equal(box.clipped, false);
  assert.equal(box.showArrow, true);
});

test('an explicit placement is honored but still cannot leave the viewport', () => {
  // Several call sites pin placement="bottom". Honoring it is right; letting it
  // push the box off the bottom of the window is not.
  const viewport = DESKTOP;
  const box = resolveTooltipGeometry({
    anchor: anchorAt(980),
    viewport,
    height: EXPLAINER_HEIGHT,
    placement: 'bottom',
  });
  assert.equal(box.placement, 'bottom');
  assertOnScreen(box, viewport, 'pinned to bottom with no room');
  assert.equal(box.showArrow, false, 'it was pushed off its natural offset');
});

test('a viewport too narrow to center the box narrows the box instead', () => {
  // Below ~392px the fixed 360px width cannot sit inside the padding on both
  // sides, and the horizontal clamp used to resolve to a negative left.
  for (const width of [390, 350, 320]) {
    const viewport = { width, height: 800 };
    const box = resolveTooltipGeometry({
      anchor: anchorAt(400, width - 20),
      viewport,
      height: EXPLAINER_HEIGHT,
    });
    assert.ok(box.width <= TOOLTIP_WIDTH);
    assertOnScreen(box, viewport, `${width}px viewport`);
  }
});

test('the arrow stays over the box even when the box slid away from its trigger', () => {
  // A trigger at the far right pushes the box left to stay on screen; the arrow
  // must not run off the box's own corner.
  const viewport = DESKTOP;
  for (const left of [0, 40, 960, 1890]) {
    const box = resolveTooltipGeometry({ anchor: anchorAt(600, left), viewport, height: 120 });
    assert.ok(box.arrowLeft >= 20, `arrow ${box.arrowLeft} off the left corner`);
    assert.ok(box.arrowLeft <= box.width - 20, `arrow ${box.arrowLeft} off the right corner`);
  }
});

test('the height estimate is never capped — that cap was the bug', () => {
  // It only has to be close enough for one frame before the measurement lands.
  // What it must not do is stop growing, which is what let a 250px box be
  // placed as if it were 160px.
  const short = estimateTooltipHeight('Short note.');
  const long = estimateTooltipHeight('x'.repeat(460));
  const longer = estimateTooltipHeight('x'.repeat(1200));
  assert.ok(short >= 72, 'a one-liner still clears the chrome');
  assert.ok(long > 200, `a 460-character explainer estimates tall, got ${long}`);
  assert.ok(longer > long, 'and it keeps growing');
});
