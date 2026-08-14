/**
 * Ordering guard for the shared live-quote cache (hooks/useApiData.ts).
 *
 * WHY THIS EXISTS
 * ---------------
 * The Price Action candlestick chart paints the tip candle's close from
 * `quote.close` in `marketQuoteCache`. That cache is fed by the WebSocket
 * quote stream via `applyLiveQuote()`, which used to apply every frame
 * unconditionally — last-writer-wins. But WebSocket quote frames can reach
 * the browser OUT OF ORDER:
 *
 *   1. Fan-out interleaving. The API worker schedules each `NOTIFY` tick's
 *      fan-out as an independent asyncio task with `await` points before the
 *      `send_text` (QuoteBroadcaster._on_notify → _fanout). Two adjacent 1 Hz
 *      ticks can therefore hit the socket in the wrong order.
 *   2. Subscribe-snapshot replay. On every (re)subscribe the server replays
 *      the last cached tick (`_latest[symbol]`, carrying an OLDER server_ts)
 *      as a `quote` frame. It can land AFTER a fresher tick that was already
 *      in flight.
 *
 * Applying an older frame rewinds the tip candle one step; the next in-order
 * frame then jumps it forward again. That back-and-forth is the "quotes
 * jumping" the chart exhibited — a value updates, reverts to a moment ago,
 * then jumps back.
 *
 * THE KEY
 * -------
 * Every `quote` frame carries `server_ts` — the API worker's wall-clock
 * emission stamp (`time.time()` in QuoteBroadcaster._fanout). A browser
 * socket is pinned to a single worker for its lifetime and workers are
 * NTP-synced, so `server_ts` is monotonic across the frames one client
 * receives. We drop any frame that is not strictly newer than the last one
 * we applied, so the displayed price only ever moves forward in emission
 * time. `applyLiveQuote` re-baselines the last-applied stamp on every socket
 * (re)connect (see resetLiveQuoteOrdering) so a reconnect that lands on a
 * differently-clocked worker starts a clean ordering epoch instead of
 * freezing.
 *
 * Extracted as a pure, dependency-free module so it is unit-testable under
 * `node --experimental-strip-types` (mirrors core/delayedQuote.ts), without
 * pulling in React or the cache singleton.
 */

/**
 * Decide whether an incoming live-quote frame supersedes the last one applied.
 *
 * @param lastServerTs   server_ts of the last frame we applied for this symbol,
 *                       or null when none has been applied yet (fresh symbol or
 *                       just-reconnected epoch).
 * @param incomingServerTs server_ts carried by the incoming frame, or null when
 *                       the frame carries no ordering stamp.
 * @returns true when the frame should be applied; false when it is a stale or
 *          duplicate frame that must be dropped.
 *
 * Rules, in order:
 *   - No incoming stamp → apply. Absence of an ordering signal must never
 *     freeze the stream; we fall back to the previous last-writer-wins
 *     behaviour (also keeps us compatible with any server that omits
 *     server_ts).
 *   - No baseline yet → apply, and the caller adopts this frame's stamp as the
 *     new baseline.
 *   - Otherwise apply iff strictly newer. Equal stamps are duplicates (the
 *     same tick re-delivered, e.g. a subscribe-snapshot replay of the frame we
 *     just showed) and are dropped; older stamps are reordered frames and are
 *     dropped.
 */
export function isFresherServerTs(
  lastServerTs: number | null | undefined,
  incomingServerTs: number | null | undefined,
): boolean {
  if (incomingServerTs == null || !Number.isFinite(incomingServerTs)) return true;
  if (lastServerTs == null || !Number.isFinite(lastServerTs)) return true;
  return incomingServerTs > lastServerTs;
}
