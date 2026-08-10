// Guards the Pair Comparison ladder's "Active strikes only" selection
// (selectActiveCells), the fix for high-priced chains like NDX reading as
// sparse: NDX lists a fine ~10-pt strike grid but only accrues open interest on
// the round 25-pt strikes, so the listed-but-empty strikes (which aggregate to
// EXACTLY net_gex 0) crowded the fixed ±MAX_SIDE window and pushed the real
// levels out of view. Active-only drops the net-GEX-0 strikes so the window
// fills with real levels; it must fall back to the full set when filtering
// would blank the column (degraded/empty snapshots), and leave everything
// untouched when off.
import test from "node:test";
import assert from "node:assert/strict";

import { selectActiveCells, type StrikeCell } from "../components/pairGammaHeatmap.helpers.ts";

const cell = (strike: number, net_gex: number): StrikeCell => ({ strike, net_gex });
const strikes = (cells: StrikeCell[]) => cells.map((c) => c.strike);

test("activeOnly drops strikes whose net GEX is exactly zero", () => {
  const cells = [cell(29970, 0), cell(29950, 40_000), cell(29940, 0), cell(29925, 20_000)];
  assert.deepEqual(strikes(selectActiveCells(cells, true)), [29950, 29925]);
});

test("activeOnly keeps thinly-populated strikes with tiny non-zero net GEX (real OI)", () => {
  // 29690/29680 in the reported NDX ladder showed ±0.01M — real contracts, not
  // empties; they must survive the filter.
  const cells = [cell(29700, 0), cell(29690, 10_000), cell(29680, -10_000), cell(29670, 0)];
  assert.deepEqual(strikes(selectActiveCells(cells, true)), [29690, 29680]);
});

test("activeOnly falls back to the full list when every strike reads zero", () => {
  const cells = [cell(100, 0), cell(105, 0)]; // e.g. a degraded after-hours snapshot
  assert.deepEqual(strikes(selectActiveCells(cells, true)), [100, 105]);
});

test("non-finite net GEX is inactive, but an all-non-finite column still renders", () => {
  assert.deepEqual(strikes(selectActiveCells([cell(100, Number.NaN), cell(105, 3_000_000)], true)), [105]);
  const allNan = [cell(100, Number.NaN), cell(105, Number.NaN)];
  assert.deepEqual(strikes(selectActiveCells(allNan, true)), [100, 105]);
});

test("activeOnly=false returns every strike unchanged", () => {
  const cells = [cell(100, 0), cell(105, 2_000_000), cell(110, 0)];
  assert.deepEqual(strikes(selectActiveCells(cells, false)), [100, 105, 110]);
});

test("selectActiveCells does not mutate its input", () => {
  const cells = [cell(100, 0), cell(105, 2_000_000)];
  const before = strikes(cells);
  selectActiveCells(cells, true);
  assert.deepEqual(strikes(cells), before);
});
