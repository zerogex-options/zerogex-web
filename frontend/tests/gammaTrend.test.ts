// Guards the Gamma Trend panel's series construction and reads
// (core/gammaTrend.ts).
//
// This panel exists to answer "which way is dealer gamma going," so the
// properties worth testing are the ones that would make it answer WRONGLY
// while still looking plausible:
//
//  * a feed gap must not sum to $0 and draw a cliff that reads as the book
//    disappearing;
//  * the display scale must be applied uniformly, or a flat book renders as
//    a slope because the divisor moved with spot;
//  * a change inside the noise floor must read "flat", not "building" —
//    without a deadband every session trends and the verdict means nothing;
//  * the cushion is the |gap|, so it converges whether the flip climbed into
//    spot or spot fell onto the flip, and the copy names which one it was.
import test from "node:test";
import assert from "node:assert/strict";

import {
  buildTrendAxis,
  buildTrendSeries,
  formatGexAxis,
  gammaDomain,
  priceDomain,
  cushionTone,
  describeCushionTrend,
  describeGammaTrend,
  formatSignedPoints,
  gammaTone,
  summarizeTrend,
  type TrendBucket,
} from "../core/gammaTrend.ts";

function bucket(
  timestamp: string,
  gammas: number[],
  close: number | null = 100,
  flip: number | null = 90,
): TrendBucket {
  return {
    timestamp,
    close,
    gamma_flip: flip,
    strikes: gammas.map((g, i) => ({ strike: 100 + i, net_gamma: g })),
  };
}

// ---------------------------------------------------------------------------
// Series construction
// ---------------------------------------------------------------------------

test("sums net gamma across every strike in a bucket", () => {
  const series = buildTrendSeries([bucket("2026-08-28T14:00:00Z", [1e9, 2e9, -5e8])]);
  assert.equal(series.length, 1);
  assert.equal(series[0].gamma, 2.5e9);
});

test("applies the display scale uniformly to every point", () => {
  // A book that does not change size must render flat under any unit. If the
  // scale were re-derived per bucket from that bucket's own spot, this would
  // slope purely because spot moved.
  const series = buildTrendSeries(
    [
      bucket("2026-08-28T14:00:00Z", [1e9], 100),
      bucket("2026-08-28T14:05:00Z", [1e9], 200),
    ],
    0.5,
  );
  assert.equal(series[0].gamma, 5e8);
  assert.equal(series[1].gamma, 5e8);
});

test("drops buckets with no strike data instead of summing them to zero", () => {
  const series = buildTrendSeries([
    bucket("2026-08-28T14:00:00Z", [4e9]),
    { timestamp: "2026-08-28T14:05:00Z", close: 100, gamma_flip: 90, strikes: [] },
    { timestamp: "2026-08-28T14:10:00Z", close: 100, gamma_flip: 90 },
    bucket("2026-08-28T14:15:00Z", [4e9]),
  ]);
  assert.equal(series.length, 2);
  assert.ok(
    series.every((p) => p.gamma === 4e9),
    "a feed gap must not draw a cliff to $0",
  );
});

test("skips unparseable timestamps and orders the series by time", () => {
  const series = buildTrendSeries([
    bucket("2026-08-28T14:10:00Z", [3e9]),
    bucket("not-a-date", [9e9]),
    bucket("2026-08-28T14:00:00Z", [1e9]),
  ]);
  assert.deepEqual(
    series.map((p) => p.gamma),
    [1e9, 3e9],
  );
});

test("cushion is spot minus flip, and null when either is missing", () => {
  const series = buildTrendSeries([
    bucket("2026-08-28T14:00:00Z", [1e9], 7761.89, 7636.33),
    bucket("2026-08-28T14:05:00Z", [1e9], 7761.89, null),
    bucket("2026-08-28T14:10:00Z", [1e9], null, 7636.33),
  ]);
  assert.ok(Math.abs((series[0].cushion as number) - 125.56) < 1e-9);
  assert.equal(series[1].cushion, null);
  assert.equal(series[2].cushion, null);
});

test("coerces string-valued numbers off the wire", () => {
  const series = buildTrendSeries([
    {
      timestamp: "2026-08-28T14:00:00Z",
      close: "7761.89",
      gamma_flip: "7636.33",
      strikes: [{ strike: "7700", net_gamma: "1500000000" }],
    },
  ]);
  assert.equal(series[0].gamma, 1.5e9);
  assert.equal(series[0].spot, 7761.89);
});

// ---------------------------------------------------------------------------
// Direction, with a deadband
// ---------------------------------------------------------------------------

test("a change inside the noise floor reads flat, not building", () => {
  // +$100M on a $50B book is 0.2% — well inside the 2% deadband.
  const summary = summarizeTrend(
    buildTrendSeries([
      bucket("2026-08-28T14:00:00Z", [50e9]),
      bucket("2026-08-28T14:05:00Z", [50.1e9]),
    ]),
  );
  assert.equal(summary.direction, "flat");
  assert.equal(gammaTone(summary), "muted");
  assert.match(describeGammaTrend(summary), /holding flat/);
});

test("a decisive build reads building and reports the delta", () => {
  const summary = summarizeTrend(
    buildTrendSeries([
      bucket("2026-08-28T14:00:00Z", [40e9]),
      bucket("2026-08-28T14:05:00Z", [50e9]),
    ]),
  );
  assert.equal(summary.direction, "building");
  assert.equal(summary.gammaChange, 10e9);
  assert.equal(gammaTone(summary), "bull");
  assert.match(describeGammaTrend(summary), /building/);
  assert.match(describeGammaTrend(summary), /\+\$10\.00B/);
});

test("a decisive drawdown reads decaying", () => {
  const summary = summarizeTrend(
    buildTrendSeries([
      bucket("2026-08-28T14:00:00Z", [50e9]),
      bucket("2026-08-28T14:05:00Z", [30e9]),
    ]),
  );
  assert.equal(summary.direction, "decaying");
  assert.equal(gammaTone(summary), "bear");
});

test("detects dealer gamma changing sign", () => {
  const summary = summarizeTrend(
    buildTrendSeries([
      bucket("2026-08-28T14:00:00Z", [5e9]),
      bucket("2026-08-28T14:05:00Z", [-5e9]),
    ]),
  );
  assert.equal(summary.crossedZero, true);
});

// ---------------------------------------------------------------------------
// Cushion drift
// ---------------------------------------------------------------------------

test("a flip climbing into a static spot reads converging, and names the flip", () => {
  const summary = summarizeTrend(
    buildTrendSeries([
      bucket("2026-08-28T14:00:00Z", [50e9], 7761, 7636),
      bucket("2026-08-28T14:05:00Z", [50e9], 7761, 7726),
    ]),
  );
  assert.equal(summary.drift, "converging");
  assert.equal(summary.flipMove, 90);
  assert.equal(summary.spotMove, 0);
  const read = describeCushionTrend(summary);
  assert.match(read, /thinning/);
  assert.match(read, /flip climbing/);
  assert.equal(cushionTone(summary), "warning");
});

test("spot falling onto a static flip also reads converging, and names spot", () => {
  // The gap is the fragility signal, so it must close whichever side moved —
  // holding spot fixed would miss this case entirely.
  const summary = summarizeTrend(
    buildTrendSeries([
      bucket("2026-08-28T14:00:00Z", [50e9], 7761, 7636),
      bucket("2026-08-28T14:05:00Z", [50e9], 7671, 7636),
    ]),
  );
  assert.equal(summary.drift, "converging");
  const read = describeCushionTrend(summary);
  assert.match(read, /thinning/);
  assert.match(read, /spot falling/);
});

test("a gap opening up reads widening", () => {
  const summary = summarizeTrend(
    buildTrendSeries([
      bucket("2026-08-28T14:00:00Z", [50e9], 7700, 7636),
      bucket("2026-08-28T14:05:00Z", [50e9], 7800, 7636),
    ]),
  );
  assert.equal(summary.drift, "widening");
  assert.match(describeCushionTrend(summary), /widening/);
  assert.equal(cushionTone(summary), "bull");
});

test("a sub-noise drift reads steady rather than inventing a direction", () => {
  const summary = summarizeTrend(
    buildTrendSeries([
      bucket("2026-08-28T14:00:00Z", [50e9], 7761, 7636),
      bucket("2026-08-28T14:05:00Z", [50e9], 7761, 7637),
    ]),
  );
  assert.equal(summary.drift, "steady");
  assert.match(describeCushionTrend(summary), /steady/);
});

test("a flip crossing leads the read, ahead of the drift", () => {
  const summary = summarizeTrend(
    buildTrendSeries([
      bucket("2026-08-28T14:00:00Z", [50e9], 7700, 7636),
      bucket("2026-08-28T14:05:00Z", [50e9], 7600, 7636),
    ]),
  );
  assert.equal(summary.crossedFlip, true);
  assert.match(describeCushionTrend(summary), /crossed below the flip/);
  assert.equal(cushionTone(summary), "bear");
});

test("no resolved flip says so instead of implying a cushion", () => {
  const summary = summarizeTrend(
    buildTrendSeries([
      bucket("2026-08-28T14:00:00Z", [50e9], 7761, null),
      bucket("2026-08-28T14:05:00Z", [50e9], 7761, null),
    ]),
  );
  assert.equal(summary.cushionNow, null);
  assert.match(describeCushionTrend(summary), /No gamma flip resolved/);
  assert.equal(cushionTone(summary), "muted");
});

// ---------------------------------------------------------------------------
// Degenerate windows
// ---------------------------------------------------------------------------

test("an empty window summarizes without throwing", () => {
  const summary = summarizeTrend(buildTrendSeries([]));
  assert.equal(summary.count, 0);
  assert.equal(summary.direction, "flat");
  assert.match(describeGammaTrend(summary), /No gamma history/);
});

test("a single reading refuses to call a trend", () => {
  const summary = summarizeTrend(buildTrendSeries([bucket("2026-08-28T14:00:00Z", [50e9])]));
  assert.equal(summary.count, 1);
  assert.match(describeGammaTrend(summary), /nothing to trend against/);
});

test("formats signed point deltas with a real minus sign", () => {
  assert.equal(formatSignedPoints(90), "+90 pts");
  assert.equal(formatSignedPoints(-38), "−38 pts");
  assert.equal(formatSignedPoints(0), "0 pts");
  assert.equal(formatSignedPoints(null), "—");
});

// ---------------------------------------------------------------------------
// Plot domains
// ---------------------------------------------------------------------------

test("the gamma domain frames the movement instead of anchoring to zero", () => {
  // A $38B→$51B session plotted from $0 puts the whole story in the top fifth
  // of the plot. The domain must hug the data so the shape is readable.
  const { domain, includesZero } = gammaDomain([38e9, 44e9, 51e9]);
  assert.equal(includesZero, false);
  assert.ok(domain[0] > 30e9, `expected a tight floor, got ${domain[0]}`);
  assert.ok(domain[1] > 51e9 && domain[1] < 60e9);
});

test("the gamma domain snaps to round bounds and still contains the data", () => {
  const { domain } = gammaDomain([38e9, 44e9, 51.48e9]);
  assert.ok(domain[0] <= 38e9 && domain[1] >= 51.48e9, "must contain the data");
  const step = 1e9;
  assert.equal(domain[0] % step, 0, `unrounded floor: ${domain[0]}`);
  assert.equal(domain[1] % step, 0, `unrounded ceiling: ${domain[1]}`);
});

test("the gamma domain pulls zero back in when the book runs near it", () => {
  // $2B floor against a $2B range — one session range from flipping sign, so
  // the boundary must stay in frame.
  const { domain, includesZero } = gammaDomain([2e9, 3e9, 4e9]);
  assert.equal(includesZero, true);
  assert.equal(domain[0], 0);
});

test("nearness to zero is judged in session ranges, not session volatility", () => {
  // Same $2B range in both, very different distance from zero. A rule keyed
  // to the span alone would treat these identically.
  assert.equal(gammaDomain([2e9, 4e9]).includesZero, true);
  assert.equal(gammaDomain([38e9, 40e9]).includesZero, false);

  // And a violent session far from zero still must not drag the boundary in
  // just because its range is large.
  assert.equal(gammaDomain([40e9, 60e9]).includesZero, false);
});

test("the gamma domain spans zero when the series actually crosses it", () => {
  const { domain, includesZero } = gammaDomain([5e9, -5e9]);
  assert.equal(includesZero, true);
  assert.ok(domain[0] < 0 && domain[1] > 0);
});

test("an all-empty gamma domain degrades without NaN bounds", () => {
  const { domain } = gammaDomain([]);
  assert.ok(domain.every((v) => Number.isFinite(v)));
});

test("the price domain snaps outward to round bounds", () => {
  const [lo, hi] = priceDomain([7636.33, 7761.89]) as [number, number];
  assert.ok(lo <= 7636.33 && hi >= 7761.89, "domain must contain the data");
  assert.equal(lo % 10, 0, `expected a round lower bound, got ${lo}`);
  assert.equal(hi % 10, 0, `expected a round upper bound, got ${hi}`);
});

test("the price domain ignores nulls and gives up cleanly when all are null", () => {
  const withNulls = priceDomain([null, 7700, null, 7800]) as [number, number];
  assert.ok(withNulls[0] <= 7700 && withNulls[1] >= 7800);
  assert.equal(priceDomain([null, null]), undefined);
});

test("the price domain survives a flat series without collapsing", () => {
  const [lo, hi] = priceDomain([7700, 7700]) as [number, number];
  assert.ok(hi > lo, "a flat series still needs a plottable range");
});

test("axis ticks drop the plus but keep the minus", () => {
  assert.equal(formatGexAxis(50.83e9), "$50.83B");
  assert.equal(formatGexAxis(-1.2e9), "−$1.20B");
  assert.equal(formatGexAxis(0), "$0");
  assert.equal(formatGexAxis(null), "");
});

// --------------------------------------------------------------------------
// The time axis
// --------------------------------------------------------------------------
//
// The panel plots position, not time, because the analytics engine only
// writes while the chain is open: on a true time scale the overnight span
// between two sessions eats most of the plot and the line drawn across it is
// an interpolation, not a reading. Two things have to survive that trade —
// labels a trader recognises, and a visible mark where time was removed.

/** A session's worth of 5-minute buckets starting at an ET wall-clock time. */
function session(dayIso: string, startEt: string, count: number): TrendBucket[] {
  // ET is UTC-4 through the summer dates used here.
  const [hh, mm] = startEt.split(":").map(Number);
  const base = Date.UTC(
    Number(dayIso.slice(0, 4)),
    Number(dayIso.slice(5, 7)) - 1,
    Number(dayIso.slice(8, 10)),
    hh + 4,
    mm,
  );
  return Array.from({ length: count }, (_, i) => ({
    timestamp: new Date(base + i * 5 * 60_000).toISOString(),
    close: 100,
    gamma_flip: 98,
    strikes: [{ strike: 100, net_gamma: 1 }],
  }));
}

test("ticks land on round ET times, not on whichever bucket fell there", () => {
  // 09:30 -> 11:55, buckets every 5 minutes.
  const points = buildTrendSeries(session("2026-08-21", "09:30", 30));
  const axis = buildTrendAxis(points);

  const labels = axis.ticks.map((t) => t.label);
  assert.ok(labels.length > 0);
  for (const label of labels) {
    assert.match(label, /^\d{2}:(00|30)$/, label);
  }
  assert.equal(labels[0], "09:30");
  assert.ok(labels.includes("10:30"));
  assert.ok(labels.includes("11:30"));
});

test("every tick points at a real reading", () => {
  const points = buildTrendSeries(session("2026-08-21", "09:30", 30));
  const axis = buildTrendAxis(points);

  for (const tick of axis.ticks) {
    assert.ok(Number.isInteger(tick.index));
    assert.ok(tick.index >= 0 && tick.index < points.length);
  }
});

test("the tick budget coarsens the step rather than crowding the axis", () => {
  // Three sessions: half-hourly would be ~40 ticks.
  const points = buildTrendSeries([
    ...session("2026-08-19", "09:30", 78),
    ...session("2026-08-20", "09:30", 78),
    ...session("2026-08-21", "09:30", 78),
  ]);
  const axis = buildTrendAxis(points, 9);

  assert.ok(axis.ticks.length <= 9, `got ${axis.ticks.length} ticks`);
  assert.ok(axis.stepMinutes > 30, "should have coarsened past half-hourly");
});

test("a closed market is cut out and the seam is reported", () => {
  // Yesterday's last hour, then today's first hour: ~17.5 hours of nothing
  // between them, which on a time axis is most of the plot.
  const points = buildTrendSeries([
    ...session("2026-08-20", "15:00", 12),
    ...session("2026-08-21", "09:30", 12),
  ]);
  const axis = buildTrendAxis(points);

  assert.equal(axis.breaks.length, 1);
  // The break indexes the first reading of the NEW session, so the caller can
  // draw the rule just before it.
  assert.equal(axis.breaks[0].index, 12);
  assert.match(axis.breaks[0].label, /8\/21/);
});

test("a single missed write is not mistaken for a session boundary", () => {
  // One dropped bucket is a 10-minute gap on a 5-minute feed. Marking that as
  // a session break would put a seam in the middle of a live session.
  const full = session("2026-08-21", "09:30", 12);
  const points = buildTrendSeries([...full.slice(0, 5), ...full.slice(6)]);

  assert.equal(buildTrendAxis(points).breaks.length, 0);
});

test("the first reading after a break is labelled with its day", () => {
  const points = buildTrendSeries([
    ...session("2026-08-20", "15:00", 12),
    ...session("2026-08-21", "09:30", 12),
  ]);
  const axis = buildTrendAxis(points);

  const resumed = axis.ticks.find((t) => t.index === 12);
  assert.ok(resumed, "the resuming session must carry a tick");
  assert.match(resumed.label, /8\/21 09:30/);
});

test("an empty or single-point series produces an axis, not a crash", () => {
  assert.deepEqual(buildTrendAxis([]).ticks, []);
  assert.deepEqual(buildTrendAxis([]).breaks, []);

  const one = buildTrendSeries(session("2026-08-21", "09:30", 1));
  const axis = buildTrendAxis(one);
  assert.equal(axis.ticks.length, 1);
  assert.equal(axis.ticks[0].index, 0);
  assert.equal(axis.breaks.length, 0);
});
