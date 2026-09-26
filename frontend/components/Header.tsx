"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
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
import { INTEGRATIONS_HUB } from "@/core/integrations";
import AccountMenu from "./AccountMenu";
import MobileMenuSheet from "./MobileMenuSheet";
import ThemeDropdown from "./ThemeDropdown";
import LanguageDropdown from "./LanguageDropdown";
import { useLanguage } from "@/core/LanguageContext";
import { Theme, MarketSession } from "@/core/types";
import type { UnderlyingSymbol } from "@/core/TimeframeContext";
import { useTimeframe } from "@/core/TimeframeContext";
import { SYMBOLS, isFuturesSymbol } from "@/core/symbols";
import { getMarketSession } from "@/core/utils";
import { getPrimaryPriceChangeSummary, getExtendedHoursRow } from "@/core/priceChange";
import { resolvePriceSession, sessionClosesLagBehind } from "@/core/sessionCloses";
import { brandTitle } from "@/core/brand";
import SessionBadge from "./SessionBadge";
import FuturesContractBadge from "./FuturesContractBadge";
import FuturesDelayBadge from "./FuturesDelayBadge";
import { futuresFeedBehind } from "@/core/futuresDataStatus";
import WorldClocks from "./WorldClocks";
import { usePersistedFlag } from "@/hooks/usePersistedFlag";
import { UI_COOKIE } from "@/core/uiCookies";
import OptionsCalendarBadge from "./OptionsCalendarBadge";
import NewsHeadlinesBadge from "./NewsHeadlinesBadge";
import PageSnapshotButton from "./PageSnapshotButton";
import { useMarketQuote, useSessionCloses } from "@/hooks/useApiData";
import { hasTierAccess, navItemRequiredTier, normalizeTier, type TierId } from "@/core/auth";
import { useAuthSession } from "@/hooks/useAuthSession";

const MOBILE_MENU_ID = "zgx-mobile-menu";

// The nav sections (and subsections) that contain `pathname`, keyed the way the
// mobile sheet keys its expand state: a group by its label, a subgroup by
// "group::subgroup".
function activeNavExpansion(groups: NavGroup[], pathname: string | null): Record<string, boolean> {
  const open: Record<string, boolean> = {};
  if (!pathname) return open;
  groups.forEach((group) => {
    let groupHit = (group.items ?? []).some((item) => item.id === pathname);
    (group.subgroups ?? []).forEach((sg) => {
      const subHit = sg.items.some((item) => item.id === pathname);
      if (subHit) open[`${group.label}::${sg.label}`] = true;
      if (subHit || sg.id === pathname) groupHit = true;
    });
    if (groupHit) open[group.label] = true;
  });
  return open;
}

interface HeaderProps {
  theme: Theme;
  onToggleTheme: () => void;
  /** Server's read of the headerCollapsed cookie — see app/layout.tsx. */
  initialCollapsed?: boolean;
}

export default function Header({ theme, onToggleTheme, initialCollapsed = false }: HeaderProps) {
  const { t } = useLanguage();
  const [session, setSession] = useState(getMarketSession());
  // The phone menu is open FOR a path: it records the pathname it was opened
  // on, so any navigation — a row in the sheet, a link in the page, the back
  // button — closes it without an effect having to watch the route.
  const [mobileMenuPath, setMobileMenuPath] = useState<string | null>(null);
  const { symbol, setSymbol } = useTimeframe();
  const [showCountdown, setShowCountdown] = useState(false);
  // Cookie-backed, with the server's read of the same cookie as the initial
  // value: the server emits the collapsed chrome directly, so there is no
  // hydration mismatch and — unlike a localStorage seed — nothing to visibly
  // correct afterwards.
  const [isCollapsed, toggleCollapsed] = usePersistedFlag(
    UI_COOKIE.headerCollapsed,
    initialCollapsed,
    "cookie",
  );
  const headerRef = useRef<HTMLElement | null>(null);
  const mobileTopBarRef = useRef<HTMLDivElement | null>(null);
  const router = useRouter();
  const pathname = usePathname();
  const mobileMenuOpen = mobileMenuPath !== null && mobileMenuPath === pathname;
  const closeMobileMenu = useCallback(() => setMobileMenuPath(null), []);


  const mobileNavGroups = useMemo<NavGroup[]>(
    () => [
      ...NAV_GROUPS,
      {
        label: "More",
        labelKey: "nav.group.more",
        items: [
          { id: "/about", label: "About", labelKey: "nav.about" },
          // One entry for every chart-platform integration — see the note on
          // the same group in Navigation.tsx.
          { id: INTEGRATIONS_HUB.href, label: INTEGRATIONS_HUB.navLabel, labelKey: "nav.integrations" },
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

  const [mobileExpandedGroups, setMobileExpandedGroups] = useState<Record<string, boolean>>(() =>
    activeNavExpansion(mobileNavGroups, pathname),
  );
  const openMobileMenu = () => {
    // Open the section holding the current page — the sheet may last have
    // been used on another page — without folding anything the reader opened.
    setMobileExpandedGroups((prev) => ({ ...prev, ...activeNavExpansion(mobileNavGroups, pathname) }));
    setMobileMenuPath(pathname);
  };
  const { data: authSession, loading: authLoading, refresh: refreshAuth } = useAuthSession();
  const currentTier = authSession?.user?.tier ?? "public";
  const isPublicUser = normalizeTier(currentTier) === "public";
  // Gated on the session having actually resolved. Until it does, currentTier
  // falls back to "public", which would offer a Pro member an Upgrade button
  // for the length of one fetch on every hard page load — the same
  // loading-is-not-logged-out confusion the auth row below avoids.
  const canUpgrade = (() => {
    if (authLoading) return false;
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

  // The session the PRICE calc reads. Identical to quoteSession except in the first
  // minutes of after-hours, before /api/market/session-closes has rolled today's 16:00
  // close in: that payload is still the open-session pair, so it is read as one (see
  // core/sessionCloses.ts) instead of publishing yesterday's close as today's price.
  // Badges and session labels keep reading quoteSession — the clock is right, the
  // closes are late.
  const closesLagBehind = sessionClosesLagBehind(
    quoteSession,
    sessionClosesData?.current_session_close_ts,
    quoteData?.timestamp,
  );
  const priceSession = resolvePriceSession(quoteSession, sessionClosesData, quoteData?.timestamp);

  const isExtendedHours = priceSession === "pre-market" || priceSession === "after-hours";
  const extendedHoursIcon = quoteSession === "pre-market" ? "sun" : "moon";

  // ── Row 1 ─────────────────────────────────────────────────────────────────
  // open     → live quote close  vs  current_session_close
  // closed   → live quote close  vs  prior_session_close
  // pre/ah   → current_session_close  vs  prior_session_close
  // (after-hours whose closes have not rolled yet reads as `open` — the live print
  //  vs the previous close, which is the same day change the header showed at 15:59.)
  const {
    displayPrice: row1Price,
    change: row1Change,
    changePercent: row1ChangePercent,
    isPositive: row1Positive,
  } = getPrimaryPriceChangeSummary({
    quoteClose: quoteData?.close,
    quoteSession: priceSession,
    sessionCloses: sessionClosesData,
    displaySource: quoteData?.display_source,
    futuresClose: quoteData?.futures_close,
    futuresReferenceClose: quoteData?.futures_reference_close,
  });

  // Overnight index→future display swap: the header shows the future's
  // price/change under the index symbol; this tag names the instrument.
  const futuresTicker =
    quoteData?.display_source === 'futures' ? quoteData?.data_symbol ?? null : null;

  // Natively-served ES / NQ. The swap badge above covers a cash index showing
  // its future overnight; this covers the case the complaints actually came
  // from, where the header reads "NQ 29,302.25" and nothing on screen says
  // WHICH NQ. The chip renders the contract code itself, so the label gap is
  // closed on the surface rather than only inside a tooltip. Renders nothing at
  // all when the quote carries no contract (older backend, cached response).
  const nativeFuturesQuote = !futuresTicker && isFuturesSymbol(symbol);

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

  const row1PriceBaseLabel = (isExtendedHours || priceSession === "closed")
    ? (sessionClosesData?.current_session_close_ts
        ? `Closing price as of ${formatEtDateTime(sessionClosesData.current_session_close_ts)}`
        : "regular session close")
    : (quoteData?.timestamp ? `as of ${formatEtDateTime(quoteData.timestamp)}` : "latest quote");
  // ES/NQ only: the feed is behind but the market is open, so the price shown
  // is the last observed futures print rather than a live one. Say so — the
  // alternative (reporting the session closed) swapped in the last cash close
  // and published its day change as today's. With CME genuinely closed the
  // price shown IS that close, and an old last print is expected rather than a
  // delay (futuresFeedBehind).
  const row1PriceLabel = futuresFeedBehind(quoteData?.stale, quoteSession)
    ? `${row1PriceBaseLabel}\u00a0- feed delayed, last observed print`
    : closesLagBehind
      // Say why the official close is not on screen yet, rather than letting the live
      // after-hours print pass silently for a settled 4 PM close.
      ? `${row1PriceBaseLabel}\u00a0- today's close has not settled yet`
      : row1PriceBaseLabel;

  const row1ChangeLabel = priceSession === "open"
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

  // ── Mobile top-bar quote ─────────────────────────────────────────────────
  // One price and one percent, sized for the chip: the extended-hours print
  // while that is the live number (the same choice the menu sheet makes),
  // otherwise Row 1.
  const mobileQuoteExtended = showExtendedRow && row2Price !== null && row2ChangePercent !== null;
  const mobileQuotePrice = mobileQuoteExtended ? row2Price : row1Price;
  const mobileQuotePct = mobileQuoteExtended ? row2ChangePercent : row1ChangePercent;
  const mobileQuotePositive = mobileQuoteExtended ? row2Positive : row1Positive;
  const mobileQuoteTitle = mobileQuoteExtended
    ? `${row2Label} (${row2ChangeLabel})`
    : `${row1PriceLabel} (${row1ChangeLabel})`;
  const sessionDotColor =
    sessionForBadge === "open"
      ? "var(--color-bull)"
      : sessionForBadge === "pre-market" || sessionForBadge === "after-hours"
        ? "var(--color-warning)"
        : sessionForBadge === "futures"
          ? "var(--color-brand-coral)"
          : "var(--text-muted)";

  const border = "var(--color-border)";

  return (
    <header
      ref={headerRef}
      // zg-app-header gives the phone bar a near-opaque ground (globals.css);
      // on desktop it stays transparent. While the menu sheet is open the bar
      // rises above it, so the close button and quote stay in reach.
      className={`zg-app-header border-b sticky top-0 ${mobileMenuOpen ? "z-[61]" : "z-40"}`}
      style={{
        borderColor: isCollapsed ? "transparent" : border,
        // The header is sticky and its background is transparent, so this blur
        // is the only thing separating it from the page scrolling underneath.
        // It used to be switched off while collapsed, which left the page
        // legible straight through the collapsed controls — worst on a narrow
        // or portrait viewport, where there is the least room between them.
        // The collapsed bar keeps its borderless look; only the backdrop stays.
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
      }}
    >
      {/* Vertical padding is desktop-only and lives in classes, not in a
          viewport flag read after hydration: the flag started false on the
          server, so every phone first painted the desktop padding and then
          jumped. */}
      <div
        className={`w-full px-0 ${isCollapsed ? "lg:py-[2px]" : "lg:py-2"}`}
        style={{ transition: "padding 0.3s ease" }}
      >
        {/* Desktop Layout */}
        <div className="hidden lg:block relative">
          {/* zg-hdr-row: below 1600px a grid (see globals.css), so the lockup
              sits between the two clusters instead of under them. */}
          <div className="zg-hdr-row relative flex items-center justify-between" style={{ minHeight: isCollapsed ? "42px" : "72px", paddingRight: "40px", paddingLeft: "10px" }}>
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
                {isCollapsed && <PageSnapshotButton compact />}
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
                    <div className={(priceSession === "open" || priceSession === "closed") ? undefined : "flex items-center gap-2"} style={(priceSession === "open" || priceSession === "closed") ? { display: "contents" } : undefined}>
                      {/* zg-metric, not font-bold: the live quote reprices every
                          second, and proportional digits change width as they
                          tick, so the whole row shimmies. Tabular + slashed-zero
                          pins each glyph to one advance width. */}
                      <span className="zg-metric" style={{ fontSize: "1.5rem" }} title={row1PriceLabel}>${row1Price.toFixed(2)}</span>
                      {futuresTicker && (
                        <FuturesContractBadge
                          contract={quoteData?.data_contract}
                          expiry={quoteData?.data_contract_expiry}
                          className="zg-chip w-fit"
                          fallbackTitle={`Outside cash session\u00a0- showing ${futuresTicker} futures for ${symbol}`}
                          style={{ '--chip-color': 'var(--color-brand-coral)' } as React.CSSProperties}
                        >
                          ◆ {futuresTicker} FUT
                        </FuturesContractBadge>
                      )}
                      {nativeFuturesQuote && (
                        <FuturesContractBadge
                          contract={quoteData?.data_contract}
                          expiry={quoteData?.data_contract_expiry}
                          className="zg-chip w-fit"
                          style={{ '--chip-color': 'var(--color-brand-coral)' } as React.CSSProperties}
                        />
                      )}
                      <FuturesDelayBadge
                        symbol={symbol}
                        stale={quoteData?.stale}
                        dataAgeSeconds={quoteData?.data_age_seconds}
                        session={quoteSession}
                      />
                      {row1Change !== null && row1ChangePercent !== null && (
                        <div className="zg-datum flex items-center gap-1 px-2 py-1 font-semibold w-fit" title={row1ChangeLabel} style={{ borderRadius: 'var(--radius-control)', backgroundColor: `color-mix(in srgb, ${row1Positive ? 'var(--color-bull)' : 'var(--color-bear)'} 12%, transparent)`, color: row1Positive ? 'var(--color-bull)' : 'var(--color-bear)', fontSize: "12px" }}>
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
            <div className="zg-hdr-logo absolute left-1/2 top-1/2 pointer-events-none" style={{ transform: "translate(-50%, -50%)" }}>
              <Link href="/" style={{ pointerEvents: "auto", display: "flex", alignItems: "center", height: "100px", overflow: "hidden", padding: 0, margin: 0, lineHeight: 0 }}>
                {/* Trimmed artwork, so the height fraction is the whole sizing
                    story (the old padded export needed 150% to fill the band).
                    76% keeps the 3.3:1 lockup ~250px wide. From 1600px it is
                    absolutely centred with room to spare; below that the
                    clocks ran over it (and at ~1100px the quote did), so it
                    joins the row and shrinks with the gap (globals.css). */}
                <Image
                  {...brandTitle(theme === "dark")}
                  alt="ZeroGEX"
                  priority
                  className="zg-hdr-logo-img"
                  style={{ objectFit: "contain", objectPosition: "center", display: "block", margin: 0, padding: 0 }}
                />
              </Link>
            </div>
            )}

            {!isCollapsed && (
              <div className="zg-hdr-right flex items-center gap-3" style={{ marginRight: "24px" }}>
                {/* Analog dials from 1600px, the compact digital row from
                    1366px, none below: there is no room beside the lockup. */}
                <div className="hidden min-[1600px]:block" style={{ marginRight: "24px" }}>
                  <WorldClocks theme={theme} session={session} />
                </div>
                <div className="hidden min-[1366px]:block min-[1600px]:hidden" style={{ marginRight: "12px" }}>
                  <WorldClocks theme={theme} session={session} compact />
                </div>
                <OptionsCalendarBadge theme={theme} />
                <NewsHeadlinesBadge theme={theme} />
                <LanguageDropdown />
                <PageSnapshotButton />
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

        {/* Phone and tablet top bar (below lg: from 768px up to ~1000px the
            desktop row's quote, centred logo, clocks and eight controls
            overlapped and pushed search and the account menu off screen).
            Three things only, so each gets real room: the
            lockup at full size, a live quote that doubles as the symbol
            switcher, and search + menu. Everything else — tools, palette,
            language, dark mode, the account — lives in the menu sheet.
            It used to carry all eight controls in one row, which left the
            logo a few pixels wide and clipped. */}
        <div className="lg:hidden">
          <div ref={mobileTopBarRef} className="zg-mbar">
            <Link href="/" aria-label="ZeroGEX home" className="zg-mbar-logo">
              <Image
                {...brandTitle(theme === "dark")}
                alt="ZeroGEX"
                priority
                sizes="120px"
                className="zg-mbar-logo-img"
              />
            </Link>

            <div className="zg-mquote" title={mobileQuoteTitle}>
              <select
                value={symbol}
                onChange={(e) => setSymbol(e.target.value as UnderlyingSymbol)}
                aria-label={`Symbol: ${symbol}. Change symbol`}
              >
                {SYMBOLS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <span className="zg-mquote-sym" aria-hidden>
                <span className="zg-mquote-dot" style={{ background: sessionDotColor }} />
                {symbol}
                <ChevronDown size={12} strokeWidth={2.5} />
              </span>
              <span className="zg-mquote-px" aria-hidden>
                <span className="zg-metric zg-mquote-price">
                  {mobileQuotePrice !== null ? mobileQuotePrice.toFixed(2) : "—"}
                </span>
                {mobileQuotePct !== null && (
                  <span
                    className="zg-mquote-chg"
                    style={{ color: mobileQuotePositive ? "var(--color-bull)" : "var(--color-bear)" }}
                  >
                    {mobileQuoteExtended && (extendedHoursIcon === "moon" ? <Moon size={9} /> : <Sun size={9} />)}
                    {mobileQuotePositive ? "+" : ""}
                    {mobileQuotePct.toFixed(2)}%
                  </span>
                )}
              </span>
            </div>

            <Link href="/search" aria-label="Search" className="zg-icon-btn zg-touch-btn">
              <Search size={19} />
            </Link>
            <button
              type="button"
              onClick={mobileMenuOpen ? closeMobileMenu : openMobileMenu}
              className="zg-icon-btn zg-touch-btn"
              aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileMenuOpen}
              aria-controls={MOBILE_MENU_ID}
            >
              {mobileMenuOpen ? <X size={21} /> : <Menu size={21} />}
            </button>
          </div>
        </div>
        <MobileMenuSheet
          id={MOBILE_MENU_ID}
          open={mobileMenuOpen}
          onClose={closeMobileMenu}
          theme={theme}
          onToggleTheme={onToggleTheme}
          groups={filteredMobileNavGroups}
          pathname={pathname}
          expanded={mobileExpandedGroups}
          onToggleExpanded={(key) =>
            setMobileExpandedGroups((prev) => ({ ...prev, [key]: !(prev[key] ?? false) }))
          }
          navLabel={navLabel}
          lockedTier={lockedTier}
          resolveNavTarget={resolveNavTarget}
          market={
            <>
              <div className="zg-msheet-market-row">
                <label className="zg-msheet-symbol">
                  <span className="zg-eyebrow">Symbol</span>
                  <span className="zg-msheet-symbol-field">
                    <select value={symbol} onChange={(e) => setSymbol(e.target.value as UnderlyingSymbol)}>
                      {SYMBOLS.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={16} aria-hidden />
                  </span>
                </label>
                <button
                  type="button"
                  className="zg-msheet-session"
                  onClick={() => setShowCountdown(!showCountdown)}
                  aria-pressed={showCountdown}
                  title="Show the session countdown"
                >
                  <SessionBadge session={sessionForBadge} theme={theme} showCountdown={showCountdown} />
                </button>
              </div>

              {/* In pre-market / after-hours the extended-hours quote leads,
                  with its session icon; otherwise the regular-session quote. */}
              {showExtendedRow && row2Price !== null && row2Change !== null && row2ChangePercent !== null ? (
                <div className="zg-msheet-quote" title={row2Label}>
                  {extendedHoursIcon === "moon" ? (
                    <Moon size={18} style={{ color: "var(--text-secondary)" }} />
                  ) : (
                    <Sun size={18} style={{ color: "var(--text-secondary)" }} />
                  )}
                  <span className="zg-metric zg-msheet-price">${row2Price.toFixed(2)}</span>
                  <span
                    className="zg-datum zg-msheet-change"
                    title={row2ChangeLabel}
                    style={{ "--chg": row2Positive ? "var(--color-bull)" : "var(--color-bear)" } as React.CSSProperties}
                  >
                    {row2Positive ? <TrendingUp size={14} strokeWidth={2.5} /> : <TrendingDown size={14} strokeWidth={2.5} />}
                    {row2Positive ? "+" : ""}
                    {row2Change.toFixed(2)} ({row2Positive ? "+" : ""}
                    {row2ChangePercent.toFixed(2)}%)
                  </span>
                </div>
              ) : row1Price !== null ? (
                <div className="zg-msheet-quote">
                  <span className="zg-metric zg-msheet-price" title={row1PriceLabel}>
                    ${row1Price.toFixed(2)}
                  </span>
                  {row1Change !== null && row1ChangePercent !== null && (
                    <span
                      className="zg-datum zg-msheet-change"
                      title={row1ChangeLabel}
                      style={{ "--chg": row1Positive ? "var(--color-bull)" : "var(--color-bear)" } as React.CSSProperties}
                    >
                      {row1Positive ? <TrendingUp size={14} strokeWidth={2.5} /> : <TrendingDown size={14} strokeWidth={2.5} />}
                      {row1Positive ? "+" : ""}
                      {row1Change.toFixed(2)} ({row1Positive ? "+" : ""}
                      {row1ChangePercent.toFixed(2)}%)
                    </span>
                  )}
                  {futuresTicker && (
                    <FuturesContractBadge
                      contract={quoteData?.data_contract}
                      expiry={quoteData?.data_contract_expiry}
                      className="zg-chip w-fit"
                      fallbackTitle={`Outside cash session\u00a0- showing ${futuresTicker} futures for ${symbol}`}
                      style={{ '--chip-color': 'var(--color-brand-coral)' } as React.CSSProperties}
                    >
                      ◆ {futuresTicker} FUT
                    </FuturesContractBadge>
                  )}
                  {nativeFuturesQuote && (
                    <FuturesContractBadge
                      contract={quoteData?.data_contract}
                      expiry={quoteData?.data_contract_expiry}
                      className="zg-chip w-fit"
                      style={{ '--chip-color': 'var(--color-brand-coral)' } as React.CSSProperties}
                    />
                  )}
                  <FuturesDelayBadge
                    symbol={symbol}
                    stale={quoteData?.stale}
                    dataAgeSeconds={quoteData?.data_age_seconds}
                    session={quoteSession}
                  />
                </div>
              ) : null}

              <WorldClocks theme={theme} session={session} compact />
            </>
          }
          tools={
            <>
              <OptionsCalendarBadge theme={theme} compact mobile label="Calendar" />
              <NewsHeadlinesBadge theme={theme} compact mobile label="Headlines" />
              <PageSnapshotButton compact label="Snapshot" />
            </>
          }
          account={
            <div className="zg-msheet-account-grid">
              {canUpgrade && (
                <Link href="/pricing" className="zg-btn zg-btn--primary" onClick={closeMobileMenu}>
                  {t('menu.upgrade')}
                </Link>
              )}
              {authSession?.authenticated && (
                <Link href="/account" className="zg-btn zg-btn--secondary" onClick={closeMobileMenu}>
                  {t('menu.account')}
                </Link>
              )}
              {/* Unlike the desktop AccountMenu — whose trigger is inert until
                  the session resolves, so its menu can never be opened early —
                  this sheet opens from a button that does not depend on auth
                  at all. On a slow mobile connection it is genuinely reachable
                  while /api/auth/session is still in flight, and a signed-in
                  member would be shown "Log in". Hold the row's box and label
                  it only once we know. */}
              <button
                type="button"
                onClick={() => {
                  if (authSession?.authenticated) {
                    void handleLogout();
                    return;
                  }
                  router.push("/login");
                  closeMobileMenu();
                }}
                className="zg-btn zg-btn--secondary"
                style={authLoading ? { visibility: 'hidden' as const } : undefined}
                aria-hidden={authLoading ? true : undefined}
                tabIndex={authLoading ? -1 : undefined}
              >
                {authLoading ? ' ' : authSession?.authenticated ? t('menu.logoutMobile') : t('menu.login')}
              </button>
            </div>
          }
        />
      </div>
    </header>
  );
}
