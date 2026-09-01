// Unit tests for the shared wall-ladder model (frontend/core/wallLadder.ts),
// which backs the optional secondary Call/Put Walls (C2/C3 · P2/P3) on the
// Gamma Chart, the Strike Profile and the Gamma Ladder.
//
// The load-bearing contract is that C1 is ALWAYS the primary wall the surface
// is drawing. Each surface resolves its primary wall through its own fallback
// chain (rewind bucket → live summary), and the ladder it holds can come from
// the other end of that chain; if the two could disagree, a chart would label
// "C1" at one price and "Call Wall" at another on the same axis.
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  WALL_DEPTH_DEFAULT,
  WALL_DEPTH_MAX,
  WALL_DEPTH_MIN,
  extraWalls,
  formatWallStrength,
  normalizeWallDepth,
  parseWallLadder,
  wallDistancePct,
  wallFullName,
  wallLabel,
  wallRankDash,
  wallRankOpacity,
  wallTooltip,
} from '../core/wallLadder.ts';

const CALL_PAYLOAD = [
  { rank: 1, label: 'C1', strike: 105, strength: 1.2e9 },
  { rank: 2, label: 'C2', strike: 115, strength: 8e8 },
  { rank: 3, label: 'C3', strike: 110, strength: 4e8 },
];

const strikes = (levels: ReturnType<typeof parseWallLadder>) => levels.map((l) => l.strike);
const labels = (levels: ReturnType<typeof parseWallLadder>) => levels.map((l) => l.label);

// ── parseWallLadder ─────────────────────────────────────────────────────────

test('parses the server ladder in rank order with client labels', () => {
  const out = parseWallLadder(CALL_PAYLOAD, 'call', 105);
  assert.deepEqual(strikes(out), [105, 115, 110]);
  assert.deepEqual(labels(out), ['C1', 'C2', 'C3']);
  assert.deepEqual(out.map((l) => l.rank), [1, 2, 3]);
  assert.equal(out[0].side, 'call');
  assert.equal(out[1].strength, 8e8);
});

test('pins the primary wall to C1 even when the ladder ranks it lower', () => {
  // The surface is drawing its Call Wall at 110 (e.g. from a rewind bucket)
  // while the ladder it holds came from the live summary.
  const out = parseWallLadder(CALL_PAYLOAD, 'call', 110);
  assert.deepEqual(strikes(out), [110, 105, 115]);
  assert.deepEqual(labels(out), ['C1', 'C2', 'C3']);
  // The promoted rung keeps the magnitude it was ranked on.
  assert.equal(out[0].strength, 4e8);
});

test('prepends a primary wall the ladder does not contain', () => {
  const out = parseWallLadder(CALL_PAYLOAD, 'call', 101);
  assert.deepEqual(strikes(out), [101, 105, 115]);
  // No ranked magnitude for it — null, not an invented number.
  assert.equal(out[0].strength, null);
});

test('a null primary leaves the server order intact', () => {
  const out = parseWallLadder(CALL_PAYLOAD, 'call', null);
  assert.deepEqual(strikes(out), [105, 115, 110]);
});

test('with no ladder at all the primary is still C1', () => {
  // An older cached response, or a bucket the server had no strikes for. The
  // surface must keep drawing its one wall rather than lose it.
  assert.deepEqual(parseWallLadder(undefined, 'put', 95), [
    { rank: 1, label: 'P1', side: 'put', strike: 95, strength: null },
  ]);
  assert.deepEqual(parseWallLadder(null, 'call', null), []);
  assert.deepEqual(parseWallLadder([], 'call', null), []);
});

test('labels follow the requested side', () => {
  const out = parseWallLadder(
    [
      { rank: 1, strike: 95, strength: 9e8 },
      { rank: 2, strike: 90, strength: 3e8 },
    ],
    'put',
    95,
  );
  assert.deepEqual(labels(out), ['P1', 'P2']);
  assert.equal(out[0].side, 'put');
});

test('depth caps the ladder and never pads it', () => {
  assert.equal(parseWallLadder(CALL_PAYLOAD, 'call', 105, 2).length, 2);
  assert.equal(parseWallLadder(CALL_PAYLOAD, 'call', 105, 0).length, 0);
  // Two eligible strikes and a request for three ⇒ two. A short ladder means
  // the chain has no further wall.
  assert.equal(parseWallLadder(CALL_PAYLOAD.slice(0, 2), 'call', 105, 3).length, 2);
});

test('drops junk rungs instead of drawing them at zero', () => {
  const out = parseWallLadder(
    [
      { rank: 1, strike: 105, strength: 1e9 },
      { rank: 2, strike: 0, strength: 5e8 }, // a zero strike is not a level
      { rank: 3, strike: null, strength: 5e8 },
      { rank: 4, strike: '', strength: 5e8 },
      { rank: 5, strike: 'not-a-number', strength: 5e8 },
      { rank: 6, strike: -110, strength: 5e8 },
      { rank: 7, strike: 115, strength: null },
    ],
    'call',
    105,
  );
  assert.deepEqual(strikes(out), [105, 115]);
  assert.equal(out[1].strength, null);
});

test('coerces numeric strings and de-duplicates repeated strikes', () => {
  const out = parseWallLadder(
    [
      { rank: 1, strike: '105.5', strength: '1e9' },
      { rank: 2, strike: 105.5, strength: 9e8 },
      { rank: 3, strike: '110', strength: '8e8' },
    ],
    'call',
    null,
  );
  assert.deepEqual(strikes(out), [105.5, 110]);
  assert.equal(out[0].strength, 1e9);
});

test('falls back to payload order when ranks are missing', () => {
  const out = parseWallLadder(
    [{ strike: 105 }, { strike: 115 }, { strike: 110 }],
    'call',
    null,
  );
  assert.deepEqual(strikes(out), [105, 115, 110]);
  assert.deepEqual(labels(out), ['C1', 'C2', 'C3']);
});

// ── extraWalls ──────────────────────────────────────────────────────────────

test('extraWalls is empty at the default depth', () => {
  // The point of defaulting to 1: an existing user's chart is unchanged, and
  // the surfaces keep drawing their own Call Wall / Put Wall lines as before.
  const ladder = parseWallLadder(CALL_PAYLOAD, 'call', 105);
  assert.deepEqual(extraWalls(ladder, WALL_DEPTH_DEFAULT), []);
});

test('extraWalls returns only the ranks past the primary', () => {
  const ladder = parseWallLadder(CALL_PAYLOAD, 'call', 105);
  assert.deepEqual(labels(extraWalls(ladder, 2)), ['C2']);
  assert.deepEqual(labels(extraWalls(ladder, 3)), ['C2', 'C3']);
});

test('extraWalls clamps an out-of-range depth', () => {
  const ladder = parseWallLadder(CALL_PAYLOAD, 'call', 105);
  assert.deepEqual(labels(extraWalls(ladder, 99)), ['C2', 'C3']);
  assert.deepEqual(extraWalls(ladder, 0), []);
  assert.deepEqual(extraWalls([], 3), []);
});

// ── normalizeWallDepth ──────────────────────────────────────────────────────

test('normalizeWallDepth clamps, rounds and survives junk', () => {
  assert.equal(normalizeWallDepth(2), 2);
  assert.equal(normalizeWallDepth('3'), 3);
  assert.equal(normalizeWallDepth(2.4), 2);
  assert.equal(normalizeWallDepth(0), WALL_DEPTH_MIN);
  assert.equal(normalizeWallDepth(99), WALL_DEPTH_MAX);
  assert.equal(normalizeWallDepth(-5), WALL_DEPTH_MIN);
  assert.equal(normalizeWallDepth(null), WALL_DEPTH_DEFAULT);
  assert.equal(normalizeWallDepth(undefined), WALL_DEPTH_DEFAULT);
  assert.equal(normalizeWallDepth('banana'), WALL_DEPTH_DEFAULT);
  assert.equal(normalizeWallDepth(NaN), WALL_DEPTH_DEFAULT);
});

// ── presentation ────────────────────────────────────────────────────────────

test('labels and full names', () => {
  assert.equal(wallLabel('call', 2), 'C2');
  assert.equal(wallLabel('put', 3), 'P3');
  assert.equal(wallFullName('call', 1), 'Call Wall');
  assert.equal(wallFullName('call', 2), '2nd Call Wall');
  assert.equal(wallFullName('put', 3), '3rd Put Wall');
});

test('secondary walls read as subordinate to the primary', () => {
  // Rank IS the message: three lines of equal weight would turn the price axis
  // into a ladder of equals.
  assert.equal(wallRankOpacity(1), 1);
  assert.ok(wallRankOpacity(2) < wallRankOpacity(1));
  assert.ok(wallRankOpacity(3) < wallRankOpacity(2));
  assert.notEqual(wallRankDash(2), wallRankDash(3));
});

test('distance from spot is null rather than a misleading zero', () => {
  assert.equal(wallDistancePct(110, 100), 10);
  assert.equal(wallDistancePct(90, 100), -10);
  assert.equal(wallDistancePct(110, null), null);
  assert.equal(wallDistancePct(110, 0), null);
});

test('strength formats compactly across magnitudes', () => {
  assert.equal(formatWallStrength(1.24e9), '$1.2B');
  assert.equal(formatWallStrength(8.4e8), '$840M');
  assert.equal(formatWallStrength(1.2e4), '$12K');
  assert.equal(formatWallStrength(430), '$430');
});

test('tooltip names the rung, the level and the book behind it', () => {
  const [c1, c2] = parseWallLadder(CALL_PAYLOAD, 'call', 105, 2);
  const tip = wallTooltip(c2, 100);
  assert.ok(tip.startsWith('C2 — 2nd Call Wall at 115.00'));
  assert.ok(tip.includes('+15.00% from spot'));
  assert.ok(tip.includes('$800M gamma'));
  // Without a spot, the distance clause is simply absent.
  assert.ok(!wallTooltip(c1, null).includes('from spot'));
});

// ── Contract with the API ───────────────────────────────────────────────────

test('reads a real /api/gex/summary ladder payload as the charts would', () => {
  // Exactly what src/analytics/walls.py ships: server-assigned ranks and
  // labels, strikes as JSON numbers (NUMERIC → float), strengths as dollar
  // gamma. This is the seam between the two repos, so it is worth pinning the
  // literal shape rather than a hand-rolled approximation of it.
  const summary = {
    call_wall: 6700,
    put_wall: 6500,
    call_walls: [
      { rank: 1, label: 'C1', strike: 6700, strength: 1_240_000_000 },
      { rank: 2, label: 'C2', strike: 6750, strength: 810_000_000 },
      { rank: 3, label: 'C3', strike: 6725, strength: 460_000_000 },
    ],
    put_walls: [
      { rank: 1, label: 'P1', strike: 6500, strength: 990_000_000 },
      { rank: 2, label: 'P2', strike: 6450, strength: 520_000_000 },
    ],
  };

  const calls = parseWallLadder(summary.call_walls, 'call', summary.call_wall);
  const puts = parseWallLadder(summary.put_walls, 'put', summary.put_wall);

  // At the default depth the charts draw nothing beyond the walls they always
  // drew — this is what makes the feature opt-in.
  assert.deepEqual(extraWalls(calls, WALL_DEPTH_DEFAULT), []);
  assert.deepEqual(extraWalls(puts, WALL_DEPTH_DEFAULT), []);

  // At full depth, the extra lines are exactly C2/C3 and P2 — and P3 is absent
  // because the chain has no third put wall, not padded to fill the depth.
  assert.deepEqual(
    extraWalls(calls, WALL_DEPTH_MAX).map((w) => [w.label, w.strike]),
    [['C2', 6750], ['C3', 6725]],
  );
  assert.deepEqual(
    extraWalls(puts, WALL_DEPTH_MAX).map((w) => [w.label, w.strike]),
    [['P2', 6450]],
  );

  // And the primary lines the charts already draw are untouched.
  assert.equal(calls[0].strike, summary.call_wall);
  assert.equal(puts[0].strike, summary.put_wall);
});

test('an empty per-bucket ladder degrades to the primary wall alone', () => {
  // A strike-profile bucket with no strikes (or one older than the ladder)
  // ships call_walls: []. The chart must keep its Call Wall line and simply
  // draw no secondary rungs — never lose the level it had.
  const bucket = { call_wall: 6700, put_wall: null, call_walls: [], put_walls: [] };
  const calls = parseWallLadder(bucket.call_walls, 'call', bucket.call_wall);
  const puts = parseWallLadder(bucket.put_walls, 'put', bucket.put_wall);
  assert.deepEqual(calls.map((w) => [w.label, w.strike]), [['C1', 6700]]);
  assert.deepEqual(extraWalls(calls, WALL_DEPTH_MAX), []);
  assert.deepEqual(puts, []);
});
