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
} from "lucide-react";
import { NAV_GROUPS } from "@/core/navigation";
import { Theme, MarketSession } from "@/core/types";
import type { UnderlyingSymbol } from "@/core/TimeframeContext";
import { useTimeframe } from "@/core/TimeframeContext";
import { getMarketSession } from "@/core/utils";
import { colors } from "@/core/colors";
import SessionBadge from "./SessionBadge";
import WorldClocks from "./WorldClocks";
import { useMarketQuote, useSessionCloses } from "@/hooks/useApiData";

interface HeaderProps {
  theme: Theme;
}

export default function Header({ theme }: HeaderProps) {
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
  const router = useRouter();
  const pathname = usePathname();


  const mobileNavGroups = useMemo(
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
      initial[group.label] = group.items.some((item) => pathname === item.id);
    });
    return initial;
  });


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

  useEffect(() => {
    const setHeaderHeight = () => {
      const h = headerRef.current?.offsetHeight ?? 0;
      document.documentElement.style.setProperty(
        "--zgx-header-height",
        `${h}px`,
      );
    };

    setHeaderHeight();

    const observer = new ResizeObserver(() => {
      setHeaderHeight();
    });

    if (headerRef.current) {
      observer.observe(headerRef.current);
    }

    window.addEventListener("resize", setHeaderHeight);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", setHeaderHeight);
    };
  }, [isCollapsed, mobileMenuOpen]);

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

  const border = "rgba(150,143,146,0.25)";

  return (
    <header
      ref={headerRef}
      className="border-b sticky top-0 z-40"
      style={{
        backgroundColor: theme === "dark" ? `${colors.bgDark}f2` : `${colors.bgLight}f2`,
        borderColor: border,
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
      }}
    >
      <div
        className="container mx-auto px-6"
        style={{
          paddingTop: isMobileViewport ? "4px" : isCollapsed ? "8px" : "16px",
          paddingBottom: isMobileViewport ? "4px" : isCollapsed ? "8px" : "16px",
          transition: "padding 0.3s ease",
        }}
      >
        {/* Desktop Layout */}
        <div className="hidden md:block relative">
          {isCollapsed ? (
            // Collapsed Layout - Single Line with Absolute Centered Logo
            <div
              className="relative flex items-center justify-between"
              style={{ paddingRight: "48px" }}
            >
              {/* Left: Dropdowns + Live Price */}
              <div className="flex items-center gap-4">
                <div className="flex flex-col gap-2">
                  <select
                    value={symbol}
                    onChange={(e) => setSymbol(e.target.value as UnderlyingSymbol)}
                    className="px-2 py-1 rounded-lg border text-xs font-semibold transition-all duration-200"
                    style={{
                      background:
                        theme === "dark"
                          ? `linear-gradient(135deg, ${colors.cardDark} 0%, rgba(66,61,63,0.6) 100%)`
                          : colors.cardLight,
                      borderColor: border,
                      color: theme === "dark" ? colors.light : colors.dark,
                      width: "90px",
                      backdropFilter: "blur(8px)",
                    }}
                  >
                    <option>SPY</option>
                    <option>SPX</option>
                    <option>QQQ</option>
                    <option>IWM</option>
                  </select>
                </div>

                {row1Price !== null && (
                  <div className="flex flex-col gap-1">
                    {/* Row 1: regular-session price + change (inline when market closed) */}
                    <div
                      className={(quoteSession === "open" || quoteSession === "closed") ? undefined : "flex items-center gap-2"}
                      style={(quoteSession === "open" || quoteSession === "closed") ? { display: "contents" } : undefined}
                    >
                      <span
                        className="font-bold text-xl"
                        title={row1PriceLabel}
                      >
                        ${row1Price.toFixed(2)}
                      </span>
                      {row1Change !== null && row1ChangePercent !== null && (
                        <div
                          className="flex items-center gap-1 px-2 py-0.5 rounded-lg font-semibold text-xs w-fit"
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
                            <TrendingUp size={12} strokeWidth={2.5} />
                          ) : (
                            <TrendingDown size={12} strokeWidth={2.5} />
                          )}
                          {row1Positive ? "+" : ""}
                          {row1Change.toFixed(2)} ({row1Positive ? "+" : ""}
                          {row1ChangePercent.toFixed(2)}%)
                        </div>
                      )}
                    </div>
                    {/* Row 2: extended-hours price (after-hours / pre-market only) */}
                    {showExtendedRow && row2Price !== null && row2Change !== null && row2ChangePercent !== null && (
                      <div
                        className="flex items-center gap-1.5 mt-0.5"
                        title={row2Label}
                      >
                        {extendedHoursIcon === "moon" ? (
                          <Moon size={11} style={{ color: colors.muted }} />
                        ) : (
                          <Sun size={11} style={{ color: colors.muted }} />
                        )}
                        <span
                          className="text-xs font-semibold"
                          style={{
                            color: theme === "dark" ? colors.light : colors.dark,
                            opacity: 0.8,
                          }}
                        >
                          ${row2Price.toFixed(2)}
                        </span>
                        <span
                          className="text-xs font-semibold"
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
              </div>

              {/* Absolute Center: Logo */}
              <div
                className="absolute left-1/2 top-1/2 pointer-events-none"
                style={{
                  transform: "translate(-50%, -50%)",
                }}
              >
                <Link href="/" style={{ pointerEvents: "auto", display: "flex", alignItems: "center", height: "100px", overflow: "hidden", transition: "height 0.3s ease" }}>
                  <img
                    src={
                      theme === "dark" ? "/title-dark-small.svg" : "/title-light-small.svg"
                    }
                    alt="ZeroGEX"
                    style={{
                      width: "auto",
                      height: "auto",
                    }}
                  />
                </Link>
              </div>

              {/* Right: Text Times + Session Circle (pulled in from right) */}
              <div
                className="flex items-center gap-4"
                style={{ marginRight: "24px" }}
              >
                <WorldClocks theme={theme} session={session} compact={true} />
                <div
                  onClick={() => setShowCountdown(!showCountdown)}
                  style={{ cursor: "pointer" }}
                >
                  <SessionBadge
                    session={sessionForBadge}
                    theme={theme}
                    showCountdown={showCountdown}
                    compact={true}
                  />
                </div>
              </div>

              {/* Collapse Toggle Button - Rightmost */}
              <button
                onClick={toggleCollapsed}
                className="p-2 rounded-lg transition-all duration-200 hover:bg-opacity-10 absolute right-0"
                style={{
                  color: colors.muted,
                  backgroundColor: "transparent",
                  top: "50%",
                  transform: "translateY(-50%)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = `${colors.muted}20`;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "transparent";
                }}
                aria-label="Expand header"
              >
                <ChevronDown size={20} />
              </button>
            </div>
          ) : (
            // Expanded Layout - Original with right padding for toggle button
            <div style={{ paddingRight: "48px" }}>
              <div
                className="grid"
                style={{
                  gridTemplateColumns: "1fr 1fr",
                  gap: "2rem",
                  alignItems: "center",
                }}
              >
                {/* Left Column - Dropdowns & Quote */}
                <div className="flex items-center gap-4">
                  <div className="flex flex-col gap-2">
                    <select
                      value={symbol}
                      onChange={(e) => setSymbol(e.target.value as UnderlyingSymbol)}
                      className="px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all duration-200"
                      style={{
                        background:
                          theme === "dark"
                            ? `linear-gradient(135deg, ${colors.cardDark} 0%, rgba(66,61,63,0.6) 100%)`
                            : colors.cardLight,
                        borderColor: border,
                        color: theme === "dark" ? colors.light : colors.dark,
                        width: "120px",
                        backdropFilter: "blur(8px)",
                      }}
                    >
                      <option>SPY</option>
                      <option>SPX</option>
                      <option>QQQ</option>
                      <option>IWM</option>
                    </select>
                  </div>

                  {row1Price !== null && (
                    <div className="flex flex-col gap-1">
                      {/* Row 1: regular-session price + change (inline when market closed) */}
                      <div
                        className={(quoteSession === "open" || quoteSession === "closed") ? undefined : "flex items-center gap-2"}
                        style={(quoteSession === "open" || quoteSession === "closed") ? { display: "contents" } : undefined}
                      >
                        <span
                          className="font-bold text-2xl"
                          title={row1PriceLabel}
                        >
                          ${row1Price.toFixed(2)}
                        </span>
                        {row1Change !== null && row1ChangePercent !== null && (
                          <div
                            className="flex items-center gap-1.5 px-2 py-1 rounded-lg font-semibold text-sm w-fit"
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
                      {/* Row 2: extended-hours price (after-hours / pre-market only) */}
                      {showExtendedRow && row2Price !== null && row2Change !== null && row2ChangePercent !== null && (
                        <div
                          className="flex items-center gap-1.5 mt-1"
                          title={row2Label}
                        >
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
                </div>

                {/* Right Column - with padding to avoid toggle button */}
                <div className="flex flex-col gap-2 items-end">
                  <div
                    onClick={() => setShowCountdown(!showCountdown)}
                    style={{ cursor: "pointer" }}
                  >
                    <SessionBadge
                      session={sessionForBadge}
                      theme={theme}
                      showCountdown={showCountdown}
                    />
                  </div>

                  <div className="scale-90 origin-right">
                    <WorldClocks
                      theme={theme}
                      session={session}
                      hideCountdown={true}
                    />
                  </div>
                </div>
              </div>


              {/* Absolutely centered logo */}
              <div
                className="absolute inset-0 flex items-center justify-center pointer-events-none"
                style={{ top: 0, bottom: 0 }}
              >
                <Link href="/" style={{ pointerEvents: "auto", display: "flex", alignItems: "center", height: "200px", overflow: "hidden", transition: "height 0.3s ease" }}>
                  <img
                    src={
                      theme === "dark" ? "/title-dark.svg" : "/title-light.svg"
                    }
                    alt="ZeroGEX"
                    style={{
                      width: "auto",
                      height: "300%",
                    }}
                  />
                </Link>
              </div>

              {/* Collapse Toggle Button - Top Right */}
              <button
                onClick={toggleCollapsed}
                className="absolute top-0 right-0 p-2 rounded-lg transition-all duration-200 hover:bg-opacity-10"
                style={{
                  color: colors.muted,
                  backgroundColor: "transparent",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = `${colors.muted}20`;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "transparent";
                }}
                aria-label="Collapse header"
              >
                <ChevronUp size={20} />
              </button>
            </div>
          )}
        </div>

        {/* Mobile Layout - Always Collapsed */}
        <div className="md:hidden">
          <div className="flex items-center justify-between mb-1" style={{ minHeight: "25px" }}>
            <Link href="/" style={{ display: "flex", alignItems: "center", height: "25px", overflow: "hidden" }}>
              <img
                src={theme === "dark" ? "/title-dark.svg" : "/title-light.svg"}
                alt="ZeroGEX"
                style={{
                  width: "auto",
                  height: "144px",
                }}
              />
            </Link>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-0"
              >
                {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
              </button>
            </div>
          </div>

          {mobileMenuOpen && (
            <div className="space-y-4">
              <div className="space-y-3">
                {mobileNavGroups.map((group) => {
                  const isExpanded = mobileExpandedGroups[group.label] ?? false;
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
                          {group.items.map((page) => {
                            const active = pathname === page.id;
                            const isExternal = 'external' in page && page.external;

                            if (isExternal) {
                              return (
                                <a
                                  key={page.id}
                                  href={page.id}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="px-3 py-2 rounded-lg border text-xs font-semibold text-left"
                                  style={{
                                    background: theme === 'dark' ? `linear-gradient(135deg, ${colors.cardDark} 0%, rgba(66,61,63,0.6) 100%)` : colors.cardLight,
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
                                  router.push(page.id);
                                  setMobileMenuOpen(false);
                                }}
                                className="px-3 py-2 rounded-lg border text-xs font-semibold text-left"
                                style={{
                                  background: theme === 'dark' ? `linear-gradient(135deg, ${colors.cardDark} 0%, rgba(66,61,63,0.6) 100%)` : colors.cardLight,
                                  borderColor: active ? `${colors.primary}60` : border,
                                  color: active ? colors.primary : theme === 'dark' ? colors.light : colors.dark,
                                }}
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

              <div className="flex gap-2">
                <select
                  value={symbol}
                  onChange={(e) => setSymbol(e.target.value as UnderlyingSymbol)}
                  className="flex-1 px-3 py-2 rounded-lg border text-sm font-semibold"
                  style={{
                    background:
                      theme === "dark"
                        ? `linear-gradient(135deg, ${colors.cardDark} 0%, rgba(66,61,63,0.6) 100%)`
                        : colors.cardLight,
                    borderColor: border,
                    color: theme === "dark" ? colors.light : colors.dark,
                  }}
                >
                  <option>SPY</option>
                  <option>SPX</option>
                  <option>QQQ</option>
                  <option>IWM</option>
                </select>
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
                <div
                  onClick={() => setShowCountdown(!showCountdown)}
                  style={{ cursor: "pointer" }}
                >
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
