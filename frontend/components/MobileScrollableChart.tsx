"use client";

import { ReactNode, useEffect, useRef } from "react";

interface MobileScrollableChartProps {
  children: ReactNode;
  minWidthClass?: string;
  className?: string;
  initialScroll?: "start" | "center" | "end";
}

export default function MobileScrollableChart({
  children,
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
    if (initialScroll === "start" || didInitialScroll.current) return;
    const container = scrollRef.current;
    if (!container) return;
    if (typeof window === "undefined") return;
    if (window.matchMedia("(min-width: 768px)").matches) return;

    const maxScrollLeft = container.scrollWidth - container.clientWidth;
    if (maxScrollLeft > 0) {
      // "end" opens on the newest bars + the gamma rail (the right side of the
      // chart); "center" splits the difference.
      container.scrollLeft = initialScroll === "end" ? maxScrollLeft : maxScrollLeft / 2;
      didInitialScroll.current = true;
    }
  }, [initialScroll, minWidthClass, children]);

  return (
    <div ref={scrollRef} className={`h-full overflow-x-auto md:overflow-visible pb-2 md:pb-0 ${className}`}>
      <div className={`h-full w-full ${minWidthClass} md:min-w-0`}>
        {children}
      </div>
    </div>
  );
}
