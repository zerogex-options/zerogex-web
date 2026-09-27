// Unit tests for the intraday time axis and the drawer's y-domain.
//
// Both of these are things a reader spots in a second and a test suite cannot
// see at all, so the rules behind them are pinned here.
//
// The time axis: Recharts' minTickGap picks evenly spaced *indices*. On a
// session that opens at 09:30 and prints every five minutes, that produced
// labels at 09:45, 10:15, 10:45 — the right cadence on the wrong phase. Two
// stacked charts that pick different starting indices then disagree about where
// 11:00 sits, which is exactly what the crosshair they share is supposed to
// guarantee they agree on.
//
// The y-domain: the structure panel's rule is symmetric about zero, which is
// right for every field where crossing zero is the story and wrong for Flip
// Cushion, which is absolute room before crossing and never prints below it.
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getFiveMinuteSessionTimeline,
  is30MinBoundary,
  isHourBoundary,
  isMajorTwoHourTick,
  onTimeTickGrid,
  safeTimeLabel,
} from '../core/flowSeriesCharts.ts';
import { nonNegativeDomain, robustDomain } from '../core/regimeDomain.ts';
import { niceAxisAround, niceTicksWithin } from '../components/phoneAxisFormat.ts';

// A summer session (EDT, UTC-4) and a winter one (EST, UTC-5). Both must tick
// on the ET clock, which is the reason the predicates read UTC minutes rather
// than formatting a zone.
const SUMMER = '2026-06-15';
const WINTER = '2026-01-14';

const labelsOn = (dateKey: string, every: 30 | 60 | 120): string[] =>
  getFiveMinuteSessionTimeline(dateKey)
    .filter((ts) => onTimeTickGrid(ts, every))
    .map(safeTimeLabel);

test('a session ticks on the half hour, not on every sixth bar', () => {
  const labels = labelsOn(SUMMER, 30);
  // 09:30 through 16:00, which is what the reader expects to be able to read
  // off the axis without doing arithmetic.
  assert.deepEqual(labels, [
    '09:30', '10:00', '10:30', '11:00', '11:30', '12:00', '12:30',
    '13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00',
  ]);
  // The bug this replaces: nothing lands on :15 or :45.
  assert.equal(labels.some((l) => l.endsWith(':15') || l.endsWith(':45')), false);
});

test('the hourly and 2-hourly cadences are subsets of the half-hourly one', () => {
  const half = new Set(labelsOn(SUMMER, 30));
  const hourly = labelsOn(SUMMER, 60);
  const major = labelsOn(SUMMER, 120);

  assert.deepEqual(hourly, ['10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00']);
  assert.deepEqual(major, ['10:00', '12:00', '14:00', '16:00']);

  // Every label must sit on a gridline, or a phone shows a clock with nothing
  // under it. The gridline builder draws at 30 or 60, so both thinner cadences
  // have to be contained in those slots.
  for (const l of hourly) assert.equal(half.has(l), true, `${l} is not a half-hour slot`);
  for (const l of major) assert.equal(hourly.includes(l), true, `${l} is not an hour slot`);
});

test('the ET clock is followed across the daylight-saving boundary', () => {
  // Same wall-clock labels in January and June, despite a one-hour shift in
  // the underlying UTC timestamps.
  assert.deepEqual(labelsOn(WINTER, 30), labelsOn(SUMMER, 30));
  assert.deepEqual(labelsOn(WINTER, 120), ['10:00', '12:00', '14:00', '16:00']);
});

test('the boundary predicates reject the bars in between', () => {
  const bars = getFiveMinuteSessionTimeline(SUMMER);
  const at = (label: string) => bars.find((ts) => safeTimeLabel(ts) === label)!;

  assert.equal(is30MinBoundary(at('10:30')), true);
  assert.equal(is30MinBoundary(at('10:35')), false);
  assert.equal(isHourBoundary(at('11:00')), true);
  assert.equal(isHourBoundary(at('11:30')), false);
  assert.equal(isMajorTwoHourTick(at('12:00')), true);
  assert.equal(isMajorTwoHourTick(at('13:00')), false);

  // A timestamp the axis cannot parse must simply carry no label rather than
  // throwing inside a Recharts render.
  for (const every of [30, 60, 120] as const) {
    assert.equal(onTimeTickGrid('nonsense', every), false);
    assert.equal(onTimeTickGrid('', every), false);
  }
});

test('flip cushion gets the whole panel height, not the top half of it', () => {
  // Absolute room before crossing: a real session of it, none of it negative.
  const cushion = [42, 38, 31, 27, 19, 22, 30, 44];
  const [lo, hi] = nonNegativeDomain(cushion);

  assert.equal(lo, 0, 'zero is the boundary and stays on the axis');
  assert.ok(hi > 44, 'the largest reading must fit');
  // The symmetric rule would have spent half the panel on a mirror image the
  // series can never reach, halving the room given to the distance to zero.
  const symmetric = robustDomain(cushion.map((v) => ({ stability: v, lean: null })));
  assert.ok(hi - lo < symmetric.domain[1] - symmetric.domain[0]);
});

test('a non-negative domain survives an empty, all-null or signed series', () => {
  assert.deepEqual(nonNegativeDomain([]), [0, 1]);
  assert.deepEqual(nonNegativeDomain([null, undefined, NaN, Infinity]), [0, 1]);

  // Defensive: if the field ever turned out to be signed, clipping the negative
  // half at zero would drop readings off the chart without a word.
  const [lo, hi] = nonNegativeDomain([-12, 5, 30]);
  assert.ok(lo < -12, 'a negative reading must stay inside the domain');
  assert.ok(hi > 30);
});

test('y ticks are numbers a reader can hold in their head', () => {
  // The clipped structure domain that produced "-$229.8M, -$79.8M, $70.2M".
  const ticks = niceTicksWithin(-229_800_000, 229_800_000, 4);
  assert.ok(ticks.length >= 3, 'the axis must still carry gridlines');
  assert.ok(ticks.includes(0), 'zero is the reading on this panel and must be labeled');
  for (const t of ticks) {
    assert.ok(t % 50_000_000 === 0, `${t} is not a round step`);
    assert.ok(t >= -229_800_000 && t <= 229_800_000, `${t} is outside the domain`);
  }

  // Points, not dollars: the cushion axis has to round just as well two orders
  // of magnitude down.
  const pts = niceTicksWithin(...nonNegativeDomain([42, 38, 19, 44]), 4);
  assert.ok(pts.includes(0));
  for (const t of pts) assert.ok(t % 10 === 0, `${t} is not a round step`);
});

test('rounding an axis outward never clips what it plots', () => {
  // The pressure panel's own extent, which Recharts labeled "-$1.30B,
  // -$650.0M, $0". Tidying those labels must not move the line.
  const axis = niceAxisAround(-1_300_000_000, 1_300_000_000, 5)!;
  assert.ok(axis.domain[0] <= -1_300_000_000, 'the lowest reading must fit');
  assert.ok(axis.domain[1] >= 1_300_000_000, 'the highest reading must fit');
  assert.ok(axis.ticks.includes(0), 'zero is the reading on this panel');
  for (const t of axis.ticks) assert.ok(t % 100_000_000 === 0, `${t} is not a round step`);

  // The domain must not be inflated to get there: one tick step of slack at
  // each end at most, or the series is flattened in exchange for tidy labels.
  const step = axis.ticks[1] - axis.ticks[0];
  assert.ok(axis.domain[1] - 1_300_000_000 < step);
  assert.ok(-1_300_000_000 - axis.domain[0] < step);
});

test('an outward-rounded axis holds every extent it is handed', () => {
  // Across seven orders of magnitude, one-sided and straddling alike.
  const extents: [number, number][] = [
    [0, 1], [0, 7], [-3, 3], [-0.004, 0.017], [12, 4821],
    [-9.4e6, 1.1e6], [0, 3.7e9], [-8.88e9, -1.2e9], [1e-3, 2e-3],
  ];
  for (const [lo, hi] of extents) {
    const axis = niceAxisAround(lo, hi, 5);
    assert.ok(axis, `no axis for [${lo}, ${hi}]`);
    assert.ok(axis.domain[0] <= lo, `[${lo}, ${hi}] clipped at the bottom`);
    assert.ok(axis.domain[1] >= hi, `[${lo}, ${hi}] clipped at the top`);
    assert.ok(axis.ticks.length >= 2, `[${lo}, ${hi}] has no gridlines`);
    assert.equal(axis.ticks[0], axis.domain[0]);
    assert.equal(axis.ticks[axis.ticks.length - 1], axis.domain[1]);
    // Evenly spaced, or the gridlines lie about the scale.
    const step = axis.ticks[1] - axis.ticks[0];
    for (let i = 1; i < axis.ticks.length; i++) {
      assert.ok(Math.abs(axis.ticks[i] - axis.ticks[i - 1] - step) < step * 1e-6);
    }
  }

  // Nothing to scale: the caller passes over a null and Recharts keeps its own
  // behavior rather than being handed a one-tick axis.
  assert.equal(niceAxisAround(5, 5), null);
  assert.equal(niceAxisAround(3, 1), null);
  assert.equal(niceAxisAround(NaN, 1), null);
});
