/**
 * The Strike Panel's strike axis — the pure half.
 *
 * On the Gamma Terminal the chart's gamma rail is portalled into a panel beside
 * the tape (GammaTerminalChart's `strikePanelTarget`). Down its left edge runs
 * a slim axis with a small label at each strike, so a bar can be read without
 * hovering it.
 *
 * Labels never overlap. Zoomed in, every strike carries one. Zoomed out, the
 * axis labels every 2nd, 5th, 10th, 20th... strike instead, picking the
 * smallest step whose labels clear each other, and anchoring the run to round
 * multiples of that step (SPX at a 50-point step reads 6000, 6050, 6100, not
 * 6005, 6055, 6105). The strike being read is always labeled; neighbors that
 * would collide with it give way.
 *
 * Pure (no React / no window) so it unit-tests directly.
 */

/** One label the axis draws. */
export interface StrikeAxisLabel {
  price: number;
  y: number;
  text: string;
  /** The strike under the pointer: drawn emphasized. */
  focus: boolean;
}

export interface StrikeAxisInput {
  /** Every strike the panel draws (any order; duplicates are fine). */
  strikes: readonly number[];
  /** Price → y, linear, in the units `minGap` and the band are in. */
  yFor: (price: number) => number;
  /** The least vertical distance between two labels' centers. */
  minGap: number;
  /** The visible band: a label whose center falls outside it is not drawn. */
  yMin: number;
  yMax: number;
  /** The strike being read, if any. Always labeled when it is in the band. */
  focus?: number | null;
}

export interface StrikeAxisResult {
  labels: StrikeAxisLabel[];
  /** Every visible strike, for the minor ticks. */
  strikes: Array<{ price: number; y: number }>;
  /** Vertical distance between two adjacent strikes at the usual increment. */
  slot: number;
  /** How many strike increments one label step spans (1, 2, 5, 10, ...). */
  every: number;
}

/** 1, 2, 5, 10, 20, 50, ... — the steps a label run may take. */
function niceMultiple(min: number): number {
  if (!(min > 1)) return 1;
  let base = 1;
  for (;;) {
    for (const m of [1, 2, 5]) {
      if (m * base >= min) return m * base;
    }
    base *= 10;
  }
}

/** A strike as the axis prints it: no thousands separator, no trailing zeros. */
export function formatStrike(price: number): string {
  if (!Number.isFinite(price)) return "";
  const cents = Math.round(price * 100);
  if (cents % 100 === 0) return String(cents / 100);
  return (cents / 100).toFixed(2).replace(/0$/, "");
}

export function strikeAxisLabels({ strikes, yFor, minGap, yMin, yMax, focus = null }: StrikeAxisInput): StrikeAxisResult {
  // Work in cents so the modular test below is exact.
  const cents = Array.from(new Set(strikes.filter(Number.isFinite).map((p) => Math.round(p * 100)))).sort((a, b) => a - b);
  const visible = cents
    .map((c) => ({ c, price: c / 100, y: yFor(c / 100) }))
    .filter((s) => Number.isFinite(s.y) && s.y >= yMin && s.y <= yMax);
  if (visible.length === 0) return { labels: [], strikes: [], slot: 0, every: 1 };

  // The usual strike increment: the median gap, so the wider strikes far from
  // spot do not set the pace for the dense ones near it.
  const gaps: number[] = [];
  for (let i = 1; i < visible.length; i++) gaps.push(visible[i].c - visible[i - 1].c);
  gaps.sort((a, b) => a - b);
  const increment = gaps.length ? gaps[Math.floor(gaps.length / 2)] : 0;
  const first = visible[0];
  const last = visible[visible.length - 1];
  const pxPerCent = last.c > first.c ? Math.abs(last.y - first.y) / (last.c - first.c) : 0;
  const slot = increment * pxPerCent;

  const every = slot > 0 ? niceMultiple(minGap / slot) : 1;
  const stepCents = increment * every;
  let candidates = every === 1 ? visible : visible.filter((s) => s.c % stepCents === 0);
  // A chain whose strikes sit off the round multiples (all on .5s, say) would
  // lose every label to the modular test: fall back to every Nth strike.
  if (candidates.length === 0) candidates = visible.filter((_, i) => i % every === 0);

  const focusCents = focus != null && Number.isFinite(focus) ? Math.round(focus * 100) : null;
  const focused = focusCents != null ? visible.find((s) => s.c === focusCents) ?? null : null;

  // Greedy, top to bottom: keep a label only if it clears the last one kept
  // and the focused one. The step above already spaces them; this catches the
  // irregular grids (wider strikes far out, mixed increments) it cannot.
  const ordered = [...candidates].sort((a, b) => a.y - b.y);
  const labels: StrikeAxisLabel[] = [];
  let lastY = -Infinity;
  for (const s of ordered) {
    if (focused && s.c === focused.c) continue;
    if (s.y - lastY < minGap) continue;
    if (focused && Math.abs(s.y - focused.y) < minGap) continue;
    labels.push({ price: s.price, y: s.y, text: formatStrike(s.price), focus: false });
    lastY = s.y;
  }
  if (focused) labels.push({ price: focused.price, y: focused.y, text: formatStrike(focused.price), focus: true });

  return { labels, strikes: visible.map((s) => ({ price: s.price, y: s.y })), slot, every };
}
