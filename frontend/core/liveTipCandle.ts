// Lays the live price onto the Gamma Terminal's newest candle, every tick.
//
// The candles come from /api/market/historical, polled once a second; the
// price comes from the WebSocket (or its 1 s HTTP fallback) and moves first.
// Inside the newest candle's bucket the price extends that candle: it becomes
// the close and widens the high or low. History stays authoritative and the
// next candle poll replaces the patched candle with the stored one.
//
// When a new bucket starts, the price moves into it before any candle poll
// can have seen it, and the chart used to hold the old candle until one did:
// at every new minute the candles stood still while the price moved. Now a
// tick in the bucket right after the newest candle opens that bucket's candle
// from the tick's own minute bar, so the candle appears the second its minute
// begins; the stored bar replaces it on the next poll. A tick any further
// ahead (overnight, a gap in the feed) is left to history, and the caller
// decides whether a new candle may open at all (intraday buckets, inside the
// symbol's trading hours: the same hours the historical bars are filtered to).
//
// Kept free of browser and React APIs so it is unit-testable under
// `node --experimental-strip-types` (tests/liveTipCandle.test.ts).

export interface Candle {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  upVolume: number;
  downVolume: number;
}

export interface LiveTick {
  /** The latest price. */
  close: number | null | undefined;
  /** Start of the 1-minute bar the price belongs to (minute-aligned). */
  timestamp: string | null | undefined;
  /** That minute bar's open, high and low, when known. */
  open?: number | null;
  high?: number | null;
  low?: number | null;
}

function finite(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/**
 * `bars` with the live tick laid on. Returns `bars` itself (same reference)
 * when nothing changes, so a memo built on it does not recompute.
 */
export function overlayLiveTick<T extends Candle>(
  bars: T[],
  tick: LiveTick,
  bucketMs: number,
  canOpenNext: boolean,
): T[] {
  if (bars.length === 0 || !finite(tick.close) || !(bucketMs > 0)) return bars;
  const price = tick.close;
  const tip = bars[bars.length - 1];
  const tipStartMs = new Date(tip.timestamp).getTime();
  const tickMs = tick.timestamp ? new Date(tick.timestamp).getTime() : NaN;
  if (!Number.isFinite(tipStartMs) || !Number.isFinite(tickMs)) return bars;
  const tipEndMs = tipStartMs + bucketMs;

  if (tickMs >= tipStartMs && tickMs < tipEndMs) {
    if (price === tip.close) return bars;
    const patched = bars.slice();
    patched[patched.length - 1] = {
      ...tip,
      close: price,
      high: Math.max(tip.high, price),
      low: Math.min(tip.low, price),
    };
    return patched;
  }

  if (canOpenNext && tickMs >= tipEndMs && tickMs < tipEndMs + bucketMs) {
    const open = finite(tick.open) ? tick.open : price;
    const next = {
      ...tip,
      timestamp: new Date(tipEndMs).toISOString(),
      open,
      high: Math.max(finite(tick.high) ? tick.high : price, open, price),
      low: Math.min(finite(tick.low) ? tick.low : price, open, price),
      close: price,
      volume: 0,
      upVolume: 0,
      downVolume: 0,
    };
    return [...bars, next];
  }

  return bars;
}
