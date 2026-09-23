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
