/**
 * Liveness rules for the WebSocket quote stream (core/quoteStream.ts).
 *
 * WHY THIS EXISTS
 * ---------------
 * The stream runs a client-side stall watchdog: if no server frame arrives
 * within STALL_TIMEOUT_MS we assume the route died (browser TCP keepalive is
 * 2+ hours, so it will not tell us) and force a reconnect. During market
 * hours that window is fed for free — the server pushes a quote per symbol
 * about once a second. Outside market hours nothing ticks, so the ONLY thing
 * feeding it is our own ping/pong round-trip.
 *
 * The watchdog used to be fed by 'quote' frames alone, on the theory that a
 * pong would otherwise mask an ingestion-down state (API alive and ponging,
 * no NOTIFYs flowing). The cost of that was a permanent reconnect loop
 * whenever the market was shut: no quotes is the healthy, expected state of a
 * closed market, so the watchdog fired every 45 seconds all night and all
 * weekend, and every firing re-minted a ticket, reopened the socket and
 * re-subscribed — which replays the server's cached last tick. On the weekend
 * of 2026-09-12 that churn is what made the SPY header quote switch back and
 * forth between its after-hours rendering and its closed one, because the
 * replayed frame still carried Friday evening's session label.
 *
 * Ingestion-down was never this timer's problem to solve. hooks/useApiData.ts
 * keeps a per-symbol WS-live TTL (WS_SYMBOL_LIVE_TTL_MS) that demotes any
 * symbol which stops ticking back to full-rate HTTP polling within seconds,
 * whether or not the socket is open — which is precisely the
 * socket-open-but-silent case, handled without a reconnect. So the watchdog is
 * left with the one question it can actually answer: is the route up?
 *
 * Extracted as a pure, dependency-free module so it is unit-testable under
 * `node --experimental-strip-types` (mirrors core/liveQuoteOrdering.ts),
 * without pulling in WebSocket, timers, or the cache singleton.
 */

/** How often to ping when the server has gone quiet. */
export const PING_INTERVAL_MS = 15_000;

/** No route-proving frame within this window ⇒ treat the socket as dead. */
export const STALL_TIMEOUT_MS = 45_000;

/** Server frame types on the /ws wire contract (quote_broadcaster.py). */
export type ServerFrameType = 'quote' | 'welcome' | 'ack' | 'error' | 'pong';

/**
 * Whether a received frame proves the socket still reaches the API, and so
 * should reset the stall watchdog.
 *
 * True for:
 *   - 'quote' — a server-initiated push; the route carried it to us.
 *   - 'pong'  — the reply to our own ping. A full round-trip is the strongest
 *               proof of a live route there is, and it is the only proof
 *               available while the market is closed.
 *
 * False for:
 *   - 'ack'     — emitted in reply to our subscribe/unsubscribe. Reconnect
 *                 churn generates these itself, so counting them would let a
 *                 half-dead socket keep resetting its own watchdog.
 *   - 'welcome' — the connect handshake, already covered by arming the
 *                 watchdog on open.
 *   - 'error'   — the server may be reporting exactly the trouble the
 *                 watchdog should act on; never treat it as health.
 */
export function feedsStallWatchdog(frameType: string | null | undefined): boolean {
  return frameType === 'quote' || frameType === 'pong';
}

/**
 * Whether a HEALTHY but quiet socket survives the watchdog on pings alone.
 *
 * This is the invariant the closed-market reconnect loop violated, so it is
 * asserted rather than assumed. `pingIfIdle` skips a tick when a frame landed
 * within the last half-interval, so in the worst case a pong can be a full
 * interval late — two intervals must still fit inside the stall window, with
 * room for the round-trip itself.
 */
export function idlePingSustainsSocket(
  pingIntervalMs: number = PING_INTERVAL_MS,
  stallTimeoutMs: number = STALL_TIMEOUT_MS,
): boolean {
  return pingIntervalMs > 0 && pingIntervalMs * 2 < stallTimeoutMs;
}
