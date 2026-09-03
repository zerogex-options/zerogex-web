/**
 * Where a fixed-viewBox chart's drawing surface actually ends *on screen*.
 *
 * The Strike Profile draws into a 1200×648 viewBox and is scaled to whatever
 * width its container hands it, with a `min-width` floor so the chart never
 * degrades into an illegible smear on a phone. Below that floor the SVG is
 * wider than its scroll container, so its right-hand edge sits outside the
 * visible box — and anything anchored to `viewBox` x = CW (the key-level price
 * pills) is the first thing to disappear. That is exactly what happens in a My
 * Dashboard tile: the tile is often a little narrower than the floor, and the
 * Spot / Gamma Flip / Call Wall / Put Wall pills get sliced down to their first
 * letter or two.
 *
 * `visibleViewBoxRight` converts the container's visible right edge back into
 * viewBox units so the chart can anchor those pills to what the reader can see
 * rather than to the far edge of the drawing. When the whole SVG is visible the
 * answer is just `viewBoxWidth`, so wide layouts are unchanged; when it is
 * scrolled or clipped, the pills ride the visible edge the way a price tag
 * rides the right of a trading chart.
 */

export interface VisibleViewBoxRightOpts {
  /** Rendered width of the `<svg>` box, CSS px. */
  svgWidth: number;
  /** Rendered height of the `<svg>` box, CSS px. */
  svgHeight: number;
  /** viewBox width (the `CW` the chart draws against). */
  viewBoxWidth: number;
  /** viewBox height (the `CH` the chart draws against). */
  viewBoxHeight: number;
  /**
   * Distance from the `<svg>` box's left edge to the right edge of the visible
   * viewport (the scroll container's content box), CSS px. Values past the SVG
   * itself simply mean "nothing is clipped".
   */
  visibleRightPx: number;
}

/**
 * The viewBox x-coordinate of the visible right edge, clamped to
 * `[0, viewBoxWidth]`.
 *
 * Assumes `preserveAspectRatio="xMidYMid meet"` — the uniform fit-inside scale
 * every chart in the app uses — so the drawing is scaled by the smaller of the
 * two axis ratios and centered horizontally in whatever slack is left over.
 * Degenerate inputs (zero/NaN sizes, as jsdom and a first paint both produce)
 * fall back to `viewBoxWidth`, i.e. "assume nothing is clipped", which keeps
 * the pre-existing full-width placement.
 */
export function visibleViewBoxRight(opts: VisibleViewBoxRightOpts): number {
  const { svgWidth, svgHeight, viewBoxWidth, viewBoxHeight, visibleRightPx } = opts;
  if (!Number.isFinite(viewBoxWidth) || viewBoxWidth <= 0) return 0;
  if (
    !Number.isFinite(svgWidth) ||
    !Number.isFinite(svgHeight) ||
    !Number.isFinite(viewBoxHeight) ||
    !Number.isFinite(visibleRightPx) ||
    svgWidth <= 0 ||
    svgHeight <= 0 ||
    viewBoxHeight <= 0
  ) {
    return viewBoxWidth;
  }

  // `meet` fits the whole viewBox inside the box: the limiting axis wins.
  const scale = Math.min(svgWidth / viewBoxWidth, svgHeight / viewBoxHeight);
  if (!(scale > 0)) return viewBoxWidth;

  // `xMid` centers the drawing in any horizontal slack the fit left behind.
  const contentLeftPx = (svgWidth - viewBoxWidth * scale) / 2;
  const x = (visibleRightPx - contentLeftPx) / scale;
  if (!Number.isFinite(x)) return viewBoxWidth;
  return Math.max(0, Math.min(viewBoxWidth, x));
}
