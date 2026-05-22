"use client";

import { ReactNode, useEffect, useLayoutEffect, useRef } from "react";

interface MobileScrollableChartProps {
  children: ReactNode;
  minWidthClass?: string;
  className?: string;
  initialScroll?: "start" | "center";
  /** Width multiplier. When > 1, the chart renders wider than its container
   *  and scrolls horizontally on all viewports (not just mobile). Each zoom
   *  change preserves the viewport's current center so the strike under the
   *  user's eye stays put while the surrounding range expands or contracts. */
  zoomLevel?: number;
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
}: MobileScrollableChartProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  // Visible-viewport center as a fraction (0..1) of the inner content width.
  // 0.5 is the default (middle of the chart). Updated on every scroll so the
  // next zoom change reuses the user's most recent reading position.
  const centerFractionRef = useRef<number>(0.5);
  const prevZoomRef = useRef<number>(zoomLevel);

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

  const handleScroll = () => {
    const container = scrollRef.current;
    if (!container) return;
    if (container.scrollWidth <= container.clientWidth) return;
    centerFractionRef.current = clamp(
      (container.scrollLeft + container.clientWidth / 2) / container.scrollWidth,
      0,
      1,
    );
  };

  // useLayoutEffect adjusts scrollLeft BEFORE the browser paints the new zoom
  // level — otherwise the chart would briefly render at the old scroll offset
  // (clamped to the new max) and then snap to the corrected center, which
  // reads as a jump. Reading the ref instead of recomputing the center from
  // the previous scroll position means a Reset-to-1× doesn't lose context if
  // the chart scrollWidth has already collapsed back to the viewport.
  useLayoutEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    if (prevZoomRef.current === zoomLevel) return;
    prevZoomRef.current = zoomLevel;
    const max = container.scrollWidth - container.clientWidth;
    if (max <= 0) return;
    const target =
      centerFractionRef.current * container.scrollWidth - container.clientWidth / 2;
    container.scrollLeft = clamp(target, 0, max);
  }, [zoomLevel]);

  // Legacy mobile-only "center on mount" for callers that opt in.
  useEffect(() => {
    if (initialScroll !== "center") return;
    const container = scrollRef.current;
    if (!container) return;
    if (typeof window === "undefined") return;
    if (window.matchMedia("(min-width: 768px)").matches) return;
    const max = container.scrollWidth - container.clientWidth;
    if (max > 0) {
      container.scrollLeft = max / 2;
    }
  }, [initialScroll, minWidthClass]);

  return (
    <div
      ref={scrollRef}
      onScroll={handleScroll}
      className={`h-full ${overflowClass} pb-2 md:pb-0 ${className}`}
    >
      <div
        className={`h-full w-full ${isZoomed ? "" : minWidthClass} md:min-w-0`}
        style={innerStyle}
      >
        {children}
      </div>
    </div>
  );
}
