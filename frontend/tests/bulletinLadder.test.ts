// Live Bulletin: the vertical positioning map's geometry.
//
// The map draws every level on one price axis, highest at the top, and labels
// each one beside the rail. Levels routinely cluster (a pin on max pain, spot
// on the flip), so labels that would print on top of each other are spread
// apart while the levels themselves stay at their true prices. These pin the
// placement rules: never closer than the gap, never out of order, never out of
// bounds, and never moved at all when nothing collides.
import test from "node:test";
import assert from "node:assert/strict";

import { fmtLevelDelta, ladderScale, spreadLabels } from "../app/live-bulletin/ladderLayout.ts";

const GAP = 22;

function assertSpread(placed: number[], gap: number, min: number, max: number) {
  const sorted = [...placed].sort((a, b) => a - b);
  for (let i = 1; i < sorted.length; i++) {
    assert.ok(sorted[i] - sorted[i - 1] >= gap - 1e-9, `rows ${i - 1} and ${i} are ${sorted[i] - sorted[i - 1]}px apart`);
  }
  for (const y of placed) {
    assert.ok(y >= min - 1e-9 && y <= max + 1e-9, `${y} is outside [${min}, ${max}]`);
  }
}

// ---------------------------------------------------------------------------
// ladderScale
// ---------------------------------------------------------------------------

test("ladderScale: higher prices sit higher on the ladder", () => {
  const y = ladderScale([7400, 7455, 7512, 7600], 30, 430);
  assert.ok(y(7600) < y(7512));
  assert.ok(y(7512) < y(7455));
  assert.ok(y(7455) < y(7400));
});

test("ladderScale: the padded domain keeps the extremes inside the drawing area", () => {
  const y = ladderScale([100, 200], 0, 400, 0.05);
  // span 100, padded 5 each side: 200 sits 5/110 of the way down, 100 5/110 up.
  assert.ok(Math.abs(y(200) - (5 / 110) * 400) < 1e-9);
  assert.ok(Math.abs(y(100) - (105 / 110) * 400) < 1e-9);
});

test("ladderScale: a single price lands mid-ladder instead of dividing by zero", () => {
  const y = ladderScale([7500], 0, 400);
  assert.equal(y(7500), 200);
});

test("ladderScale: non-finite prices are ignored", () => {
  const y = ladderScale([Number.NaN, 100, 200, Number.POSITIVE_INFINITY], 0, 400, 0);
  assert.equal(y(200), 0);
  assert.equal(y(100), 400);
});

// ---------------------------------------------------------------------------
// spreadLabels
// ---------------------------------------------------------------------------

test("spreadLabels: labels with room to spare are not moved", () => {
  const desired = [40, 120, 260, 380];
  assert.deepEqual(spreadLabels(desired, GAP, 0, 420), desired);
});

test("spreadLabels: two colliding labels split evenly around their mean", () => {
  const [a, b] = spreadLabels([200, 210], GAP, 0, 420);
  assert.equal(b - a, GAP);
  assert.equal((a + b) / 2, 205);
});

test("spreadLabels: a crowded cluster (pin on max pain, spot on the flip) is spread and kept in order", () => {
  // call wall, pin, max pain, flip: the NDX case, four levels inside 15px.
  const desired = [201, 210, 210, 216];
  const placed = spreadLabels(desired, GAP, 26, 400);
  assertSpread(placed, GAP, 26, 400);
  for (let i = 1; i < placed.length; i++) assert.ok(placed[i] > placed[i - 1], "order changed");
  // Centered on the cluster's mean, so no label drifts further than it must.
  const mean = desired.reduce((s, v) => s + v, 0) / desired.length;
  assert.ok(Math.abs(placed.reduce((s, v) => s + v, 0) / placed.length - mean) < 1e-9);
});

test("spreadLabels: results come back in the caller's order, whatever the input order", () => {
  const placed = spreadLabels([300, 100, 105, 50], GAP, 0, 420);
  assertSpread(placed, GAP, 0, 420);
  assert.equal(placed[0], 300); // untouched: nothing near it
  assert.equal(placed[3], 50);
  assert.ok(placed[1] < placed[2], "the two colliding labels keep their price order");
});

test("spreadLabels: a cluster at an edge is pushed inward, not past the bound", () => {
  const placed = spreadLabels([2, 4, 6], GAP, 10, 400);
  assertSpread(placed, GAP, 10, 400);
  assert.deepEqual(placed, [10, 10 + GAP, 10 + 2 * GAP]);
  const bottom = spreadLabels([396, 398, 399], GAP, 10, 400);
  assertSpread(bottom, GAP, 10, 400);
  assert.deepEqual(bottom, [400 - 2 * GAP, 400 - GAP, 400]);
});

test("spreadLabels: a block pushed off one edge still clears its neighbor", () => {
  // The bottom cluster is shoved up by the bound into the label above it.
  const placed = spreadLabels([340, 395, 398, 399], GAP, 0, 400);
  assert.deepEqual(placed, [400 - 3 * GAP, 400 - 2 * GAP, 400 - GAP, 400]);
  assertSpread(placed, GAP, 0, 400);
  for (let i = 1; i < placed.length; i++) assert.ok(placed[i] > placed[i - 1]);
});

test("spreadLabels: equal prices stack in the order given", () => {
  const [pin, pain] = spreadLabels([210, 210], GAP, 0, 420);
  assert.ok(pin < pain, "the first label given is drawn above");
});

test("spreadLabels: when they cannot all fit, the gap shrinks to share the space", () => {
  const placed = spreadLabels([50, 50, 50, 50, 50], GAP, 0, 60);
  assert.deepEqual(placed, [0, 15, 30, 45, 60]);
});

test("spreadLabels: no labels, no work", () => {
  assert.deepEqual(spreadLabels([], GAP, 0, 100), []);
  assert.deepEqual(spreadLabels([42], GAP, 0, 100), [42]);
});

// ---------------------------------------------------------------------------
// fmtLevelDelta
// ---------------------------------------------------------------------------

test("fmtLevelDelta: whole points on an index, signed, with a real minus", () => {
  assert.equal(fmtLevelDelta(7600, 7512.4), "+88");
  assert.equal(fmtLevelDelta(7455, 7512.4), "−57");
});

test("fmtLevelDelta: cents on an ETF, the precision its levels print in", () => {
  assert.equal(fmtLevelDelta(755, 744.82), "+10.18");
  assert.equal(fmtLevelDelta(735, 744.82), "−9.82");
});

test("fmtLevelDelta: a level on spot says so rather than printing +0", () => {
  assert.equal(fmtLevelDelta(7512, 7512.4), "at spot");
  assert.equal(fmtLevelDelta(612.35, 612.35), "at spot");
});
