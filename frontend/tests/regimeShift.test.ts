// Guards the Gamma Shift page's copy generation (core/regimeShift.ts).
//
// The headline IS the product on this page — it is the thing a competitor
// writes by hand and we compute — so the rules that produce it are tested
// like logic, not eyeballed like styling. Three properties matter most:
//
//  * a band is quoted ONLY when it resolved (naming a level that is not
//    there is how a generated headline loses a reader for good);
//  * a level row's arrow and its colour come from DIFFERENT fields, because
//    a gamma flip dropping is a falling number and a bullish event;
//  * the ribbon's scale is stable across sessions, so a quiet day looks
//    quiet rather than being renormalized up to look like a violent one.
import test from "node:test";
import assert from "node:assert/strict";

import {
  STATE_META,
  buildExpiryCaveat,
  buildHeadline,
  buildLevelRows,
  buildNormalizationNote,
  buildRolloffConsequence,
  buildRolloffSentence,
  buildSubhead,
  describeFlipCrossing,
  describePositioningGap,
  formatBand,
  formatGexMagnitude,
  formatPercent,
  formatSignedGex,
  formatStrike,
  formatZ,
  isCrossSession,
  positioningResolved,
  ribbonHeight,
  ribbonReference,
  type ExpiryRolloffPayload,
  type ExpiryScope,
  type RegimeShiftPayload,
  type RegimeState,
} from "../core/regimeShift.ts";

// --------------------------------------------------------------------------
// Fixtures
// --------------------------------------------------------------------------

function payload(overrides: Partial<RegimeShiftPayload> = {}): RegimeShiftPayload {
  return {
    symbol: "SPY",
    lookback: "session",
    lookback_label: "Since the open",
    lens: "net",
    spot: 765.4,
    session_date: "2026-08-21",
    from: {
      timestamp: "2026-08-21T13:30:00Z",
      spot: 761.2,
      gamma_flip: 771.5,
      call_wall: 775,
      put_wall: 755,
      net_gex_at_spot: -4.2e8,
    },
    to: {
      timestamp: "2026-08-21T16:05:00Z",
      spot: 765.4,
      gamma_flip: 762.8,
      call_wall: 780,
      put_wall: 763,
      net_gex_at_spot: 2.85e9,
    },
    read: {
      state: "FIRMING",
      adverb: "dramatically",
      lean_z: 1.9,
      stability_z: 2.6,
      magnitude: 3.22,
      meaning: "Floor building and vol compressing.",
      normalization: "trailing",
      sessions_in_window: 42,
    },
    scores: {
      lean: 1.9e9,
      stability: 2.6e9,
      net_shift: 4.31e9,
      gross_shift: 5.71e9,
      sigma_price: 7.654,
    },
    band: { low: 764, high: 770, share: 0.61, resolved: true },
    strikes: [],
    strikes_truncated: false,
    expiry_scope: {
      common: ["2026-08-21", "2026-08-28"],
      common_count: 2,
      expired: [],
      expired_net_gex: 0,
      expired_abs_gex: 0,
      added: [],
      added_net_gex: 0,
    },
    rolloff: null,
    positioning: { resolved: true, oi_moved_strikes: 31, strike_count: 59 },
    ...overrides,
  };
}

/** The shape an intraday window actually comes back as on the second lens. */
function unresolvedPositioning(
  overrides: Partial<RegimeShiftPayload> = {},
): RegimeShiftPayload {
  return payload({
    lens: "positioning",
    positioning: { resolved: false, oi_moved_strikes: 0, strike_count: 59 },
    ...overrides,
  });
}

function rolloff(overrides: Partial<ExpiryRolloffPayload> = {}): ExpiryRolloffPayload {
  return {
    symbol: "SPY",
    as_of: "2026-08-21T16:05:00Z",
    session_date: "2026-08-21",
    spot: 765.4,
    total_abs_gex: 1.2e10,
    total_net_gex: 4e9,
    next: {
      expiration: "2026-08-21",
      dte: 0,
      net_gex: 2.1e9,
      abs_gex: 4.56e9,
      share: 0.38,
    },
    context: { percentile: 0.94, verdict: "heavy", sessions_in_window: 45 },
    tranches: [],
    tranches_folded: false,
    next_by_strike: [],
    ...overrides,
  };
}

// --------------------------------------------------------------------------
// Formatting
// --------------------------------------------------------------------------

test("formatSignedGex always shows a sign for non-zero values", () => {
  assert.equal(formatSignedGex(1.234e9), "+$1.23B");
  assert.equal(formatSignedGex(-4.3e8), "−$430.0M");
  assert.equal(formatSignedGex(0), "$0");
});

test("formatSignedGex handles absent and non-finite values", () => {
  assert.equal(formatSignedGex(null), "—");
  assert.equal(formatSignedGex(undefined), "—");
  assert.equal(formatSignedGex(NaN), "—");
  assert.equal(formatSignedGex(Infinity), "—");
});

test("formatGexMagnitude never signs a magnitude", () => {
  // A tranche's gross size and the chain total are quantities, not gains.
  // Printing "+$4.56B expiring" reads as a profit and invites comparison
  // against the signed net beside it as if they were the same kind of number.
  assert.equal(formatGexMagnitude(4.56e9), "$4.56B");
  assert.equal(formatGexMagnitude(-4.56e9), "$4.56B");
  assert.equal(formatGexMagnitude(0), "$0");
  assert.equal(formatGexMagnitude(null), "—");
});

test("formatStrike drops a trailing .0", () => {
  assert.equal(formatStrike(765), "765");
  assert.equal(formatStrike(765.5), "766");
  assert.equal(formatStrike(12.5), "12.5");
  assert.equal(formatStrike(null), "—");
});

test("formatZ uses a real minus sign and one decimal", () => {
  assert.equal(formatZ(2.61), "+2.6σ");
  assert.equal(formatZ(-1.94), "−1.9σ");
  assert.equal(formatZ(0), "0.0σ");
});

test("formatPercent rounds to whole percent by default", () => {
  assert.equal(formatPercent(0.384), "38%");
  assert.equal(formatPercent(0.384, 1), "38.4%");
  assert.equal(formatPercent(null), "—");
});

test("formatBand returns a range, a single strike, or null", () => {
  assert.equal(formatBand({ low: 764, high: 770, share: 0.6, resolved: true }), "764–770");
  assert.equal(formatBand({ low: 765, high: 765, share: 0.7, resolved: true }), "765");
  assert.equal(formatBand({ low: 700, high: 800, share: 0.6, resolved: false }), null);
  assert.equal(formatBand(null), null);
});

// --------------------------------------------------------------------------
// Headline
// --------------------------------------------------------------------------

test("headline names the state, the adverb and the band", () => {
  assert.equal(
    buildHeadline(payload()),
    "Dealers dramatically added support into 764–770.",
  );
});

test("headline never quotes an unresolved band", () => {
  // Naming a level for a change spread across the chain invents structure
  // that is not there — the fastest way to lose a reader's trust.
  const out = buildHeadline(
    payload({ band: { low: 700, high: 800, share: 0.62, resolved: false } }),
  );
  assert.equal(out, "Dealers dramatically added support.");
  assert.ok(!out.includes("700"));
  assert.ok(!out.includes("800"));
});

test("headline covers every state", () => {
  const states: RegimeState[] = [
    "FIRMING",
    "CAPPING",
    "FRAGILE_BID",
    "DETERIORATING",
    "QUIET",
  ];
  const seen = new Set<string>();
  for (const state of states) {
    const out = buildHeadline(payload({ read: { ...payload().read, state } }));
    assert.ok(out.length > 0, state);
    assert.ok(out.endsWith("."), state);
    seen.add(out);
  }
  assert.equal(seen.size, states.length, "each state must read differently");
});

test("a quiet read says nothing happened rather than naming a direction", () => {
  const out = buildHeadline(payload({ read: { ...payload().read, state: "QUIET" } }));
  assert.equal(out, "No meaningful repositioning.");
});

test("an unmeasured read never claims nothing happened", () => {
  // Without a denominator every z is 0, so the server classifies QUIET —
  // but "no meaningful repositioning" is a measurement, and none was taken.
  // This is the one sentence on the card a reader acts on by NOT looking
  // further, so it must never be produced by an absence of history.
  const out = buildHeadline(
    payload({
      read: { ...payload().read, state: "QUIET", normalization: "none" },
    }),
  );
  assert.ok(!out.includes("No meaningful repositioning"));
  assert.match(out, /not enough history/i);
});

test("an unmeasured read says the direction still stands", () => {
  // No flip crossing here — that is an observed fact and rightly outranks
  // everything, normalization or not.
  const out = buildSubhead(
    payload({
      read: { ...payload().read, state: "QUIET", normalization: "none" },
      from: { ...payload().from, gamma_flip: 755 },
    }),
  );
  assert.match(out, /direction is measured/i);
});

test("an empty repositioning lens is not reported as a quiet session", () => {
  // Every strike reads zero because open interest never republished, not
  // because dealers sat still. Saying "no meaningful repositioning" there is
  // the strongest possible claim made from an absence of data.
  const out = buildHeadline(
    unresolvedPositioning({
      read: { ...payload().read, state: "QUIET" },
    }),
  );
  assert.equal(out, "No repositioning visible in this window.");
});

test("the adverb comes from the server, not from this layer", () => {
  const out = buildHeadline(
    payload({ read: { ...payload().read, adverb: "modestly" } }),
  );
  assert.ok(out.includes("modestly"));
  assert.ok(!out.includes("dramatically"));
});

// --------------------------------------------------------------------------
// Subhead / flip crossing
// --------------------------------------------------------------------------

test("a flip crossing takes the subhead when it happens", () => {
  // Spot 761.2 under a 771.5 flip, then 765.4 over a 762.8 flip.
  assert.equal(
    buildSubhead(payload()),
    "Spot crossed above the gamma flip — dealers are long gamma here now.",
  );
});

test("no crossing falls back to describing the two axes", () => {
  const out = buildSubhead(
    payload({
      from: { spot: 100, gamma_flip: 95 },
      to: { spot: 101, gamma_flip: 96 },
    }),
  );
  assert.ok(out.includes("stabilizing"));
  assert.ok(out.includes("below spot"));
});

test("crossing detection compares the SIDE of the flip, not the flip level", () => {
  // The flip moved 5 points but spot moved with it — no regime change.
  assert.equal(
    describeFlipCrossing({ spot: 100, gamma_flip: 95 }, { spot: 110, gamma_flip: 100 }),
    null,
  );
  // The flip barely moved but spot crossed it — regime change.
  assert.ok(
    describeFlipCrossing({ spot: 99, gamma_flip: 100 }, { spot: 101, gamma_flip: 100 }),
  );
});

test("crossing detection is null when either flip is missing", () => {
  assert.equal(describeFlipCrossing({ spot: 100 }, { spot: 101, gamma_flip: 99 }), null);
  assert.equal(describeFlipCrossing({ gamma_flip: 100 }, { spot: 101, gamma_flip: 99 }), null);
});

// --------------------------------------------------------------------------
// Disclosure
// --------------------------------------------------------------------------

test("expiry caveat names the excluded tranche and its size", () => {
  const scope: ExpiryScope = {
    common: ["2026-08-21"],
    common_count: 12,
    expired: ["2026-08-20"],
    expired_net_gex: 1.4e9,
    expired_abs_gex: 1.4e9,
    added: [],
    added_net_gex: 0,
  };
  const out = buildExpiryCaveat(scope);
  assert.ok(out);
  assert.ok(out.includes("12 common expiries"));
  assert.ok(out.includes("2026-08-20"));
  assert.ok(out.includes("+$1.40B"));
  assert.ok(out.includes("excluded"));
});

test("expiry caveat also discloses newly listed expirations", () => {
  const out = buildExpiryCaveat({
    common: [],
    common_count: 5,
    expired: [],
    expired_net_gex: 0,
    expired_abs_gex: 0,
    added: ["2026-09-04"],
    added_net_gex: 9e8,
  });
  assert.ok(out?.includes("newly listed"));
});

test("expiry caveat is null when nothing was excluded", () => {
  assert.equal(buildExpiryCaveat(payload().expiry_scope), null);
  assert.equal(buildExpiryCaveat(null), null);
});

test("expiry caveat singularises one expiry", () => {
  const out = buildExpiryCaveat({
    common: ["2026-08-21"],
    common_count: 1,
    expired: ["2026-08-20"],
    expired_net_gex: 1e6,
    expired_abs_gex: 1e6,
    added: [],
    added_net_gex: 0,
  });
  assert.ok(out?.includes("1 common expiry"));
});

test("a trailing normalization needs no note", () => {
  assert.equal(buildNormalizationNote(payload().read), null);
});

test("a proxy normalization says the magnitude is provisional", () => {
  const out = buildNormalizationNote({
    ...payload().read,
    normalization: "proxy",
    sessions_in_window: 3,
  });
  assert.ok(out?.includes("provisional"));
  assert.ok(out?.includes("3 stored sessions"));
});

test("no normalization says the magnitude is not measured", () => {
  const out = buildNormalizationNote({
    ...payload().read,
    normalization: "none",
    sessions_in_window: 0,
  });
  assert.ok(out?.includes("direction is measured"));
});

// --------------------------------------------------------------------------
// Level rows — arrow vs colour
// --------------------------------------------------------------------------

test("a gamma flip dropping below spot is a DOWN arrow in a GOOD colour", () => {
  // The single most important encoding rule on this card: the arrow reports
  // which way the number moved, the colour reports whether that is good for
  // the tape. Bind them to one field and every crossing row renders wrong.
  const rows = buildLevelRows(payload());
  const flip = rows.find((r) => r.key === "flip");
  assert.ok(flip);
  assert.equal(flip.direction, "down");
  assert.equal(flip.sense, "good");
});

test("a gamma flip rising above spot is an UP arrow in a BAD colour", () => {
  const rows = buildLevelRows(
    payload({
      spot: 100,
      from: { spot: 100, gamma_flip: 98, call_wall: 105, put_wall: 95, net_gex_at_spot: 1 },
      to: { spot: 100, gamma_flip: 103, call_wall: 105, put_wall: 95, net_gex_at_spot: 1 },
    }),
  );
  const flip = rows.find((r) => r.key === "flip");
  assert.equal(flip?.direction, "up");
  assert.equal(flip?.sense, "bad");
});

test("a flip that stays on the same side of spot is sense-flat", () => {
  const rows = buildLevelRows(
    payload({
      spot: 100,
      from: { spot: 100, gamma_flip: 90, call_wall: 105, put_wall: 95, net_gex_at_spot: 1 },
      to: { spot: 100, gamma_flip: 93, call_wall: 105, put_wall: 95, net_gex_at_spot: 1 },
    }),
  );
  const flip = rows.find((r) => r.key === "flip");
  assert.equal(flip?.direction, "up");
  assert.equal(flip?.sense, "flat");
});

test("a put wall lifting is good, a put wall dropping is bad", () => {
  const rows = buildLevelRows(payload());
  const put = rows.find((r) => r.key === "put_wall");
  assert.equal(put?.direction, "up");
  assert.equal(put?.sense, "good");
  assert.equal(put?.note, "floor lifted");
});

test("unchanged levels are flat in both fields", () => {
  const rows = buildLevelRows(
    payload({
      from: { spot: 100, gamma_flip: 99, call_wall: 105, put_wall: 95, net_gex_at_spot: 5 },
      to: { spot: 100, gamma_flip: 99, call_wall: 105, put_wall: 95, net_gex_at_spot: 5 },
    }),
  );
  for (const key of ["put_wall", "call_wall", "net_gex_at_spot"]) {
    const row = rows.find((r) => r.key === key);
    assert.equal(row?.direction, "flat", key);
    assert.equal(row?.sense, "flat", key);
  }
});

test("rows for absent levels are omitted rather than rendered as dashes", () => {
  const rows = buildLevelRows(
    payload({ from: { spot: 100 }, to: { spot: 101 } }),
  );
  assert.deepEqual(
    rows.map((r) => r.key),
    ["net_shift"],
  );
});

test("net shift always renders and has no before value", () => {
  const row = buildLevelRows(payload()).find((r) => r.key === "net_shift");
  assert.ok(row);
  assert.equal(row.before, "");
  assert.equal(row.after, "+$4.31B");
});

test("net shift is sense-flat on a quiet read even when positive", () => {
  const rows = buildLevelRows(payload({ read: { ...payload().read, state: "QUIET" } }));
  assert.equal(rows.find((r) => r.key === "net_shift")?.sense, "flat");
});

// --------------------------------------------------------------------------
// Roll-off copy
// --------------------------------------------------------------------------

test("roll-off sentence leads with the share and ranks it", () => {
  assert.equal(
    buildRolloffSentence(rolloff()),
    "38% of dealer gamma expires at today’s close — heavy for SPY (94th percentile).",
  );
});

test("roll-off sentence omits the ranking without enough history", () => {
  const out = buildRolloffSentence(
    rolloff({ context: { percentile: null, verdict: null, sessions_in_window: 2 } }),
  );
  assert.equal(out, "38% of dealer gamma expires at today’s close.");
});

test("roll-off sentence names the horizon when it is not today", () => {
  const out = buildRolloffSentence(
    rolloff({ next: { ...rolloff().next, dte: 3 } }),
  );
  assert.ok(out.includes("in 3d"));
});

test("ordinals read correctly around the teens", () => {
  const at = (p: number) =>
    buildRolloffSentence(
      rolloff({ context: { percentile: p / 100, verdict: "typical", sessions_in_window: 40 } }),
    );
  assert.ok(at(1).includes("1st"));
  assert.ok(at(2).includes("2nd"));
  assert.ok(at(3).includes("3rd"));
  assert.ok(at(11).includes("11th"));
  assert.ok(at(12).includes("12th"));
  assert.ok(at(13).includes("13th"));
  assert.ok(at(21).includes("21st"));
});

test("roll-off consequence distinguishes which side is leaving", () => {
  // Same headline share, opposite consequence for tomorrow — and the share
  // alone cannot tell them apart, because it is measured on |gamma|.
  const long = buildRolloffConsequence(rolloff());
  assert.ok(long.includes("stabilizing side"));
  assert.ok(long.includes("looser"));

  const short = buildRolloffConsequence(
    rolloff({ next: { ...rolloff().next, net_gex: -2.1e9 } }),
  );
  assert.ok(short.includes("accelerant"));
  assert.ok(short.includes("calmer"));
});

test("a balanced expiring tranche reads as neutral", () => {
  const out = buildRolloffConsequence(
    rolloff({ next: { ...rolloff().next, net_gex: 0 } }),
  );
  assert.ok(out.includes("balanced"));
});

// --------------------------------------------------------------------------
// Ribbon scaling
// --------------------------------------------------------------------------

test("ribbon height is monotone and bounded", () => {
  assert.equal(ribbonHeight(0, 100), 0);
  assert.ok(ribbonHeight(50, 100) > 0);
  assert.ok(ribbonHeight(80, 100) > ribbonHeight(50, 100));
  assert.equal(ribbonHeight(500, 100), 1, "clamps rather than overflowing the track");
});

test("ribbon height is sign-agnostic (direction is carried by position)", () => {
  assert.equal(ribbonHeight(-40, 100), ribbonHeight(40, 100));
});

test("ribbon height compresses so small strikes stay visible", () => {
  // Linear would put a 1/30th strike at 3% of the track — a hairline.
  const compressed = ribbonHeight(1, 30);
  assert.ok(compressed > 0.1, `expected a visible bar, got ${compressed}`);
  assert.ok(compressed < 0.3);
});

test("ribbon reference is stable, so a quiet day renders quiet", () => {
  const strikes = (scale: number) =>
    [1, 2, 3, 4, 5].map((i) => ({
      strike: 100 + i,
      net_a: 0,
      net_b: i * scale,
      d_net: i * scale,
      positioning: i * scale,
      repricing: 0,
      call_oi_delta: 0,
      put_oi_delta: 0,
    }));

  const busy = strikes(100);
  const quiet = strikes(1);
  const busyRef = ribbonReference(busy, "net");

  // Rendered against the SAME reference (as the page does across a session),
  // a quiet day's tallest bar is a fraction of a busy day's.
  const busyTop = ribbonHeight(500, busyRef);
  const quietTop = ribbonHeight(5, busyRef);
  assert.ok(quietTop < busyTop * 0.35, `${quietTop} vs ${busyTop}`);
});

test("ribbon reference never returns zero", () => {
  assert.ok(ribbonReference([], "net") > 0);
  assert.ok(
    ribbonReference(
      [
        {
          strike: 100,
          net_a: 0,
          net_b: 0,
          d_net: 0,
          positioning: 0,
          repricing: 0,
          call_oi_delta: 0,
          put_oi_delta: 0,
        },
      ],
      "net",
    ) > 0,
  );
});

// --------------------------------------------------------------------------
// State metadata
// --------------------------------------------------------------------------

test("every state carries a glyph so colour is never the only encoding", () => {
  // Bull green and bear red separate at ΔE ~34 for normal vision but collapse
  // to ~5 under deuteranopia. On a card whose whole job is direction, colour
  // cannot be load-bearing on its own.
  for (const [state, meta] of Object.entries(STATE_META)) {
    assert.ok(meta.glyph.length > 0, state);
    assert.ok(meta.label.length > 0, state);
  }
});

test("the two axes are named separately on every state", () => {
  assert.equal(STATE_META.CAPPING.stability, "stabilizing");
  assert.equal(STATE_META.CAPPING.direction, "capping");
  assert.equal(STATE_META.FRAGILE_BID.stability, "destabilizing");
  assert.equal(STATE_META.FRAGILE_BID.direction, "supportive");
});


// --------------------------------------------------------------------------
// The repositioning lens
// --------------------------------------------------------------------------

test("the lens question is only asked on the lens that raises it", () => {
  // On 'net' the OI counter is irrelevant, so a zero there must not suppress
  // a perfectly good total-change ribbon.
  assert.equal(
    positioningResolved(
      payload({ positioning: { resolved: false, oi_moved_strikes: 0, strike_count: 59 } }),
    ),
    true,
  );
  assert.equal(positioningResolved(unresolvedPositioning()), false);
});

test("a payload from an older API build is not treated as empty", () => {
  const { positioning: _dropped, ...rest } = payload({ lens: "positioning" });
  assert.equal(positioningResolved(rest as RegimeShiftPayload), true);
});

test("an intraday window is told open interest cannot move inside a session", () => {
  const out = describePositioningGap(unresolvedPositioning({ lookback: "1h" }));
  assert.match(out, /once a day at settlement/i);
  assert.match(out, /prior session/i);
});

test("a cross-session window with no OI move gets a different reason", () => {
  // Here the window DID straddle a settlement, so "you picked the wrong
  // lookback" would be wrong — the book genuinely only re-priced.
  const out = describePositioningGap(unresolvedPositioning({ lookback: "prev_close" }));
  assert.match(out, /re-pricing/i);
  assert.doesNotMatch(out, /once a day at settlement/i);
});

test("cross-session lookbacks are exactly the ones that straddle a settlement", () => {
  for (const lb of ["prev_close", "prev_same_time", "week"] as const) {
    assert.equal(isCrossSession(lb), true, lb);
  }
  for (const lb of ["30m", "1h", "2h", "4h", "session"] as const) {
    assert.equal(isCrossSession(lb), false, lb);
  }
});
