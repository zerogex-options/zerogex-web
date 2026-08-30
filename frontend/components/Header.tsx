"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import Image from "next/image";
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
  Search,
} from "lucide-react";
import { NAV_GROUPS, type NavGroup, type NavItem } from "@/core/navigation";
import AccountMenu from "./AccountMenu";
import BetaBadge from "./BetaBadge";
import TierBadge from "./TierBadge";
import ThemeDropdown from "./ThemeDropdown";
import LanguageDropdown from "./LanguageDropdown";
import { useLanguage } from "@/core/LanguageContext";
import { Theme, MarketSession } from "@/core/types";
import type { UnderlyingSymbol } from "@/core/TimeframeContext";
import { useTimeframe } from "@/core/TimeframeContext";
import { SYMBOLS } from "@/core/symbols";
import { getMarketSession } from "@/core/utils";
import { getPrimaryPriceChangeSummary, getExtendedHoursRow } from "@/core/priceChange";
import { brandTitle } from "@/core/brand";
import SessionBadge from "./SessionBadge";
import FuturesDelayBadge from "./FuturesDelayBadge";
import WorldClocks from "./WorldClocks";
import OptionsCalendarBadge from "./OptionsCalendarBadge";
import NewsHeadlinesBadge from "./NewsHeadlinesBadge";
import { useMarketQuote, useSessionCloses } from "@/hooks/useApiData";
import { hasTierAccess, navItemRequiredTier, normalizeTier, type TierId } from "@/core/auth";
import { useAuthSession } from "@/hooks/useAuthSession";

interface HeaderProps {
  theme: Theme;
  onToggleTheme: () => void;
}

export default function Header({ theme, onToggleTheme }: HeaderProps) {
  const { t } = useLanguage();
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
  const router = useRouter();
  const pathname = usePathname();


  const mobileNavGroups = useMemo<NavGroup[]>(
    () => [
      ...NAV_GROUPS,
      {
        label: "More",
        labelKey: "nav.group.more",
        items: [
          { id: "/about", label: "About", labelKey: "nav.about" },
          // Chart-platform integrations. Brand names, so no labelKey — they
          // stay English in every locale, same as "API Specs".
          { id: "/tradingview-indicator", label: "TradingView Indicator" },
          { id: "/ninjatrader-indicator", label: "NinjaTrader Indicator" },
          { id: "https://api.zerogex.io/docs", label: "API Specs", external: true },
          // mailto: — `external` keeps it an <a href> rather than a router.push,
          // and the http-only target/rel check leaves it opening in the same tab
          // so the mail client takes over instead of leaving a blank window.
          { id: "mailto:support@zerogex.io", label: "Support", labelKey: "nav.support", external: true },
        ],
      },
    ],
    [],
  );
  // Translated nav label when the entry carries a labelKey; English otherwise.
  const navLabel = (entry: { label: string; labelKey?: NavItem["labelKey"] }) =>
    entry.labelKey ? t(entry.labelKey) : entry.label;

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
  const canUpgrade = (() => {
    const t = normalizeTier(currentTier);
    return t !== "pro" && t !== "admin";
  })();
  const normalizedTier = normalizeTier(currentTier);
  // Effective required tier for a nav entry — the stricter of its declared tier
  // and its enforced route rule (navItemRequiredTier); null means public.
  const entryRequiredTier = (entry: { id?: string; requiredTier?: NavItem["requiredTier"] }): TierId | null =>
    navItemRequiredTier(entry.id, entry.requiredTier ?? null);
  const canAccessEntry = (entry: { id?: string; requiredTier?: NavItem["requiredTier"] }) =>
    hasTierAccess(normalizedTier, entryRequiredTier(entry));
  // Badge to show on an entry the current member can see but not open yet, or
  // null when it's accessible (or an admin-only tool, which is hidden entirely).
  const lockedTier = (entry: { id?: string; requiredTier?: NavItem["requiredTier"] }): TierId | null => {
    const needed = entryRequiredTier(entry);
    if (!needed || needed === "admin") return null;
    return hasTierAccess(normalizedTier, needed) ? null : needed;
  };
  const shouldForcePricing = (entry: { id: string; requiredTier?: NavItem["requiredTier"] }) => {
    // API Specs is a Pro-tier entitlement per the pricing page, so anyone
    // below Pro (public + basic) is routed to /pricing instead of the docs.
    if (entry.id === "https://api.zerogex.io/docs") {
      return !hasTierAccess(normalizedTier, "pro");
    }
    // Locked items (shown to signed-in members with a TierBadge) route to the
    // pricing page instead of bouncing off the middleware to /unauthorized.
    return !canAccessEntry(entry);
  };
  const resolveNavTarget = (entry: { id: string; requiredTier?: NavItem["requiredTier"] }) =>
    shouldForcePricing(entry) ? "/pricing" : entry.id;
  const filteredMobileNavGroups = useMemo(
    () => {
      // Self-contained access check (mirrors canAccessEntry) so this hook does
      // not close over component-scope helpers.
      const canAccess = (entry: { id?: string; requiredTier?: NavItem["requiredTier"] }) =>
        hasTierAccess(normalizeTier(currentTier), navItemRequiredTier(entry.id, entry.requiredTier ?? null));
      return mobileNavGroups
        .map((group) => {
          const keepItem = (item: NavItem) => {
            if (item.external) return true;
            // Admin tools are never advertised to non-admins.
            if (item.requiredTier === "admin") return canAccess(item);
            // Signed-in members also see higher-tier items — they render locked,
            // with a TierBadge that routes to /pricing on click. Logged-out and
            // unpaid visitors only see what their tier can actually open.
            if (isPublicUser) return canAccess(item);
            return true;
          };
          const items = (group.items ?? []).filter(keepItem);
          const subgroups = (group.subgroups ?? [])
            .map((sg) => ({ ...sg, items: sg.items.filter(keepItem) }))
            .filter((sg) => sg.items.length > 0 || (sg.id != null && (!isPublicUser || canAccess(sg))));
          return { ...group, items, subgroups };
        })
        .filter((group) => group.items.length + group.subgroups.length > 0);
    },
    [mobileNavGroups, currentTier, isPublicUser],
  );


  // Fetch real market data
  const { data: quoteData } = useMarketQuote(symbol, 1000);
  const { data: sessionClosesData } = useSessionCloses(symbol, 60000, quoteData?.session ?? null);

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
    localStorage.removeItem("zgx_symbol");
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
    const interval = setInterval(() => {
      setSession(getMarketSession());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  // Session from the API is the authoritative source; fall back to locally
  // computed value only while the first quote response is still in-flight.
  const quoteSession = quoteData?.session ?? null;
  // The cash index is closed overnight (session='closed'), but when the
  // futures display swap is active the badge should read FUTURES, not CLOSED.
  const sessionForBadge: MarketSession =
    quoteData?.display_source === 'futures'
      ? 'futures'
      : (quoteSession as MarketSession | null) ?? session;

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
    displaySource: quoteData?.display_source,
    futuresClose: quoteData?.futures_close,
    futuresReferenceClose: quoteData?.futures_reference_close,
  });

  // Overnight index→future display swap: the header shows the future's
  // price/change under the index symbol; this tag names the instrument.
  const futuresTicker =
    quoteData?.display_source === 'futures' ? quoteData?.data_symbol ?? null : null;

  // ── Row 2 (pre-market / after-hours only) ────────────────────────────────
  // pre/ah → icon + live quote close  vs  current_session_close
  const showExtendedRow = isExtendedHours && !!quoteData && !!sessionClosesData;

  // Extended price vs the most-recent cash close (current_session_close),
  // shared with the Gamma Chart's extended-hours line via getExtendedHoursRow.
  const {
    price: row2Price,
    change: row2Change,
    changePercent: row2ChangePercent,
    isPositive: row2Positive,
  } = getExtendedHoursRow(quoteData?.close, sessionClosesData?.current_session_close);

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

  const row1PriceBaseLabel = (isExtendedHours || quoteSession === "closed")
    ? (sessionClosesData?.current_session_close_ts
        ? `Closing price as of ${formatEtDateTime(sessionClosesData.current_session_close_ts)}`
        : "regular session close")
    : (quoteData?.timestamp ? `as of ${formatEtDateTime(quoteData.timestamp)}` : "latest quote");
  // ES/NQ only: the feed is behind but the market is open, so the price shown
  // is the last observed futures print rather than a live one. Say so — the
  // alternative (reporting the session closed) swapped in the last cash close
  // and published its day change as today's.
  const row1PriceLabel = quoteData?.stale
    ? `${row1PriceBaseLabel} — feed delayed, last observed print`
    : row1PriceBaseLabel;

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
                  className={`zg-icon-btn${isCollapsed ? " zg-icon-btn--sm" : ""}`}
                  style={{ marginLeft: "12px", marginRight: isCollapsed ? "0" : "12px" }}
                  aria-label={t('menu.toggleTheme')}
                >
                  {theme === "dark" ? <Moon size={isCollapsed ? 16 : 18} /> : <Sun size={isCollapsed ? 16 : 18} />}
                </button>
                <ThemeDropdown />
                {isCollapsed && <LanguageDropdown compact />}
                {isCollapsed && <AccountMenu align="start" compact />}
                {isCollapsed && <OptionsCalendarBadge theme={theme} compact />}
                {isCollapsed && <NewsHeadlinesBadge theme={theme} compact />}
                {isCollapsed && (
                  <div style={{ position: "relative", width: "76px", height: "32px", flexShrink: 0 }}>
                    <select
                      value={symbol}
                      onChange={(e) => setSymbol(e.target.value as UnderlyingSymbol)}
                      className="rounded-lg border text-xs font-semibold transition-all duration-200"
                      style={{
                        appearance: "none",
                        WebkitAppearance: "none",
                        MozAppearance: "none",
                        background: "color-mix(in srgb, var(--bg-card) 80%, transparent)",
                        borderColor: border,
                        color: 'var(--text-primary)',
                        width: "100%",
                        height: "100%",
                        padding: "0 22px 0 10px",
                        boxSizing: "border-box",
                        backdropFilter: "blur(8px)",
                        cursor: "pointer",
                        lineHeight: 1,
                      }}
                    >
                      {SYMBOLS.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                    <ChevronDown
                      size={14}
                      style={{
                        position: "absolute",
                        right: 6,
                        top: "50%",
                        transform: "translateY(-50%)",
                        pointerEvents: "none",
                        color: 'var(--text-secondary)',
                      }}
                    />
                  </div>
                )}
                {!isCollapsed && (
                  <div className="flex flex-col gap-1">
                    <select
                      value={symbol}
                      onChange={(e) => setSymbol(e.target.value as UnderlyingSymbol)}
                      className="px-2 py-1 rounded-lg border text-xs font-semibold transition-all duration-200"
                      style={{
                        background: "color-mix(in srgb, var(--bg-card) 80%, transparent)",
                        borderColor: border,
                        color: 'var(--text-primary)',
                        width: "96px",
                        backdropFilter: "blur(8px)",
                      }}
                    >
                      {SYMBOLS.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                    <div onClick={() => setShowCountdown(!showCountdown)}>
                      <SessionBadge session={sessionForBadge} theme={theme} showCountdown={showCountdown} />
                    </div>
                  </div>
                )}
                {!isCollapsed && row1Price !== null && (
                  <div className="flex flex-col gap-0.5">
                    <div className={(quoteSession === "open" || quoteSession === "closed") ? undefined : "flex items-center gap-2"} style={(quoteSession === "open" || quoteSession === "closed") ? { display: "contents" } : undefined}>
                      {/* zg-metric, not font-bold: the live quote reprices every
                          second, and proportional digits change width as they
                          tick, so the whole row shimmies. Tabular + slashed-zero
                          pins each glyph to one advance width. */}
                      <span className="zg-metric" style={{ fontSize: "1.5rem" }} title={row1PriceLabel}>${row1Price.toFixed(2)}</span>
                      {futuresTicker && (
                        <span
                          className="zg-chip w-fit"
                          title={`Outside cash session — showing ${futuresTicker} futures for ${symbol}`}
                          style={{ '--chip-color': 'var(--color-brand-coral)' } as React.CSSProperties}
                        >
                          ◆ {futuresTicker} FUT
                        </span>
                      )}
                      <FuturesDelayBadge
                        symbol={symbol}
                        stale={quoteData?.stale}
                        dataAgeSeconds={quoteData?.data_age_seconds}
                      />
                      {row1Change !== null && row1ChangePercent !== null && (
                        <div className="zg-datum flex items-center gap-1 px-2 py-1 font-semibold w-fit" title={row1ChangeLabel} style={{ borderRadius: 'var(--radius-control)', backgroundColor: `${row1Positive ? 'var(--color-bull)' : 'var(--color-bear)'}1f`, color: row1Positive ? 'var(--color-bull)' : 'var(--color-bear)', fontSize: "12px" }}>
                          {row1Positive ? <TrendingUp size={12} strokeWidth={2.5} /> : <TrendingDown size={12} strokeWidth={2.5} />}
                          {row1Positive ? "+" : ""}{row1Change.toFixed(2)} ({row1Positive ? "+" : ""}{row1ChangePercent.toFixed(2)}%)
                        </div>
                      )}
                    </div>
                    {showExtendedRow && row2Price !== null && row2Change !== null && row2ChangePercent !== null && (
                      <div className="flex items-center gap-1.5 mt-0.5" title={row2Label}>
                        {extendedHoursIcon === "moon" ? <Moon size={11} style={{ color: 'var(--text-secondary)' }} /> : <Sun size={11} style={{ color: 'var(--text-secondary)' }} />}
                        <span className="zg-datum text-xs font-semibold" style={{ color: 'var(--text-primary)', opacity: 0.8 }}>${row2Price.toFixed(2)}</span>
                        <span className="zg-datum text-xs font-semibold" title={row2ChangeLabel} style={{ color: row2Positive ? 'var(--color-bull)' : 'var(--color-bear)' }}>
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
                {/* Trimmed artwork, so the height fraction is the whole sizing
                    story (the old padded export needed 150% to fill the band).
                    76% keeps the 3.3:1 lockup ~250px wide — the footprint the
                    old wordmark had, so it still clears the world clocks that
                    sit either side of this absolutely-centred block. */}
                <Image
                  {...brandTitle(theme === "dark")}
                  alt="ZeroGEX"
                  priority
                  style={{ width: "auto", height: "76%", maxWidth: "none", maxHeight: "none", objectFit: "contain", objectPosition: "center", display: "block", margin: 0, padding: 0 }}
                />
              </Link>
            </div>
            )}

            {!isCollapsed && (
              <div className="flex items-center gap-3" style={{ marginRight: "24px" }}>
                <div style={{ marginRight: "24px" }}>
                  <WorldClocks theme={theme} session={session} compact={isCollapsed} />
                </div>
                <OptionsCalendarBadge theme={theme} />
                <NewsHeadlinesBadge theme={theme} />
                <LanguageDropdown />
                <Link href="/search" aria-label="Search" className="zg-icon-btn">
                  <Search size={18} />
                </Link>
                <AccountMenu align="end" />
              </div>
            )}

            <button
              onClick={toggleCollapsed}
              className="zg-icon-btn zg-icon-btn--sm absolute"
              style={{ border: "0", top: "50%", transform: "translateY(-50%)", right: "12px" }}
              aria-label={isCollapsed ? "Expand header" : "Collapse header"}
            >
              {isCollapsed ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
            </button>
          </div>
        </div>

        {/* Mobile Layout - Always Collapsed */}
        <div className="md:hidden">
          <div ref={mobileTopBarRef} className="flex items-center justify-between mb-1 min-w-0 w-full" style={{ minHeight: "36px" }}>
            <Link href="/" className="flex items-center overflow-hidden min-w-0" style={{ height: "36px", maxWidth: "min(56vw, 210px)", padding: 0, margin: 0, lineHeight: 0 }}>
              <Image
                {...brandTitle(theme === "dark")}
                alt="ZeroGEX"
                priority
                // Fit the lockup fully inside the mobile top bar: cap it to the
                // bar height AND the (flex-shrunk) container width so it never
                // clips top/bottom or on the right the way a fixed 130%-height,
                // width:auto image did once the icons on the right claimed space.
                style={{
                  height: "auto",
                  width: "auto",
                  maxHeight: "100%",
                  maxWidth: "100%",
                  objectFit: "contain",
                  objectPosition: "left center",
                  display: "block",
                  margin: 0,
                  padding: 0,
                }}
              />
            </Link>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Link href="/search" aria-label="Search" className="zg-icon-btn zg-icon-btn--sm">
                <Search size={16} />
              </Link>
              <OptionsCalendarBadge theme={theme} compact mobile />
              <NewsHeadlinesBadge theme={theme} compact mobile />
              <button
                onClick={onToggleTheme}
                className="zg-icon-btn zg-icon-btn--sm"
                aria-label={t('menu.toggleTheme')}
              >
                {theme === "dark" ? <Moon size={16} /> : <Sun size={16} />}
              </button>
              <ThemeDropdown />
              <LanguageDropdown compact />
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="zg-icon-btn zg-icon-btn--sm mr-1"
                style={{ border: "0" }}
                aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
                aria-expanded={mobileMenuOpen}
              >
                {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
              </button>
            </div>
          </div>

          {mobileMenuOpen && (
            <div
              className="space-y-4 overflow-y-auto overscroll-contain"
              style={{
                // Subtract the top-bar height PLUS the ~10px of header chrome
                // above the menu (header padding + the top-bar's mb-1) so the
                // scroll area ends just inside the viewport instead of spilling
                // a few px past the fold and hiding the last row.
                maxHeight:
                  "calc(100dvh - var(--zgx-mobile-topbar-height, 44px) - 10px)",
              }}
            >
              <div className="space-y-3">
                {filteredMobileNavGroups.map((group) => {
                  const isExpanded = mobileExpandedGroups[group.label] ?? false;
                  const renderItem = (page: NavItem) => {
                    const active = pathname === page.id;
                    const isExternal = page.external === true;
                    const lock = lockedTier(page);

                    if (isExternal) {
                      const targetHref = resolveNavTarget(page);
                      return (
                        <a
                          key={page.id}
                          href={targetHref}
                          target={targetHref.startsWith("http") ? "_blank" : undefined}
                          rel={targetHref.startsWith("http") ? "noreferrer" : undefined}
                          className="flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-semibold text-left"
                          style={{
                            background: "var(--bg-card)",
                            borderColor: border,
                            color: 'var(--text-primary)',
                          }}
                        >
                          <span>{navLabel(page)}</span>
                          {lock && <TierBadge tier={lock} />}
                          {page.beta && <BetaBadge />}
                        </a>
                      );
                    }

                    return (
                      <button
                        key={page.id}
                        onClick={() => {
                          router.push(resolveNavTarget(page));
                          setMobileMenuOpen(false);
                        }}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-semibold text-left"
                        style={{
                          background: "var(--bg-card)",
                          borderColor: active ? `${'var(--color-brand-primary)'}60` : border,
                          color: active ? 'var(--color-brand-primary)' : 'var(--text-primary)',
                        }}
                      >
                        <span>{page.label}</span>
                        {lock && <TierBadge tier={lock} />}
                        {page.beta && <BetaBadge />}
                      </button>
                    );
                  };

                  return (
                    <div key={group.label} className="rounded-lg border p-3" style={{ borderColor: border }}>
                      <button
                        type="button"
                        onClick={() => setMobileExpandedGroups((prev) => ({ ...prev, [group.label]: !isExpanded }))}
                        className="mb-2 flex w-full items-center justify-between text-[11px] font-semibold uppercase tracking-[0.18em]"
                        style={{ color: 'var(--color-brand-primary)' }}
                      >
                        {navLabel(group)}
                        <ChevronDown size={14} style={{ transform: isExpanded ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 0.2s' }} />
                      </button>
                      {isExpanded ? (
                        <div className="grid grid-cols-1 gap-2">
                          {group.items.map(renderItem)}
                          {group.subgroups.map((subgroup) => {
                            const subKey = `${group.label}::${subgroup.label}`;
                            const isSubExpanded = mobileExpandedGroups[subKey] ?? false;
                            const subgroupId = subgroup.id;
                            const subgroupLock = lockedTier(subgroup);
                            const subgroupActive = subgroupId != null && pathname === subgroupId;
                            const subgroupLabelStyle = {
                              color: subgroupActive
                                ? 'var(--color-brand-primary)'
                                : "var(--text-primary)",
                              opacity: subgroupActive ? 1 : 0.8,
                            };
                            return (
                              <div key={subKey} className="mt-1 pl-2 border-l" style={{ borderColor: `${'var(--color-brand-primary)'}33` }}>
                                <div className="mb-1 flex w-full items-center text-[10px] font-semibold uppercase tracking-[0.16em]">
                                  {subgroupId ? (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        router.push(resolveNavTarget({ id: subgroupId, requiredTier: subgroup.requiredTier }));
                                        setMobileMenuOpen(false);
                                      }}
                                      className="flex-1 text-left bg-transparent flex items-center gap-1.5"
                                      style={subgroupLabelStyle}
                                    >
                                      {navLabel(subgroup)}
                                      {subgroupLock && <TierBadge tier={subgroupLock} />}
                                    </button>
                                  ) : (
                                    <span className="flex-1 flex items-center gap-1.5" style={subgroupLabelStyle}>
                                      {navLabel(subgroup)}
                                      {subgroupLock && <TierBadge tier={subgroupLock} />}
                                    </span>
                                  )}
                                  <button
                                    type="button"
                                    aria-label={isSubExpanded ? t('nav.collapse', { name: navLabel(subgroup) }) : t('nav.expand', { name: navLabel(subgroup) })}
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      setMobileExpandedGroups((prev) => ({ ...prev, [subKey]: !isSubExpanded }));
                                    }}
                                    className="flex h-7 w-7 items-center justify-center rounded-md bg-transparent"
                                    style={{ color: 'var(--text-primary)', opacity: 0.8 }}
                                  >
                                    <ChevronDown size={12} style={{ transform: isSubExpanded ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 0.2s' }} />
                                  </button>
                                </div>
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
                    background: "var(--bg-card)",
                    borderColor: border,
                    color: 'var(--text-primary)',
                  }}
                >
                  {SYMBOLS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
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
                    style={{ borderColor: border, color: 'var(--text-secondary)' }}
                  >
                    {t('menu.account')}
                  </button>
                )}
                {canUpgrade && (
                  <button
                    type="button"
                    onClick={() => {
                      router.push("/pricing");
                      setMobileMenuOpen(false);
                    }}
                    className="rounded-lg border px-3 py-2 text-sm font-semibold"
                    style={{ borderColor: border, color: 'var(--text-secondary)' }}
                  >
                    {t('menu.upgrade')}
                  </button>
                )}
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
                  style={{ borderColor: border, color: 'var(--text-secondary)' }}
                >
                  {authSession?.authenticated ? t('menu.logoutMobile') : t('menu.login')}
                </button>
              </div>

              {/* Mobile: in pre-market / after-hours show ONLY the extended-hours
                  quote with a leading session icon. Outside extended hours,
                  fall back to the regular Row 1 quote. */}
              {showExtendedRow && row2Price !== null && row2Change !== null && row2ChangePercent !== null ? (
                <div className="flex items-center gap-3 flex-wrap" title={row2Label}>
                  {extendedHoursIcon === "moon" ? (
                    <Moon size={20} style={{ color: 'var(--text-secondary)' }} />
                  ) : (
                    <Sun size={20} style={{ color: 'var(--text-secondary)' }} />
                  )}
                  <span className="zg-metric" style={{ fontSize: "1.5rem" }} title={row2Label}>
                    ${row2Price.toFixed(2)}
                  </span>
                  <div
                    className="zg-datum flex items-center gap-1.5 px-2.5 py-1 font-semibold text-sm"
                    title={row2ChangeLabel}
                    style={{
                      borderRadius: 'var(--radius-control)',
                      backgroundColor:
                        theme === "dark"
                          ? `${row2Positive ? 'var(--color-bull)' : 'var(--color-bear)'}15`
                          : `${row2Positive ? 'var(--color-bull)' : 'var(--color-bear)'}10`,
                      color: row2Positive ? 'var(--color-bull)' : 'var(--color-bear)',
                    }}
                  >
                    {row2Positive ? (
                      <TrendingUp size={14} strokeWidth={2.5} />
                    ) : (
                      <TrendingDown size={14} strokeWidth={2.5} />
                    )}
                    {row2Positive ? "+" : ""}
                    {row2Change.toFixed(2)} ({row2Positive ? "+" : ""}
                    {row2ChangePercent.toFixed(2)}%)
                  </div>
                </div>
              ) : row1Price !== null ? (
                <div className="flex items-center gap-3 flex-wrap">
                  <span
                    className="zg-metric"
                    style={{ fontSize: "1.5rem" }}
                    title={row1PriceLabel}
                  >
                    ${row1Price.toFixed(2)}
                  </span>
                  {futuresTicker && (
                    <span
                      className="zg-chip w-fit"
                      title={`Outside cash session — showing ${futuresTicker} futures for ${symbol}`}
                      style={{ '--chip-color': 'var(--color-brand-coral)' } as React.CSSProperties}
                    >
                      ◆ {futuresTicker} FUT
                    </span>
                  )}
                  <FuturesDelayBadge
                    symbol={symbol}
                    stale={quoteData?.stale}
                    dataAgeSeconds={quoteData?.data_age_seconds}
                  />
                  {row1Change !== null && row1ChangePercent !== null && (
                    <div
                      className="zg-datum flex items-center gap-1.5 px-2.5 py-1 font-semibold text-sm"
                      title={row1ChangeLabel}
                      style={{
                        borderRadius: 'var(--radius-control)',
                        backgroundColor:
                          theme === "dark"
                            ? `${row1Positive ? 'var(--color-bull)' : 'var(--color-bear)'}15`
                            : `${row1Positive ? 'var(--color-bull)' : 'var(--color-bear)'}10`,
                        color: row1Positive ? 'var(--color-bull)' : 'var(--color-bear)',
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
              ) : null}

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
