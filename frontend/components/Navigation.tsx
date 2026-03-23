"use client";

import { usePathname, useRouter } from "next/navigation";
import { Theme } from "@/core/types";
import { colors } from "@/core/colors";
import { useEffect, useMemo, useRef, useState } from "react";

interface NavigationProps {
  theme: Theme;
}

type NavGroup = {
  label: string;
  items: Array<{ id: string; label: string }>;
};

const SIDEBAR_WIDTH = 272;

export default function Navigation({ theme }: NavigationProps) {
  const pathname = usePathname();
  const router = useRouter();
  const navRef = useRef<HTMLElement | null>(null);
  const [hoveredPage, setHoveredPage] = useState<string | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return localStorage.getItem("headerCollapsed") === "true";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const onCollapsed = (e: Event) => {
      const next = (e as CustomEvent<boolean>).detail;
      if (typeof next === "boolean") setIsCollapsed(next);
    };
    window.addEventListener("header:collapse-changed", onCollapsed);
    return () => window.removeEventListener("header:collapse-changed", onCollapsed);
  }, []);

  useEffect(() => {
    const syncNavVars = () => {
      const desktop = typeof window !== "undefined" && window.innerWidth >= 768;
      const width = !isCollapsed && desktop ? SIDEBAR_WIDTH : 0;
      document.documentElement.style.setProperty("--zgx-nav-height", "0px");
      document.documentElement.style.setProperty("--zgx-nav-width", `${width}px`);
    };

    syncNavVars();
    window.addEventListener("resize", syncNavVars);
    return () => window.removeEventListener("resize", syncNavVars);
  }, [isCollapsed]);

  const groups = useMemo<NavGroup[]>(() => [
    {
      label: "Main",
      items: [{ id: "/dashboard", label: "Main Dashboard" }],
    },
    {
      label: "Proprietary Signals",
      items: [
        { id: "/trading-signals", label: "Trade Ideas" },
        { id: "/volatility-expansion", label: "Volatility Expansion" },
        { id: "/position-optimizer", label: "Position Optimizer" },
      ],
    },
    {
      label: "Metrics",
      items: [
        { id: "/gamma-exposure", label: "Gamma Exposure" },
        { id: "/flow-analysis", label: "Flow Analysis" },
        { id: "/max-pain", label: "Max Pain" },
        { id: "/intraday-tools", label: "Other" },
      ],
    },
    {
      label: "Strategy Tools",
      items: [
        { id: "/options-calculator", label: "Live Strategy Lab" },
        { id: "/option-contracts", label: "Real-Time Contract Viewer" },
      ],
    },
  ], []);

  if (isCollapsed) return null;

  const border = "rgba(150,143,146,0.25)";

  return (
    <nav
      ref={navRef}
      className="hidden md:block fixed left-0 z-30 border-r"
      style={{
        width: `${SIDEBAR_WIDTH}px`,
        top: "var(--zgx-header-height, 0px)",
        bottom: 0,
        backgroundColor: theme === "dark" ? `${colors.bgDark}f2` : `${colors.bgLight}f2`,
        borderColor: border,
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
      }}
    >
      <div className="h-full overflow-y-auto px-4 py-5">
        {groups.map((group) => (
          <div key={group.label} className="mb-6 last:mb-0">
            <div
              className="mb-3 px-3 text-[11px] font-semibold uppercase tracking-[0.18em]"
              style={{ color: colors.primary }}
            >
              {group.label}
            </div>
            <div className="space-y-1">
              {group.items.map((page) => {
                const isActive = pathname === page.id;
                const isHovered = hoveredPage === page.id;
                return (
                  <button
                    key={page.id}
                    onClick={() => router.push(page.id)}
                    onMouseEnter={() => setHoveredPage(page.id)}
                    onMouseLeave={() => setHoveredPage(null)}
                    className="w-full rounded-xl px-3 py-3 text-left text-sm font-semibold transition-all duration-200"
                    style={{
                      color: isActive || isHovered ? colors.primary : theme === "dark" ? colors.light : colors.dark,
                      opacity: isActive || isHovered ? 1 : 0.72,
                      background: isHovered && !isActive
                        ? `${colors.primary}18`
                        : isActive
                          ? `${colors.primary}14`
                          : "transparent",
                      border: `1px solid ${isActive || isHovered ? colors.primary + "40" : "transparent"}`,
                    }}
                    type="button"
                  >
                    {page.label}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </nav>
  );
}
