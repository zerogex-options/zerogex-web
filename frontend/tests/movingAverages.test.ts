import assert from 'node:assert/strict';
import test from 'node:test';

import {
  clampEmaLength,
  emaAlpha,
  emaPath,
  emaRange,
  emaSeries,
  emaStep,
  emaWarmupCloses,
  parseEmaLines,
  EMA_DEFAULT_LINES,
  EMA_MAX_LENGTH,
  EMA_MIN_LENGTH,
} from '../core/movingAverages.ts';

const close = (a: number | null, b: number, eps = 1e-9) => {
  assert.ok(a != null, `expected a value near ${b}, got null`);
  assert.ok(Math.abs(a - b) < eps, `expected ${b}, got ${a}`);
};

// A seeded random walk, so the convergence checks are deterministic.
function walk(n: number, start: number, seed: number): number[] {
  let s = seed >>> 0;
  const rand = () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
  const out: number[] = [];
  let p = start;
  for (let i = 0; i < n; i++) {
    // Box-Muller, about 0.1% per bar.
    const z = Math.sqrt(-2 * Math.log(rand() || 1e-12)) * Math.cos(2 * Math.PI * rand());
    p *= Math.exp(0.001 * z);
    out.push(p);
  }
  return out;
}

// ── The math ────────────────────────────────────────────────────────────────

test('the defaults are the 13, 40 and 200, all on', () => {
  assert.deepEqual(
    EMA_DEFAULT_LINES.map((l) => [l.length, l.on]),
    [
      [13, true],
      [40, true],
      [200, true],
    ],
  );
  assert.equal(EMA_MIN_LENGTH, 2);
  assert.equal(EMA_MAX_LENGTH, 200);
});

test('seeds with the simple average of the first `length` closes, then steps by 2 / (length + 1)', () => {
  assert.deepEqual(emaSeries([1, 2, 3, 4, 5, 6], 3), [null, null, 2, 3, 4, 5]);
  assert.equal(emaAlpha(3), 0.5);
});

test('matches values worked out by hand', () => {
  // length 4: seed (10 + 11 + 12 + 11) / 4 = 11, then alpha 0.4.
  const out = emaSeries([10, 11, 12, 11, 10, 12, 13, 14, 13, 15], 4);
  assert.deepEqual(out.slice(0, 3), [null, null, null]);
  close(out[3], 11);
  close(out[4], 10.6);
  close(out[5], 11.16);
  close(out[6], 11.896);
  close(out[7], 12.7376);
  close(out[8], 12.84256);
  close(out[9], 13.705536);
});

test('a flat series stays flat', () => {
  for (const v of emaSeries(new Array(50).fill(680.25), 13).slice(12)) close(v, 680.25);
});

test('too few closes draw nothing', () => {
  assert.deepEqual(emaSeries([1, 2, 3], 4), [null, null, null]);
  assert.deepEqual(emaSeries([], 13), []);
});

test('a missing close is skipped: it neither counts toward the seed nor moves the line', () => {
  const out = emaSeries([1, NaN, 2, 3, Infinity, 5], 3);
  assert.deepEqual(out.slice(0, 3), [null, null, null]);
  close(out[3], 2); // (1 + 2 + 3) / 3
  close(out[4], 2); // held
  close(out[5], 3.5); // 2 + 0.5 * (5 - 2)
});

test('emaStep is one step of the series', () => {
  const closes = walk(60, 680, 7);
  const out = emaSeries(closes, 13);
  close(emaStep(out[40]!, closes[41], 13), out[41]!);
});

// ── Warm-up ─────────────────────────────────────────────────────────────────

test('a later start converges on the full-history line, by (1 - alpha) per bar', () => {
  // Past the seed both lines follow the same recurrence, so the gap between
  // them shrinks by exactly (1 - alpha) every bar. That is the whole case for
  // feeding the chart's extra candles in as warm-up.
  const closes = walk(5000, 680, 42);
  const full = emaSeries(closes, 200);
  for (const loaded of [400, 576]) {
    const part = emaSeries(closes.slice(-loaded), 200);
    const offset = closes.length - loaded;
    const seedGap = part[199]! - full[offset + 199]!;
    const endGap = part[loaded - 1]! - full[closes.length - 1]!;
    close(endGap, seedGap * (1 - emaAlpha(200)) ** (loaded - 200), 1e-9);
  }
  // What is left of the seed's error at the newest candle: about 2% of it
  // from the 576 candles the chart loads, against about 13% from the 400 it
  // keeps for panning.
  close((1 - emaAlpha(200)) ** (576 - 200), 0.0233, 0.001);
  close((1 - emaAlpha(200)) ** (400 - 200), 0.1353, 0.001);
  const from576 = emaSeries(closes.slice(-576), 200).at(-1)!;
  const truth = full.at(-1)!;
  assert.ok(Math.abs(from576 - truth) / truth < 0.0005, `576 candles should be within 0.05%, off by ${from576 - truth}`);
});

test('the warm-up closes are the candles before the first kept one, each at its latest row', () => {
  const MIN = 60_000;
  const t0 = Date.parse('2026-11-06T14:30:00Z');
  const iso = (ms: number) => new Date(ms).toISOString();
  const fiveMin = (ms: number) => Math.floor(ms / (5 * MIN)) * 5 * MIN;
  const rows = [
    { timestamp: iso(t0 + 6 * MIN), close: 102 }, // second candle, out of order
    { timestamp: iso(t0), close: 100 },
    { timestamp: iso(t0 + 4 * MIN), close: 101 }, // first candle closes here
    { timestamp: iso(t0 + 5 * MIN), close: 101.5 },
    { timestamp: iso(t0 + 9 * MIN), close: 103 }, // second candle closes here
    { timestamp: iso(t0 + 7 * MIN), close: NaN }, // skipped
    { timestamp: 'not a time', close: 99 }, // skipped
    { timestamp: iso(t0 + 10 * MIN), close: 104 }, // the first kept candle: excluded
    { timestamp: iso(t0 + 12 * MIN), close: 105 },
  ];
  assert.deepEqual(emaWarmupCloses(rows, t0 + 10 * MIN, fiveMin), [101, 103]);
  assert.deepEqual(emaWarmupCloses(rows, t0, fiveMin), []);
});

// ── Drawing ─────────────────────────────────────────────────────────────────

test('the path starts where the line has a value and breaks across a gap', () => {
  const x = (i: number) => i * 10;
  const y = (p: number) => 100 - p;
  assert.equal(emaPath([null, 1, 2, null, 4], x, y), 'M 10.0 99.0 L 20.0 98.0 M 40.0 96.0');
  assert.equal(emaPath([null, null], x, y), '');
});

test('the range spans every line and ignores the warm-up', () => {
  assert.deepEqual(emaRange([[null, 5, 7], [null, null, 3], []]), { min: 3, max: 7 });
  assert.equal(emaRange([[null], []]), null);
});

// ── Settings ────────────────────────────────────────────────────────────────

test('a length is a whole number from 2 to 200, and anything else falls back', () => {
  assert.equal(clampEmaLength(13, 40), 13);
  assert.equal(clampEmaLength('21', 40), 21);
  assert.equal(clampEmaLength(9.6, 40), 10);
  assert.equal(clampEmaLength(1, 40), 2);
  assert.equal(clampEmaLength(500, 40), 200);
  for (const bad of [NaN, Infinity, '', '  ', 'abc', null, undefined, true, {}]) {
    assert.equal(clampEmaLength(bad, 40), 40, `${String(bad)} should fall back`);
  }
});

test('saved lines restore what is usable and default the rest', () => {
  const defaults = EMA_DEFAULT_LINES.map((l) => ({ ...l }));
  assert.deepEqual(parseEmaLines(null), defaults);
  assert.deepEqual(parseEmaLines('junk'), defaults);
  assert.deepEqual(parseEmaLines([{ length: 9, on: false }]), [{ length: 9, on: false }, defaults[1], defaults[2]]);
  assert.deepEqual(
    parseEmaLines([{ length: '21' }, { on: 'yes', length: 1000 }, null, { length: 5, on: true }]),
    [
      { length: 21, on: true },
      { length: 200, on: true },
      defaults[2],
    ],
  );
  // A fresh copy, so the chart can never edit the defaults in place.
  const parsed = parseEmaLines(null);
  parsed[0].length = 99;
  assert.equal(EMA_DEFAULT_LINES[0].length, 13);
});
