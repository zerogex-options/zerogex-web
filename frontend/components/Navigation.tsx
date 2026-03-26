"use client";

import { usePathname, useRouter } from "next/navigation";
import { Theme } from "@/core/types";
import { colors } from "@/core/colors";
import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { NAV_GROUPS } from "@/core/navigation";
import Link from "next/link";

interface NavigationProps {
  theme: Theme;
}

const SIDEBAR_WIDTH = 272;

export default function Navigation({ theme }: NavigationProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [hoveredPage, setHoveredPage] = useState<string | null>(null);
  const [sidebarVisible, setSidebarVisible] = useState(() => {
    if (typeof window === "undefined") return true;
    try {
      return localStorage.getItem("sidebarVisible") !== "false";
    } catch {
      return true;
    }
  });

  useEffect(() => {
    const syncNavVars = () => {
      const desktop = typeof window !== "undefined" && window.innerWidth >= 768;
      const width = sidebarVisible && desktop ? SIDEBAR_WIDTH : 0;
      document.documentElement.style.setProperty("--zgx-nav-height", "0px");
      document.documentElement.style.setProperty("--zgx-nav-width", `${width}px`);
    };

    syncNavVars();
    window.addEventListener("resize", syncNavVars);
    return () => window.removeEventListener("resize", syncNavVars);
  }, [sidebarVisible]);

  const toggleSidebar = () => {
    const next = !sidebarVisible;
    setSidebarVisible(next);
    try {
      localStorage.setItem("sidebarVisible", String(next));
    } catch {}
  };

  const border = "rgba(150,143,146,0.25)";

  return (
    <>
      {sidebarVisible ? (
        <nav
          className="group/sidebar hidden md:block fixed left-0 z-30 border-r"
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
            {NAV_GROUPS.map((group) => (
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

            <div className="mt-6 border-t pt-4" style={{ borderColor: border }}>
              <div
                className="mb-3 px-3 text-[11px] font-semibold uppercase tracking-[0.18em]"
                style={{ color: colors.primary }}
              >
                More
              </div>
              <div className="space-y-1">
                <button
                  onClick={() => router.push("/about")}
                  className="w-full rounded-xl px-3 py-3 text-left text-sm font-semibold transition-all duration-200"
                  style={{ color: theme === "dark" ? colors.light : colors.dark, opacity: 0.72 }}
                  type="button"
                >
                  About
                </button>
                <Link
                  href="https://api.zerogex.io/docs"
                  target="_blank"
                  rel="noreferrer"
                  className="block w-full rounded-xl px-3 py-3 text-left text-sm font-semibold transition-all duration-200"
                  style={{ color: theme === "dark" ? colors.light : colors.dark, opacity: 0.72 }}
                >
                  API Specs
                </Link>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={toggleSidebar}
            className="absolute -right-9 top-4 flex h-14 w-9 items-center justify-center rounded-r-xl border border-l-0 opacity-0 transition-opacity duration-150 group-hover/sidebar:opacity-100 focus-visible:opacity-100"
            style={{
              backgroundColor: theme === "dark" ? `${colors.cardDark}f2` : `${colors.cardLight}f2`,
              borderColor: border,
              color: colors.muted,
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
            }}
            aria-label="Hide left navigation"
          >
            <ChevronLeft size={18} />
          </button>
        </nav>
      ) : (
        <button
          type="button"
          onClick={toggleSidebar}
          className="hidden md:flex fixed z-30 items-center gap-1 rounded-r-xl border border-l-0 px-2"
          style={{
            left: 0,
            top: "calc(var(--zgx-header-height, 0px) + 18px)",
            height: "56px",
            backgroundColor: theme === "dark" ? `${colors.cardDark}f2` : `${colors.cardLight}f2`,
            borderColor: border,
            color: colors.muted,
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
          }}
          aria-label="Show left navigation"
        >
          <ChevronRight size={18} />
          <span className="text-[10px] font-semibold uppercase tracking-wide">menu</span>
        </button>
      )}
    </>
  );
}
