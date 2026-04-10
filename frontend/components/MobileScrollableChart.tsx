"use client";

import { ReactNode } from "react";

interface MobileScrollableChartProps {
  children: ReactNode;
  minWidthClass?: string;
  className?: string;
}

export default function MobileScrollableChart({
  children,
  minWidthClass = "min-w-[900px]",
  className = "",
}: MobileScrollableChartProps) {
  return (
    <div className={`h-full overflow-x-auto md:overflow-visible pb-2 md:pb-0 ${className}`}>
      <div className={`h-full w-full ${minWidthClass} md:min-w-0`}>
        {children}
      </div>
    </div>
  );
}
