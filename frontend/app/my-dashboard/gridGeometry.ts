'use client';

/**
 * Live geometry of a My Dashboard widget grid, read from the DOM.
 *
 * Widths are stored in the board's twelve columns (core/myDashboardLayout),
 * but what is on screen is CSS tracks: 48 on the desktop grid, 2 on a tablet,
 * and on a side-by-side split half the same 48 drawn at twice the board's
 * share (globals.css .zg-mydash-grid--half). Everything that turns a pointer
 * position into a stored width, or a stored width into tracks, goes through
 * here, so the drag, the keyboard steps and the drawing agree at every
 * breakpoint and in either half.
 */

import { GRID_COLUMNS, GRID_TRACKS, type TrackMetrics } from '@/core/myDashboardLayout';

// Mirrors the media query the half-pane rules in globals.css sit under.
const SPLIT_SIDE_BY_SIDE = '(min-width: 1280px)';

export type GridGeometry = TrackMetrics & {
  /** CSS tracks the grid lays out right now. */
  tracks: number;
  left: number;
  right: number;
  /** The full desktop grid, where a width can be any number of tracks. */
  desktop: boolean;
  /** A side-by-side split half, which draws widths at twice the tracks. */
  half: boolean;
};

export function readGridGeometry(grid: HTMLElement): GridGeometry {
  const gs = getComputedStyle(grid);
  const tracks = gs.gridTemplateColumns.split(' ').filter(Boolean).length || 1;
  const gap = parseFloat(gs.columnGap) || 0;
  const rect = grid.getBoundingClientRect();
  const trackWidth = Math.max(0, (rect.width - gap * (tracks - 1)) / tracks);
  // The desktop grid spaces its tiles with cell padding, not a gap.
  const cell = grid.firstElementChild;
  const cs = cell ? getComputedStyle(cell) : null;
  const gutter = cs ? (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0) : 0;
  const desktop = tracks === GRID_TRACKS;
  const half =
    desktop &&
    grid.classList.contains('zg-mydash-grid--half') &&
    typeof window !== 'undefined' &&
    window.matchMedia(SPLIT_SIDE_BY_SIDE).matches;
  return {
    tracks,
    gap,
    gutter,
    trackWidth,
    left: rect.left,
    right: rect.right,
    desktop,
    half,
    columnsPerTrack: GRID_COLUMNS / tracks / (half ? 2 : 1),
  };
}

export { renderedSpan, spanFloor, toSpanStep, tracksForWidth } from '@/core/myDashboardLayout';
