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
      const h = navRef.current?.offsetHeight ?? 0;
      document.documentElement.style.setProperty("--zgx-nav-height", `${h}px`);
    };
    setNavHeight();
    window.addEventListener("resize", setNavHeight);
    return () => window.removeEventListener("resize", setNavHeight);
  }, [isCollapsed]);

  const pages = [
    { id: "/", label: "DASHBOARD" },
    { id: "/flow-analysis", label: "FLOW ANALYSIS" },
    { id: "/gamma-exposure", label: "GAMMA EXPOSURE" },
    { id: "/intraday-tools", label: "INTRADAY TOOLS" },
    { id: "/max-pain", label: "MAX PAIN" },
    { id: "/about", label: "ABOUT" },
  ];

  return (
    <nav
      ref={navRef}
      className="border-b hidden md:block fixed left-0 right-0 z-30"
      style={{
        backgroundColor: theme === "dark" ? colors.bgDark : colors.bgLight,
        borderColor: colors.muted,
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
                className="px-6 py-4 font-semibold text-sm whitespace-nowrap transition-all duration-200 relative group"
                style={{
                  color: isActive ? colors.bearish : theme === "dark" ? colors.light : colors.dark,
                  opacity: isActive ? 1 : 0.6,
                  cursor: "pointer",
                }}
              >
                {page.label}
                {isActive && <div className="absolute bottom-0 left-0 right-0 h-0.5" style={{ backgroundColor: colors.bearish }} />}
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
