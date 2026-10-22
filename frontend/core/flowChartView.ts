/**
 * The Flow Analysis chart's zoom and pan: which slice of the session's bar
 * grid is on screen, and how the price scale sits on it.
 *
 * The chart lays a session out on a fixed grid of bar slots, 09:30 through
 * the last bar at 16:15. Unzoomed it shows all of it, so in the first hour the
 * whole hour fills the left seventh of the chart; on 1-minute bars the strike
 * dots then sit on top of each other. Zooming narrows the window to a span of
 * slots so each bar gets room of its own.
 *
 * A zoomed view at the newest bar follows the session as bars arrive, the way
 * the Gamma Chart's live view does, instead of being left behind. One panned
 * back stays where the reader put it, so a stretch being read does not creep
 * away from under the pointer a bar at a time.
 *
 * Pure: no React, no DOM. Units are bar slots from the open.
 */

export interface FlowTimeView {
  /** Bars on screen. */
  span: number;
  /** The window's right edge, in slots; null follows the newest bar. */
  end: number | null;
}

export interface FlowWindow {
  /** First slot on screen (may be fractional). */
  start: number;
  /** Where the window ends, in slots. */
  end: number;
  span: number;
}

/** The most zoomed-in a window gets, in bars. */
export const MIN_SPAN = 15;
/** One press of a zoom button. */
export const ZOOM_STEP = 1.5;
/** One notch of the wheel, or one wheel event of a pinch. */
export const WHEEL_STEP = 1.2;

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

/** Room to the right of the newest bar while a view follows it, in bars. */
export function edgePad(span: number): number {
  return Math.max(1, span * 0.04);
}

/** Where a following window's right edge sits: just past the newest bar, never past the session. */
function rightEdge(span: number, slots: number, edge: number): number {
  return Math.min(slots, edge + edgePad(span));
}

function minSpan(slots: number): number {
  return Math.min(MIN_SPAN, slots);
}

/**
 * The window a view puts on screen. `slots` is the session's grid and `edge`
 * the slot just past the newest bar. No view is the whole session.
 */
export function flowWindow(view: FlowTimeView | null, slots: number, edge: number): FlowWindow {
  if (!view || !(slots > 0)) return { start: 0, end: Math.max(1, slots), span: Math.max(1, slots) };
  const span = clamp(view.span, minSpan(slots), slots);
  // Early in a session the window is wider than what has traded: it starts at
  // the open and shows some of the day still to come.
  const end = clamp(view.end ?? rightEdge(span, slots, edge), span, slots);
  return { start: end - span, end, span };
}

/** A window turned back into a view: one reaching the newest bar follows it. */
function toView(start: number, span: number, slots: number, edge: number): FlowTimeView | null {
  if (span >= slots - 1e-9) return null;
  const end = clamp(start + span, span, slots);
  return end >= rightEdge(span, slots, edge) - 1e-9 ? { span, end: null } : { span, end };
}

/**
 * Zoom by `factor` (under 1 zooms in), keeping `anchor` (a slot) where it is
 * on screen: the bar under the pointer for a wheel or a pinch. A button has no
 * pointer: it anchors on the newest bar while the view shows it, so the
 * latest trading stays in sight, and on the middle of the window otherwise.
 * Zoomed all the way out is the whole session again (null).
 */
export function zoomView(
  view: FlowTimeView | null,
  factor: number,
  anchor: number | null,
  slots: number,
  edge: number,
): FlowTimeView | null {
  if (!(slots > 0) || !(factor > 0)) return view;
  const w = flowWindow(view, slots, edge);
  const span = clamp(w.span * factor, minSpan(slots), slots);
  const a =
    anchor != null && Number.isFinite(anchor)
      ? clamp(anchor, w.start, w.end)
      : edge >= w.start && edge <= w.end
        ? edge
        : (w.start + w.end) / 2;
  const at = w.span > 0 ? (a - w.start) / w.span : 1;
  return toView(a - at * span, span, slots, edge);
}

/**
 * Pan by `delta` bars: positive goes back in time, as dragging the chart to
 * the right does. Held between the open and the newest bar; panning back to
 * the newest bar follows it again. The whole session has nothing to pan.
 */
export function panView(view: FlowTimeView | null, delta: number, slots: number, edge: number): FlowTimeView | null {
  if (!view || !Number.isFinite(delta)) return view;
  const w = flowWindow(view, slots, edge);
  return toView(w.start - delta, w.span, slots, edge);
}

/** The time-axis step, in minutes, that keeps labels at least `minGapPx` apart. */
const TICK_STEPS_MIN = [5, 10, 15, 30, 60, 120];
export function tickStepMinutes(pxPerMinute: number, minGapPx: number): number {
  for (const step of TICK_STEPS_MIN) if (step * pxPerMinute >= minGapPx) return step;
  return TICK_STEPS_MIN[TICK_STEPS_MIN.length - 1];
}

/** The price scale's own zoom: 1 and no center is the scale fitting what is on screen. */
export interface FlowPriceView {
  /** Share of the fitted range on screen: under 1 zooms in. */
  zoom: number;
  /** The price the scale is centered on, once panned; null follows the fit. */
  center: number | null;
}

export const PRICE_ZOOM_MIN = 0.15;
export const PRICE_ZOOM_MAX = 4;
export const FIT_PRICE: FlowPriceView = { zoom: 1, center: null };

export function isFitPrice(pv: FlowPriceView): boolean {
  return pv.zoom === 1 && pv.center == null;
}

/** The fitted price window with the reader's zoom and pan applied. */
export function applyPriceView(base: { min: number; max: number }, pv: FlowPriceView): { min: number; max: number } {
  if (isFitPrice(pv)) return base;
  const center = pv.center ?? (base.min + base.max) / 2;
  const half = ((base.max - base.min) / 2) * clamp(pv.zoom, PRICE_ZOOM_MIN, PRICE_ZOOM_MAX);
  return { min: center - half, max: center + half };
}

export function zoomPrice(pv: FlowPriceView, factor: number): FlowPriceView {
  const zoom = clamp(pv.zoom * factor, PRICE_ZOOM_MIN, PRICE_ZOOM_MAX);
  // Zoomed back out to the fit with nothing panned is the fit itself.
  return pv.center == null && Math.abs(zoom - 1) < 1e-9 ? FIT_PRICE : { zoom, center: pv.center };
}
