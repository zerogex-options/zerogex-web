"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ExternalLink, Newspaper, X } from "lucide-react";
import { Theme } from "@/core/types";
import { colors } from "@/core/colors";
import {
  categoryPalette,
  formatRelativeTime,
  isHighSignal,
  type NewsHeadline,
} from "@/core/newsHeadlines";

type FilterMode = "high" | "all";

const FILTER_MODE_KEY = "zgx_news_filter_mode";

function readSavedFilterMode(): FilterMode {
  if (typeof window === "undefined") return "high";
  try {
    const stored = window.localStorage.getItem(FILTER_MODE_KEY);
    return stored === "all" ? "all" : "high";
  } catch {
    return "high";
  }
}

interface NewsHeadlinesBadgeProps {
  theme: Theme;
  compact?: boolean;
  // When true, the popup is centered on the viewport (mobile). When false
  // (desktop, whether collapsed or expanded), the popup is anchored to the
  // right side of the viewport so it lands in the same place users are
  // already used to from the expanded header.
  mobile?: boolean;
}

interface NewsResponse {
  headlines: NewsHeadline[];
  generatedAt: number;
}

const REFRESH_MS = 5 * 60 * 1000;
// Pulse the badge for headlines fresher than this — gives traders a quick
// visual signal that something just hit the wires.
const FRESH_THRESHOLD_MS = 15 * 60 * 1000;

export default function NewsHeadlinesBadge({
  theme,
  compact = false,
  mobile = false,
}: NewsHeadlinesBadgeProps) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<NewsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [now, setNow] = useState<number>(() => Date.now());
  const [filterMode, setFilterMode] = useState<FilterMode>(readSavedFilterMode);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const popupRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    try {
      window.localStorage.setItem(FILTER_MODE_KEY, filterMode);
    } catch {
      // localStorage may be disabled in some browser modes; the toggle still
      // works for the current session, it just won't persist.
    }
  }, [filterMode]);

  // Initial load + background refresh every 5 minutes.
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

  // Refresh "X ago" labels once a minute.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      const target = e.target as Node;
      // The popup may be portaled outside wrapperRef (compact mode), so we
      // check both refs before closing.
      if (wrapperRef.current?.contains(target)) return;
      if (popupRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const headlines = useMemo<NewsHeadline[]>(() => data?.headlines ?? [], [data]);
  const highSignalHeadlines = useMemo(
    () => headlines.filter(isHighSignal),
    [headlines],
  );
  // Empty-fallback: if the user toggled to High but nothing scores high
  // yet, show all so the popup is never blank — they'll see the toggle
  // is still set to High but the list is the full feed.
  const visibleHeadlines = useMemo(() => {
    if (filterMode === "all") return headlines;
    return highSignalHeadlines.length > 0 ? highSignalHeadlines : headlines;
  }, [filterMode, headlines, highSignalHeadlines]);
  const isFallback = filterMode === "high" && highSignalHeadlines.length === 0 && headlines.length > 0;

  // Fresh dot tracks high-signal freshness specifically — a fresh "tech
  // CEO interview" headline shouldn't pulse the badge if the user is
  // looking for market movers.
  const newestHighSignal = highSignalHeadlines[0];
  const newest = newestHighSignal ?? headlines[0];
  const hasFresh = !!newestHighSignal && now - newestHighSignal.publishedAtMs < FRESH_THRESHOLD_MS;

  const border = "var(--color-border)";
  const cardBg = theme === "dark" ? `${colors.cardDark}f5` : `${colors.cardLight}f5`;

  const iconSize = compact ? 18 : 20;

  const trigger = (
    <button
      type="button"
      onClick={() => setOpen((prev) => !prev)}
      className="relative rounded-full border transition-colors"
      style={{
        borderColor: border,
        color: colors.muted,
        backgroundColor: "transparent",
        padding: compact ? "6px" : "9px",
        cursor: "pointer",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = `${colors.accent}26`;
        e.currentTarget.style.color = colors.accent;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = "transparent";
        e.currentTarget.style.color = colors.muted;
      }}
      aria-label="Top headlines"
      title={
        newest
          ? `${newest.title} — ${formatRelativeTime(now, newest.publishedAtMs)}`
          : "Top headlines"
      }
    >
      <Newspaper size={iconSize} strokeWidth={2.2} />
      {hasFresh && (
        <span
          aria-hidden
          style={{
            position: "absolute",
            top: compact ? "-3px" : "-4px",
            right: compact ? "-3px" : "-4px",
            width: compact ? "10px" : "12px",
            height: compact ? "10px" : "12px",
            borderRadius: "999px",
            background: colors.coral,
            border: `1px solid ${colors.coral}66`,
            boxShadow: `0 0 10px ${colors.coral}80`,
          }}
        />
      )}
    </button>
  );

  // Popup positioning mirrors OptionsCalendarBadge so both header badges feel
  // identical: mobile = viewport-centered, compact desktop = right-pinned to
  // viewport, expanded desktop = button-anchored.
  const usePortal = compact;
  const popupPositioning: React.CSSProperties = mobile
    ? {
        position: "fixed",
        top: "calc(var(--zgx-header-height, 56px) + 10px)",
        left: "50%",
        transform: "translateX(-50%)",
      }
    : compact
      ? {
          position: "fixed",
          top: "calc(var(--zgx-header-height, 56px) + 10px)",
          right: "12px",
        }
      : {
          position: "absolute",
          right: 0,
          top: "calc(100% + 10px)",
        };

  const popup = open && (
    <div
      ref={popupRef}
      role="dialog"
      aria-label="Top headlines"
      className="rounded-xl border"
      style={{
        ...popupPositioning,
        width: "min(92vw, 380px)",
        maxHeight: "min(70vh, 520px)",
        overflowY: "auto",
        background: cardBg,
        borderColor: border,
        boxShadow: "0 12px 32px rgba(0, 0, 0, 0.28)",
        zIndex: 70,
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
      }}
    >
      <div
        className="px-4 py-3 border-b"
        style={{
          borderColor: border,
          position: "sticky",
          top: 0,
          background: cardBg,
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          zIndex: 1,
        }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Newspaper size={16} style={{ color: colors.primary }} />
            <span
              className="text-xs font-bold uppercase tracking-wider"
              style={{ color: 'var(--text-primary)' }}
            >
              Top Headlines
            </span>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-md p-1"
            style={{ color: colors.muted, background: "transparent", cursor: "pointer" }}
            aria-label="Close"
          >
            <X size={14} />
          </button>
        </div>
        <div className="mt-2.5 flex items-center justify-between gap-2">
          <div
            className="inline-flex rounded-md border overflow-hidden"
            style={{ borderColor: border }}
            role="tablist"
            aria-label="Headline filter"
          >
            {(["high", "all"] as const).map((mode) => {
              const active = filterMode === mode;
              const label = mode === "high" ? "High signal" : "All";
              return (
                <button
                  key={mode}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setFilterMode(mode)}
                  className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider transition-colors"
                  style={{
                    background: active ? colors.primary : "transparent",
                    color: active
                      ? "#FFFFFF"
                      : theme === "dark"
                        ? colors.light
                        : colors.dark,
                    cursor: "pointer",
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>
          <span
            className="text-[10px] font-semibold uppercase tracking-wider"
            style={{ color: colors.muted }}
          >
            {visibleHeadlines.length} shown
          </span>
        </div>
        {isFallback && (
          <div
            className="mt-2 text-[10px]"
            style={{ color: colors.muted }}
          >
            No high-signal headlines yet — showing all.
          </div>
        )}
      </div>

      {loading && !data ? (
        <div className="px-4 py-6 text-xs" style={{ color: colors.muted, textAlign: "center" }}>
          Loading headlines…
        </div>
      ) : error && headlines.length === 0 ? (
        <div className="px-4 py-6 text-xs" style={{ color: colors.muted, textAlign: "center" }}>
          Unable to load headlines.
        </div>
      ) : visibleHeadlines.length === 0 ? (
        <div className="px-4 py-6 text-xs" style={{ color: colors.muted, textAlign: "center" }}>
          No headlines available.
        </div>
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: "8px" }}>
          {visibleHeadlines.map((h, idx) => {
            const pal = categoryPalette(h.category, colors);
            const fresh = now - h.publishedAtMs < FRESH_THRESHOLD_MS;
            return (
              <li
                key={h.id}
                className="rounded-lg border p-3"
                style={{
                  borderColor: fresh ? pal.border : `${colors.muted}40`,
                  background: fresh ? pal.bg : `${colors.muted}1a`,
                  marginTop: idx === 0 ? 0 : "8px",
                }}
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                    style={{
                      background: pal.bg,
                      color: pal.fg,
                      border: `1px solid ${pal.border}`,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {pal.label}
                  </span>
                  <span
                    className="text-[10px] font-semibold uppercase tracking-wider"
                    style={{ color: colors.muted, whiteSpace: "nowrap" }}
                    title={
                      new Date(h.publishedAtMs).toLocaleString("en-US", {
                        timeZone: "America/New_York",
                      }) + " ET"
                    }
                  >
                    {formatRelativeTime(now, h.publishedAtMs)}
                  </span>
                </div>
                {h.url ? (
                  <a
                    href={h.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 block text-sm font-bold leading-snug"
                    style={{
                      color: 'var(--text-primary)',
                      textDecoration: "none",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = colors.accent;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color =
                        'var(--text-primary)';
                    }}
                  >
                    {h.title}
                  </a>
                ) : (
                  <div
                    className="mt-2 text-sm font-bold leading-snug"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {h.title}
                  </div>
                )}
                <div
                  className="mt-1.5 flex items-center justify-between text-[11px] font-semibold"
                  style={{ color: colors.muted }}
                >
                  <span>
                    {h.source}
                    {h.crossSourceCount >= 2 && (
                      <span
                        title={`Cross-confirmed by ${h.crossSourceCount} sources`}
                        style={{ marginLeft: 6, color: colors.bullish, fontWeight: 700 }}
                      >
                        ×{h.crossSourceCount}
                      </span>
                    )}
                  </span>
                  {h.url && <ExternalLink size={11} style={{ opacity: 0.7 }} />}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div
        className="border-t px-4 py-2.5 text-[10px]"
        style={{
          borderColor: border,
          color: colors.muted,
          textAlign: "center",
        }}
      >
        Aggregated from public RSS feeds. Newest first.
      </div>
    </div>
  );

  return (
    <div ref={wrapperRef} style={{ position: "relative" }}>
      {trigger}
      {open && usePortal ? createPortal(popup, document.body) : popup}
    </div>
  );
}
