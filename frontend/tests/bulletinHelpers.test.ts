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
  detectRegime,
  sampleGexProfile,
  type GexSummaryInput,
  type ReportInputs,
} from "../app/live-bulletin/bulletinHelpers.ts";
import { longGammaAtSpot, netGexAtSpotOrNull } from "../core/gammaRegime.ts";
import { keyLevelsRegime } from "../core/keyLevels.ts";

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

// ---------------------------------------------------------------------------
// No flip near spot: the regime is the sign of net GEX at spot
//
// The engine publishes no flip when no zero crossing sits near enough to spot,
// as when spot is deep inside one regime. At 10:08 ET on 2026-11-25 NDX was
// down 3.52% with net GEX at spot −$1.03B and no flip: Today's Read said
// "Regime unresolved" while the Key Levels chip beside it said SHORT Γ. The
// at-spot value comes off the same spot-shift curve as the flip, so with no
// flip its sign IS the regime; "unresolved" is left for a snapshot with neither.
// ---------------------------------------------------------------------------

test("detectRegime: no flip + negative net GEX at spot reads negative", () => {
  assert.equal(detectRegime(null, 20750, -1.03e9), "negative");
  assert.equal(detectRegime(undefined, 20750, -1), "negative");
});

test("detectRegime: no flip + positive net GEX at spot reads positive", () => {
  assert.equal(detectRegime(null, 6812, 1.32e9), "positive");
});

test("detectRegime: no flip + no net GEX at spot is the only unresolved read", () => {
  assert.equal(detectRegime(null, 6812, null), "unresolved");
  assert.equal(detectRegime(null, 6812, undefined), "unresolved");
  assert.equal(detectRegime(Number.NaN, 6812, Number.NaN), "unresolved");
  assert.equal(detectRegime(null, null, null), "unresolved");
});

test("detectRegime: zero at spot reads long, as the Key Levels chip does", () => {
  assert.equal(detectRegime(null, 6812, 0), "positive");
});

test("detectRegime: with no flip it matches the Key Levels chip for every sign", () => {
  for (const atSpot of [-1.03e9, -1, 0, 1, 5.45e9]) {
    const chip = keyLevelsRegime(longGammaAtSpot(netGexAtSpotOrNull(atSpot), 20750, null));
    assert.ok(chip, `chip renders for ${atSpot}`);
    assert.equal(detectRegime(null, 20750, atSpot), chip.long ? "positive" : "negative", `net GEX ${atSpot}`);
  }
  // Neither has a read: the chip renders nothing and the badge says unresolved.
  assert.equal(keyLevelsRegime(longGammaAtSpot(null, 20750, null)), null);
  assert.equal(detectRegime(null, 20750, null), "unresolved");
});

test("detectRegime: a served numeric string at spot reads as the free cards read it", () => {
  // netGexAtSpotOrNull coerces "-1030000000" on the free cards; the regime must too.
  assert.equal(detectRegime(null, 20750, "-1030000000" as unknown as number), "negative");
  assert.equal(detectRegime(null, 20750, "" as unknown as number), "unresolved");
});

test("detectRegime: a flip still decides, with the ±0.25% at-flip band unchanged", () => {
  // A real flip wins over the at-spot sign, as before.
  assert.equal(detectRegime(6780, 6812.4, -5e8), "positive"); // 0.48% above
  assert.equal(detectRegime(6850, 6812.4, 5e8), "negative"); // 0.55% below
  // The band edge: 17 pts under 6812 is 0.2496% (neutral), 18 pts is 0.2642%.
  assert.equal(detectRegime(6829, 6812, -2e9), "neutral");
  assert.equal(detectRegime(6830, 6812, 2e9), "negative");
  assert.equal(detectRegime(6795, 6812, null), "neutral");
  assert.equal(detectRegime(6794, 6812, null), "positive");
});

test("detectRegime: a flip with no usable spot falls back to the sign at spot", () => {
  assert.equal(detectRegime(6780, null, -1e9), "negative");
  assert.equal(detectRegime(6780, 0, 1e9), "positive");
  assert.equal(detectRegime(6780, null, null), "unresolved");
});

// The NDX snapshot from the report. The whole-chain total carries the OPPOSITE
// sign to the at-spot value on purpose: it must never decide the regime.
const NDX_NO_FLIP: GexSummaryInput = {
  symbol: "NDX",
  spot_price: 20750,
  gamma_flip: null,
  net_gex_at_spot: -1.03e9,
  net_gex: 2.1e9,
  call_wall: 21500,
  put_wall: 20500,
  max_pain: 21000,
};

const ndxInputs = {
  symbol: "NDX",
  spot: 20750,
  priorClose: 21507, // −3.52%
  summary: NDX_NO_FLIP,
  vix: null,
  volIndex: "VXN",
  horizon: "daily",
} satisfies ReportInputs;

const FLIP_PLACEMENT = /\b(above|below|beneath|under|over) the\b[^.]*\bflip\b/i;
const NO_FLIP_NOTE = /no (gamma )?flip (sits near spot|close enough to spot)/i;

test("buildReportModel: no flip + negative net GEX at spot is short gamma, said plainly", () => {
  const model = buildReportModel(ndxInputs);
  assert.equal(model.regime, "negative");
  assert.equal(model.regimeBadge, "− GAMMA REGIME");
  assert.equal(model.regimeLabel, "Negative GEX · no flip near spot");
  assert.match(model.headline, /^NDX 20,750 −3\.52%\. Dealers Short Gamma\.$/);
  near(model.netGex, -1.03e9, "net GEX is the at-spot value, not the total");
  assert.match(model.lead, NO_FLIP_NOTE);
  assert.doesNotMatch(model.lead, /provisional|unresolved/i);
  // No flip on the card, so nothing places spot above or below one.
  assert.doesNotMatch(model.lead, FLIP_PLACEMENT);
});

test("buildReportModel: no flip + positive net GEX at spot is long gamma", () => {
  const model = buildReportModel({ ...ndxInputs, summary: { ...NDX_NO_FLIP, net_gex_at_spot: 1.32e9 } });
  assert.equal(model.regime, "positive");
  assert.equal(model.regimeBadge, "+ GAMMA REGIME");
  assert.equal(model.regimeLabel, "Positive GEX · no flip near spot");
  assert.match(model.headline, /Dealers Long Gamma\.$/);
  assert.match(model.lead, NO_FLIP_NOTE);
  assert.doesNotMatch(model.lead, /provisional|unresolved/i);
});

test("buildReportModel: no flip + no net GEX at spot stays unresolved, never the total's sign", () => {
  const model = buildReportModel({ ...ndxInputs, summary: { ...NDX_NO_FLIP, net_gex_at_spot: null } });
  assert.equal(model.regime, "unresolved");
  assert.equal(model.regimeBadge, "? GAMMA REGIME");
  assert.equal(model.regimeLabel, "Regime unresolved this snapshot");
  assert.match(model.headline, /Gamma Regime Unresolved\.$/);
  assert.equal(model.netGex, null);
  // A snapshot with neither reading is the one case the levels are provisional.
  assert.match(model.lead, /provisional/);
});

test("buildReportModel: every wording of the no-flip lead stays plain and flip-free", () => {
  // The call wall moves the wording seed, so this walks every variant.
  for (let i = 0; i < 40; i++) {
    for (const atSpot of [-1.03e9, 1.32e9]) {
      const model = buildReportModel({
        ...ndxInputs,
        summary: { ...NDX_NO_FLIP, net_gex_at_spot: atSpot, call_wall: 21500 + 25 * i },
      });
      assert.match(model.lead, NO_FLIP_NOTE);
      assert.match(model.lead, atSpot < 0 ? /short-gamma/ : /long-gamma/);
      assert.doesNotMatch(model.lead, /provisional|unresolved/i);
      assert.doesNotMatch(model.lead, FLIP_PLACEMENT);
    }
  }
});

test("buildReportModel: a futures-implied open with no flip reads the resampled sign", () => {
  // Overnight the card quotes the implied open and its resampled net GEX (see
  // impliedNetGex), so the badge agrees with the card's own Net GEX stat.
  const model = buildReportModel({
    ...ndxInputs,
    spotIsProjected: true,
    spotSourceLabel: "NQZ26",
    impliedNetGex: -4e8,
    summary: { ...NDX_NO_FLIP, net_gex_at_spot: 3e8 },
  });
  assert.equal(model.regime, "negative");
  near(model.netGex, -4e8, "card stat");
});

test("buildReportModel: with a flip the read is unchanged", () => {
  // 7530 is 0.52% over the 7491 flip, clear of the at-flip band.
  const model = buildReportModel({ ...baseInputs, spot: 7530 });
  assert.equal(model.regime, "positive");
  assert.equal(model.regimeLabel, "Positive GEX · pinned, low vol");
  assert.doesNotMatch(model.lead, NO_FLIP_NOTE);
});
