// Vertical label de-collision for horizontal level lines (call/put walls,
// gamma flip, max pain, spot). Given each level line's on-screen y — sorted
// ascending (top of chart first) — it returns the y each level's LABEL should
// render at so the labels never overlap: every label starts `anchor` px above
// its line, any that land closer than `gap` are pushed apart, the stack is kept
// inside [minY, maxY], and their order is preserved. Pure and side-effect free
// so both the replay scrubber and the shareable snapshot can share it.
export function staggerLabelYs(
  sortedLineYs: number[],
  { gap, minY, maxY, anchor = 4 }: { gap: number; minY: number; maxY: number; anchor?: number },
): number[] {
  const ys = sortedLineYs.map((ly) => ly - anchor);
  // Pass 1 — top→bottom: push each label down to keep a min gap below the one above.
  for (let i = 1; i < ys.length; i += 1) {
    if (ys[i] < ys[i - 1] + gap) ys[i] = ys[i - 1] + gap;
  }
  // Pass 2 — if the stack overran the bottom, pin the last and walk back up.
  if (ys.length > 0 && ys[ys.length - 1] > maxY) {
    ys[ys.length - 1] = maxY;
    for (let i = ys.length - 2; i >= 0; i -= 1) {
      if (ys[i] > ys[i + 1] - gap) ys[i] = ys[i + 1] - gap;
    }
  }
  // Pass 3 — clamp the top (rare) and re-spread downward.
  if (ys.length > 0 && ys[0] < minY) {
    ys[0] = minY;
    for (let i = 1; i < ys.length; i += 1) {
      if (ys[i] < ys[i - 1] + gap) ys[i] = ys[i - 1] + gap;
    }
  }
  return ys;
}

/**
 * Why a reference level is, or is not, drawn on the plot right now.
 *
 *   'on'    — inside the visible price band; the line and its label render.
 *   'none'  — no value this minute. A real and frequent answer for the Pin,
 *             which the server suppresses below its score floor rather than
 *             inventing a weak one.
 *   'above' / 'below' — has a value, but outside the visible band, so the line
 *             is clipped away.
 *
 * The last three all render as *nothing* on the chart, and an absent line reads
 * as "this product has no such level" rather than "this level is not on screen
 * right now" — which is how a working Pin looked broken to a trader who opened
 * a replay on a minute where it was inactive. Callers use this to say which of
 * the three is true instead of leaving a silent gap.
 */
export type LevelVisibility = 'on' | 'none' | 'above' | 'below';

/**
 * Classify one level against the plot band.
 *
 * `top`/`bottom` are the same bounds the marker filter uses (inclusive of the
 * 1px slack), so `'on'` means exactly "this level got a marker" — the status
 * row and the plot can never disagree about what is drawn.
 */
export function classifyLevelVisibility(
  value: number | null | undefined,
  yForPrice: (price: number) => number,
  { top, bottom }: { top: number; bottom: number },
): LevelVisibility {
  if (value == null || !Number.isFinite(value)) return 'none';
  const y = yForPrice(value);
  if (y < top - 1) return 'above';
  if (y > bottom + 1) return 'below';
  return 'on';
}
