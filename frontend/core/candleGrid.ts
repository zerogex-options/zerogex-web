/**
 * Where a candle starts, for candles the chart builds itself from 1-minute
 * bars (the API serves 1, 5 and 15 minutes, an hour and a day; the Fuseline
 * Radar's 4-minute candle is built in the browser).
 *
 * Candles are counted from the instrument's session open, the way charting
 * platforms count them, so a 4-minute candle here starts at the same minute as
 * one on the trader's own chart:
 *
 * - Cash symbols (SPX, SPY, QQQ ...) count from the 09:30 ET open: 09:30,
 *   09:34, 09:38 ...
 * - Futures (ES, NQ) count from the 18:00 ET open the evening before. 18:00 is
 *   a whole hour, so their candles sit on the plain clock grid: 09:28, 09:32 ...
 *
 * An hour is a whole number of 4-minute steps, so the offset is the same in
 * summer and winter time. Pure; every instant is passed in.
 */

const MINUTE_MS = 60_000;
const CASH_OPEN_MINUTES = 9 * 60 + 30;

/**
 * How far the candle grid sits off the plain UTC clock grid, in ms. Zero for
 * futures; for cash symbols, the 09:30 open's remainder on the grid.
 */
export function candleGridOffsetMs(minutes: number, futures: boolean): number {
  if (futures || !(minutes > 0) || minutes >= 60) return 0;
  return (CASH_OPEN_MINUTES % minutes) * MINUTE_MS;
}

/** The start of the candle that the instant `ms` falls in. */
export function candleStartMs(ms: number, minutes: number, offsetMs = 0): number {
  const size = minutes * MINUTE_MS;
  return Math.floor((ms - offsetMs) / size) * size + offsetMs;
}
