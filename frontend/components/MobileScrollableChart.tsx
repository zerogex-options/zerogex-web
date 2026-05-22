"use client";

import { ReactNode, useEffect, useRef } from "react";

interface MobileScrollableChartProps {
  children: ReactNode;
  minWidthClass?: string;
  className?: string;
  initialScroll?: "start" | "center";
  /** Width multiplier. When > 1, the chart renders wider than its container
   *  and scrolls horizontally on all viewports (not just mobile). */
  zoomLevel?: number;
  /** Fraction (0..1) along the inner content to center the viewport on.
   *  The wrapper scrolls to this position whenever it changes or zoomLevel
   *  changes — data updates do NOT trigger a re-scroll, so the user's
   *  manual scroll position is preserved while quotes tick. */
  centerFraction?: number | null;
}

// Mobile floor (in px) used to keep zoomed charts legible. Matches the
// 900px default minWidthClass so 1× zoom on mobile looks identical to the
// pre-zoom behaviour.
const BASE_MOBILE_MIN_PX = 900;

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

export default function MobileScrollableChart({
  children,
  minWidthClass = "min-w-[900px]",
  className = "",
  initialScroll = "start",
  zoomLevel = 1,
  centerFraction = null,
}: MobileScrollableChartProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // When zoomed, the chart is wider than its container on every viewport —
  // override the desktop `md:overflow-visible` so the user gets a horizontal
  // scrollbar instead of clipped bars.
  const isZoomed = zoomLevel > 1.001;
  const overflowClass = isZoomed
    ? "overflow-x-auto"
    : "overflow-x-auto md:overflow-visible";

  // Inline width takes precedence over Tailwind w-full; the minWidth floor
  // keeps zoom legible on narrow viewports (mobile container × zoom can be
  // smaller than the un-zoomed mobile minimum, so scale the floor with zoom).
  const innerStyle: React.CSSProperties | undefined = isZoomed
    ? {
        width: `${zoomLevel * 100}%`,
        minWidth: `${zoomLevel * BASE_MOBILE_MIN_PX}px`,
      }
    : undefined;

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    if (typeof window === "undefined") return;

    // Caller-driven centering: fires on first non-null fraction and again
    // whenever zoomLevel changes. Not on `children` so spot/quote ticks
    // do NOT reset the user's manual scroll position.
    if (centerFraction != null && Number.isFinite(centerFraction)) {
      const maxScrollLeft = container.scrollWidth - container.clientWidth;
      if (maxScrollLeft > 0) {
        container.scrollLeft = clamp(
          centerFraction * container.scrollWidth - container.clientWidth / 2,
          0,
          maxScrollLeft,
        );
      }
      return;
    }

    // Legacy behaviour: mobile-only "center on mount" for callers that opt in.
    if (initialScroll !== "center") return;
    if (window.matchMedia("(min-width: 768px)").matches) return;
    const maxScrollLeft = container.scrollWidth - container.clientWidth;
    if (maxScrollLeft > 0) {
      container.scrollLeft = maxScrollLeft / 2;
    }
  }, [initialScroll, minWidthClass, zoomLevel, centerFraction]);

  return (
    <div ref={scrollRef} className={`h-full ${overflowClass} pb-2 md:pb-0 ${className}`}>
      <div
        className={`h-full w-full ${isZoomed ? "" : minWidthClass} md:min-w-0`}
        style={innerStyle}
      >
        {children}
      </div>
    </div>
  );
}
