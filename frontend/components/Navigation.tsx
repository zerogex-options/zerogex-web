"use client";

import { usePathname, useRouter } from "next/navigation";
import { MarketSession, Theme } from "@/core/types";
import { colors } from "@/core/colors";
import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { NAV_GROUPS } from "@/core/navigation";
import Link from "next/link";
import { useTimeframe } from "@/core/TimeframeContext";
import { useMarketQuote, useSessionCloses } from "@/hooks/useApiData";
import { getMarketSession } from "@/core/utils";
import SessionBadge from "./SessionBadge";
import { TrendingDown, TrendingUp } from "lucide-react";

interface NavigationProps {
  theme: Theme;
}

const SIDEBAR_WIDTH = 272;

export default function Navigation({ theme }: NavigationProps) {
  const { symbol } = useTimeframe();
  const pathname = usePathname();
  const router = useRouter();
  const [session, setSession] = useState(getMarketSession());
  const [hoveredPage, setHoveredPage] = useState<string | null>(null);
  const [sidebarVisible, setSidebarVisible] = useState(() => {
    if (typeof window === "undefined") return true;
    try {
      return localStorage.getItem("sidebarVisible") !== "false";
    } catch {
      return true;
    }
  });
  const [headerCollapsed, setHeaderCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return localStorage.getItem("headerCollapsed") === "true";
    } catch {
      return false;
    }
  });

  const navGroups = useMemo(
    () => [
      ...NAV_GROUPS,
      {
        label: "More",
        items: [
          { id: "/about", label: "About" },
          { id: "https://api.zerogex.io/docs", label: "API Specs", external: true },
        ],
      },
    ],
    [],
  );

  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    navGroups.forEach((group) => {
      initial[group.label] = group.items.some((item) => pathname === item.id);
    });
    return initial;
  });

  useEffect(() => {
    const interval = setInterval(() => setSession(getMarketSession()), 60000);
    return () => clearInterval(interval);
  }, []);

  const { data: quoteData } = useMarketQuote(symbol, 1000);
  const { data: sessionClosesData } = useSessionCloses(symbol, 60000);
  const quoteSession = quoteData?.session ?? null;
  const sessionForBadge = (quoteSession as MarketSession | null) ?? session;
  const isExtendedHours = quoteSession === "pre-market" || quoteSession === "after-hours";
  const row1Price = (isExtendedHours || quoteSession === "closed")
    ? (sessionClosesData?.current_session_close ?? null)
    : (quoteData?.close ?? null);
  const row1BaseClose = quoteSession === "open"
    ? (sessionClosesData?.current_session_close ?? null)
    : (sessionClosesData?.prior_session_close ?? null);
  const row1Change =
    row1Price !== null && row1BaseClose !== null ? row1Price - row1BaseClose : null;
  const row1ChangePercent =
    row1Change !== null && row1BaseClose ? (row1Change / row1BaseClose) * 100 : null;
  const row1Positive = row1Change !== null ? row1Change >= 0 : false;

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

  useEffect(() => {
    const handleCollapseChanged = (event: Event) => {
      const detail = (event as CustomEvent<boolean>).detail;
      setHeaderCollapsed(Boolean(detail));
    };

    window.addEventListener("header:collapse-changed", handleCollapseChanged as EventListener);
    return () =>
      window.removeEventListener("header:collapse-changed", handleCollapseChanged as EventListener);
  }, []);

  const toggleSidebar = () => {
    const next = !sidebarVisible;
    setSidebarVisible(next);
    try {
      localStorage.setItem("sidebarVisible", String(next));
    } catch {}
  };

  const border = "var(--color-border)";

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
            {headerCollapsed && (
              <div className="mb-5 rounded-xl border p-3" style={{ borderColor: border, backgroundColor: theme === "dark" ? `${colors.cardDark}c9` : `${colors.cardLight}c9` }}>
                <Link href="/" className="flex w-full items-center overflow-hidden">
                  <img
                    src={theme === "dark" ? "/title-subtitle-dark.svg" : "/title-subtitle-light.svg"}
                    alt="ZeroGEX"
                    style={{ width: "118%", maxWidth: "118%", height: "auto", objectFit: "cover", marginLeft: "-9%" }}
                  />
                </Link>
                {row1Price !== null && (
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <div className="flex flex-col gap-1">
                      <span className="font-bold text-lg">${row1Price.toFixed(2)}</span>
                      {row1Change !== null && row1ChangePercent !== null && (
                        <div className="flex items-center gap-1 px-2 py-0.5 rounded-lg font-semibold text-xs w-fit" style={{ backgroundColor: `${row1Positive ? colors.bullish : colors.bearish}1f`, color: row1Positive ? colors.bullish : colors.bearish }}>
                          {row1Positive ? <TrendingUp size={12} strokeWidth={2.5} /> : <TrendingDown size={12} strokeWidth={2.5} />}
                          {row1Positive ? "+" : ""}{row1Change.toFixed(2)} ({row1Positive ? "+" : ""}{row1ChangePercent.toFixed(2)}%)
                        </div>
                      )}
                    </div>
                    <SessionBadge session={sessionForBadge} theme={theme} compact />
                  </div>
                )}
              </div>
            )}
            {navGroups.map((group) => {
              const isExpanded = expandedGroups[group.label] ?? false;
              return (
                <div key={group.label} className="mb-4 last:mb-0">
                  <button
                    type="button"
                    onClick={() => setExpandedGroups((prev) => ({ ...prev, [group.label]: !isExpanded }))}
                    className="mb-2 flex w-full items-center justify-between rounded-lg px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em]"
                    style={{
                      color: theme === "light" ? colors.coral : colors.primary,
                      background: `${theme === "light" ? colors.coral : colors.primary}0f`,
                    }}
                  >
                    {group.label}
                    <ChevronDown
                      size={14}
                      style={{ transform: isExpanded ? "rotate(0deg)" : "rotate(-90deg)", transition: "transform 0.2s" }}
                    />
                  </button>
                  {isExpanded ? (
                    <div className="space-y-1">
                      {group.items.map((page) => {
                        const isExternal = "external" in page && page.external;
                        const isActive = pathname === page.id;
                        const isHovered = hoveredPage === page.id;
                        const commonStyle = {
                          color: isActive || isHovered
                            ? (theme === "light" ? colors.coral : colors.primary)
                            : theme === "dark"
                              ? colors.light
                              : colors.dark,
                          opacity: isActive || isHovered ? 1 : 0.72,
                          background: isHovered && !isActive
                            ? `${theme === "light" ? colors.coral : colors.primary}18`
                            : isActive
                              ? `${theme === "light" ? colors.coral : colors.primary}14`
                              : "transparent",
                          border: `1px solid ${
                            isActive || isHovered
                              ? `${theme === "light" ? colors.coral : colors.primary}40`
                              : "transparent"
                          }`,
                        };

                        if (isExternal) {
                          return (
                            <Link
                              key={page.id}
                              href={page.id}
                              target="_blank"
                              rel="noreferrer"
                              onMouseEnter={() => setHoveredPage(page.id)}
                              onMouseLeave={() => setHoveredPage(null)}
                              className="block w-full rounded-xl px-3 py-3 text-left text-sm font-semibold transition-all duration-200"
                              style={commonStyle}
                            >
                              {page.label}
                            </Link>
                          );
                        }

                        return (
                          <button
                            key={page.id}
                            onClick={() => router.push(page.id)}
                            onMouseEnter={() => setHoveredPage(page.id)}
                            onMouseLeave={() => setHoveredPage(null)}
                            className="w-full rounded-xl px-3 py-3 text-left text-sm font-semibold transition-all duration-200"
                            style={commonStyle}
                            type="button"
                          >
                            {page.label}
                          </button>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              );
            })}
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
