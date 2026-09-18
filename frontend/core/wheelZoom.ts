/**
 * What a wheel event over a chart should actually do.
 *
 * Every chart in the app used to treat *any* wheel event over its drawing
 * surface as a zoom and `preventDefault()` it unconditionally. That makes the
 * chart a scroll trap: a reader working down a long page — Technicals, Dealer
 * Positioning, a My Dashboard board — drags the cursor across a chart on the
 * way past, and the page stops dead while the chart silently zooms itself. The
 * reader then has to notice what happened, zoom back out, move the cursor to a
 * chart-free strip of page, and find their place again. The zoom was never
 * asked for, and losing your place on the page is a far bigger cost than the
 * convenience of an unmodified-wheel zoom.
 *
 * So an unmodified wheel scrolls the page, like it does everywhere else on the
 * web, and zoom belongs to gestures you can only make on purpose:
 *
 *   * **Ctrl / Cmd + wheel** — zoom. Ctrl also covers trackpad pinch, which
 *     browsers deliver as a wheel event with `ctrlKey` set, so pinch-to-zoom
 *     the chart keeps working without a special case.
 *   * **Shift + wheel** — zoom the price axis. This is the gesture the charts
 *     already used for price zoom, kept so existing muscle memory survives.
 *   * **Wheel over the price scale** — zoom the price axis. The right-hand
 *     scale is a few dozen pixels you have to aim at; nobody lands there while
 *     scrolling past. This is the escape hatch for anyone who liked
 *     wheel-zoom, and it matches how desktop charting packages behave.
 *
 * Note that taking Ctrl + wheel suppresses the browser's own page-zoom over
 * the chart. That is the deliberate trade every charting surface makes, and it
 * is what lets trackpad pinch zoom the chart rather than the document.
 *
 * Every chart wired to this also carries on-screen zoom buttons, so the wheel
 * is never the only way to zoom.
 */

/** Time zoom, price zoom, or hands off — let the page scroll. */
export type WheelAction = 'page-scroll' | 'zoom-time' | 'zoom-price';

export interface WheelActionInput {
  /** `WheelEvent.ctrlKey` — also set by trackpad pinch. */
  ctrlKey: boolean;
  /** `WheelEvent.metaKey` — Cmd on macOS. */
  metaKey: boolean;
  /** `WheelEvent.shiftKey`. */
  shiftKey: boolean;
  /**
   * Cursor is over the chart's right-hand price scale — an aimed target, so a
   * bare wheel there is a deliberate price zoom rather than a passer-by.
   * Charts with no price scale (or no separate price zoom) omit it.
   */
  overPriceAxis?: boolean;
}

/**
 * Which of the three a wheel event means.
 *
 * Order matters: the price axis and Shift both name the price axis explicitly,
 * so they win over the generic Ctrl/Cmd zoom when they are combined.
 */
export function wheelAction(input: WheelActionInput): WheelAction {
  if (input.overPriceAxis) return 'zoom-price';
  if (input.shiftKey) return 'zoom-price';
  if (input.ctrlKey || input.metaKey) return 'zoom-time';
  return 'page-scroll';
}

/**
 * `true` when the event carries a deliberate zoom intent, i.e. the handler
 * should `preventDefault()` and zoom. For charts with a single zoom axis,
 * which only need the yes/no and not which axis was asked for.
 */
export function isZoomGesture(input: WheelActionInput): boolean {
  return wheelAction(input) !== 'page-scroll';
}
