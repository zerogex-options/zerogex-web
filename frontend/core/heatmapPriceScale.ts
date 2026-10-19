/**
 * Which side(s) of the GEX heatmap carry the price scale, and the plot padding
 * that follows from it.
 *
 * The scale has always been on the left. A right-hand scale sits between the
 * plot and the color legend, next to the newest candles, which is where the
 * current price is. The choice is a saved display preference, and
 * core/chartSettings only checks that a stored value is a string, so a stored
 * side is checked against the options here before it is used.
 *
 * Pure layout: no React, no DOM.
 */

export const PRICE_SCALE_SIDES = ['left', 'right', 'both'] as const;
export type PriceScaleSide = (typeof PRICE_SCALE_SIDES)[number];

export const PRICE_SCALE_LABEL: Record<PriceScaleSide, string> = {
  left: 'Left',
  right: 'Right',
  both: 'Both',
};

/** Where the scale has always been, so nobody's chart moves until they ask. */
export const DEFAULT_PRICE_SCALE: PriceScaleSide = 'left';

/**
 * Left edge of the plot when the scale is on the right only. Not zero: the
 * first time label is centered on its tick and hangs past the plot's edge.
 */
export const PRICE_SCALE_EDGE_PAD = 16;

export type Pads = { L: number; R: number; T: number; B: number };

export interface PriceScaleLayout {
  pads: Pads;
  /** Draw the scale in the left gutter. */
  left: boolean;
  /** Draw the scale in a gutter immediately right of the plot. */
  right: boolean;
  /**
   * Width of that right-hand gutter (0 without one). Anything the layout keeps
   * on the right, like the color legend, starts after it.
   */
  rightGutter: number;
}

export function isPriceScaleSide(value: unknown): value is PriceScaleSide {
  return typeof value === 'string' && (PRICE_SCALE_SIDES as readonly string[]).includes(value);
}

/**
 * Lay out the price scale for `side`. `base` is the layout's padding with the
 * scale on the left, as it has always been drawn. A right-hand scale gets a
 * gutter as wide as the left one, in front of whatever `base` already keeps on
 * the right.
 */
export function priceScaleLayout(base: Pads, side: PriceScaleSide): PriceScaleLayout {
  const left = side !== 'right';
  const right = side !== 'left';
  const rightGutter = right ? base.L : 0;
  return {
    pads: {
      ...base,
      L: left ? base.L : PRICE_SCALE_EDGE_PAD,
      R: base.R + rightGutter,
    },
    left,
    right,
    rightGutter,
  };
}

/**
 * Fewest CSS px between two price labels. Labels used to sit on every Dots row,
 * and ES and NQ strikes (SPX and NDX strikes carried over by the basis) can
 * sit two points apart, so their labels printed over each other.
 */
export const PRICE_LABEL_MIN_GAP_PX = 26;

/** The smallest of 1, 2 or 5 times a power of ten that is at least `span / maxLabels`. */
export function niceStep(span: number, maxLabels: number): number {
  const raw = span / Math.max(1, maxLabels);
  if (!Number.isFinite(raw) || raw <= 0) return 1;
  const pow = 10 ** Math.floor(Math.log10(raw));
  for (const m of [1, 2, 5]) if (m * pow >= raw * (1 - 1e-9)) return m * pow;
  return 10 * pow;
}

/** Decimal places a step's labels need: 0 for 1 and up, 1 for 0.5 or 0.2. */
export function stepDecimals(step: number): number {
  for (let d = 0; d < 6; d++) {
    const scaled = step * 10 ** d;
    if (Math.abs(scaled - Math.round(scaled)) < 1e-6) return d;
  }
  return 6;
}

export type PriceTick = { value: number; label: string };

/**
 * The y-axis labels for a price range drawn `plotHeight` px tall: every round
 * multiple of a 1-2-5 step inside the range, the step being the smallest that
 * keeps labels at least `minGapPx` apart. Labels print at the step's own
 * precision ("$7800", or "$662.5" with "$663.0" beside it), never as raw
 * strikes like "$7810.25".
 */
export function priceTicks(
  yMin: number,
  yMax: number,
  plotHeight: number,
  minGapPx: number = PRICE_LABEL_MIN_GAP_PX,
): PriceTick[] {
  const span = yMax - yMin;
  if (!Number.isFinite(span) || span <= 0 || !(plotHeight > 0)) return [];
  const step = niceStep(span, Math.floor(plotHeight / minGapPx));
  const decimals = stepDecimals(step);
  const ticks: PriceTick[] = [];
  for (let i = Math.ceil(yMin / step - 1e-9); i * step <= yMax + 1e-9; i++) {
    const value = Number((i * step).toFixed(decimals));
    ticks.push({ value, label: `$${value.toFixed(decimals)}` });
  }
  return ticks;
}
