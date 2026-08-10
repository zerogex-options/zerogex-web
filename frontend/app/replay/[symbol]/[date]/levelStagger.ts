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
