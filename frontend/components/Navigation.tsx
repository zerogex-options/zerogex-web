"use client";

import { usePathname, useRouter } from "next/navigation";
import { Theme } from "@/core/types";
import { colors } from "@/core/colors";
import { useEffect, useRef, useState } from "react";

interface NavigationProps {
  theme: Theme;
}

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
    const setNavHeight = () => {
      const h = isCollapsed ? 0 : navRef.current?.offsetHeight ?? 0;
      document.documentElement.style.setProperty("--zgx-nav-height", `${h}px`);
    };

    setNavHeight();
    const raf = requestAnimationFrame(setNavHeight);
    window.addEventListener("resize", setNavHeight);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", setNavHeight);
    };
  }, [isCollapsed]);

  const pages = [
    { id: "/dashboard", label: "DASHBOARD" },
    { id: "/trading-signals", label: "TRADING SIGNALS" },
    { id: "/volatility-expansion", label: "VOL EXPANSION" },
    { id: "/position-optimizer", label: "POSITION OPTIMIZER" },
    { id: "/flow-analysis", label: "FLOW ANALYSIS" },
    { id: "/gamma-exposure", label: "GAMMA EXPOSURE" },
    { id: "/intraday-tools", label: "INTRADAY TOOLS" },
    { id: "/max-pain", label: "MAX PAIN" },
    { id: "/options-calculator", label: "OPTIONS CALCULATOR" },
    { id: "/option-contracts", label: "OPTION CONTRACTS" },
  ];

  if (isCollapsed) return null;

  const border = "rgba(150,143,146,0.25)";

  return (
    <nav
      ref={navRef}
      className="border-b hidden md:block fixed left-0 right-0 z-30"
      style={{
        backgroundColor: theme === "dark" ? `${colors.bgDark}f2` : `${colors.bgLight}f2`,
        borderColor: border,
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        top: "var(--zgx-header-height, 0px)",
      }}
    >
      <div className="container mx-auto px-6">
        <div className="flex overflow-x-hidden justify-center">
          {pages.map((page) => {
            const isActive = pathname === page.id;
            return (
              <button
                key={page.id}
                onClick={() => router.push(page.id)}
                onMouseEnter={() => setHoveredPage(page.id)}
                onMouseLeave={() => setHoveredPage(null)}
                className="px-4 py-2 my-2 font-semibold text-sm whitespace-nowrap transition-all duration-200 relative"
                style={{
                  color: isActive || hoveredPage === page.id ? colors.primary : theme === "dark" ? colors.light : colors.dark,
                  opacity: isActive || hoveredPage === page.id ? 1 : 0.6,
                  cursor: "pointer",
                  borderRadius: 8,
                  background: hoveredPage === page.id && !isActive
                    ? `${colors.primary}18`
                    : isActive
                      ? `${colors.primary}14`
                      : "transparent",
                  border: `1px solid ${isActive || hoveredPage === page.id ? colors.primary + "40" : "transparent"}`,
                }}
              >
                {page.label}
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
