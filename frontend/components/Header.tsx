"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Menu,
  X,
  TrendingUp,
  TrendingDown,
  ChevronUp,
  ChevronDown,
  Moon,
  Sun,
  CircleUserRound,
  LogIn,
  LogOut,
  Rocket,
  User,
} from "lucide-react";
import { NAV_GROUPS, type NavGroup, type NavItem } from "@/core/navigation";
import { Theme, MarketSession } from "@/core/types";
import type { UnderlyingSymbol } from "@/core/TimeframeContext";
import { useTimeframe } from "@/core/TimeframeContext";
import { getMarketSession } from "@/core/utils";
import { getPrimaryPriceChangeSummary } from "@/core/priceChange";
import { colors } from "@/core/colors";
import SessionBadge from "./SessionBadge";
import WorldClocks from "./WorldClocks";
import { useMarketQuote, useSessionCloses } from "@/hooks/useApiData";
import { hasRequiredTier, normalizeTier, requiredTierForRoute } from "@/core/auth";
import { useAuthSession } from "@/hooks/useAuthSession";

interface HeaderProps {
  theme: Theme;
  onToggleTheme: () => void;
}

export default function Header({ theme, onToggleTheme }: HeaderProps) {
  const [session, setSession] = useState(getMarketSession());
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { symbol, setSymbol } = useTimeframe();
  const [showCountdown, setShowCountdown] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return localStorage.getItem("headerCollapsed") === "true";
    } catch {
      return false;
    }
  });
  const headerRef = useRef<HTMLElement | null>(null);
  const mobileTopBarRef = useRef<HTMLDivElement | null>(null);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);
  const router = useRouter();
  const pathname = usePathname();
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);


  const mobileNavGroups = useMemo<NavGroup[]>(
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

  const [mobileExpandedGroups, setMobileExpandedGroups] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    mobileNavGroups.forEach((group) => {
      const directMatch = (group.items ?? []).some((item) => pathname === item.id);
      const subMatch = (group.subgroups ?? []).some((sg) =>
        sg.items.some((item) => pathname === item.id),
      );
      initial[group.label] = directMatch || subMatch;
      (group.subgroups ?? []).forEach((sg) => {
        initial[`${group.label}::${sg.label}`] = sg.items.some(
          (item) => pathname === item.id,
        );
      });
    });
    return initial;
  });
  const { data: authSession, refresh: refreshAuth } = useAuthSession();
  const currentTier = authSession?.user?.tier ?? "public";
  const isPublicUser = normalizeTier(currentTier) === "public";
  const shouldForcePricing = (id: string) => {
    if (!isPublicUser) return false;
    if (id === "https://api.zerogex.io/docs") return true;
    return !hasRequiredTier(id, currentTier) && requiredTierForRoute(id) === "pro";
  };
  const resolveNavTarget = (id: string) => (shouldForcePricing(id) ? "/pricing" : id);
  const filteredMobileNavGroups = useMemo(
    () =>
      mobileNavGroups
        .map((group) => {
          const bypassTierCheck = group.label === "Signals";
          const keepItem = (item: NavItem) => {
            if (item.external) return true;
            if (bypassTierCheck) return true;
            return hasRequiredTier(item.id, currentTier);
          };
          const items = (group.items ?? []).filter(keepItem);
          const subgroups = (group.subgroups ?? [])
            .map((sg) => ({ ...sg, items: sg.items.filter(keepItem) }))
            .filter((sg) => sg.items.length > 0);
          return { ...group, items, subgroups };
        })
        .filter((group) => group.items.length + group.subgroups.length > 0),
    [mobileNavGroups, currentTier],
  );


  // Fetch real market data
  const { data: quoteData } = useMarketQuote(symbol, 1000);
  const { data: sessionClosesData } = useSessionCloses(symbol, 60000);

  // Save collapsed state to localStorage
  const toggleCollapsed = () => {
    const newState = !isCollapsed;
    setIsCollapsed(newState);
    localStorage.setItem("headerCollapsed", String(newState));
    window.dispatchEvent(
      new CustomEvent("header:collapse-changed", { detail: newState }),
    );
  };


  useEffect(() => {
    const syncViewport = () => setIsMobileViewport(window.innerWidth < 768);
    syncViewport();
    window.addEventListener("resize", syncViewport);
    return () => window.removeEventListener("resize", syncViewport);
  }, []);
  const handleLogout = async () => {
    const csrfResponse = await fetch("/api/auth/csrf");
    const csrf = (await csrfResponse.json()) as { csrfToken: string };
    await fetch("/api/auth/logout", {
      method: "POST",
      headers: {
        "x-csrf-token": csrf.csrfToken,
      },
    });
    await refreshAuth();
    router.push("/login");
  };

  useEffect(() => {
    const setHeaderHeight = () => {
      const h = headerRef.current?.offsetHeight ?? 0;
      document.documentElement.style.setProperty(
        "--zgx-header-height",
        `${h}px`,
      );
      const topBar = mobileTopBarRef.current?.offsetHeight ?? 0;
      document.documentElement.style.setProperty(
        "--zgx-mobile-topbar-height",
        `${topBar}px`,
      );
    };

    setHeaderHeight();

    const observer = new ResizeObserver(() => {
      setHeaderHeight();
    });

    if (headerRef.current) {
      observer.observe(headerRef.current);
    }
    if (mobileTopBarRef.current) {
      observer.observe(mobileTopBarRef.current);
    }

    window.addEventListener("resize", setHeaderHeight);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", setHeaderHeight);
    };
  }, [isCollapsed, mobileMenuOpen]);

  useEffect(() => {
    const closeOnOutside = (event: MouseEvent) => {
      if (!profileMenuRef.current) return;
      if (!profileMenuRef.current.contains(event.target as Node)) {
        setProfileMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", closeOnOutside);
    return () => document.removeEventListener("mousedown", closeOnOutside);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setSession(getMarketSession());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  // Session from the API is the authoritative source; fall back to locally
  // computed value only while the first quote response is still in-flight.
  const quoteSession = quoteData?.session ?? null;
  const sessionForBadge = (quoteSession as MarketSession | null) ?? session;

  const isExtendedHours = quoteSession === "pre-market" || quoteSession === "after-hours";
  const extendedHoursIcon = quoteSession === "pre-market" ? "sun" : "moon";

  // ── Row 1 ─────────────────────────────────────────────────────────────────
  // open     → live quote close  vs  current_session_close
  // closed   → live quote close  vs  prior_session_close
  // pre/ah   → current_session_close  vs  prior_session_close
  const {
    displayPrice: row1Price,
    change: row1Change,
    changePercent: row1ChangePercent,
    isPositive: row1Positive,
  } = getPrimaryPriceChangeSummary({
    quoteClose: quoteData?.close,
    quoteSession,
    sessionCloses: sessionClosesData,
  });

  // ── Row 2 (pre-market / after-hours only) ────────────────────────────────
  // pre/ah → icon + live quote close  vs  current_session_close
  const showExtendedRow = isExtendedHours && !!quoteData && !!sessionClosesData;

  const row2Price = quoteData?.close ?? null;
  const row2BaseClose = sessionClosesData?.current_session_close ?? null;
  const row2Change =
    row2Price !== null && row2BaseClose !== null ? row2Price - row2BaseClose : null;
  const row2ChangePercent =
    row2Change !== null && row2BaseClose ? (row2Change / row2BaseClose) * 100 : null;
  const row2Positive = row2Change !== null ? row2Change >= 0 : false;

  // ── Labels / tooltips ────────────────────────────────────────────────────
  const formatEtDateTime = (ts: string) => {
    try {
      return new Date(ts).toLocaleString("en-US", {
        timeZone: "America/New_York",
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }) + " ET";
    } catch {
      return ts;
    }
  };

  const row1PriceLabel = (isExtendedHours || quoteSession === "closed")
    ? (sessionClosesData?.current_session_close_ts
        ? `Closing price as of ${formatEtDateTime(sessionClosesData.current_session_close_ts)}`
        : "regular session close")
    : (quoteData?.timestamp ? `as of ${formatEtDateTime(quoteData.timestamp)}` : "latest quote");

  const row1ChangeLabel = quoteSession === "open"
    ? (sessionClosesData?.current_session_close_ts
        ? `vs close ${formatEtDateTime(sessionClosesData.current_session_close_ts)}`
        : "vs previous close")
    : (sessionClosesData?.prior_session_close_ts
        ? `vs close ${formatEtDateTime(sessionClosesData.prior_session_close_ts)}`
        : "vs previous close");

  const row2SessionLabel = session === "pre-market" ? "Pre-market" : "After-hours";
  const row2Label = quoteData?.timestamp
    ? `${row2SessionLabel} price as of ${formatEtDateTime(quoteData.timestamp)}`
    : `${row2SessionLabel} price`;
  const row2ChangeLabel = sessionClosesData?.current_session_close_ts
    ? `vs close ${formatEtDateTime(sessionClosesData.current_session_close_ts)}`
    : "vs regular session close";

  const border = "var(--color-border)";

  return (
    <header
      ref={headerRef}
      className="border-b sticky top-0 z-40"
      style={{
        backgroundColor: "transparent",
        borderColor: isCollapsed ? "transparent" : border,
        backdropFilter: isCollapsed ? "none" : "blur(20px)",
        WebkitBackdropFilter: isCollapsed ? "none" : "blur(20px)",
      }}
    >
      <div
        className="w-full px-0"
        style={{
          paddingTop: isMobileViewport ? "2px" : isCollapsed ? "2px" : "8px",
          paddingBottom: isMobileViewport ? "2px" : isCollapsed ? "2px" : "8px",
          transition: "padding 0.3s ease",
        }}
      >
        {/* Desktop Layout */}
        <div className="hidden md:block relative">
          <div className="relative flex items-center justify-between" style={{ minHeight: isCollapsed ? "42px" : "72px", paddingRight: "40px", paddingLeft: "10px" }}>
            <div className="flex items-center" style={{ gap: isCollapsed ? "14px" : "20px" }}>
                <button
                  onClick={onToggleTheme}
                  className="rounded-full border p-2 transition-colors"
                  style={{ borderColor: border, color: colors.muted, backgroundColor: "transparent", cursor: "pointer", marginLeft: "12px", marginRight: "12px" }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = `${colors.accent}26`; e.currentTarget.style.color = colors.accent; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; e.currentTarget.style.color = colors.muted; }}
                  aria-label="Toggle theme"
                >
                  {theme === "dark" ? <Moon size={20} /> : <Sun size={20} />}
                </button>
                {isCollapsed && (
                  <div ref={profileMenuRef} style={{ position: "relative" }}>
                    <button
                      type="button"
                      onClick={() => setProfileMenuOpen((prev) => !prev)}
                      className="rounded-full border p-2"
                      style={{ borderColor: border, color: colors.muted, background: "transparent" }}
                      aria-label="Open profile menu"
                    >
                      <CircleUserRound size={24} />
                    </button>
                    {profileMenuOpen && (
                      <div
                        className="rounded-lg border p-1.5"
                        style={{
                          position: "absolute",
                          left: 0,
                          top: "calc(100% + 8px)",
                          minWidth: "170px",
                          borderColor: border,
                          background: theme === "dark" ? `${colors.cardDark}f2` : `${colors.cardLight}f2`,
                          boxShadow: "0 8px 26px rgba(0,0,0,0.25)",
                          zIndex: 60,
                        }}
                      >
                        {authSession?.authenticated && (
                          <button
                            type="button"
                            onClick={() => {
                              setProfileMenuOpen(false);
                              router.push("/account");
                            }}
                            className="w-full rounded-md px-2.5 py-2 text-left text-xs font-semibold"
                            style={{ color: theme === "dark" ? colors.light : colors.dark }}
                          >
                            <span className="inline-flex items-center gap-2"><User size={14} />Account</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setProfileMenuOpen(false);
                            router.push("/pricing");
                          }}
                          className="w-full rounded-md px-2.5 py-2 text-left text-xs font-semibold"
                          style={{ color: theme === "dark" ? colors.light : colors.dark }}
                        >
                          <span className="inline-flex items-center gap-2"><Rocket size={14} />Upgrade</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setProfileMenuOpen(false);
                            if (authSession?.authenticated) {
                              void handleLogout();
                              return;
                            }
                            router.push("/login");
                          }}
                          className="w-full rounded-md px-2.5 py-2 text-left text-xs font-semibold"
                          style={{ color: theme === "dark" ? colors.light : colors.dark }}
                        >
                          <span className="inline-flex items-center gap-2">
                            {authSession?.authenticated ? <LogOut size={14} /> : <LogIn size={14} />}
                            {authSession?.authenticated ? "Logout" : "Login"}
                          </span>
                        </button>
                      </div>
                    )}
                  </div>
                )}
                {isCollapsed && (
                  <select
                    value={symbol}
                    onChange={(e) => setSymbol(e.target.value as UnderlyingSymbol)}
                    className="px-2 py-1 rounded-lg border text-xs font-semibold transition-all duration-200"
                    style={{
                      background: theme === "dark" ? `${colors.cardDark}cc` : `${colors.cardLight}cc`,
                      borderColor: border,
                      color: theme === "dark" ? colors.light : colors.dark,
                      width: "90px",
                      backdropFilter: "blur(8px)",
                    }}
                  >
                    <option>SPY</option>
                    <option>SPX</option>
                    <option>QQQ</option>
                  </select>
                )}
                {!isCollapsed && (
                  <div onClick={() => setShowCountdown(!showCountdown)}>
                    <SessionBadge session={sessionForBadge} theme={theme} showCountdown={showCountdown} />
                  </div>
                )}
                {!isCollapsed && row1Price !== null && (
                  <div className="flex flex-col gap-0.5">
                    <div className={(quoteSession === "open" || quoteSession === "closed") ? undefined : "flex items-center gap-2"} style={(quoteSession === "open" || quoteSession === "closed") ? { display: "contents" } : undefined}>
                      <span className="font-bold" style={{ fontSize: "1.5rem", lineHeight: 1.05 }} title={row1PriceLabel}>${row1Price.toFixed(2)}</span>
                      {row1Change !== null && row1ChangePercent !== null && (
                        <div className="flex items-center gap-1 px-2 py-1 rounded-lg font-semibold w-fit" title={row1ChangeLabel} style={{ backgroundColor: `${row1Positive ? colors.bullish : colors.bearish}1f`, color: row1Positive ? colors.bullish : colors.bearish, fontSize: "12px" }}>
                          {row1Positive ? <TrendingUp size={12} strokeWidth={2.5} /> : <TrendingDown size={12} strokeWidth={2.5} />}
                          {row1Positive ? "+" : ""}{row1Change.toFixed(2)} ({row1Positive ? "+" : ""}{row1ChangePercent.toFixed(2)}%)
                        </div>
                      )}
                    </div>
                    {showExtendedRow && row2Price !== null && row2Change !== null && row2ChangePercent !== null && (
                      <div className="flex items-center gap-1.5 mt-0.5" title={row2Label}>
                        {extendedHoursIcon === "moon" ? <Moon size={11} style={{ color: colors.muted }} /> : <Sun size={11} style={{ color: colors.muted }} />}
                        <span className="text-xs font-semibold" style={{ color: theme === "dark" ? colors.light : colors.dark, opacity: 0.8 }}>${row2Price.toFixed(2)}</span>
                        <span className="text-xs font-semibold" title={row2ChangeLabel} style={{ color: row2Positive ? colors.bullish : colors.bearish }}>
                          {row2Positive ? "+" : ""}{row2Change.toFixed(2)} ({row2Positive ? "+" : ""}{row2ChangePercent.toFixed(2)}%)
                        </span>
                      </div>
                    )}
                  </div>
                )}
            </div>

            {!isCollapsed && (
            <div className="absolute left-1/2 top-1/2 pointer-events-none" style={{ transform: "translate(-50%, -50%)" }}>
              <Link href="/" style={{ pointerEvents: "auto", display: "flex", alignItems: "center", height: "100px", overflow: "hidden", padding: 0, margin: 0, lineHeight: 0 }}>
                <img
                  src="/title.svg"
                  alt="ZeroGEX"
                  style={{ width: "auto", height: "150%", maxWidth: "none", maxHeight: "none", objectFit: "contain", objectPosition: "center", display: "block", margin: 0, padding: 0 }}
                />
              </Link>
            </div>
            )}

            {!isCollapsed && (
              <div
                className="absolute top-1/2 pointer-events-none"
                style={{ left: "75%", transform: "translate(-50%, -50%)" }}
              >
                <div className="flex flex-col items-center gap-1.5" style={{ pointerEvents: "auto" }}>
                  <WorldClocks theme={theme} session={session} compact={isCollapsed} />
                  <select
                    value={symbol}
                    onChange={(e) => setSymbol(e.target.value as UnderlyingSymbol)}
                    className="px-2 py-1 rounded-lg border text-xs font-semibold transition-all duration-200"
                    style={{
                      background: theme === "dark" ? `${colors.cardDark}cc` : `${colors.cardLight}cc`,
                      borderColor: border,
                      color: theme === "dark" ? colors.light : colors.dark,
                      width: "96px",
                      backdropFilter: "blur(8px)",
                    }}
                  >
                    <option>SPY</option>
                    <option>SPX</option>
                    <option>QQQ</option>
                  </select>
                </div>
              </div>
            )}

            {!isCollapsed && (
              <div className="flex items-center gap-3" style={{ marginRight: "24px" }}>
                <div ref={profileMenuRef} style={{ position: "relative" }}>
                  <button
                    type="button"
                    onClick={() => setProfileMenuOpen((prev) => !prev)}
                    className="rounded-full border p-2"
                    style={{ borderColor: border, color: colors.muted, background: "transparent" }}
                    aria-label="Open profile menu"
                  >
                    <CircleUserRound size={24} />
                  </button>
                  {profileMenuOpen && (
                    <div
                      className="rounded-lg border p-1.5"
                      style={{
                        position: "absolute",
                        right: 0,
                        top: "calc(100% + 8px)",
                        minWidth: "170px",
                        borderColor: border,
                        background: theme === "dark" ? `${colors.cardDark}f2` : `${colors.cardLight}f2`,
                        boxShadow: "0 8px 26px rgba(0,0,0,0.25)",
                        zIndex: 60,
                      }}
                    >
                      {authSession?.authenticated && (
                        <button
                          type="button"
                          onClick={() => {
                            setProfileMenuOpen(false);
                            router.push("/account");
                          }}
                          className="w-full rounded-md px-2.5 py-2 text-left text-xs font-semibold"
                          style={{ color: theme === "dark" ? colors.light : colors.dark }}
                        >
                          <span className="inline-flex items-center gap-2"><User size={14} />Account</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setProfileMenuOpen(false);
                          router.push("/pricing");
                        }}
                        className="w-full rounded-md px-2.5 py-2 text-left text-xs font-semibold"
                        style={{ color: theme === "dark" ? colors.light : colors.dark }}
                      >
                        <span className="inline-flex items-center gap-2"><Rocket size={14} />Upgrade</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setProfileMenuOpen(false);
                          if (authSession?.authenticated) {
                            void handleLogout();
                            return;
                          }
                          router.push("/login");
                        }}
                        className="w-full rounded-md px-2.5 py-2 text-left text-xs font-semibold"
                        style={{ color: theme === "dark" ? colors.light : colors.dark }}
                      >
                        <span className="inline-flex items-center gap-2">
                          {authSession?.authenticated ? <LogOut size={14} /> : <LogIn size={14} />}
                          {authSession?.authenticated ? "Logout" : "Login"}
                        </span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            <button
              onClick={toggleCollapsed}
              className="p-2 rounded-lg transition-all duration-200 hover:bg-opacity-10 absolute"
              style={{ color: colors.muted, backgroundColor: "transparent", top: "50%", transform: "translateY(-50%)", right: "12px" }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = `${colors.muted}20`; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
              aria-label={isCollapsed ? "Expand header" : "Collapse header"}
            >
              {isCollapsed ? <ChevronDown size={20} /> : <ChevronUp size={20} />}
            </button>
          </div>
        </div>

        {/* Mobile Layout - Always Collapsed */}
        <div className="md:hidden">
          <div ref={mobileTopBarRef} className="flex items-center justify-between mb-1 min-w-0 w-full" style={{ minHeight: "36px" }}>
            <Link href="/" className="flex items-center overflow-hidden min-w-0" style={{ height: "36px", maxWidth: "min(66vw, 240px)", padding: 0, margin: 0, lineHeight: 0 }}>
              <img
                src="/title.svg"
                alt="ZeroGEX"
                style={{
                  height: "130%",
                  width: "auto",
                  maxHeight: "none",
                  maxWidth: "none",
                  objectFit: "contain",
                  objectPosition: "left center",
                  display: "block",
                  margin: 0,
                  padding: 0,
                }}
              />
            </Link>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={onToggleTheme}
                className="rounded-full border p-1"
                style={{ borderColor: border, color: colors.muted, backgroundColor: "transparent" }}
                aria-label="Toggle theme"
              >
                {theme === "dark" ? <Moon size={14} /> : <Sun size={14} />}
              </button>
              <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="p-0 mr-1">
                {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
              </button>
            </div>
          </div>

          {mobileMenuOpen && (
            <div
              className="space-y-4 overflow-y-auto overscroll-contain"
              style={{
                maxHeight:
                  "calc(100dvh - var(--zgx-mobile-topbar-height, 44px))",
              }}
            >
              <div className="space-y-3">
                {filteredMobileNavGroups.map((group) => {
                  const isExpanded = mobileExpandedGroups[group.label] ?? false;
                  const renderItem = (page: NavItem) => {
                    const active = pathname === page.id;
                    const isExternal = page.external === true;

                    if (isExternal) {
                      const targetHref = resolveNavTarget(page.id);
                      return (
                        <a
                          key={page.id}
                          href={targetHref}
                          target={targetHref.startsWith("http") ? "_blank" : undefined}
                          rel={targetHref.startsWith("http") ? "noreferrer" : undefined}
                          className="px-3 py-2 rounded-lg border text-xs font-semibold text-left"
                          style={{
                            background: theme === 'dark' ? `linear-gradient(135deg, ${colors.cardDark} 0%, var(--bg-active) 100%)` : colors.cardLight,
                            borderColor: border,
                            color: theme === 'dark' ? colors.light : colors.dark,
                          }}
                        >
                          {page.label}
                        </a>
                      );
                    }

                    return (
                      <button
                        key={page.id}
                        onClick={() => {
                          router.push(resolveNavTarget(page.id));
                          setMobileMenuOpen(false);
                        }}
                        className="px-3 py-2 rounded-lg border text-xs font-semibold text-left"
                        style={{
                          background: theme === 'dark' ? `linear-gradient(135deg, ${colors.cardDark} 0%, var(--bg-active) 100%)` : colors.cardLight,
                          borderColor: active ? `${colors.primary}60` : border,
                          color: active ? colors.primary : theme === 'dark' ? colors.light : colors.dark,
                        }}
                      >
                        {page.label}
                      </button>
                    );
                  };

                  return (
                    <div key={group.label} className="rounded-lg border p-3" style={{ borderColor: border }}>
                      <button
                        type="button"
                        onClick={() => setMobileExpandedGroups((prev) => ({ ...prev, [group.label]: !isExpanded }))}
                        className="mb-2 flex w-full items-center justify-between text-[11px] font-semibold uppercase tracking-[0.18em]"
                        style={{ color: colors.primary }}
                      >
                        {group.label}
                        <ChevronDown size={14} style={{ transform: isExpanded ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 0.2s' }} />
                      </button>
                      {isExpanded ? (
                        <div className="grid grid-cols-1 gap-2">
                          {group.items.map(renderItem)}
                          {group.subgroups.map((subgroup) => {
                            const subKey = `${group.label}::${subgroup.label}`;
                            const isSubExpanded = mobileExpandedGroups[subKey] ?? false;
                            return (
                              <div key={subKey} className="mt-1 pl-2 border-l" style={{ borderColor: `${colors.primary}33` }}>
                                <button
                                  type="button"
                                  onClick={() => setMobileExpandedGroups((prev) => ({ ...prev, [subKey]: !isSubExpanded }))}
                                  className="mb-1 flex w-full items-center justify-between text-[10px] font-semibold uppercase tracking-[0.16em]"
                                  style={{ color: theme === "dark" ? colors.light : colors.dark, opacity: 0.8 }}
                                >
                                  {subgroup.label}
                                  <ChevronDown size={12} style={{ transform: isSubExpanded ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 0.2s' }} />
                                </button>
                                {isSubExpanded ? (
                                  <div className="grid grid-cols-1 gap-2">
                                    {subgroup.items.map(renderItem)}
                                  </div>
                                ) : null}
                              </div>
                            );
                          })}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>

              <div className="flex gap-2">
                <select
                  value={symbol}
                  onChange={(e) => setSymbol(e.target.value as UnderlyingSymbol)}
                  className="flex-1 px-3 py-2 rounded-lg border text-sm font-semibold"
                  style={{
                    background:
                      theme === "dark"
                        ? `linear-gradient(135deg, ${colors.cardDark} 0%, var(--bg-active) 100%)`
                        : colors.cardLight,
                    borderColor: border,
                    color: theme === "dark" ? colors.light : colors.dark,
                  }}
                >
                  <option>SPY</option>
                  <option>SPX</option>
                  <option>QQQ</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {authSession?.authenticated && (
                  <button
                    type="button"
                    onClick={() => {
                      router.push("/account");
                      setMobileMenuOpen(false);
                    }}
                    className="rounded-lg border px-3 py-2 text-sm font-semibold col-span-2"
                    style={{ borderColor: border, color: colors.muted }}
                  >
                    Account
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    router.push("/pricing");
                    setMobileMenuOpen(false);
                  }}
                  className="rounded-lg border px-3 py-2 text-sm font-semibold"
                  style={{ borderColor: border, color: colors.muted }}
                >
                  Upgrade
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (authSession?.authenticated) {
                      void handleLogout();
                      return;
                    }
                    router.push("/login");
                    setMobileMenuOpen(false);
                  }}
                  className="rounded-lg border px-3 py-2 text-sm font-semibold"
                  style={{ borderColor: border, color: colors.muted }}
                >
                  {authSession?.authenticated ? "Log out" : "Login"}
                </button>
              </div>

              {row1Price !== null && (
                <div className="flex flex-col gap-1.5">
                  {/* Row 1 */}
                  <div className="flex items-center gap-3 flex-wrap">
                    <span
                      className="font-bold text-2xl"
                      title={row1PriceLabel}
                    >
                      ${row1Price.toFixed(2)}
                    </span>
                    {row1Change !== null && row1ChangePercent !== null && (
                      <div
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-semibold text-sm"
                        title={row1ChangeLabel}
                        style={{
                          backgroundColor:
                            theme === "dark"
                              ? `${row1Positive ? colors.bullish : colors.bearish}15`
                              : `${row1Positive ? colors.bullish : colors.bearish}10`,
                          color: row1Positive ? colors.bullish : colors.bearish,
                        }}
                      >
                        {row1Positive ? (
                          <TrendingUp size={14} strokeWidth={2.5} />
                        ) : (
                          <TrendingDown size={14} strokeWidth={2.5} />
                        )}
                        {row1Positive ? "+" : ""}
                        {row1Change.toFixed(2)} ({row1Positive ? "+" : ""}
                        {row1ChangePercent.toFixed(2)}%)
                      </div>
                    )}
                  </div>
                  {/* Row 2: extended-hours */}
                  {showExtendedRow && row2Price !== null && row2Change !== null && row2ChangePercent !== null && (
                    <div className="flex items-center gap-1.5" title={row2Label}>
                      {extendedHoursIcon === "moon" ? (
                        <Moon size={13} style={{ color: colors.muted }} />
                      ) : (
                        <Sun size={13} style={{ color: colors.muted }} />
                      )}
                      <span
                        className="text-sm font-semibold"
                        style={{
                          color: theme === "dark" ? colors.light : colors.dark,
                          opacity: 0.8,
                        }}
                      >
                        ${row2Price.toFixed(2)}
                      </span>
                      <span
                        className="text-sm font-semibold"
                        title={row2ChangeLabel}
                        style={{ color: row2Positive ? colors.bullish : colors.bearish }}
                      >
                        {row2Positive ? "+" : ""}
                        {row2Change.toFixed(2)} ({row2Positive ? "+" : ""}
                        {row2ChangePercent.toFixed(2)}%)
                      </span>
                    </div>
                  )}
                </div>
              )}

              <WorldClocks theme={theme} session={session} />
              <div className="flex items-center gap-2">
                <div onClick={() => setShowCountdown(!showCountdown)}>
                  <SessionBadge
                    session={session}
                    theme={theme}
                    showCountdown={showCountdown}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
