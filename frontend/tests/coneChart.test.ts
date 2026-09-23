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
  conePriceDecimals,
  conePriceDomain,
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

test("the price axis does not anchor at zero", () => {
  // The bug this exists for. The band is two STACKED areas, and a stack's
  // implied baseline is zero, so recharts derived a 0-800 domain and drew a
  // $2 cone as a flat line at the top of an empty rectangle.
  // The fixture is a $600 underlying with a 597.4-602.6 cone.
  const rows = mergeConeSeries(buildConePoints(fire()), buildSpotPath([fire()]));
  const d = conePriceDomain(rows);
  assert.ok(d);
  assert.ok(d[0] > 500, `axis must not reach toward zero, got ${d[0]}`);
  assert.ok(d[0] <= 597.4, "and must contain the lowest band edge");
  assert.ok(d[1] >= 602.6, "and the highest");
});

test("the domain contains every band edge and the anchor", () => {
  const rows = mergeConeSeries(buildConePoints(fire()), buildSpotPath([fire()]));
  const [lo, hi] = conePriceDomain(rows)!;
  for (const p of rows) {
    if (p.spot !== null) {
      assert.ok(p.spot >= lo && p.spot <= hi);
    }
    if (p.bandBase !== null) {
      assert.ok(p.bandBase >= lo, "band floor inside the axis");
      assert.ok((p.bandBase + (p.bandSpan ?? 0)) <= hi, "band ceiling inside");
    }
  }
});

test("a nearby level joins the axis and a distant one does not", () => {
  const rows = mergeConeSeries(buildConePoints(fire()), buildSpotPath([fire()]));
  const bare = conePriceDomain(rows)!;

  // A wall just outside the band should widen the axis to show it.
  const near = conePriceDomain(rows, [603.5])!;
  assert.ok(near[1] >= 603.5, "a wall near the cone must be visible");

  // One 5% away must not flatten the band into a line to display it.
  const far = conePriceDomain(rows, [640])!;
  assert.ok(far[1] < 640, "a distant wall must not stretch the axis");
  assert.deepEqual(far, bare, "and must leave the axis untouched");
});

test("the axis snaps to round numbers", () => {
  // allowDataOverflow makes recharts use the bounds verbatim as the outer
  // ticks, so unrounded bounds read as 765.40 ... 771.60 — three even gaps
  // and a short one, which looks like a rounding bug.
  const rows = mergeConeSeries(buildConePoints(fire()), buildSpotPath([fire()]));
  const [lo, hi] = conePriceDomain(rows)!;
  const step = (hi - lo) / 4;
  assert.ok(Number.isFinite(step) && step > 0);
  for (const bound of [lo, hi]) {
    const k = bound / step;
    assert.ok(Math.abs(k - Math.round(k)) < 1e-9,
      `${bound} should be a whole number of ${step} steps`);
  }
});

test("a single anchor still yields a usable axis", () => {
  // The session's first fire has one price and a zero-width band at t0; a
  // naive pad of 0 would collapse the axis to a point.
  const one = { forecast_ts: ANCHOR, anchor_spot: 600, horizons: [] };
  const rows = mergeConeSeries(buildConePoints(one), buildSpotPath([one]));
  const d = conePriceDomain(rows);
  assert.ok(d);
  assert.ok(d[1] > d[0], "the axis must have width");
  assert.ok(d[0] <= 600 && d[1] >= 600, "and contain the price");
});

test("nothing to draw yields no axis rather than a bogus one", () => {
  assert.equal(conePriceDomain([]), null);
  assert.equal(conePriceDomain([{ t: 1, bandBase: null, bandSpan: null, spot: null }]), null);
});

test("tick precision follows the price scale", () => {
  // Cents matter on SPY. On NDX at 30,000 they are four columns of noise.
  assert.equal(conePriceDecimals(768.98), 1);
  assert.equal(conePriceDecimals(30220.12), 0);
  assert.equal(conePriceDecimals(7720.07), 0);
  assert.equal(conePriceDecimals(42.5), 2);
});

test("a matured claim with no bars stays its own outcome", () => {
  assert.equal(horizonVerdict({ graded: true, held: true }), "held");
  assert.equal(horizonVerdict({ graded: true, held: false }), "broke");
  // Graded, but the window never produced bars. Neither outcome.
  assert.equal(horizonVerdict({ graded: true, held: null }), "not scored");
  assert.equal(horizonVerdict({ graded: false, held: null }), "pending");
});
