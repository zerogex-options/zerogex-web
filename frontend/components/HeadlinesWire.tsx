"use client";

/**
 * HeadlinesWire — a Bloomberg-terminal-style live news crawl.
 *
 * Renders the same aggregated feed as the header's "Top Headlines" dropdown
 * (`/api/news`, which now includes the CNBC desk headlines the automated X
 * post is built from) as a dense, continuously-scrolling wire that
 * auto-updates as new headlines roll in. Designed for the "My Dashboard"
 * widget board but self-contained enough to drop anywhere.
 *
 * Motion contract:
 *   - With enough headlines to fill the frame it crawls upward on a seamless
 *     two-copy loop (the classic ticker), speed held constant per-item so a
 *     quiet news day scrolls at the same pace as a busy one.
 *   - Hovering or keyboard-focusing the wire freezes the crawl in place (no
 *     jump) so a reader can catch and click a headline.
 *   - `prefers-reduced-motion` (or too few items to fill the frame) falls back
 *     to a plain scrollable list — never a broken half-empty loop.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { ExternalLink } from "lucide-react";
import { Theme } from "@/core/types";
import { colors } from "@/core/colors";
import {
  categoryPalette,
  formatRelativeTime,
  isHighSignal,
  type NewsHeadline,
} from "@/core/newsHeadlines";

type FilterMode = "all" | "high";

interface NewsResponse {
  headlines: NewsHeadline[];
  generatedAt: number;
}

// Poll cadence. The /api/news route caches upstream for ~5 min, so a 60s poll
// is cheap (mostly cache hits) while still surfacing a new print within a
// minute of the cache turning over.
const REFRESH_MS = 60_000;
// Headlines fresher than this pulse/flag as "new" so the eye catches an
// arrival even while the wire is crawling.
const FRESH_THRESHOLD_MS = 15 * 60 * 1000;
// Seconds each headline spends crossing the frame — the crawl duration scales
// with the item count so speed stays constant regardless of feed depth.
const SECONDS_PER_ITEM = 3.4;
const MIN_CRAWL_SECONDS = 24;
// Below this many items the content can't reliably fill the frame, so a
// two-copy loop would show a seam gap — fall back to a static list instead.
const MIN_ITEMS_TO_CRAWL = 7;

const FILTER_KEY = "zgx_headlines_wire_filter";

function readSavedFilter(): FilterMode {
  if (typeof window === "undefined") return "all";
  try {
    return window.localStorage.getItem(FILTER_KEY) === "high" ? "high" : "all";
  } catch {
    return "all";
  }
}

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener?.("change", update);
    return () => mq.removeEventListener?.("change", update);
  }, []);
  return reduced;
}

export default function HeadlinesWire({ theme }: { theme: Theme }) {
  // theme is accepted for parity with the other dashboard panels; the wire
  // paints entirely from CSS custom properties so it needs no branch on it.
  void theme;

  const [data, setData] = useState<NewsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [now, setNow] = useState<number>(() => Date.now());
  const [filterMode, setFilterMode] = useState<FilterMode>(readSavedFilter);
  const [paused, setPaused] = useState(false);
  const reducedMotion = usePrefersReducedMotion();
  const liveRef = useRef(false);

  useEffect(() => {
    try {
      window.localStorage.setItem(FILTER_KEY, filterMode);
    } catch {
      /* private mode — the toggle still works for this session */
    }
  }, [filterMode]);

  // Initial load + background refresh.
  useEffect(() => {
    let aborted = false;
    const load = async () => {
      try {
        const res = await fetch("/api/news", { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as NewsResponse;
        if (!aborted) {
          setData(json);
          setError(false);
        }
      } catch {
        if (!aborted) setError(true);
      } finally {
        if (!aborted) setLoading(false);
      }
    };
    void load();
    const id = setInterval(load, REFRESH_MS);
    return () => {
      aborted = true;
      clearInterval(id);
    };
  }, []);

  // Tick relative-time labels once a minute.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const headlines = useMemo<NewsHeadline[]>(() => data?.headlines ?? [], [data]);
  const highSignal = useMemo(() => headlines.filter(isHighSignal), [headlines]);
  const visible = useMemo(() => {
    if (filterMode === "all") return headlines;
    // Never blank the wire: if High is on but nothing scores high yet, show
    // the full feed rather than an empty frame.
    return highSignal.length > 0 ? highSignal : headlines;
  }, [filterMode, headlines, highSignal]);
  const isFallback = filterMode === "high" && highSignal.length === 0 && headlines.length > 0;

  const crawl = !reducedMotion && visible.length >= MIN_ITEMS_TO_CRAWL;
  const crawlSeconds = Math.max(MIN_CRAWL_SECONDS, visible.length * SECONDS_PER_ITEM);

  // Mark the LIVE dot as genuinely live once at least one successful load has
  // landed with content.
  if (visible.length > 0) liveRef.current = true;

  const row = (h: NewsHeadline, key: string) => {
    const pal = categoryPalette(h.category, colors);
    const fresh = now - h.publishedAtMs < FRESH_THRESHOLD_MS;
    const high = isHighSignal(h);
    const body = (
      <div
        className="flex items-stretch gap-2.5 px-3 py-2"
        style={{
          borderLeft: `2px solid ${pal.border}`,
          background: fresh ? pal.bg : "transparent",
        }}
      >
        <div className="flex flex-col items-start pt-0.5" style={{ minWidth: 52 }}>
          <span
            className="text-[9px] font-bold uppercase tracking-wider tabular-nums"
            style={{ color: "var(--text-secondary)", whiteSpace: "nowrap" }}
          >
            {formatRelativeTime(now, h.publishedAtMs)}
          </span>
          <span
            className="mt-1 text-[8px] font-extrabold uppercase tracking-wider"
            style={{ color: pal.fg, whiteSpace: "nowrap" }}
          >
            {pal.label}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-1.5">
            {high && (
              <span
                aria-hidden
                title="High signal"
                style={{
                  flexShrink: 0,
                  width: 6,
                  height: 6,
                  marginTop: 4,
                  borderRadius: 999,
                  background: "var(--color-bull)",
                  boxShadow: "0 0 6px var(--color-bull)",
                }}
              />
            )}
            <span
              className="text-[12.5px] font-bold leading-snug"
              style={{ color: "var(--text-primary)" }}
            >
              {h.title}
            </span>
          </div>
          <div
            className="mt-0.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider"
            style={{ color: "var(--text-secondary)" }}
          >
            <span style={{ whiteSpace: "nowrap" }}>{h.source}</span>
            {h.crossSourceCount >= 2 && (
              <span
                title={`Cross-confirmed by ${h.crossSourceCount} sources`}
                style={{ color: "var(--color-bull)", fontWeight: 800 }}
              >
                ×{h.crossSourceCount}
              </span>
            )}
            {fresh && (
              <span style={{ color: "var(--color-brand-coral)", fontWeight: 800 }}>NEW</span>
            )}
            {h.url && <ExternalLink size={10} style={{ opacity: 0.6 }} />}
          </div>
        </div>
      </div>
    );
    return h.url ? (
      <a
        key={key}
        href={h.url}
        target="_blank"
        rel="noopener noreferrer"
        className="block no-underline transition-colors"
        style={{ color: "inherit", textDecoration: "none" }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "var(--bg-hover)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "transparent";
        }}
      >
        {body}
      </a>
    ) : (
      <div key={key}>{body}</div>
    );
  };

  const list = visible.map((h, i) => row(h, `a:${h.id}:${i}`));
  // Second copy powers the seamless loop; hidden from a11y so screen readers
  // don't announce every headline twice.
  const listClone = visible.map((h, i) => row(h, `b:${h.id}:${i}`));

  return (
    <div className="flex h-full flex-col">
      {/* Keyframes are scoped to this component; identical duplicates across
          multiple mounted wires are harmless. */}
      <style>{`
        @keyframes zgx-wire-crawl { from { transform: translateY(0); } to { transform: translateY(-50%); } }
        @keyframes zgx-wire-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.35; } }
      `}</style>

      {/* Control strip: LIVE indicator + High/All filter + count. */}
      <div
        className="flex items-center justify-between gap-2 px-3 py-2 border-b"
        style={{ borderColor: "var(--border-subtle)" }}
      >
        <div className="flex items-center gap-1.5">
          <span
            aria-hidden
            style={{
              width: 7,
              height: 7,
              borderRadius: 999,
              background: liveRef.current && !error ? "var(--color-bull)" : "var(--text-secondary)",
              boxShadow: liveRef.current && !error ? "0 0 8px var(--color-bull)" : "none",
              animation: liveRef.current && !error && !reducedMotion ? "zgx-wire-pulse 2s ease-in-out infinite" : "none",
            }}
          />
          <span
            className="text-[10px] font-extrabold uppercase tracking-wider"
            style={{ color: "var(--text-secondary)" }}
          >
            {error && visible.length === 0 ? "Offline" : "Live wire"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div
            className="inline-flex rounded-md border overflow-hidden"
            style={{ borderColor: "var(--color-border)" }}
            role="tablist"
            aria-label="Headline filter"
          >
            {(["all", "high"] as const).map((mode) => {
              const active = filterMode === mode;
              return (
                <button
                  key={mode}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setFilterMode(mode)}
                  className="px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider transition-colors"
                  style={{
                    background: active ? "var(--color-brand-primary)" : "transparent",
                    color: active ? "#FFFFFF" : "var(--text-primary)",
                    cursor: "pointer",
                  }}
                >
                  {mode === "high" ? "High" : "All"}
                </button>
              );
            })}
          </div>
          <span
            className="text-[10px] font-semibold uppercase tracking-wider tabular-nums"
            style={{ color: "var(--text-secondary)" }}
          >
            {visible.length}
          </span>
        </div>
      </div>

      {isFallback && (
        <div
          className="px-3 py-1 text-[9px] uppercase tracking-wider border-b"
          style={{ color: "var(--text-secondary)", borderColor: "var(--border-subtle)" }}
        >
          No high-signal headlines yet — showing all
        </div>
      )}

      {/* The crawl frame. */}
      <div
        className="relative flex-1 min-h-0 overflow-hidden"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onFocus={() => setPaused(true)}
        onBlur={() => setPaused(false)}
        aria-label="Live headlines wire"
      >
        {loading && !data ? (
          <div className="px-3 py-6 text-center text-[11px]" style={{ color: "var(--text-secondary)" }}>
            Loading the wire…
          </div>
        ) : visible.length === 0 ? (
          <div className="px-3 py-6 text-center text-[11px]" style={{ color: "var(--text-secondary)" }}>
            {error ? "Wire unavailable." : "No headlines on the wire."}
          </div>
        ) : crawl ? (
          <div
            style={{
              animation: `zgx-wire-crawl ${crawlSeconds}s linear infinite`,
              animationPlayState: paused ? "paused" : "running",
              willChange: "transform",
            }}
          >
            <div>{list}</div>
            <div aria-hidden>{listClone}</div>
          </div>
        ) : (
          <div className="h-full overflow-y-auto">{list}</div>
        )}

        {/* Top/bottom fades sell the "endless tape" feel on the crawl. */}
        {crawl && (
          <>
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-0"
              style={{ height: 16, background: "linear-gradient(to bottom, var(--bg-card), transparent)" }}
            />
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 bottom-0"
              style={{ height: 16, background: "linear-gradient(to top, var(--bg-card), transparent)" }}
            />
          </>
        )}
      </div>
    </div>
  );
}
