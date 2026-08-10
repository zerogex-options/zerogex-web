// Guards the shared strike-filter preference + selection primitives
// (core/strikeFilter.ts) behind the "Active strikes only" toggle used by both
// the Pair Comparison ladder and the Gamma Exposure snapshot table.
//
// The filter is what keeps a high-priced chain like NDX — which lists a fine
// ~10-pt strike grid but only accrues open interest on the round 25-pt strikes
// — from reading as sparse: "Active" drops the listed-but-empty strikes so the
// view fills with real levels. This pins the persistence round-trip (item: the
// preference survives reloads) and the pure selection logic (drop-empties with
// a never-blank fallback).
import test from "node:test";
import assert from "node:assert/strict";
import type { StrikeCell } from "../core/strikeFilter.ts";

// Minimal localStorage stand-in, installed before the module's window-guarded
// reads/writes run (mirrors tests/chartSettings.test.ts).
class MemoryStorage {
  private map = new Map<string, string>();
  get length(): number {
    return this.map.size;
  }
  getItem(key: string): string | null {
    return this.map.has(key) ? this.map.get(key)! : null;
  }
  setItem(key: string, value: string): void {
    this.map.set(key, String(value));
  }
  removeItem(key: string): void {
    this.map.delete(key);
  }
  clear(): void {
    this.map.clear();
  }
  key(index: number): string | null {
    return Array.from(this.map.keys())[index] ?? null;
  }
}

const memory = new MemoryStorage();
(globalThis as { window?: unknown }).window = { localStorage: memory };

// Imported AFTER the window stub so any window-guarded path sees it.
const {
  parseStrikeFilter,
  readStoredStrikeFilter,
  writeStoredStrikeFilter,
  selectActive,
  selectActiveCells,
  STRIKE_FILTER_STORAGE_KEY,
} = await import("../core/strikeFilter.ts");

test.beforeEach(() => {
  memory.clear();
});

// ---- preference persistence -------------------------------------------------

test("parseStrikeFilter defaults to active for anything but the explicit 'all' opt-out", () => {
  assert.equal(parseStrikeFilter("all"), "all");
  assert.equal(parseStrikeFilter("active"), "active");
  assert.equal(parseStrikeFilter(null), "active");
  assert.equal(parseStrikeFilter(undefined), "active");
  assert.equal(parseStrikeFilter("garbage"), "active");
});

test("read defaults to active when nothing is stored", () => {
  assert.equal(readStoredStrikeFilter(), "active");
});

test("write then read round-trips the preference (survives reload)", () => {
  writeStoredStrikeFilter("all");
  assert.equal(memory.getItem(STRIKE_FILTER_STORAGE_KEY), "all");
  assert.equal(readStoredStrikeFilter(), "all");
  writeStoredStrikeFilter("active");
  assert.equal(readStoredStrikeFilter(), "active");
});

test("a corrupt stored value reads back as the active default", () => {
  memory.setItem(STRIKE_FILTER_STORAGE_KEY, "nonsense");
  assert.equal(readStoredStrikeFilter(), "active");
});

// ---- generic selection (drives the Gamma Exposure table via an OI predicate) --

test("selectActive keeps only members passing the predicate when active", () => {
  assert.deepEqual(selectActive([1, 0, 2, 0, 3], true, (n) => n > 0), [1, 2, 3]);
});

test("selectActive returns everything when the filter is off", () => {
  assert.deepEqual(selectActive([1, 0, 2], false, (n) => n > 0), [1, 0, 2]);
});

test("selectActive falls back to the full list when the predicate matches nothing", () => {
  assert.deepEqual(selectActive([0, 0], true, (n) => n > 0), [0, 0]);
});

test("selectActive does not mutate its input", () => {
  const input = [1, 0, 2];
  selectActive(input, true, (n) => n > 0);
  assert.deepEqual(input, [1, 0, 2]);
});

// ---- ladder cells (net-GEX predicate) --------------------------------------

const cell = (strike: number, net_gex: number): StrikeCell => ({ strike, net_gex });
const strikes = (cells: StrikeCell[]) => cells.map((c) => c.strike);

test("selectActiveCells drops strikes whose net GEX is exactly zero", () => {
  const cells = [cell(29970, 0), cell(29950, 40_000), cell(29940, 0), cell(29925, 20_000)];
  assert.deepEqual(strikes(selectActiveCells(cells, true)), [29950, 29925]);
});

test("selectActiveCells keeps thinly-populated strikes with tiny non-zero net GEX", () => {
  // 29690/29680 in the reported NDX ladder showed ±0.01M — real thin strikes.
  const cells = [cell(29700, 0), cell(29690, 10_000), cell(29680, -10_000), cell(29670, 0)];
  assert.deepEqual(strikes(selectActiveCells(cells, true)), [29690, 29680]);
});

test("selectActiveCells: non-finite net GEX is inactive, but an all-non-finite column still renders", () => {
  assert.deepEqual(strikes(selectActiveCells([cell(100, Number.NaN), cell(105, 3_000_000)], true)), [105]);
  const allNan = [cell(100, Number.NaN), cell(105, Number.NaN)];
  assert.deepEqual(strikes(selectActiveCells(allNan, true)), [100, 105]);
});

test("selectActiveCells with the filter off returns every strike unchanged", () => {
  const cells = [cell(100, 0), cell(105, 2_000_000), cell(110, 0)];
  assert.deepEqual(strikes(selectActiveCells(cells, false)), [100, 105, 110]);
});
