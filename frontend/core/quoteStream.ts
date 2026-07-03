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

import type { MarketQuoteRow } from '@/hooks/useApiData';
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
   */
  acquire(symbol: string): () => void {
    if (!isEnabled()) return () => undefined;
    const sym = symbol.trim().toUpperCase();
    if (!sym) return () => undefined;

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

  /** Force-close and stop reconnecting. Used on logout/page unload. */
  shutdown(): void {
    this.stopped = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.pingTimer) clearInterval(this.pingTimer);
    if (this.stallTimer) clearTimeout(this.stallTimer);
    this.reconnectTimer = null;
    this.pingTimer = null;
    this.stallTimer = null;
    setLiveStreamActive(false);
    if (this.ws) {
      try {
        this.ws.close(1000, 'client shutdown');
      } catch {
        /* ignore */
      }
    }
    this.ws = null;
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
      socket.onclose = (ev) => this.onClose(ev);
    } catch {
      this.scheduleReconnect();
    } finally {
      this.connecting = false;
    }
  }

  private onOpen(): void {
    this.reconnectAttempt = 0;
    this.lastMessageAt = Date.now();
    setLiveStreamActive(true);
    // Re-arm ping + stall watchdog.
    if (this.pingTimer) clearInterval(this.pingTimer);
    this.pingTimer = setInterval(() => this.pingIfIdle(), PING_INTERVAL_MS);
    this.resetStallWatchdog();
    // Re-issue every desired subscription (this covers reconnect and
    // any acquires that happened while the socket was in CONNECTING).
    const wanted = Array.from(this.desiredSymbols);
    if (wanted.length > 0) this.sendSubscribe(wanted);
  }

  private onMessage(ev: MessageEvent): void {
    this.lastMessageAt = Date.now();
    this.resetStallWatchdog();
    let frame: ServerFrame | null = null;
    try {
      frame = JSON.parse(String(ev.data)) as ServerFrame;
    } catch {
      return;
    }
    if (!frame || typeof frame !== 'object') return;
    switch (frame.type) {
      case 'quote': {
        const row: MarketQuoteRow = {
          symbol: frame.symbol,
          timestamp: frame.timestamp,
          open: (frame.open as number) ?? 0,
          high: (frame.high as number) ?? 0,
          low: (frame.low as number) ?? 0,
          close: (frame.close as number) ?? 0,
          volume: frame.volume ?? null,
          up_volume: frame.up_volume ?? null,
          down_volume: frame.down_volume ?? null,
          session: frame.session ?? null,
        };
        applyLiveQuote(frame.symbol, row);
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

  private onClose(ev: CloseEvent): void {
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

  private resetStallWatchdog(): void {
    if (this.stallTimer) clearTimeout(this.stallTimer);
    this.stallTimer = setTimeout(() => {
      // No traffic in STALL_TIMEOUT_MS — force a reconnect. The
      // browser's own onclose fires eventually, but "eventually" can
      // be many minutes on a broken NAT.
      try {
        if (this.ws) this.ws.close(4000, 'stall_timeout');
      } catch {
        /* ignore */
      }
    }, STALL_TIMEOUT_MS);
  }
}

// Module-level singleton. Import as `quoteStream` and call
// `.acquire(symbol)` to receive live pushes.
export const quoteStream = new QuoteStream();

// Kill the socket cleanly when the page goes away so the server can
// reclaim the slot instead of waiting for the WS_IDLE_TIMEOUT to fire.
if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => {
    quoteStream.shutdown();
  });
}
