"use client";

import { ReactNode, useEffect, useRef } from "react";

interface MobileScrollableChartProps {
  children: ReactNode;
  minWidthClass?: string;
  className?: string;
  initialScroll?: "start" | "center";
}

export default function MobileScrollableChart({
  children,
  minWidthClass = "min-w-[900px]",
  className = "",
  initialScroll = "start",
}: MobileScrollableChartProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (initialScroll !== "center") return;
    const container = scrollRef.current;
    if (!container) return;
    if (typeof window === "undefined") return;
    if (window.matchMedia("(min-width: 768px)").matches) return;

    const maxScrollLeft = container.scrollWidth - container.clientWidth;
    if (maxScrollLeft > 0) {
      container.scrollLeft = maxScrollLeft / 2;
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
