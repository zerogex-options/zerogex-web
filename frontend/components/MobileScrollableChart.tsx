"use client";

import { ReactNode, useEffect, useRef } from "react";

interface MobileScrollableChartProps {
  children: ReactNode;
  /**
   * Opt back in to the old phone behaviour: hold the chart at this minimum
   * width inside a sideways scroller. Only for a surface that is genuinely
   * unreadable any narrower — no chart on the site needs it today.
   */
  scroll?: boolean;
  minWidthClass?: string;
  className?: string;
  initialScroll?: "start" | "center" | "end";
}

/**
 * The frame a chart sits in on a phone.
 *
 * It used to hold EVERY chart at a 900–1000px minimum width inside a sideways
 * scroller below the md breakpoint. On a 390px screen that showed a third of a
 * chart at a time, split every tooltip gesture between "scroll the frame" and
 * "read the point", and hid the axis on whichever side was off-screen — the
 * "impossible to navigate" charts. Charts now fit the width they are given and
 * thin their own ticks, axes and legends on a phone instead; this frame is a
 * plain full-size box unless a caller explicitly asks for `scroll`.
 */
export default function MobileScrollableChart({
  children,
  scroll = false,
  minWidthClass = "min-w-[900px]",
  className = "",
  initialScroll = "start",
}: MobileScrollableChartProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  // Position the initial scroll exactly once. `children` is a dep so we retry
  // until the content has laid out (scrollWidth known), but the guard stops us
  // re-snapping on every subsequent re-render — otherwise a live chart that
  // re-renders each second would fight the user's own scrolling.
  const didInitialScroll = useRef(false);

  useEffect(() => {
    if (!scroll || initialScroll === "start" || didInitialScroll.current) return;
    const container = scrollRef.current;
    if (!container) return;
    if (window.matchMedia("(min-width: 768px)").matches) return;

    const maxScrollLeft = container.scrollWidth - container.clientWidth;
    if (maxScrollLeft > 0) {
      container.scrollLeft = initialScroll === "end" ? maxScrollLeft : maxScrollLeft / 2;
      didInitialScroll.current = true;
    }
  }, [scroll, initialScroll, minWidthClass, children]);

  if (!scroll) {
    return <div className={`h-full w-full min-w-0 ${className}`}>{children}</div>;
  }

  return (
    <div ref={scrollRef} className={`h-full overflow-x-auto md:overflow-visible pb-2 md:pb-0 ${className}`}>
      <div className={`h-full w-full ${minWidthClass} md:min-w-0`}>
        {children}
      </div>
    </div>
  );
}
