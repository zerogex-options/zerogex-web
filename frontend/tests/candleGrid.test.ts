// The 4-minute candle is built in the browser from 1-minute bars, so where
// each candle starts is ours to get right. It has to start on the same minute
// as the trader's own 4-minute chart, or the radar and the Fuse chart disagree
// about which candle a move happened in.
import test from 'node:test';
import assert from 'node:assert/strict';

import { candleGridOffsetMs, candleStartMs } from '../core/candleGrid.ts';

const et = (iso: string) => Date.parse(iso);
const hhmm = (ms: number, offset: string) =>
  new Date(ms + (offset === '-04:00' ? -4 : -5) * 3600_000).toISOString().slice(11, 16);

for (const [season, day, offset] of [
  ['summer', '2026-10-29', '-04:00'],
  ['winter', '2026-12-01', '-05:00'],
] as const) {
  test(`SPX 4-minute candles count from the 09:30 open (${season})`, () => {
    const off = candleGridOffsetMs(4, false);
    const at = (t: string) => hhmm(candleStartMs(et(`${day}T${t}:00${offset}`), 4, off), offset);
    assert.equal(at('09:30'), '09:30');
    assert.equal(at('09:33'), '09:30');
    assert.equal(at('09:34'), '09:34');
    assert.equal(at('15:59'), '15:58');
  });

  test(`ES 4-minute candles count from the 18:00 futures open (${season})`, () => {
    const off = candleGridOffsetMs(4, true);
    const at = (t: string) => hhmm(candleStartMs(et(`${day}T${t}:00${offset}`), 4, off), offset);
    assert.equal(at('09:30'), '09:28');
    assert.equal(at('09:32'), '09:32');
    assert.equal(at('18:00'), '18:00');
  });
}

test('the API\'s own intervals keep the plain clock grid', () => {
  assert.equal(candleGridOffsetMs(5, false), 0);
  assert.equal(candleGridOffsetMs(15, false), 0);
  assert.equal(candleGridOffsetMs(60, false), 0);
});
