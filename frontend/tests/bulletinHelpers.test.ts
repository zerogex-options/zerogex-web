// Live Bulletin: futures-implied-open net GEX.
//
// The card already projects the cash-index spot from the future (ES) outside
// the cash session and reads the regime / flip-distance / walls off that
// implied open. The bug this suite pins: the "dealers are long/short gamma"
// posture in the auto-lead was keyed off the summary's `net_gex_at_spot`, which
// the engine evaluates at the FROZEN CASH SPOT — on the far side of the flip
// from the implied open during an overnight gap. So a market gapping BELOW the
// flip still read "long gamma, buy dips" (the cash-close posture), which is
// exactly what makes the card look like it ignores the futures.
//
// The fix samples the spot-shift gex profile at the implied open (the frontend
// twin of the engine's `_net_gex_at_spot`) and feeds that in as `impliedNetGex`.
import test from "node:test";
import assert from "node:assert/strict";

import {
  buildReportModel,
  sampleGexProfile,
  type GexSummaryInput,
  type ReportInputs,
} from "../app/live-bulletin/bulletinHelpers.ts";

// A piecewise-linear dealer-gamma curve that crosses zero at the flip (7491)
// and reads +$5.45B at the cash spot (7509, +18 pts) — the scenario from the
// bug report. slope = 5.45e9 / 18 ≈ 3.0278e8 per point, so gex(p) = slope·(p−7491).
const FLIP = 7491;
const SLOPE = 5.45e9 / 18;
const gexAt = (p: number) => SLOPE * (p - FLIP);
const PROFILE = [7450, 7470, 7491, 7510, 7530].map((price) => ({ price, gex: gexAt(price) }));

const EPS = 1; // dollars — the curve is billions, so 1 catches formula regressions

function near(actual: number | null, expected: number, msg?: string) {
  assert.ok(actual != null, `${msg ?? "value"}: expected number, got null`);
  assert.ok(
    Math.abs((actual as number) - expected) < EPS,
    `${msg ?? "value"}: expected ≈${expected}, got ${actual}`,
  );
}

// ---------------------------------------------------------------------------
// sampleGexProfile — the interpolation primitive
// ---------------------------------------------------------------------------

test("sampleGexProfile: at the cash spot it reproduces net_gex_at_spot (+$5.45B)", () => {
  // 7509 sits between grid points 7491 and 7510; the linear read must land on
  // the same +5.45e9 the engine persisted as net_gex_at_spot.
  near(sampleGexProfile(PROFILE, 7509), gexAt(7509), "spot sample");
  near(sampleGexProfile(PROFILE, 7509), 5.45e9, "spot sample == net_gex_at_spot");
});

test("sampleGexProfile: at the implied open (below the flip) it goes negative", () => {
  // 7479 is 12 pts below the flip → short-gamma side → negative.
  const v = sampleGexProfile(PROFILE, 7479);
  assert.ok(v != null && v < 0, `expected negative, got ${v}`);
  near(v, gexAt(7479), "implied-open sample"); // ≈ −$3.63B
});

test("sampleGexProfile: zero exactly at the flip crossing", () => {
  near(sampleGexProfile(PROFILE, FLIP), 0, "flip crossing");
});

test("sampleGexProfile: clamps to the endpoints outside the grid", () => {
  near(sampleGexProfile(PROFILE, 1), gexAt(7450), "below-grid clamp");
  near(sampleGexProfile(PROFILE, 99999), gexAt(7530), "above-grid clamp");
});

test("sampleGexProfile: null / empty / non-finite guards return null", () => {
  assert.equal(sampleGexProfile(PROFILE, null), null);
  assert.equal(sampleGexProfile(PROFILE, undefined), null);
  assert.equal(sampleGexProfile(PROFILE, Number.NaN), null);
  assert.equal(sampleGexProfile(null, 7479), null);
  assert.equal(sampleGexProfile([], 7479), null);
});

test("sampleGexProfile: skips non-finite grid points", () => {
  const dirty = [
    { price: Number.NaN, gex: 1 },
    { price: 7470, gex: gexAt(7470) },
    { price: 7510, gex: gexAt(7510) },
    { price: 7530, gex: Number.POSITIVE_INFINITY },
  ];
  // With the junk rows dropped the usable grid is [7470, 7510]; 7491 interpolates.
  near(sampleGexProfile(dirty, 7491), 0, "cleaned interpolation");
});

// ---------------------------------------------------------------------------
// buildReportModel — the posture must follow the implied open, not the close
// ---------------------------------------------------------------------------

const SUMMARY: GexSummaryInput = {
  gamma_flip: FLIP,
  call_wall: 7510,
  put_wall: 7500,
  max_pain: 7495,
  net_gex_at_spot: 5.45e9, // evaluated at the cash spot — LONG gamma
  net_gex: 6e9,
  put_call_ratio: 1.1,
  spot_price: 7509,
};

const baseInputs = {
  symbol: "SPX",
  priorClose: 7509,
  summary: SUMMARY,
  vix: 14,
  volIndex: "VIX",
  horizon: "daily",
} satisfies Partial<ReportInputs>;

test("buildReportModel: implied open below the flip flips the posture to SHORT gamma", () => {
  const impliedNetGex = sampleGexProfile(PROFILE, 7479); // ≈ −$3.63B
  const model = buildReportModel({
    ...baseInputs,
    spot: 7479, // futures-implied open
    spotIsProjected: true,
    spotSourceLabel: "ES",
    impliedNetGex,
  });

  // Net GEX metric + posture both come off the implied-open sample, not the
  // frozen +$5.45B cash-spot figure.
  assert.ok(model.netGex != null && model.netGex < 0, `netGex should be negative, got ${model.netGex}`);
  assert.match(model.lead, /short/i);
  assert.doesNotMatch(model.lead, /long[ -]gamma/i);
});

test("buildReportModel: without an override it still uses the summary's cash-spot value", () => {
  // In-session (no projection): the summary's net_gex_at_spot already matches
  // the live spot, so the long-gamma posture is correct and must be preserved.
  const model = buildReportModel({
    ...baseInputs,
    spot: 7509,
    spotIsProjected: false,
    spotSourceLabel: null,
    // impliedNetGex omitted
  });
  near(model.netGex, 5.45e9, "falls back to net_gex_at_spot");
  assert.match(model.lead, /long/i);
});

test("buildReportModel: structural levels stay put — only the spot side of the flip moves", () => {
  // The flip / walls / max pain are chain properties, not spot-dependent: they
  // must read identically whether we quote the cash spot or the implied open.
  const projected = buildReportModel({
    ...baseInputs,
    spot: 7479,
    spotIsProjected: true,
    impliedNetGex: sampleGexProfile(PROFILE, 7479),
  });
  assert.equal(projected.gammaFlip, FLIP);
  assert.equal(projected.callWall, 7510);
  assert.equal(projected.putWall, 7500);
  assert.equal(projected.maxPain, 7495);
  // Flip distance is measured from the implied open (7479 − 7491 = −12).
  near(projected.flipDistance, -12, "flip distance off the implied open");
});
