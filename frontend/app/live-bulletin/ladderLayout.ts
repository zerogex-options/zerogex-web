// Geometry for the Live Bulletin's vertical positioning map: a price ladder
// with the highest level at the top. Kept framework-free (like
// bulletinHelpers.ts) so the label placement can be tested on its own.

/**
 * A linear price -> y mapping for a ladder drawn between `top` and `bottom`
 * (px, top < bottom). Higher prices sit higher, so they get the smaller y.
 * `values` are every price the ladder has to show; the domain is padded by
 * `padFrac` of their span so nothing lands exactly on an edge.
 */
export function ladderScale(
  values: number[],
  top: number,
  bottom: number,
  padFrac = 0.05,
): (price: number) => number {
  const finite = values.filter((v) => Number.isFinite(v));
  if (finite.length === 0) return () => (top + bottom) / 2;
  const min = Math.min(...finite);
  const max = Math.max(...finite);
  // A single price (or several equal ones) still needs a non-zero span.
  const span = max - min || Math.max(Math.abs(max) * 0.01, 1);
  const hi = max + span * padFrac;
  const lo = min - span * padFrac;
  return (price: number) => top + ((hi - price) / (hi - lo)) * (bottom - top);
}

/**
 * Where to draw each label so that no two sit closer than `gap`, moving each
 * as little as possible from where its level actually is.
 *
 * `desired` holds each label's ideal center (in any order); the result holds
 * the placed centers in the same order. Labels keep their top-to-bottom order
 * and stay within [min, max]. Labels that collide are pushed apart as a block
 * centered on their mean, the usual way to label crowded lines: the levels
 * stay at their true prices, and only the text steps aside, joined to its
 * level by a leader line. If even that cannot fit them all, the gap shrinks
 * so they still share the space evenly.
 */
export function spreadLabels(desired: number[], gap: number, min: number, max: number): number[] {
  const n = desired.length;
  if (n === 0) return [];
  const g = n > 1 ? Math.min(gap, Math.max(0, max - min) / (n - 1)) : gap;
  const order = desired.map((y, i) => ({ y, i })).sort((a, b) => a.y - b.y || a.i - b.i);
  const place = (top: number, count: number) =>
    Math.min(Math.max(top, min), max - (count - 1) * g);

  type Block = { first: number; count: number; sum: number; top: number };
  const blocks: Block[] = [];
  order.forEach(({ y }, k) => {
    blocks.push({ first: k, count: 1, sum: y, top: place(y, 1) });
    // Merge backwards while the newest block overlaps the one above it.
    while (blocks.length > 1) {
      const b = blocks[blocks.length - 1];
      const a = blocks[blocks.length - 2];
      if (a.top + a.count * g <= b.top + 1e-9) break;
      const count = a.count + b.count;
      const sum = a.sum + b.sum;
      blocks.splice(-2, 2, { first: a.first, count, sum, top: place(sum / count - ((count - 1) * g) / 2, count) });
    }
  });

  const out = new Array<number>(n);
  for (const block of blocks) {
    for (let j = 0; j < block.count; j++) {
      out[order[block.first + j].i] = block.top + j * g;
    }
  }
  return out;
}

/**
 * A level's distance from spot, signed, for the ladder: "+88" (above spot),
 * "−57" (below). Whole points on a four-figure index, cents on an ETF, the
 * precision fmtPrice prints the levels themselves in.
 */
export function fmtLevelDelta(level: number, spot: number): string {
  const delta = level - spot;
  const digits = Math.abs(spot) >= 1000 ? 0 : 2;
  const text = Math.abs(delta).toFixed(digits);
  if (Number(text) === 0) return 'at spot';
  return `${delta > 0 ? '+' : '−'}${text}`;
}
