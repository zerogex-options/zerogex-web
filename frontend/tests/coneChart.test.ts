// Guards the intraday cone's series construction (core/coneChart.ts).
//
// The cone is a published claim: each band edge is what the grader tested
// price against. So the properties worth testing are the ones that would let
// the chart show a reader a band nobody committed to, while still looking
// like a perfectly ordinary cone:
//
//  * the cone must START AT SPOT and widen — a band drawn at full width from
//    the anchor implies price could gap to its edge instantly, which is the
//    opposite of what the horizon sigma says;
//  * horizons must be ordered, or an out-of-order payload folds the cone back
//    on itself and the widest band renders inside the narrowest;
//  * merging the realized path onto the cone must never let a null erase a
//    value — the anchor instant carries BOTH a band and a price, and a naive
//    spread drops whichever arrives second;
//  * "not scored" has to survive as its own outcome, because folding it into
//    held or broke moves a published hit rate for a reason that has nothing
//    to do with the model.
import test from "node:test";
import assert from "node:assert/strict";

import {
  CONE_SYMBOLS,
  buildConePoints,
  buildSpotPath,
  coneDomain,
  horizonVerdict,
  mergeConeSeries,
} from "../core/coneChart.ts";

const ANCHOR = "2026-09-21T11:00:00-04:00";
const ANCHOR_MS = Date.parse(ANCHOR);

function fire(overrides: Record<string, unknown> = {}) {
  return {
    forecast_ts: ANCHOR,
    anchor_spot: 600,
    horizons: [
      { horizon_min: 30, band_low: 598.4, band_high: 601.6 },
      { horizon_min: 60, band_low: 598.0, band_high: 602.0 },
      { horizon_min: 120, band_low: 597.4, band_high: 602.6 },
    ],
    ...overrides,
  };
}

test("the picker offers only the symbols the cone is modelled for", () => {
  // The cone hardcodes a 390-minute cash session and a diurnal curve shaped
  // around an opening auction and a closing ramp. Futures trade ~23 hours, so
  // pointing this model at them would anchor every fire to 09:30 and ignore
  // the session where they are most distinctive. Listing them would render
  // "no cone committed" forever, which reads as a broken page rather than a
  // scoping decision.
  assert.deepEqual([...CONE_SYMBOLS], ["SPY", "SPX", "QQQ", "NDX"]);
  for (const future of ["ES", "NQ"]) {
    assert.ok(
      !(CONE_SYMBOLS as readonly string[]).includes(future),
      `${future} trades outside the cash session this model assumes`,
    );
  }
});

test("the cone starts as a point at the anchor, then widens", () => {
  const points = buildConePoints(fire());
  assert.equal(points.length, 4);

  const [origin, ...rest] = points;
  assert.equal(origin.t, ANCHOR_MS);
  assert.equal(origin.bandSpan, 0, "the band must have zero width at the anchor");
  assert.equal(origin.bandBase, 600);
  assert.equal(origin.spot, 600, "the anchor also carries the price it was read at");

  const spans = rest.map((p) => p.bandSpan as number);
  assert.deepEqual(spans, [...spans].sort((a, b) => a - b), "the cone must widen");
  assert.ok(spans[0] > 0);
});

test("each horizon lands at its own offset from the anchor", () => {
  const points = buildConePoints(fire());
  assert.deepEqual(
    points.slice(1).map((p) => (p.t - ANCHOR_MS) / 60_000),
    [30, 60, 120],
  );
});

test("an out-of-order payload cannot fold the cone back on itself", () => {
  const scrambled = fire({
    horizons: [
      { horizon_min: 120, band_low: 597.4, band_high: 602.6 },
      { horizon_min: 30, band_low: 598.4, band_high: 601.6 },
      { horizon_min: 60, band_low: 598.0, band_high: 602.0 },
    ],
  });
  const points = buildConePoints(scrambled);
  assert.deepEqual(
    points.slice(1).map((p) => (p.t - ANCHOR_MS) / 60_000),
    [30, 60, 120],
  );
});

test("a horizon with a missing bound is skipped, not coerced to zero", () => {
  const partial = fire({
    horizons: [
      { horizon_min: 30, band_low: 598.4, band_high: 601.6 },
      { horizon_min: 60, band_low: null, band_high: 602.0 },
    ],
  });
  const points = buildConePoints(partial);
  assert.equal(points.length, 2, "anchor + the one complete horizon");
  assert.equal(points[1].bandBase, 598.4);
});

test("a fire with no usable anchor draws nothing rather than drawing at zero", () => {
  assert.deepEqual(buildConePoints(null), []);
  assert.deepEqual(buildConePoints(fire({ anchor_spot: null })), []);
  assert.deepEqual(buildConePoints(fire({ forecast_ts: null })), []);
  assert.deepEqual(buildConePoints(fire({ forecast_ts: "not a date" })), []);
});

test("the realized path is sampled at every fire's anchor, in order", () => {
  const path = buildSpotPath([
    { forecast_ts: "2026-09-21T11:30:00-04:00", anchor_spot: 601, horizons: [] },
    { forecast_ts: ANCHOR, anchor_spot: 600, horizons: [] },
    { forecast_ts: "2026-09-21T11:15:00-04:00", anchor_spot: 599.5, horizons: [] },
  ]);
  assert.deepEqual(path.map((p) => p.spot), [600, 599.5, 601]);
  assert.ok(path.every((p) => p.bandBase === null && p.bandSpan === null));
});

test("fires without a price are dropped from the path", () => {
  const path = buildSpotPath([
    { forecast_ts: ANCHOR, anchor_spot: null, horizons: [] },
    { forecast_ts: null, anchor_spot: 600, horizons: [] },
  ]);
  assert.deepEqual(path, []);
  assert.deepEqual(buildSpotPath(null), []);
});

test("merging never lets a null erase a value at the shared anchor instant", () => {
  // The anchor carries both a band and a price. A naive spread would drop
  // whichever landed second.
  const merged = mergeConeSeries(buildConePoints(fire()), buildSpotPath([fire()]));
  const origin = merged.find((r) => r.t === ANCHOR_MS);
  assert.ok(origin);
  assert.equal(origin.spot, 600, "the price survived the merge");
  assert.equal(origin.bandBase, 600, "and so did the band origin");
  assert.equal(origin.bandSpan, 0);
});

test("merged rows are unique per instant and time-ordered", () => {
  const merged = mergeConeSeries(
    buildConePoints(fire()),
    buildSpotPath([
      fire(),
      { forecast_ts: "2026-09-21T11:15:00-04:00", anchor_spot: 599.5, horizons: [] },
    ]),
  );
  const ts = merged.map((r) => r.t);
  assert.deepEqual(ts, [...new Set(ts)], "no duplicate instants");
  assert.deepEqual(ts, [...ts].sort((a, b) => a - b), "chronological");
});

test("the domain spans the cone, which runs past the last price print", () => {
  const merged = mergeConeSeries(buildConePoints(fire()), buildSpotPath([fire()]));
  const domain = coneDomain(merged);
  assert.ok(domain);
  assert.equal(domain[0], ANCHOR_MS);
  assert.equal(domain[1], ANCHOR_MS + 120 * 60_000);
});

test("an empty series has no domain rather than a degenerate one", () => {
  assert.equal(coneDomain([]), null);
});

test("a matured claim with no bars stays its own outcome", () => {
  assert.equal(horizonVerdict({ graded: true, held: true }), "held");
  assert.equal(horizonVerdict({ graded: true, held: false }), "broke");
  // Graded, but the window never produced bars. Neither outcome.
  assert.equal(horizonVerdict({ graded: true, held: null }), "not scored");
  assert.equal(horizonVerdict({ graded: false, held: null }), "pending");
});
