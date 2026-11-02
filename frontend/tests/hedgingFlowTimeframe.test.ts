import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import {
  barIndexAt,
  hedgingFlowBarMinutes,
  hedgingFlowEndpoint,
  hedgingFlowTimeline,
  normalizeHedgingFlow,
} from '../core/hedgingFlowSeries.ts';

// The Hedging Flow page's 5 min / 1 min buttons.
//
// The flow chart can go to 1-minute bars while the structure chart under it
// stays on 5-minute bars, and Gamma Weather keeps reading 5-minute bars. Each
// way that goes wrong draws a believable page: a crosshair on the wrong bar,
// a minute plotted minutes away from its time on the shared axis, or Weather
// fed 1-minute bars its rules were never written for.

const HERE = path.dirname(new URL(import.meta.url).pathname);
const ROOT = path.join(HERE, '..');
const read = (p: string) => readFileSync(path.join(ROOT, p), 'utf8');

const DAY = '2026-11-02'; // EST: 09:30 ET is 14:30Z.

test('the 5-minute request is the one it has always been', () => {
  // Same URL, same API cache entry: the default view must not change at all.
  assert.equal(hedgingFlowEndpoint('SPY'), '/api/flow/hedging?symbol=SPY');
  assert.equal(
    hedgingFlowEndpoint('SPY', { timeframe: '5min', expirations: [DAY] }),
    `/api/flow/hedging?symbol=SPY&expirations=${DAY}`,
  );
  assert.equal(
    hedgingFlowEndpoint('SPX', { date: '2026-06-12', smoothing: 4 }),
    '/api/flow/hedging?symbol=SPX&date=2026-06-12&smoothing=4',
  );
});

test('the 1-minute request asks for timeframe=1min', () => {
  const url = new URL(hedgingFlowEndpoint('SPY', { timeframe: '1min', expirations: [DAY] }), 'http://x');
  assert.equal(url.searchParams.get('timeframe'), '1min');
  assert.equal(url.searchParams.get('expirations'), DAY);
  // No smoothing unless asked: the API's default follows the bar (15 bars on
  // 1-minute), and pinning the 5-minute default here would make it 3 minutes.
  assert.equal(url.searchParams.get('smoothing'), null);
});

test('the bar size comes from the payload, and an old payload is 5-minute', () => {
  assert.equal(hedgingFlowBarMinutes({ timeframe: '1min' }), 1);
  assert.equal(hedgingFlowBarMinutes({ timeframe: '5min' }), 5);
  assert.equal(hedgingFlowBarMinutes({}), 5);
  assert.equal(hedgingFlowBarMinutes(null), 5);
});

test('normalizeHedgingFlow keeps the timeframe', () => {
  const normalized = normalizeHedgingFlow({
    symbol: 'SPY',
    session: 'current',
    basis: 'aggressor_inferred',
    disclosure: 'Estimated, not observed.',
    timeframe: '1min',
    smoothing_bars: 15,
    bars: [],
    flips: [],
  });
  assert.equal(normalized?.timeframe, '1min');
});

test('both grids run 09:30 through the 16:15 bar, so the stacked charts share one time axis', () => {
  // The structure chart under the flow chart draws lines only, so its 82 bars
  // are points from the left edge (09:30) to the right edge (16:15). A
  // 1-minute grid over the same span puts each minute within a pixel of it; one
  // run on to 16:19 measured 9px off by the close.
  const five = hedgingFlowTimeline(DAY, 5);
  const one = hedgingFlowTimeline(DAY, 1);

  assert.equal(five.length, 82);
  assert.equal(one.length, 406);
  assert.equal(five[0], '2026-11-02T14:30:00.000Z');
  assert.equal(one[0], five[0]);
  assert.equal(five[five.length - 1], '2026-11-02T21:15:00.000Z');
  assert.equal(one[one.length - 1], five[five.length - 1]);

  // Each 5-minute bar starts on a minute the 1-minute grid has, five slots on.
  five.forEach((slot, i) => assert.equal(one[i * 5], slot));
});

test('barIndexAt finds the bar containing a time', () => {
  const five = hedgingFlowTimeline(DAY, 5);
  const one = hedgingFlowTimeline(DAY, 1);

  // Same grid: an exact match, as matching by position gave.
  assert.equal(barIndexAt(five, five[6]), 6);
  // A 1-minute crosshair at 10:03 sits on the 10:00 structure bar.
  assert.equal(five[barIndexAt(five, '2026-11-02T15:03:00.000Z')], '2026-11-02T15:00:00.000Z');
  // A 5-minute crosshair at 10:00 sits on the 10:00 minute.
  assert.equal(one[barIndexAt(one, '2026-11-02T15:00:00.000Z')], '2026-11-02T15:00:00.000Z');
  // The last minute is the last 5-minute bar, and so is anything after it.
  assert.equal(barIndexAt(five, one[one.length - 1]), five.length - 1);
  assert.equal(barIndexAt(five, '2026-11-02T21:19:00.000Z'), five.length - 1);
  // Before the open, unparseable or absent: no bar.
  assert.equal(barIndexAt(five, '2026-11-02T14:29:00.000Z'), -1);
  assert.equal(barIndexAt(five, 'not a time'), -1);
  assert.equal(barIndexAt(five, null), -1);
  assert.equal(barIndexAt([], five[0]), -1);
});

test('both stacked charts sync their crosshairs by time, not by position', () => {
  // Recharts' default matches bars by index. With 410 one-minute bars over 82
  // five-minute ones, index 30 is 10:00 on one chart and 12:00 on the other.
  for (const chart of ['components/HedgingFlowChart.tsx', 'components/GammaRegimeChart.tsx']) {
    assert.match(read(chart), /syncMethod=\{syncByBarTime\}/, `${chart} must sync by time`);
    assert.match(read(chart), /barIndexAt\(/, `${chart} must read the lifted hover by time`);
  }
});

test('the live page keeps Gamma Weather on 5-minute bars', () => {
  const page = read('app/hedging-flow/page.tsx');
  const panels = read('app/hedging-flow/HedgingFlowPanels.tsx');

  // The 5-minute series is always fetched; the 1-minute one only while shown.
  assert.match(page, /useHedgingFlow\(symbol, \{ expirations \}\)/);
  assert.match(page, /timeframe: '1min',\s*enabled: timeframe === '1min'/);
  // Weather reads `data`, the 5-minute series, never the chart's.
  assert.match(panels, /<GammaWeatherStrip[\s\S]*?flow=\{data\}/);
  assert.match(panels, /payload=\{chartData \?\? data\}/);
});

test('the dated page has no bar-size buttons', () => {
  // A past session is served from the 5-minute snapshot; 1-minute bars for it
  // exist only inside the retention window, so the permalink stays 5-minute.
  assert.doesNotMatch(read('app/hedging-flow/[symbol]/[date]/DatedHedgingFlow.tsx'), /onTimeframeChange/);
});
