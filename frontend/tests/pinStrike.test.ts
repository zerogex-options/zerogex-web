// Unit tests for the Pin Strike presentation helpers. Pin Strike is a
// distinct dealer-positioning metric (the reachable 0DTE strike with the
// strongest modeled positive/restoring dealer gamma into expiration); these
// cover the tile value formatting, the confidence-derived strength label, and
// — most importantly — the empty state, which must render a dash and never
// `0` / `NaN` / a misleading fallback strike.
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  classifyPinDisplay,
  classifyPinStrength,
  formatPinStrike,
  pinDistance,
  pinFarDetail,
  pinFarFallbackPct,
  pinLineLabel,
  pinStrikeSubtitle,
  pinStrengthLabel,
  pinStabilityNote,
  PIN_FAR_EXPECTED_MOVES,
  PIN_FAR_FALLBACK_PCT,
  PIN_FAR_NOTE,
  PIN_STRIKE_EMPTY,
  PIN_STRENGTH_STRONG_MIN_CONFIDENCE,
  PIN_STRENGTH_MODERATE_MIN_CONFIDENCE,
  PIN_STRIKE_TOOLTIP,
} from '../core/pinStrike.ts';
import { buildExpectedRange, dailyExpectedMove } from '../app/live-bulletin/bulletinHelpers.ts';

test('formatPinStrike renders a dollar strike for an active pin', () => {
  assert.equal(formatPinStrike(775), '$775.00');
  assert.equal(formatPinStrike(6012.5), '$6012.50');
});

test('formatPinStrike renders the em-dash empty state, never 0/NaN', () => {
  assert.equal(formatPinStrike(null), PIN_STRIKE_EMPTY);
  assert.equal(formatPinStrike(undefined), PIN_STRIKE_EMPTY);
  assert.equal(formatPinStrike(NaN), PIN_STRIKE_EMPTY);
  // A non-positive strike is not a real pin; it must render as empty, never
  // "$0.00" (the spec's "do not display 0" rule).
  assert.equal(formatPinStrike(0), PIN_STRIKE_EMPTY);
  assert.equal(formatPinStrike(-5), PIN_STRIKE_EMPTY);
});

test('classifyPinStrength buckets on confidence and returns none when no pin', () => {
  assert.equal(classifyPinStrength(775, PIN_STRENGTH_STRONG_MIN_CONFIDENCE), 'strong');
  assert.equal(classifyPinStrength(775, PIN_STRENGTH_STRONG_MIN_CONFIDENCE - 0.01), 'moderate');
  assert.equal(classifyPinStrength(775, PIN_STRENGTH_MODERATE_MIN_CONFIDENCE), 'moderate');
  assert.equal(classifyPinStrength(775, PIN_STRENGTH_MODERATE_MIN_CONFIDENCE - 0.01), 'weak');
  assert.equal(classifyPinStrength(775, 0), 'weak');
  // No strike ⇒ none regardless of confidence.
  assert.equal(classifyPinStrength(null, 0.99), 'none');
  assert.equal(classifyPinStrength(undefined, 0.99), 'none');
});

// The strength label is a SHARE-OF-FIELD measure: the winner's dominance over
// the other viable pins, not the size of its gamma. Readers reliably take
// "Weak" for "small" — a support ticket where a strike carrying ~3x its
// neighbors' gamma labelled Weak because the kernel spread that gamma across
// the neighborhood, diluting its share to just under the 33% threshold. The
// tooltip is the only place that correction reaches someone mid-chart, so it
// may be reworded but must not lose the distinction.
test('the tooltip explains that strength is dominance, not magnitude', () => {
  const tip = PIN_STRIKE_TOOLTIP.toLowerCase();
  assert.ok(tip.includes('dominates'), 'tooltip must say the label measures dominance');
  assert.ok(tip.includes('weak'), 'tooltip must say what "Weak" means');
  assert.ok(
    tip.includes('not how large') || tip.includes('not how big'),
    'tooltip must deny that the label measures size',
  );
});

test('pinStrengthLabel maps buckets to human labels', () => {
  assert.equal(pinStrengthLabel('none'), 'No active pin');
  assert.equal(pinStrengthLabel('weak'), 'Weak');
  assert.equal(pinStrengthLabel('moderate'), 'Moderate');
  assert.equal(pinStrengthLabel('strong'), 'Strong');
});

test('pinStrikeSubtitle shows strength + confidence for an active pin', () => {
  assert.equal(pinStrikeSubtitle(775, 0.62), 'Pin strength: Strong · 62%');
  assert.equal(pinStrikeSubtitle(775, 0.4), 'Pin strength: Moderate · 40%');
  assert.equal(pinStrikeSubtitle(775, 0.2), 'Pin strength: Weak · 20%');
});

test('pinStrikeSubtitle degrades gracefully with no confidence', () => {
  assert.equal(pinStrikeSubtitle(775, null), 'Pin strength: Weak');
});

test('pinStrikeSubtitle shows the no-pin state when there is no strike', () => {
  assert.equal(pinStrikeSubtitle(null, null), 'No active pin');
  assert.equal(pinStrikeSubtitle(undefined, 0.9), 'No active pin');
});

// pinLineLabel is what the Daily Replay chart's pin line and the Gamma
// Terminal chart's PIN tag are both built from — the level must not be named
// two different things on two charts showing the same minute.
test('pinLineLabel qualifies the line with the pin strength', () => {
  assert.equal(pinLineLabel(775, 0.62), 'Pin · Strong');
  assert.equal(pinLineLabel(775, 0.4), 'Pin · Moderate');
  assert.equal(pinLineLabel(775, 0.2), 'Pin · Weak');
});

test('pinLineLabel falls back to a bare "Pin" when there is no pin', () => {
  // A missing confidence reads as Weak rather than as unqualified — the same
  // answer pinStrikeSubtitle already gives the tiles, so one pin cannot read
  // two ways depending on which surface you are looking at.
  assert.equal(pinLineLabel(775, null), 'Pin · Weak');
  // The bare "Pin" is reserved for having no pin to qualify at all.
  assert.equal(pinLineLabel(null, 0.9), 'Pin');
  assert.equal(pinLineLabel(undefined, undefined), 'Pin');
  // Never a "$0" pin, and so never a strength claimed for one.
  assert.equal(pinLineLabel(0, 0.9), 'Pin');
});

test('pinLineLabel upper-cases into the Gamma Terminal chart tag', () => {
  // That chart's level tags are caps; it upper-cases this result rather than
  // composing its own wording.
  assert.equal(pinLineLabel(775, 0.62).toUpperCase(), 'PIN · STRONG');
  assert.equal(pinLineLabel(null, null).toUpperCase(), 'PIN');
});

// ---------------------------------------------------------------------------
// Pin stability — what the pin has DONE this session
// ---------------------------------------------------------------------------

test('pinStabilityNote reports a settled pin by the time it took hold', () => {
  // 13:41Z is 09:41 ET — the session-open read.
  assert.equal(
    pinStabilityNote({
      held_pin: 7730,
      held_since: '2026-08-31T13:41:00Z',
      net_migration: 0,
      distinct_values: 1,
      current_established: true,
    }),
    'Held since 09:41',
  );
});

test('pinStabilityNote leads with the signed move once the pin has migrated', () => {
  // The session Andres described: the pin walked 30 points DOWN with the tape.
  // The distance is the fact a trader watching the level leave needs first, so
  // it comes before the hold time rather than after it.
  assert.equal(
    pinStabilityNote({
      held_pin: 7700,
      held_since: '2026-08-31T18:05:00Z',
      net_migration: -30,
      distinct_values: 3,
      current_established: true,
    }),
    '\u221230 pts today \u00b7 held since 14:05',
  );
  assert.equal(
    pinStabilityNote({
      held_pin: 7712.5,
      held_since: '2026-08-31T18:05:00Z',
      net_migration: 12.5,
      distinct_values: 2,
      current_established: true,
    }),
    '+12.50 pts today \u00b7 held since 14:05',
  );
});

test('pinStabilityNote treats a zero net move as held even across strikes', () => {
  // A pin that left 7730 and came back has traveled nowhere on net, and
  // "0 pts today" would be a distinction without a difference.
  assert.equal(
    pinStabilityNote({
      held_pin: 7730,
      held_since: '2026-08-31T13:41:00Z',
      net_migration: 0,
      distinct_values: 3,
      current_established: true,
    }),
    'Held since 09:41',
  );
});

test('pinStabilityNote names the settled strike while the current pin is provisional', () => {
  // The live SPX case: 7675 all session, one 7670 print at the bell. The card's
  // headline value is 7670, so a bare "Held since 09:30" would read as if 7670
  // had held all day. Naming the settled strike keeps the two apart, and no
  // migration is claimed for a tick that has not settled.
  assert.equal(
    pinStabilityNote({
      held_pin: 7675,
      held_since: '2026-09-02T13:30:00Z',
      net_migration: 0,
      distinct_values: 1,
      current_established: false,
    }),
    'Held 7675 since 09:30',
  );
});

test('pinStabilityNote renders nothing rather than a zeroed line', () => {
  assert.equal(pinStabilityNote(null), null);
  assert.equal(pinStabilityNote(undefined), null);
  assert.equal(
    pinStabilityNote({
      held_pin: 7675,
      held_since: 'not-a-timestamp',
      net_migration: -30,
      distinct_values: 2,
      current_established: true,
    }),
    null,
  );
});

// ---------------------------------------------------------------------------
// Far pins — a pin far from price reads FAR, never STRONG or MODERATE
// ---------------------------------------------------------------------------
//
// The fixtures are real ES Daily Replay minutes (spot, pin, confidence) with
// that day's VIX. The case that started this: Mon Nov 16 at 12:00, ES 7493.25
// falling in short gamma, and a lone pin 89 points overhead at 60% confidence
// drawn as a teal "PIN · STRONG" line, which reads as a target.

const ES_NOV16_1200 = { spot: 7493.25, pin: 7582.25, confidence: 0.604, vix: 20.08 };
const ES_NOV13_1100 = { spot: 7550.5, pin: 7674.75, confidence: 0.14, vix: 19.3 };
const ES_NOV10_1100 = { spot: 7526.75, pin: 7586.5, confidence: 0.12, vix: 20.17 };
const ES_NOV12_1100 = { spot: 7655.25, pin: 7685.5, confidence: 0.09, vix: 18.7 };

const esDistance = (row: { spot: number; pin: number; vix: number }, withVol = true) =>
  pinDistance({
    pinStrike: row.pin,
    spot: row.spot,
    expectedMove: withVol ? dailyExpectedMove(row.spot, row.vix) : null,
    symbol: 'ES',
  });

test('the expected move is the Daily Expected Range overlay’s own half-width', () => {
  // Far must be measured in the same units the chart draws, or a pin could sit
  // inside the drawn band and still be called far.
  const band = buildExpectedRange({
    spot: 7493.25,
    vix: 20.08,
    volIndex: 'VIX',
    horizon: 'daily',
    callWall: null,
    putWall: null,
  });
  assert.ok(band);
  assert.equal(dailyExpectedMove(7493.25, 20.08), band.moveAbs);
  // ≈ 94.8 ES points: spot × 20.08% × √(1/252).
  assert.ok(Math.abs((dailyExpectedMove(7493.25, 20.08) ?? 0) - 94.78) < 0.01);
  assert.equal(dailyExpectedMove(null, 20), null);
  assert.equal(dailyExpectedMove(7493.25, null), null);
  assert.equal(dailyExpectedMove(7493.25, 0), null);
});

test('the Nov 16 12:00 pin is far: FAR replaces STRONG on the line and the tile', () => {
  const d = esDistance(ES_NOV16_1200);
  assert.ok(d);
  assert.equal(d.basis, 'expected-move');
  assert.equal(d.points, 89);
  assert.ok(Math.abs((d.expectedMoves ?? 0) - 0.939) < 0.001, `got ${d.expectedMoves}`);
  assert.equal(d.far, true);
  // The confidence alone would still say Strong…
  assert.equal(classifyPinStrength(ES_NOV16_1200.pin, ES_NOV16_1200.confidence), 'strong');
  // …but no surface may print it on a far pin.
  assert.equal(classifyPinDisplay(ES_NOV16_1200.pin, ES_NOV16_1200.confidence, d), 'far');
  assert.equal(pinLineLabel(ES_NOV16_1200.pin, ES_NOV16_1200.confidence, d), 'Pin · Far');
  assert.equal(pinLineLabel(ES_NOV16_1200.pin, ES_NOV16_1200.confidence, d).toUpperCase(), 'PIN · FAR');
  assert.equal(
    pinStrikeSubtitle(ES_NOV16_1200.pin, ES_NOV16_1200.confidence, d),
    'Far: 1.19% above spot · no nearby pin',
  );
});

test('a far pin never reads Strong or Moderate, whatever its confidence', () => {
  const d = esDistance(ES_NOV16_1200);
  for (const confidence of [0, 0.2, 0.33, 0.5, 0.99, null]) {
    assert.equal(classifyPinDisplay(ES_NOV16_1200.pin, confidence, d), 'far');
    assert.doesNotMatch(pinLineLabel(ES_NOV16_1200.pin, confidence, d), /Strong|Moderate|Weak/);
    assert.doesNotMatch(pinStrikeSubtitle(ES_NOV16_1200.pin, confidence, d), /Strong|Moderate|Weak|strength/);
  }
});

test('the replay table: only the pins a day’s move or so away read far', () => {
  // Nov 13, 124 points over a 92-point expected move.
  assert.equal(esDistance(ES_NOV13_1100)?.far, true);
  // Nov 10, 60 points (0.62 of a move) and Nov 12, 30 points (0.34): ordinary
  // intraday distances, so the strength label stays.
  assert.equal(esDistance(ES_NOV10_1100)?.far, false);
  assert.equal(esDistance(ES_NOV12_1100)?.far, false);
  assert.equal(
    pinLineLabel(ES_NOV12_1100.pin, ES_NOV12_1100.confidence, esDistance(ES_NOV12_1100)),
    'Pin · Weak',
  );
});

test('far is measured in expected moves, so it means the same on every symbol', () => {
  // 0.9 of a daily move is far on ES and on SPY alike, though one is ~86
  // points and the other ~$7.80.
  const es = dailyExpectedMove(7500, 20) ?? 0;
  const spy = dailyExpectedMove(680, 20) ?? 0;
  assert.equal(pinDistance({ pinStrike: 7500 + 0.9 * es, spot: 7500, expectedMove: es, symbol: 'ES' })?.far, true);
  assert.equal(pinDistance({ pinStrike: 680 + 0.9 * spy, spot: 680, expectedMove: spy, symbol: 'SPY' })?.far, true);
  // And the same 1.0% that is far for SPX at a VIX of 15 is near when the
  // market is pricing a VIX of 30.
  const calm = dailyExpectedMove(6800, 15);
  const stressed = dailyExpectedMove(6800, 30);
  assert.equal(pinDistance({ pinStrike: 6868, spot: 6800, expectedMove: calm, symbol: 'SPX' })?.far, true);
  assert.equal(pinDistance({ pinStrike: 6868, spot: 6800, expectedMove: stressed, symbol: 'SPX' })?.far, false);
});

test('the threshold is strict: exactly three-quarters of a move is not yet far', () => {
  const move = 100;
  assert.equal(PIN_FAR_EXPECTED_MOVES, 0.75);
  const at = pinDistance({ pinStrike: 7575, spot: 7500, expectedMove: move });
  assert.equal(at?.expectedMoves, 0.75);
  assert.equal(at?.far, false);
  assert.equal(pinDistance({ pinStrike: 7575.25, spot: 7500, expectedMove: move })?.far, true);
  // Below spot counts the same as above.
  assert.equal(pinDistance({ pinStrike: 7424.75, spot: 7500, expectedMove: move })?.far, true);
});

test('a pin below spot says so', () => {
  const d = pinDistance({ pinStrike: 7400, spot: 7500, expectedMove: 100, symbol: 'ES' });
  assert.ok(d);
  assert.equal(d.points, -100);
  assert.equal(pinStrikeSubtitle(7400, 0.7, d), 'Far: 1.33% below spot · no nearby pin');
});

test('with no vol reading the percent fallback decides, per symbol family', () => {
  assert.equal(pinFarFallbackPct('ES'), PIN_FAR_FALLBACK_PCT.sp500);
  assert.equal(pinFarFallbackPct('SPX'), 1);
  assert.equal(pinFarFallbackPct('SPY'), 1);
  assert.equal(pinFarFallbackPct('NDX'), PIN_FAR_FALLBACK_PCT.nasdaq100);
  assert.equal(pinFarFallbackPct('nq'), 1.25);
  assert.equal(pinFarFallbackPct('QQQ'), 1.25);
  assert.equal(pinFarFallbackPct('NVDA'), PIN_FAR_FALLBACK_PCT.stock);
  assert.equal(pinFarFallbackPct('MSFT'), 2);
  // Unknown or missing: the S&P cutoff, the tightest, never a missing rule.
  assert.equal(pinFarFallbackPct(null), 1);

  // The replay page has no VIX, and the Nov 16 12:00 pin (1.19%) still reads far there.
  const replay = esDistance(ES_NOV16_1200, false);
  assert.equal(replay?.basis, 'percent');
  assert.equal(replay?.expectedMoves, null);
  assert.equal(replay?.far, true);
  // Nov 10's 0.79% does not.
  assert.equal(esDistance(ES_NOV10_1100, false)?.far, false);

  // The same 1.1% is far on ES but not on NQ, which moves more.
  assert.equal(pinDistance({ pinStrike: 7582.5, spot: 7500, symbol: 'ES' })?.far, true);
  assert.equal(pinDistance({ pinStrike: 27302, spot: 27000, symbol: 'NQ' })?.far, false);
  assert.equal(pinDistance({ pinStrike: 27350, spot: 27000, symbol: 'NQ' })?.far, true);
  // A stock gets twice the S&P's room.
  assert.equal(pinDistance({ pinStrike: 203, spot: 200, symbol: 'NVDA' })?.far, false);
  assert.equal(pinDistance({ pinStrike: 204.5, spot: 200, symbol: 'NVDA' })?.far, true);
});

test('an unusable expected move falls back rather than calling everything far', () => {
  for (const expectedMove of [0, -5, NaN, Infinity, null, undefined]) {
    const d = pinDistance({ pinStrike: 7530, spot: 7500, expectedMove, symbol: 'ES' });
    assert.equal(d?.basis, 'percent', `expectedMove ${expectedMove}`);
    assert.equal(d?.far, false, `expectedMove ${expectedMove}`);
  }
});

test('no pin or no spot gives no distance, never a far call on missing data', () => {
  assert.equal(pinDistance({ pinStrike: null, spot: 7500, expectedMove: 90 }), null);
  assert.equal(pinDistance({ pinStrike: undefined, spot: 7500 }), null);
  assert.equal(pinDistance({ pinStrike: 0, spot: 7500 }), null);
  assert.equal(pinDistance({ pinStrike: NaN, spot: 7500 }), null);
  assert.equal(pinDistance({ pinStrike: 7600, spot: null, expectedMove: 90 }), null);
  assert.equal(pinDistance({ pinStrike: 7600, spot: 0 }), null);
  // No distance leaves the strength label exactly as it was.
  assert.equal(pinLineLabel(775, 0.62, null), 'Pin · Strong');
  assert.equal(pinStrikeSubtitle(775, 0.62, null), 'Pin strength: Strong · 62%');
  assert.equal(classifyPinDisplay(null, 0.9, null), 'none');
  assert.equal(pinLineLabel(null, 0.9, esDistance(ES_NOV16_1200)), 'Pin');
});

test('a near pin keeps its strength label', () => {
  const d = pinDistance({ pinStrike: 7510, spot: 7500, expectedMove: 94, symbol: 'ES' });
  assert.equal(d?.far, false);
  assert.equal(pinLineLabel(7510, 0.62, d), 'Pin · Strong');
  assert.equal(pinStrikeSubtitle(7510, 0.4, d), 'Pin strength: Moderate · 40%');
});

test('the far explanation says how far, by which rule, and what it means', () => {
  const live = pinFarDetail(esDistance(ES_NOV16_1200)!);
  assert.match(live, /^Far from spot: 1\.19% above spot, 0\.94 of the daily expected move\./);
  assert.match(live, /no nearby pin/);
  assert.match(live, /short gamma/);
  assert.match(live, /not a target/);

  const replay = pinFarDetail(esDistance(ES_NOV16_1200, false)!);
  assert.match(replay, /^Far from spot: 1\.19% above spot, more than the 1% that counts as far without a live volatility reading\./);
  const nq = pinFarDetail(pinDistance({ pinStrike: 27400, spot: 27000, symbol: 'NQ' })!);
  assert.match(nq, /more than the 1\.25% that counts as far/);

  assert.equal(PIN_FAR_NOTE, 'Far · no nearby pin');
});

test('the tooltip says what Far means', () => {
  const tip = PIN_STRIKE_TOOLTIP.toLowerCase();
  assert.match(tip, /"far"/);
  assert.match(tip, /no nearby pin/);
  assert.match(tip, /short gamma/);
});
