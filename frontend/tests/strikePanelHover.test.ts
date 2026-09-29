// Unit tests for the pure half of the Gamma Terminal Strike Panel's hover card
// (core/strikePanelHover): which strike the pointer is on, how heavy it is, the
// key levels on it, its per-expiration split, the Expiry scope in the header,
// and where the card sits.
//
// The placement tests lean on the one invariant that matters in a panel whose
// card clips overflow: whatever the pointer does, the readout stays inside the
// panel, and a mouse readout never sits on top of the strike it describes.
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  READOUT_GAP,
  READOUT_INSET,
  dteLabel,
  expiryBreakdown,
  expiryScopeLabel,
  levelsForStrike,
  nearestStrike,
  readoutPlacement,
  shareOfPeak,
} from '../core/strikePanelHover.ts';

const rows = [
  { price: 575, netGex: -2e8 },
  { price: 576, netGex: 5e7 },
  { price: 577, netGex: 9e8 },
  { price: 578, netGex: -4.5e8 },
];

test('nearestStrike snaps to the closest strike, including past either end', () => {
  assert.equal(nearestStrike(rows, 576.2)?.price, 576);
  assert.equal(nearestStrike(rows, 576.8)?.price, 577);
  assert.equal(nearestStrike(rows, 560)?.price, 575, 'below the lowest strike');
  assert.equal(nearestStrike(rows, 600)?.price, 578, 'above the highest strike');
  assert.equal(nearestStrike(rows, 576.5)?.price, 576, 'a tie goes to the first row');
});

test('nearestStrike has nothing to say about no strikes or no price', () => {
  assert.equal(nearestStrike([], 576), null);
  assert.equal(nearestStrike(rows, Number.NaN), null);
  assert.equal(nearestStrike([{ price: Number.NaN }, { price: 580 }], 1)?.price, 580, 'a malformed row is skipped');
});

test('shareOfPeak measures |net| against the heaviest strike, either sign', () => {
  assert.equal(shareOfPeak(rows, 9e8), 1);
  assert.equal(shareOfPeak(rows, -4.5e8), 0.5, 'a short-gamma strike is weighed by magnitude');
  assert.equal(shareOfPeak(rows, 0), 0);
  assert.equal(shareOfPeak([{ netGex: 0 }], 0), null, 'nothing carries gamma');
  assert.equal(shareOfPeak([], 1), null);
  assert.equal(shareOfPeak(rows, 2e9), 1, 'never above 100%');
});

const levels = [
  { label: 'FLIP', value: 576.4 },
  { label: 'CALL WALL', value: 580 },
  { label: 'GEX KING', value: 580 },
  { label: 'PUT WALL', value: 570 },
  { label: 'VWAP', value: null },
];

test('levelsForStrike names every level on the strike', () => {
  const on = levelsForStrike(levels, 580);
  assert.deepEqual(on.map((l) => [l.label, l.dist]), [['CALL WALL', 0], ['GEX KING', 0]]);
  // A served value a hair off the strike is still that strike.
  assert.deepEqual(levelsForStrike([{ label: 'MAX PAIN', value: 575.0000001 }], 575).map((l) => l.dist), [0]);
});

test('levelsForStrike falls back to the nearest level and its distance', () => {
  const near = levelsForStrike(levels, 577);
  assert.equal(near.length, 1);
  assert.equal(near[0].label, 'FLIP');
  assert.ok(Math.abs(near[0].dist - 0.6) < 1e-9);
  assert.deepEqual(levelsForStrike([{ label: 'VWAP', value: null }], 577), [], 'no known levels');
});

test('expiryBreakdown splits each side by its shares, nearest first', () => {
  const b = expiryBreakdown({
    callGex: 1e9,
    putGex: -4e8,
    call: [
      { exp: '2026-09-29', frac: 0.6 },
      { exp: '2026-10-02', frac: 0.4 },
    ],
    put: [
      { exp: '2026-09-29', frac: 0.25 },
      { exp: '2026-10-16', frac: 0.75 },
    ],
    order: ['2026-09-29', '2026-10-02', '2026-10-09', '2026-10-16'],
    maxRows: 6,
  });
  assert.ok(b);
  assert.deepEqual(b.rows.map((r) => r.exp), ['2026-09-29', '2026-10-02', '2026-10-16'], 'an empty expiration is skipped');
  assert.equal(b.rest, null);
  // Each column sums back to its bar: the split never changes the magnitude.
  const callSum = b.rows.reduce((s, r) => s + r.call, 0);
  const putSum = b.rows.reduce((s, r) => s + r.put, 0);
  assert.ok(Math.abs(callSum - 1e9) < 1e-3);
  assert.ok(Math.abs(putSum - -4e8) < 1e-3);
  assert.ok(b.rows.every((r) => r.call >= 0 && r.put <= 0), 'signs follow the sides');
});

test('expiryBreakdown lists the nearest few and folds the rest into one row', () => {
  const order = Array.from({ length: 10 }, (_, i) => `2026-10-${String(i + 1).padStart(2, '0')}`);
  const segs = order.map((exp, i) => ({ exp, frac: (i + 1) / 55 }));
  const b = expiryBreakdown({ callGex: 1e8, putGex: -2e8, call: segs, put: segs, order, maxRows: 3 });
  assert.ok(b);
  assert.deepEqual(b.rows.map((r) => r.exp), order.slice(0, 3), 'the nearest roll off first');
  assert.ok(b.rest);
  assert.equal(b.rest.count, 7);
  // Listed rows plus the folded rest are still the whole bar.
  const callSum = b.rows.reduce((s, r) => s + r.call, 0) + b.rest.call;
  const putSum = b.rows.reduce((s, r) => s + r.put, 0) + b.rest.put;
  assert.ok(Math.abs(callSum - 1e8) < 1e-3, `call ${callSum}`);
  assert.ok(Math.abs(putSum - -2e8) < 1e-3, `put ${putSum}`);
});

test('expiryBreakdown never folds a single expiration into a "+1 later" row', () => {
  const order = ['2026-09-29', '2026-10-02', '2026-10-09', '2026-10-16'];
  const segs = order.map((exp) => ({ exp, frac: 0.25 }));
  const b = expiryBreakdown({ callGex: 1e8, putGex: -1e8, call: segs, put: segs, order, maxRows: 3 });
  assert.ok(b);
  assert.equal(b.rows.length, 4, 'the fourth row costs no more room than a "+1 later" row');
  assert.equal(b.rest, null);
});

test('expiryBreakdown stays quiet when there is nothing to split', () => {
  const order = ['2026-09-29', '2026-10-02'];
  assert.equal(expiryBreakdown({ callGex: 1e8, putGex: -1e8, call: [], put: [], order, maxRows: 6 }), null);
  // One expiration holding the whole strike would only repeat the totals.
  const one = [{ exp: '2026-09-29', frac: 1 }];
  assert.equal(expiryBreakdown({ callGex: 1e8, putGex: -1e8, call: one, put: one, order, maxRows: 6 }), null);
});

test('dteLabel counts ET calendar days', () => {
  assert.equal(dteLabel('2026-09-29', '2026-09-29'), '0DTE');
  assert.equal(dteLabel('2026-10-02', '2026-09-29'), '3DTE');
  assert.equal(dteLabel('2026-11-02', '2026-10-30'), '3DTE', 'across the DST change');
  assert.equal(dteLabel('2026-10-02T00:00:00', '2026-09-29'), '3DTE', 'a trailing time is ignored');
  assert.equal(dteLabel('2026-09-28', '2026-09-29'), '0DTE', 'never negative');
  assert.equal(dteLabel('soon', '2026-09-29'), 'soon');
});

test('expiryScopeLabel reads like the Expiry control', () => {
  assert.equal(expiryScopeLabel({ selection: [] }), 'All expiries');
  assert.equal(expiryScopeLabel({ selection: ['2026-10-02'] }), 'Exp 2026-10-02');
  assert.equal(expiryScopeLabel({ selection: ['2026-10-02', '2026-10-09', '2026-10-16'] }), '3 expiries');
  // A rolling 0DTE pick resolves to today's date; the header names the pick.
  assert.equal(
    expiryScopeLabel({ selection: ['2026-09-29'], zeroDte: { active: true, availableToday: true } }),
    '0DTE',
  );
  // On a day with no same-day expiry the numbers are the whole chain: say so.
  assert.equal(
    expiryScopeLabel({ selection: [], zeroDte: { active: true, availableToday: false } }),
    'All expiries · no 0DTE today',
  );
});

// ── Placement ───────────────────────────────────────────────────────────────
// The Terminal's panel on a wide screen: 372px card, 8px insets, chart-tall.
const PANEL = { width: 356, height: 620 };
const CARD = { width: 220, height: 300 };

function assertInside(box: { left: number; top: number }, panel: typeof PANEL, card: typeof CARD, what: string) {
  assert.ok(box.left >= READOUT_INSET - 1e-9, `${what}: left ${box.left}`);
  assert.ok(box.top >= READOUT_INSET - 1e-9, `${what}: top ${box.top}`);
  assert.ok(box.left + card.width <= panel.width - READOUT_INSET + 1e-9, `${what}: right ${box.left + card.width}`);
  assert.ok(box.top + card.height <= panel.height - READOUT_INSET + 1e-9, `${what}: bottom ${box.top + card.height}`);
}

test('a mouse readout sits beside the pointer, like the candlestick card', () => {
  const wide = { width: 1000, height: 420 };
  const right = readoutPlacement({ x: 100, y: 100 }, wide, CARD);
  assert.deepEqual(right, { left: 100 + READOUT_GAP, top: 100 + READOUT_GAP });
  const left = readoutPlacement({ x: 900, y: 100 }, wide, CARD);
  assert.deepEqual(left, { left: 900 - READOUT_GAP - CARD.width, top: 100 + READOUT_GAP });
});

test('the readout stays inside the panel wherever the pointer goes', () => {
  for (const panel of [PANEL, { width: 1000, height: 420 }, { width: 300, height: 700 }]) {
    for (let x = 0; x <= panel.width; x += 7) {
      for (let y = 0; y <= panel.height; y += 11) {
        for (const pinned of [false, true]) {
          assertInside(readoutPlacement({ x, y }, panel, CARD, pinned), panel, CARD, `${panel.width}x${panel.height} @ ${x},${y}${pinned ? ' pinned' : ''}`);
        }
      }
    }
  }
});

test('a mouse readout never covers the strike being read', () => {
  // Beside the pointer, the card clears it horizontally; in a panel too narrow
  // for that, it has to clear the pointer's row instead.
  for (let x = 0; x <= PANEL.width; x += 5) {
    for (let y = 0; y <= PANEL.height; y += 5) {
      const box = readoutPlacement({ x, y }, PANEL, CARD);
      const coversX = x >= box.left && x <= box.left + CARD.width;
      const coversY = y >= box.top && y <= box.top + CARD.height;
      assert.ok(!(coversX && coversY), `pointer ${x},${y} is under the card at ${box.left},${box.top}`);
    }
  }
});

test('a touch readout pins to the corner away from the finger', () => {
  const lowerRight = readoutPlacement({ x: 300, y: 500 }, PANEL, CARD, true);
  assert.deepEqual(lowerRight, { left: READOUT_INSET, top: READOUT_INSET });
  const upperLeft = readoutPlacement({ x: 40, y: 60 }, PANEL, CARD, true);
  assert.deepEqual(upperLeft, {
    left: PANEL.width - CARD.width - READOUT_INSET,
    top: PANEL.height - CARD.height - READOUT_INSET,
  });
});
