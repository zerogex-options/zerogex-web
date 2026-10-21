// Unit tests for the Flow Analysis page's session read (frontend/core/flowAnalysis.ts).
//
// The contract: bought and sold come out of a volume and a bought-minus-sold
// position as integers that sum to the volume; the bars are oldest first with
// the not-yet-written open bar dropped; the bullish and bearish sides net to
// the feed's own net flow; the regime calls a lean only when both measures
// agree and are big enough; the flow log lists turns (not wobbles) newest
// first with markers numbered oldest first.
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  BURST_LIMIT,
  bearishSide,
  bullishSide,
  buildFlowBars,
  buildFlowEvents,
  flowRead,
  flowRegime,
  fmtContracts,
  fmtContractsCompact,
  fmtShare,
  fmtUsdCompact,
  paneLayout,
  sideTotal,
  splitSides,
  valueDomain,
  type FlowRowLike,
} from '../core/flowAnalysis.ts';
import { sortFlowRowsOldestFirst } from '../core/flowSeriesCharts.ts';

test('bought and sold split a volume exactly, whatever the rounding', () => {
  assert.deepEqual(splitSides(1000, 200), { bought: 600, sold: 400 });
  assert.deepEqual(splitSides(1000, -1000), { bought: 0, sold: 1000 });
  assert.deepEqual(splitSides(3, 0), { bought: 2, sold: 1 }, 'an odd volume still sums');
  for (const [v, p] of [[7, 3], [7, -3], [1, 1], [12345, -6789], [0, 0]]) {
    const { bought, sold } = splitSides(v, p);
    assert.equal(bought + sold, v, `sums for ${v}/${p}`);
    assert.ok(bought >= 0 && sold >= 0);
  }
  assert.deepEqual(splitSides(100, 250), { bought: 100, sold: 0 }, 'a position past the volume is clamped');
  assert.deepEqual(splitSides(-5, 0), { bought: 0, sold: 0 });
});

const T0 = Date.parse('2026-10-15T13:30:00Z'); // 09:30 ET
const at = (i: number, minutes = 5) => new Date(T0 + i * minutes * 60_000).toISOString().replace('.000Z', 'Z');

/** A row from per-side session totals, the way the backend builds one. */
function row(
  i: number,
  cb: number,
  cs: number,
  pb: number,
  ps: number,
  opts: { callPrem?: number; putPrem?: number; price?: number; minutes?: number } = {},
): FlowRowLike {
  const callVol = cb + cs;
  const putVol = pb + ps;
  const callPos = cb - cs;
  const putPos = pb - ps;
  const callPrem = opts.callPrem ?? callPos * 250;
  const putPrem = opts.putPrem ?? putPos * 280;
  return {
    timestamp: at(i, opts.minutes),
    call_premium_cum: callPrem,
    put_premium_cum: putPrem,
    call_volume_cum: callVol,
    put_volume_cum: putVol,
    net_volume_cum: callPos - putPos,
    raw_volume_cum: callVol + putVol,
    call_position_cum: callPos,
    put_position_cum: putPos,
    net_premium_cum: callPrem - putPrem,
    put_call_ratio: callVol > 0 ? putVol / callVol : null,
    underlying_price: opts.price ?? 660 + i * 0.1,
  };
}

test('bars come out oldest first, from newest-first rows, with per-bar sides', () => {
  const rows = [row(2, 600, 400, 500, 520), row(0, 100, 80, 90, 110), row(1, 300, 240, 260, 300)];
  const bars = buildFlowBars(rows);
  assert.deepEqual(bars.map((b) => b.ms), [T0, T0 + 300_000, T0 + 600_000]);
  assert.deepEqual(bars[0].bar, { callsBought: 100, callsSold: 80, putsBought: 90, putsSold: 110 }, 'the first bar is its own totals');
  assert.deepEqual(bars[2].bar, { callsBought: 300, callsSold: 160, putsBought: 240, putsSold: 220 });
  assert.deepEqual(bars[2].cum, { callsBought: 600, callsSold: 400, putsBought: 500, putsSold: 520 });
  // The per-bar counts add back up to the session totals.
  const summed = bars.reduce((s, b) => s + sideTotal(b.bar), 0);
  assert.equal(summed, sideTotal(bars[2].cum));
});

test('the bullish and bearish sides net to the feed’s own net flow', () => {
  const [b] = buildFlowBars([row(0, 1200, 800, 700, 900)]);
  assert.equal(bullishSide(b.cum), 1200 + 900);
  assert.equal(bearishSide(b.cum), 700 + 800);
  assert.equal(bullishSide(b.cum) - bearishSide(b.cum), b.netFlow);
});

test('a just-opened bar the backend has not written yet is dropped, not plotted as zero', () => {
  const zeroed: FlowRowLike = { ...row(3, 0, 0, 0, 0), put_call_ratio: null };
  const bars = buildFlowBars([row(0, 100, 80, 90, 110), row(1, 300, 240, 260, 300), row(2, 600, 400, 500, 520), zeroed]);
  assert.equal(bars.length, 3);
  assert.equal(bars[bars.length - 1].ms, T0 + 600_000);
  // A quiet bar (no new volume) is a real bar and stays.
  const quiet = buildFlowBars([row(0, 100, 80, 90, 110), row(1, 100, 80, 90, 110)]);
  assert.equal(quiet.length, 2);
  assert.deepEqual(quiet[1].bar, { callsBought: 0, callsSold: 0, putsBought: 0, putsSold: 0 });
});

test('duplicate timestamps keep the last row; unparseable ones are dropped', () => {
  const bars = buildFlowBars([row(0, 100, 80, 90, 110), { ...row(0, 120, 80, 90, 110) }, { ...row(1, 1, 1, 1, 1), timestamp: 'nope' }]);
  assert.equal(bars.length, 1);
  assert.equal(bars[0].cum.callsBought, 120);
});

test('the read: totals, sides, the latest bar and the regime', () => {
  const read = flowRead(buildFlowBars([row(0, 1000, 800, 900, 1000), row(1, 2600, 1800, 2000, 2400)]));
  assert.ok(read);
  assert.equal(read!.totalVolume, 2600 + 1800 + 2000 + 2400);
  assert.deepEqual(read!.last, { callsBought: 1600, callsSold: 1000, putsBought: 1100, putsSold: 1400 });
  assert.equal(read!.lastVolume, 5100);
  assert.equal(read!.bullish - read!.bearish, read!.netFlow);
  assert.equal(read!.regime, 'riskOn');
  assert.equal(flowRead([]), null);
});

test('the regime calls a lean only when premium and contracts agree and are big enough', () => {
  assert.equal(flowRegime(5e6, 8e6, 3e6, 40_000, 1_000_000).regime, 'riskOn');
  assert.equal(flowRegime(-5e6, -2e6, 3e6, -40_000, 1_000_000).regime, 'riskOff');
  const split = flowRegime(5e6, 8e6, 3e6, -40_000, 1_000_000);
  assert.equal(split.regime, 'twoWay');
  assert.equal(split.detail, 'premium leans bullish, contracts bearish');
  // Under 5% of the premium and under 1% of the volume: no lean either way.
  assert.equal(flowRegime(0.3e6, 10e6, 9.7e6, 5_000, 1_000_000).detail, 'no clear lean either way');
  // A big premium lean with a sliver of agreeing contracts still counts.
  assert.equal(flowRegime(5e6, 8e6, 3e6, 100, 1_000_000).regime, 'riskOn');
});

// A session that starts bullish, sells off hard enough from bar 10 for the
// running total to turn bearish, then buys back from bar 20 until it turns
// bullish again, on 5-minute bars.
function swingSession(): FlowRowLike[] {
  const rows: FlowRowLike[] = [];
  let cb = 0, cs = 0, pb = 0, ps = 0;
  for (let i = 0; i < 30; i += 1) {
    const lean = i < 10 ? 120 : i < 20 ? -300 : 400;
    cb += 1000 + lean;
    cs += 1000 - lean;
    pb += 1000 - lean;
    ps += 1000 + lean;
    rows.push(row(i, cb, cs, pb, ps));
  }
  return rows;
}

test('the flow log: turns newest first, markers numbered oldest first', () => {
  const events = buildFlowEvents(buildFlowBars(swingSession()), 5);
  const turns = events.filter((e) => e.kind === 'flowTurn');
  assert.equal(turns.length, 2, `expected two turns, got ${turns.length}`);
  assert.equal(turns[turns.length - 1].title, 'Net flow turned bearish');
  assert.equal(turns[0].title, 'Net flow turned bullish');
  for (let i = 1; i < events.length; i += 1) {
    assert.ok(events[i - 1].ms >= events[i].ms, 'newest first');
    assert.equal(events[i - 1].marker, events[i].marker + 1, 'markers count down the list');
  }
  assert.equal(events[events.length - 1].marker, 1);
});

test('a total wobbling across zero by a few contracts lists nothing', () => {
  const rows: FlowRowLike[] = [];
  let cb = 0, cs = 0, pb = 0, ps = 0;
  for (let i = 0; i < 40; i += 1) {
    const wobble = i % 2 === 0 ? 3 : -3;
    cb += 1000 + wobble;
    cs += 1000 - wobble;
    pb += 1000;
    ps += 1000;
    rows.push(row(i, cb, cs, pb, ps, { callPrem: 0, putPrem: 0 }));
  }
  const events = buildFlowEvents(buildFlowBars(rows), 5);
  assert.equal(events.filter((e) => e.kind === 'flowTurn' || e.kind === 'premiumTurn').length, 0);
});

test('nothing is called in the first ten minutes', () => {
  const rows = [row(0, 100, 50, 50, 100), row(1, 150, 200, 260, 120), row(2, 400, 200, 200, 420)];
  const events = buildFlowEvents(buildFlowBars(rows), 5);
  assert.ok(events.every((e) => new Date(e.ms).getUTCMinutes() >= 40 || new Date(e.ms).getUTCHours() > 13));
});

test('put/call crossing 1 is called once it clears the band', () => {
  const rows: FlowRowLike[] = [];
  let calls = 0, puts = 0;
  for (let i = 0; i < 24; i += 1) {
    calls += 1000;
    puts += i < 12 ? 1300 : 300;
    rows.push(row(i, calls / 2, calls / 2, puts / 2, puts / 2));
  }
  const events = buildFlowEvents(buildFlowBars(rows), 5).filter((e) => e.kind === 'pcrCross');
  assert.equal(events.length, 1);
  assert.equal(events[0].title, 'Put/call fell below 1');
  assert.equal(events[0].tone, 'bullish');
});

test('bursts: a bar far over the last hour’s median, the biggest few only', () => {
  const rows: FlowRowLike[] = [];
  let cb = 0, cs = 0, pb = 0, ps = 0;
  for (let i = 0; i < 60; i += 1) {
    const size = i % 6 === 5 ? 9000 : 1000;
    cb += size * 0.4;
    cs += size * 0.1;
    pb += size * 0.25;
    ps += size * 0.25;
    rows.push(row(i, cb, cs, pb, ps));
  }
  const bursts = buildFlowEvents(buildFlowBars(rows), 5).filter((e) => e.kind === 'burst');
  assert.equal(bursts.length, BURST_LIMIT);
  assert.equal(bursts[0].tone, 'bullish', 'calls bought and puts sold lead the bar');
  assert.match(bursts[0].detail ?? '', /× the last hour · 65% bullish side/);
});

test('panes share the height by weight and end flush', () => {
  const bands = paneLayout(['price', 'premium', 'contracts', 'pcr'], 20, 400, 10);
  assert.equal(bands.length, 4);
  assert.equal(bands[0].top, 20);
  const last = bands[bands.length - 1];
  assert.equal(last.top + last.height, 420);
  assert.ok(bands[0].height > bands[1].height && bands[1].height > bands[3].height, 'price > premium > put/call');
  const two = paneLayout(['premium', 'pcr'], 0, 300, 10);
  assert.equal(two[1].top + two[1].height, 300);
  assert.deepEqual(paneLayout([], 0, 300, 10), []);
});

test('value windows pad, and take in a nearby anchor', () => {
  const d = valueDomain([0.9, 1.3], 1)!;
  assert.ok(d.min < 0.9 && d.max > 1.3);
  const far = valueDomain([3, 4], 1)!;
  assert.ok(far.min > 1, 'an anchor far outside is left off-scale');
  const flat = valueDomain([5, 5])!;
  assert.ok(flat.max > flat.min, 'a flat series still gets a window');
  const pcr = valueDomain([1.12, 1.14], 1, 0.12, 0.2)!;
  assert.ok(pcr.max - pcr.min >= 0.2, 'a near-flat ratio keeps a minimum span, so it draws flat');
  assert.ok(pcr.min <= 1, 'and the line at 1 comes into view');
  assert.equal(valueDomain([]), null);
});

test('formatting', () => {
  assert.equal(fmtUsdCompact(12_400_000, true), '+$12.4M');
  assert.equal(fmtUsdCompact(-860_000), '-$860K');
  assert.equal(fmtUsdCompact(3_100_000_000, true), '+$3.10B');
  assert.equal(fmtUsdCompact(null), '—');
  assert.equal(fmtContracts(238410), '238,410');
  assert.equal(fmtContracts(-20540, true), '-20,540');
  assert.equal(fmtContracts(64190, true), '+64,190');
  assert.equal(fmtContractsCompact(238_410), '238K');
  assert.equal(fmtContractsCompact(-3_400_000), '-3.4M');
  assert.equal(fmtShare(58, 100), '58%');
  assert.equal(fmtShare(1, 0), '—');
});

test('rows sort oldest first', () => {
  const sorted = sortFlowRowsOldestFirst([{ timestamp: at(2) }, { timestamp: at(0) }, { timestamp: 'bad' }, { timestamp: at(1) }]);
  assert.deepEqual(sorted.map((r) => r.timestamp), ['bad', at(0), at(1), at(2)]);
});
