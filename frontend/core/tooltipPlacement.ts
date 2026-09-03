/**
 * Where a hover tooltip goes — the pure geometry behind components/TooltipWrapper.
 *
 * It lives here, apart from the component, because the whole of this feature is
 * arithmetic over two rectangles and every bug it has had was an arithmetic bug
 * no rendering test would have caught. The one that prompted the split: the
 * box's height was GUESSED from its character count and the guess was capped at
 * 160px, so a ~250px tooltip was placed above a trigger with 214px of room and
 * then lifted clean through the top of the window. A capped estimate is not a
 * height, and nothing downstream re-checked it.
 *
 * Two rules follow from that and are what the tests hold:
 *   • the caller passes a MEASURED height once one exists — the estimate below
 *     is only ever the first frame's placeholder;
 *   • the returned box is inside the viewport on all four sides no matter what
 *     is passed in, including a placement the caller asked for explicitly and a
 *     viewport shorter than the tooltip itself.
 *
 * Runtime-dependency-free (no React, no DOM) so it runs under the Node test
 * runner, in keeping with the other core modules.
 */

/** Preferred box width. Narrowed on a viewport too small to center it. */
export const TOOLTIP_WIDTH = 360;
/** Space between the trigger and the box. */
export const TOOLTIP_GAP = 12;
/** Space kept clear at every viewport edge. */
export const VIEWPORT_PADDING = 16;
/** Half the arrow's diagonal, so it stays fully over the box's border. */
const ARROW_INSET = 20;

export type TooltipPlacement = 'top' | 'bottom';

/** The trigger's viewport-space rect — the four fields of a DOMRect used here. */
export interface TooltipAnchor {
  top: number;
  bottom: number;
  left: number;
  width: number;
}

export interface TooltipViewport {
  width: number;
  height: number;
}

export interface TooltipGeometry {
  /** Final viewport-space top edge — already clamped, applied verbatim. */
  top: number;
  left: number;
  width: number;
  /** Ceiling on the box's height. Only binding on a very short viewport. */
  maxHeight: number;
  /**
   * True when the content genuinely exceeds `maxHeight`, and the only case that
   * may set `overflow`. It has to stay `visible` otherwise: the arrow is an
   * absolutely positioned child sitting OUTSIDE the box's edge, so a scroll
   * container would clip it away on every ordinary tooltip.
   */
  clipped: boolean;
  placement: TooltipPlacement;
  /** Arrow offset from the box's left edge. */
  arrowLeft: number;
  /**
   * False when the box had to be pushed off its natural offset to stay on
   * screen. The arrow is drawn against the box's own edge, so once the box has
   * moved the arrow no longer meets the trigger, and pointing at nothing is
   * worse than not pointing at all.
   */
  showArrow: boolean;
}

/**
 * First-frame height placeholder, replaced by a measurement one frame later.
 *
 * Derived from the box's own type: ~46 characters per line at 14px in a 360px
 * box less its 32px of horizontal padding, ~23px of leading, and ~41px of
 * chrome (24px of vertical padding plus the "Context" eyebrow). It only has to
 * be close — but it must NOT be capped, which is the bug this module exists to
 * make untestable-by-accident no longer.
 */
export function estimateTooltipHeight(text: string): number {
  return Math.max(72, Math.ceil(text.length / 46) * 23 + 41);
}

/**
 * Clamp that survives an impossible range. A viewport shorter than the box
 * makes `max` < `min`; the low end wins, so the TOP of the content stays on
 * screen rather than the bottom.
 */
function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

export function resolveTooltipGeometry({
  anchor,
  viewport,
  height,
  placement = 'auto',
}: {
  anchor: TooltipAnchor;
  viewport: TooltipViewport;
  /** The box's height — measured wherever possible, estimated only at first paint. */
  height: number;
  placement?: 'auto' | TooltipPlacement;
}): TooltipGeometry {
  // Narrow before placing: below ~392px of viewport a fixed 360px box cannot be
  // centered inside the padding on both sides, and the clamp would otherwise
  // resolve to a negative left.
  const width = Math.min(TOOLTIP_WIDTH, viewport.width - VIEWPORT_PADDING * 2);
  const centeredLeft = anchor.left + anchor.width / 2 - width / 2;
  const left = clamp(centeredLeft, VIEWPORT_PADDING, viewport.width - width - VIEWPORT_PADDING);

  const needed = height + TOOLTIP_GAP;
  const roomAbove = anchor.top - VIEWPORT_PADDING;
  const roomBelow = viewport.height - anchor.bottom - VIEWPORT_PADDING;
  const resolvedPlacement: TooltipPlacement =
    placement !== 'auto'
      ? placement
      : roomAbove >= needed
        ? 'top'
        : roomBelow >= needed
          ? 'bottom'
          : // Neither side fits. Take the roomier one and let the clamp settle
            // the rest, rather than committing to the side that guarantees more
            // of the text ends up off screen.
            roomBelow >= roomAbove
            ? 'bottom'
            : 'top';

  // Resolve to a real top edge rather than leaning on translateY(-100%): a
  // transform hides the box's true extent from every bound check after it,
  // which is how a box believed to be 160px tall walked off the window.
  const naturalTop =
    resolvedPlacement === 'top' ? anchor.top - TOOLTIP_GAP - height : anchor.bottom + TOOLTIP_GAP;
  const top = clamp(naturalTop, VIEWPORT_PADDING, viewport.height - height - VIEWPORT_PADDING);

  const maxHeight = viewport.height - VIEWPORT_PADDING * 2;
  const triggerCenter = anchor.left + anchor.width / 2;

  return {
    top,
    left,
    width,
    maxHeight,
    clipped: height > maxHeight,
    placement: resolvedPlacement,
    arrowLeft: clamp(triggerCenter - left, ARROW_INSET, width - ARROW_INSET),
    showArrow: Math.abs(top - naturalTop) < 1,
  };
}
