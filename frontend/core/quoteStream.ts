/**
 * Browser-side singleton that manages the WebSocket connection to the
 * FastAPI /ws quote stream and feeds ticks into the shared
 * `marketQuoteCache` in `hooks/useApiData.ts`.
 *
 * Architecture:
 *
 *   useMarketQuote(symbol)         // dashboard, header, gex page…
 *     └── marketQuoteCache          // module-level Map<symbol, entry>
 *          └── entry.listeners       // Set<() => void>
 *
 *   quoteStream (this module)
 *     └── ws?  ← ?ticket=<jwt>
 *     └── subscribedSymbols: Set<string>
 *     └── on 'quote' frame:
 *          applyLiveQuote(symbol, quote)   // <-- exposed by useApiData.ts
 *          which writes into the entry and calls entry.listeners.forEach()
 *
 * This means:
 *   1. NO existing consumer of useMarketQuote has to change — all
 *      dashboard, gex, greeks, live-bulletin, options-calculator, etc.
 *      pages automatically receive live pushes.
 *   2. When WS is connected, the shared cache's HTTP poll is paused
 *      (through the same `applyLiveQuote` call marking the entry live);
 *      when the socket drops or the feature flag is off, polling
 *      transparently resumes.
 *   3. All subscribers land on the same `listeners.forEach()` sync
 *      call — React batches every downstream setState into ONE commit,
 *      so the header price, the price card, the GEX profile spot line,
 *      and the candle overlay update in a single paint (in perfect
 *      synchronization, as requested).
 *
 * Reconnect policy: jittered exponential backoff, 1s → 30s cap, with a
 * ticket refresh on every reconnect (tickets have a 60s TTL, so a long
 * disconnect must re-mint before reopening).
 */

'use client';

import type { LiveQuoteIncoming } from '@/hooks/useApiData';
import { applyLiveQuote, setLiveStreamActive } from '@/hooks/useApiData';

// ---------- feature flag & config ----------

function isEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  const flag = (process.env.NEXT_PUBLIC_ENABLE_WEBSOCKET ?? '').trim().toLowerCase();
  return flag === '1' || flag === 'true' || flag === 'yes';
}

const TICKET_ENDPOINT = '/api/ws/ticket';

// Reconnect backoff — jittered exponential; capped so a long network
// outage doesn't leave us waiting for an hour after connectivity
// returns.
const BACKOFF_MIN_MS = 1_000;
const BACKOFF_MAX_MS = 30_000;

// Client-side liveness watchdog. If no server frame in this window we
// treat the socket as dead and force a reconnect — TCP keepalive is
// usually 2+ hours in the browser so we can't rely on it detecting a
// dropped route between us and the API. Server sends at least the
// per-symbol quote once a second during market hours; we ping to keep
// this true during closed markets too.
const PING_INTERVAL_MS = 15_000;
const STALL_TIMEOUT_MS = 45_000;

// Types matching the server-side JSON wire contract in
// src/api/quote_broadcaster.py::QuoteBroadcaster._fanout.
type ServerFrame =
  | { type: 'quote'; symbol: string } & QuoteFrame
  | { type: 'welcome'; symbols_allowed?: string[]; max_subs_per_conn?: number }
  | { type: 'ack'; op: 'subscribe' | 'unsubscribe'; symbols: string[] }
  | { type: 'error'; code: string; detail: string }
  | { type: 'pong'; client_ts?: number };

interface QuoteFrame {
  timestamp: string;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
  volume?: number | null;
  up_volume?: number | null;
  down_volume?: number | null;
  session?: string | null;
  server_ts?: number;
}

// ---------- singleton state ----------

class QuoteStream {
  private ws: WebSocket | null = null;
  // The set of symbols we WANT subscribed. Anything in here that the
  // socket hasn't confirmed is (re)sent on every connect.
  private desiredSymbols = new Set<string>();
  // Refcount per symbol so multiple useMarketQuote consumers of the
  // same symbol only add/remove the subscription when the last one
  // detaches.
  private refCounts = new Map<string, number>();

  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempt = 0;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private stallTimer: ReturnType<typeof setTimeout> | null = null;

  private stopped = false;
  private connecting = false;
  private lastMessageAt = 0;

  // ---------- public API (consumed by useMarketQuote's live-mode wiring) ----------

  /**
   * Register interest in `symbol`. If the socket is connected the
   * subscription goes out immediately; otherwise it queues for the
   * next connect. Returns an unsubscribe function that decrements the
   * refcount and removes the sub only when the last caller detaches.
   *
   * Also clears the ``stopped`` latch so an acquire after a pagehide
   * (which we now use for bfcache-safe suspend) reactivates the
   * stream instead of no-op-ing forever.
   */
  acquire(symbol: string): () => void {
    if (!isEnabled()) return () => undefined;
    const sym = symbol.trim().toUpperCase();
    if (!sym) return () => undefined;

    if (this.stopped) this.stopped = false;

    const next = (this.refCounts.get(sym) ?? 0) + 1;
    this.refCounts.set(sym, next);
    if (next === 1) {
      this.desiredSymbols.add(sym);
      this.sendSubscribe([sym]);
      this.ensureConnection();
    }

    let released = false;
    return () => {
      if (released) return;
      released = true;
      const current = this.refCounts.get(sym) ?? 0;
      if (current <= 1) {
        this.refCounts.delete(sym);
        this.desiredSymbols.delete(sym);
        this.sendUnsubscribe([sym]);
      } else {
        this.refCounts.set(sym, current - 1);
      }
    };
  }

  /**
   * Suspend the connection without permanently disabling it. Used on
   * ``pagehide`` (mobile Safari backgrounding, bfcache navigation).
   * The stream will resume on the next ``resume()`` call — typically
   * driven by ``pageshow`` or a visibility change.
   *
   * A previous version used ``shutdown()`` on pagehide which set
   * ``stopped = true`` permanently — restoring from bfcache left the
   * stream dead until a hard reload, because effect re-runs don't
   * fire on bfcache restore.
   */
  suspend(): void {
    setLiveStreamActive(false);
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.pingTimer) clearInterval(this.pingTimer);
    if (this.stallTimer) clearTimeout(this.stallTimer);
    this.reconnectTimer = null;
    this.pingTimer = null;
    this.stallTimer = null;
    if (this.ws) {
      try {
        this.ws.close(1000, 'client suspend');
      } catch {
        /* ignore */
      }
    }
    this.ws = null;
  }

  /** Reopen after a suspend if there are active subscriptions. */
  resume(): void {
    if (this.desiredSymbols.size === 0) return;
    this.reconnectAttempt = 0;
    this.ensureConnection();
  }

  /** Permanent teardown — release everything. Used on logout. */
  shutdown(): void {
    this.stopped = true;
    this.suspend();
    this.desiredSymbols.clear();
    this.refCounts.clear();
  }

  // ---------- connection lifecycle ----------

  private ensureConnection(): void {
    if (!isEnabled()) return;
    if (this.stopped) return;
    if (this.ws && this.ws.readyState === WebSocket.OPEN) return;
    if (this.ws && this.ws.readyState === WebSocket.CONNECTING) return;
    if (this.connecting) return;
    void this.connect();
  }

  private async connect(): Promise<void> {
    if (this.connecting) return;
    this.connecting = true;
    try {
      const res = await fetch(TICKET_ENDPOINT, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) {
        // 401 = unauthenticated (anonymous browsing). 503 = feature or
        // secret not configured. Both are "no live stream today" — do
        // NOT retry aggressively; back off long so we don't hammer the
        // BFF, and let the poll fallback carry the page.
        this.scheduleReconnect(res.status === 401 ? BACKOFF_MAX_MS : undefined);
        return;
      }
      const { url } = (await res.json()) as { url: string };
      if (!url) {
        this.scheduleReconnect(BACKOFF_MAX_MS);
        return;
      }
      const socket = new WebSocket(url);
      this.ws = socket;
      socket.onopen = () => this.onOpen();
      socket.onmessage = (ev) => this.onMessage(ev);
      socket.onerror = () => this.onError();
      // Capture ``socket`` in the closure so onClose can compare
      // against ``this.ws``. Without this, an old socket's late
      // ``onclose`` (from a stall-watchdog forced close) would fire
      // AFTER a new socket had been assigned to ``this.ws``, and the
      // unconditional ``this.ws = null`` at the bottom of onClose
      // would orphan the fresh connection — server holds us at zero
      // subscribed symbols and no ticks arrive until the next
      // reconnect cycle.
      socket.onclose = (ev) => this.onClose(ev, socket);
    } catch {
      this.scheduleReconnect();
    } finally {
      this.connecting = false;
    }
  }

  private onOpen(): void {
    this.reconnectAttempt = 0;
    this.lastMessageAt = Date.now();
    // NOTE: we deliberately do NOT flip a global "live" flag here.
    // Poll throttling is decided per-symbol in useApiData.ts based
    // on whether a WS tick actually arrived for that symbol —
    // opening a socket that never delivers ticks (SPX/QQQ before
    // ingestion adds them, or ingestion crashed while socket is
    // open) must not throttle polls or the user sees stale prices.
    // Re-arm ping + stall watchdog.
    if (this.pingTimer) clearInterval(this.pingTimer);
    this.pingTimer = setInterval(() => this.pingIfIdle(), PING_INTERVAL_MS);
    this.markQuoteReceived();
    // Re-issue every desired subscription (this covers reconnect and
    // any acquires that happened while the socket was in CONNECTING).
    const wanted = Array.from(this.desiredSymbols);
    if (wanted.length > 0) this.sendSubscribe(wanted);
  }

  /**
   * Reset the stall watchdog. Only real quote frames call this — a
   * pong from the server keeps ``lastMessageAt`` fresh (so we don't
   * ping in a busy loop) but doesn't mask an ingestion-down state
   * where the API server is alive and pongs cheerfully while no
   * NOTIFYs are flowing.
   */
  private markQuoteReceived(): void {
    if (this.stallTimer) clearTimeout(this.stallTimer);
    this.stallTimer = setTimeout(() => {
      try {
        if (this.ws) this.ws.close(4000, 'stall_timeout');
      } catch {
        /* ignore */
      }
    }, STALL_TIMEOUT_MS);
  }

  private onMessage(ev: MessageEvent): void {
    // lastMessageAt tracks ANY server frame — used by pingIfIdle to
    // suppress redundant pings when the market's already busy. The
    // stall watchdog, however, is only reset on real 'quote' frames
    // (via markQuoteReceived()) so an ingestion-down state where the
    // server still answers our pings can't defeat detection.
    this.lastMessageAt = Date.now();
    let frame: ServerFrame | null = null;
    try {
      frame = JSON.parse(String(ev.data)) as ServerFrame;
    } catch {
      return;
    }
    if (!frame || typeof frame !== 'object') return;
    switch (frame.type) {
      case 'quote': {
        // Preserve null OHLC as null (not coerced to 0) — a data hole
        // or illiquid warmup tick with null prices used to render
        // $0.00 across the header, price card, GEX spot line, and
        // candle tip. applyLiveQuote's merge preserves the previous
        // value for any null field, so passing null through is the
        // correct behaviour: the last known price stays on screen
        // until a real tick arrives.
        const row: LiveQuoteIncoming = {
          symbol: frame.symbol,
          timestamp: frame.timestamp,
          open: frame.open ?? null,
          high: frame.high ?? null,
          low: frame.low ?? null,
          close: frame.close ?? null,
          volume: frame.volume ?? null,
          up_volume: frame.up_volume ?? null,
          down_volume: frame.down_volume ?? null,
          session: frame.session ?? null,
        };
        applyLiveQuote(frame.symbol, row);
        // Only 'quote' frames should reset the stall watchdog —
        // pongs would otherwise mask an ingestion-down state (the
        // stall timeout never fires because our own pings elicit
        // pongs that count as messages).
        this.markQuoteReceived();
        break;
      }
      case 'welcome':
      case 'ack':
      case 'pong':
        // No-op — protocol acks; we don't surface them to the UI.
        break;
      case 'error':
        // Log server-side errors but don't surface them; a bad symbol
        // subscription just means no updates for that symbol.
        console.warn('[quoteStream] server error', frame.code, frame.detail);
        break;
    }
  }

  private onError(): void {
    // The close event follows an error; nothing to do here beyond
    // suppressing the default console noise from onerror.
  }

  private onClose(ev: CloseEvent, socket: WebSocket): void {
    // Only null out ``this.ws`` if the socket that closed is the
    // current one. A stall-watchdog forced-close on the OLD socket
    // can fire AFTER ``connect()`` has already assigned a new
    // socket; without this guard we'd orphan the new connection.
    if (this.ws !== socket) return;
    if (this.pingTimer) clearInterval(this.pingTimer);
    if (this.stallTimer) clearTimeout(this.stallTimer);
    this.pingTimer = null;
    this.stallTimer = null;
    this.ws = null;
    setLiveStreamActive(false);
    if (this.stopped) return;
    // 1000 = normal close (client shutdown initiated us). Don't
    // reconnect from an intentional close.
    if (ev.code === 1000 && this.desiredSymbols.size === 0) return;
    this.scheduleReconnect();
  }

  private scheduleReconnect(overrideMs?: number): void {
    if (this.stopped) return;
    if (this.reconnectTimer) return;
    const base = Math.min(BACKOFF_MAX_MS, BACKOFF_MIN_MS * 2 ** this.reconnectAttempt);
    const jitter = Math.random() * base * 0.25;
    const delay = overrideMs ?? Math.floor(base + jitter);
    this.reconnectAttempt = Math.min(this.reconnectAttempt + 1, 10);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.ensureConnection();
    }, delay);
  }

  // ---------- protocol frames ----------

  private sendSubscribe(symbols: string[]): void {
    if (symbols.length === 0) return;
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    try {
      this.ws.send(JSON.stringify({ op: 'subscribe', symbols }));
    } catch {
      /* ignore — reconnect will re-send */
    }
  }

  private sendUnsubscribe(symbols: string[]): void {
    if (symbols.length === 0) return;
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    try {
      this.ws.send(JSON.stringify({ op: 'unsubscribe', symbols }));
    } catch {
      /* ignore */
    }
  }

  private pingIfIdle(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    // Only ping when we haven't heard from the server recently — a
    // busy market hour stream doesn't need extra chatter.
    if (Date.now() - this.lastMessageAt < PING_INTERVAL_MS / 2) return;
    try {
      this.ws.send(JSON.stringify({ op: 'ping', client_ts: Date.now() }));
    } catch {
      /* ignore */
    }
  }

}

// Module-level singleton. Import as `quoteStream` and call
// `.acquire(symbol)` to receive live pushes.
export const quoteStream = new QuoteStream();

// Close the socket cleanly when the page goes away so the server can
// reclaim the slot instead of waiting for WS_IDLE_TIMEOUT to fire —
// but SUSPEND (not shutdown) because mobile Safari fires pagehide on
// tab backgrounding with the tab remaining in bfcache. shutdown()
// would latch ``stopped=true`` and no subsequent effect re-mount can
// re-open (bfcache restore doesn't re-fire useEffect). suspend() is
// idempotent and resume() reopens on next visibility.
if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => {
    quoteStream.suspend();
  });
  window.addEventListener('pageshow', () => {
    quoteStream.resume();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      quoteStream.resume();
    }
  });
}
