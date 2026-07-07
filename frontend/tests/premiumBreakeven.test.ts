// Fixtures for the Premium Surface page's "% to Breakeven" mode.
//
// Every asserted number is hand-computed from the contract's breakeven price:
//   call breakeven = strike + premium,  move = breakeven − spot
//   put  breakeven = strike − premium,  move = spot − breakeven
//   pct  = max(0, move) / spot × 100
//
// The suite crosses OTM/ATM/ITM with calls and puts, then covers the null-input
// guard and the negative-move clamp.
import test from "node:test";
import assert from "node:assert/strict";

import { moveToBreakevenPct } from "../core/premiumBreakeven.ts";

// Tolerance: assertions are computed to 4dp by hand; 1e-9 catches formula
// regressions without tripping on floating-point noise.
const EPS = 1e-9;

function near(actual: number | null, expected: number, msg?: string) {
  assert.ok(actual != null, `${msg ?? 'value'}: expected number, got null`);
  assert.ok(
    Math.abs((actual as number) - expected) < EPS,
    `${msg ?? 'value'}: expected ≈${expected}, got ${actual}`,
  );
}

test("OTM put — the user's 725P example: spot 735, $1 premium ⇒ 1.4966% move", () => {
  // Breakeven = 725 − 1 = 724. Move = 735 − 724 = 11. Pct = 11/735*100.
  near(moveToBreakevenPct(725, 1, 735, 'P'), (11 / 735) * 100);
});

test("OTM call — spot 735, 750C at $3 needs spot to climb $18 (2.4490%)", () => {
  // Breakeven = 750 + 3 = 753. Move = 753 − 735 = 18. Pct = 18/735*100.
  near(moveToBreakevenPct(750, 3, 735, 'C'), (18 / 735) * 100);
});

test("ATM call — spot=strike, whole premium is the move", () => {
  // Breakeven = 100 + 2 = 102. Move = 2. Pct = 2/100*100 = 2%.
  near(moveToBreakevenPct(100, 2, 100, 'C'), 2);
});

test("ATM put — spot=strike, whole premium is the move", () => {
  // Breakeven = 100 − 2 = 98. Move = 2. Pct = 2/100*100 = 2%.
  near(moveToBreakevenPct(100, 2, 100, 'P'), 2);
});

test("ITM call — breakeven above spot by extrinsic only", () => {
  // spot 110, 100C @ $12 (intrinsic 10, extrinsic 2). Breakeven = 112.
  // Move = 112 − 110 = 2. Pct = 2/110*100 ≈ 1.8182%.
  near(moveToBreakevenPct(100, 12, 110, 'C'), (2 / 110) * 100);
});

test("ITM put — breakeven below spot by extrinsic only", () => {
  // spot 90, 100P @ $11 (intrinsic 10, extrinsic 1). Breakeven = 89.
  // Move = 90 − 89 = 1. Pct = 1/90*100 ≈ 1.1111%.
  near(moveToBreakevenPct(100, 11, 90, 'P'), (1 / 90) * 100);
});

test("deep ITM with negative-extrinsic quote clamps to 0", () => {
  // Crossed quote: 100C @ $9 with spot 115 → moveDollars = 100 + 9 − 115 = −6.
  // Would imply free money; clamp to 0 rather than surface the artefact.
  assert.equal(moveToBreakevenPct(100, 9, 115, 'C'), 0);
  // Same for a put: 100P @ $4 with spot 90 → moveDollars = 90 − 100 + 4 = −6.
  assert.equal(moveToBreakevenPct(100, 4, 90, 'P'), 0);
});

test("zero premium — call at strike ⇒ 0% move, put at strike ⇒ 0% move", () => {
  assert.equal(moveToBreakevenPct(100, 0, 100, 'C'), 0);
  assert.equal(moveToBreakevenPct(100, 0, 100, 'P'), 0);
});

test("null/undefined premium returns null (no fabricated cell)", () => {
  assert.equal(moveToBreakevenPct(100, null, 100, 'C'), null);
  assert.equal(moveToBreakevenPct(100, undefined, 100, 'P'), null);
});

test("non-positive spot returns null (can't express move as % of nothing)", () => {
  assert.equal(moveToBreakevenPct(100, 5, 0, 'C'), null);
  assert.equal(moveToBreakevenPct(100, 5, -10, 'P'), null);
});

test("collapse property: ITM breakeven % equals extrinsic / spot × 100", () => {
  // For ITM contracts, moveDollars simplifies to extrinsic (premium − intrinsic),
  // so a client that scales extrinsic by spot gets the same answer. This test
  // pins that property so a future refactor can't quietly break it.
  const spot = 500;
  const strike = 480;
  const intrinsicCall = spot - strike; // 20
  const extrinsic = 3;
  const premium = intrinsicCall + extrinsic; // 23
  const viaHelper = moveToBreakevenPct(strike, premium, spot, 'C');
  const viaExtrinsic = (extrinsic / spot) * 100;
  near(viaHelper, viaExtrinsic, "ITM call collapse");

  const putSpot = 460;
  const putStrike = 480;
  const intrinsicPut = putStrike - putSpot; // 20
  const putPremium = intrinsicPut + extrinsic; // 23
  const viaPutHelper = moveToBreakevenPct(putStrike, putPremium, putSpot, 'P');
  const viaPutExtrinsic = (extrinsic / putSpot) * 100;
  near(viaPutHelper, viaPutExtrinsic, "ITM put collapse");
});
