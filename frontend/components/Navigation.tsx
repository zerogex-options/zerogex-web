"use client";

import { usePathname, useRouter } from "next/navigation";
import { MarketSession, Theme } from "@/core/types";
import { colors } from "@/core/colors";
import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { NAV_GROUPS, type NavGroup, type NavItem } from "@/core/navigation";
import Image from "next/image";
import Link from "next/link";
import { useLanguage } from "@/core/LanguageContext";
import { useTimeframe } from "@/core/TimeframeContext";
import { useMarketQuote, useSessionCloses } from "@/hooks/useApiData";
import { getMarketSession } from "@/core/utils";
import { hasTierAccess, navItemRequiredTier, normalizeTier, type TierId } from "@/core/auth";
import SessionBadge from "./SessionBadge";
import BetaBadge from "./BetaBadge";
import TierBadge from "./TierBadge";
import { TrendingDown, TrendingUp } from "lucide-react";
import { useAuthSession } from "@/hooks/useAuthSession";

interface NavigationProps {
  theme: Theme;
}

const SIDEBAR_WIDTH = 272;

export default function Navigation({ theme }: NavigationProps) {
  const { symbol } = useTimeframe();
  const { t } = useLanguage();
  // Resolve a nav entry's display text: translated when it carries a labelKey,
  // otherwise the English label (trading feature names stay English on purpose).
  const navLabel = (entry: { label: string; labelKey?: NavItem['labelKey'] }) =>
    entry.labelKey ? t(entry.labelKey) : entry.label;
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
  const { data: authSession } = useAuthSession();
  const currentTier = authSession?.user?.tier ?? "public";
  const isAuthenticated = !!authSession?.authenticated;
  const isPublicUser = normalizeTier(currentTier) === "public";
  const normalizedTier = normalizeTier(currentTier);
  // Effective required tier for a nav entry — the stricter of its declared tier
  // and its enforced route rule (navItemRequiredTier); null means public.
  const entryRequiredTier = (entry: { id?: string; requiredTier?: NavItem["requiredTier"] }): TierId | null =>
    navItemRequiredTier(entry.id, entry.requiredTier ?? null);
  const canAccessEntry = (entry: { id?: string; requiredTier?: NavItem["requiredTier"] }) =>
    hasTierAccess(normalizedTier, entryRequiredTier(entry));
  // Badge to show on an entry the current member can see but not open yet, or
  // null when it's accessible (or an admin-only tool, which is hidden entirely
  // rather than surfaced as an upsell).
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

  const navGroups = useMemo<NavGroup[]>(
    () => [
      ...NAV_GROUPS,
      {
        label: "More",
        labelKey: "nav.group.more",
        // Account is appended last so it sits at the bottom of the sidebar.
        // Only shown for authed users — for guests the link would just bounce
        // through /login and add a confusing detour.
        items: [
          { id: "/about", label: "About", labelKey: "nav.about" as const },
          { id: "https://api.zerogex.io/docs", label: "API Specs", external: true },
          ...(isAuthenticated ? [{ id: "/account", label: "Account", labelKey: "nav.account" as const }] : []),
        ],
      },
    ],
    [isAuthenticated],
  );
  const filteredNavGroups = useMemo(
    () => {
      // Self-contained access check (mirrors canAccessEntry) so this hook does
      // not close over component-scope helpers.
      const canAccess = (entry: { id?: string; requiredTier?: NavItem["requiredTier"] }) =>
        hasTierAccess(normalizeTier(currentTier), navItemRequiredTier(entry.id, entry.requiredTier ?? null));
      return navGroups
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
    [navGroups, currentTier, isPublicUser],
  );

  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    navGroups.forEach((group) => {
      const directMatch = (group.items ?? []).some((item) => pathname === item.id);
      const subMatch = (group.subgroups ?? []).some((sg) =>
        sg.id === pathname || sg.items.some((item) => pathname === item.id),
      );
      initial[group.label] = directMatch || subMatch;
      (group.subgroups ?? []).forEach((sg) => {
        initial[`${group.label}::${sg.label}`] =
          sg.id === pathname || sg.items.some((item) => pathname === item.id);
      });
    });
    return initial;
  });

  useEffect(() => {
    const interval = setInterval(() => setSession(getMarketSession()), 60000);
    return () => clearInterval(interval);
  }, []);
  const { data: quoteData } = useMarketQuote(symbol, 1000);
  const quoteSession = quoteData?.session ?? null;
  const { data: sessionClosesData } = useSessionCloses(symbol, 60000, quoteSession);
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
            backgroundColor: "color-mix(in srgb, var(--bg-main) 95%, transparent)",
            borderColor: border,
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
          }}
        >
          <div className="h-full overflow-y-auto px-4 py-5">
            {headerCollapsed && (
              <div className="mb-5 rounded-xl border p-3" style={{ borderColor: border, backgroundColor: 'color-mix(in srgb, var(--bg-card) 79%, transparent)' }}>
                <Link href="/" className="flex w-full items-center overflow-hidden">
                  <Image
                    src={theme === "dark" ? "/logo-dark.svg" : "/logo-light.svg"}
                    alt="ZeroGEX"
                    width={160}
                    height={160}
                    style={{ width: "118%", maxWidth: "118%", height: "auto", objectFit: "cover", marginLeft: "-9%" }}
                  />
                </Link>
                {row1Price !== null && (
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <div className="flex flex-col gap-1">
                      <span className="font-bold text-lg">${row1Price.toFixed(2)}</span>
                      {row1Change !== null && row1ChangePercent !== null && (
                        <div className="flex items-center gap-1 px-2 py-0.5 rounded-lg font-semibold text-xs w-fit" style={{ backgroundColor: `${row1Positive ? 'var(--color-bull)' : 'var(--color-bear)'}1f`, color: row1Positive ? 'var(--color-bull)' : 'var(--color-bear)' }}>
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
            {filteredNavGroups.map((group) => {
              const isExpanded = expandedGroups[group.label] ?? false;
              const renderItem = (page: NavItem) => {
                const isExternal = page.external === true;
                const isActive = pathname === page.id;
                const isHovered = hoveredPage === page.id;
                const lock = lockedTier(page);
                const accent = theme === "light" ? 'var(--color-brand-coral)' : 'var(--color-brand-primary)';
                // Only animate paint-only properties. Animating the `border`/
                // `background` shorthands (or using `transition-all`) let the
                // browser re-evaluate the whole box each frame, which shifted
                // rows a couple of pixels on hover and made the mouse bounce
                // in and out of the wrapper — the flicker in the recording.
                const commonStyle = {
                  color: isActive || isHovered ? accent : "var(--text-primary)",
                  opacity: isActive || isHovered ? 1 : 0.72,
                  backgroundColor: isHovered && !isActive
                    ? `${accent}18`
                    : isActive
                      ? `${accent}14`
                      : "transparent",
                  borderColor: isActive || isHovered ? `${accent}40` : "transparent",
                  transitionProperty: "color, background-color, border-color, opacity",
                  transitionDuration: "200ms",
                };

                if (isExternal) {
                  const targetHref = resolveNavTarget(page);
                  return (
                    <Link
                      key={page.id}
                      href={targetHref}
                      target={targetHref.startsWith("http") ? "_blank" : undefined}
                      rel={targetHref.startsWith("http") ? "noreferrer" : undefined}
                      onMouseEnter={() => setHoveredPage(page.id)}
                      onMouseLeave={() => setHoveredPage(null)}
                      className="flex w-full items-center gap-2 rounded-xl border border-solid px-3 py-3 text-left text-sm font-semibold"
                      style={commonStyle}
                    >
                      <span>{navLabel(page)}</span>
                      {lock && <TierBadge tier={lock} />}
                      {page.beta && <BetaBadge />}
                    </Link>
                  );
                }

                return (
                  <button
                    key={page.id}
                    onClick={() => router.push(resolveNavTarget(page))}
                    onMouseEnter={() => setHoveredPage(page.id)}
                    onMouseLeave={() => setHoveredPage(null)}
                    className="flex w-full items-center gap-2 rounded-xl border border-solid px-3 py-3 text-left text-sm font-semibold"
                    style={commonStyle}
                    type="button"
                  >
                    <span>{navLabel(page)}</span>
                    {lock && <TierBadge tier={lock} />}
                    {page.beta && <BetaBadge />}
                  </button>
                );
              };

              return (
                <div key={group.label} className="mb-4 last:mb-0">
                  <button
                    type="button"
                    onClick={() => setExpandedGroups((prev) => ({ ...prev, [group.label]: !isExpanded }))}
                    className="mb-2 flex w-full items-center justify-between rounded-lg px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em]"
                    style={{
                      color: theme === "light" ? 'var(--color-brand-coral)' : 'var(--color-brand-primary)',
                      background: `${theme === "light" ? 'var(--color-brand-coral)' : 'var(--color-brand-primary)'}0f`,
                    }}
                  >
                    {group.labelKey ? t(group.labelKey) : group.label}
                    <ChevronDown
                      size={14}
                      style={{ transform: isExpanded ? "rotate(0deg)" : "rotate(-90deg)", transition: "transform 0.2s" }}
                    />
                  </button>
                  {isExpanded ? (
                    <div className="space-y-1">
                      {group.items.map(renderItem)}
                      {group.subgroups.map((subgroup) => {
                        const subKey = `${group.label}::${subgroup.label}`;
                        const isSubExpanded = expandedGroups[subKey] ?? false;
                        const subgroupId = subgroup.id;
                        const subgroupLock = lockedTier(subgroup);
                        const subgroupActive = subgroupId != null && pathname === subgroupId;
                        const subgroupHovered = subgroupId != null && hoveredPage === subgroupId;
                        const subgroupAccent = theme === "light" ? 'var(--color-brand-coral)' : 'var(--color-brand-primary)';
                        const subgroupTransition = {
                          transitionProperty: "color, background-color, border-color, opacity",
                          transitionDuration: "200ms",
                        };
                        const subgroupStyle = subgroupId != null
                          ? {
                              color: subgroupActive || subgroupHovered ? subgroupAccent : "var(--text-primary)",
                              opacity: subgroupActive || subgroupHovered ? 1 : 0.72,
                              backgroundColor: subgroupHovered && !subgroupActive
                                ? `${subgroupAccent}18`
                                : subgroupActive
                                  ? `${subgroupAccent}14`
                                  : "transparent",
                              borderColor: subgroupActive || subgroupHovered ? `${subgroupAccent}40` : "transparent",
                              ...subgroupTransition,
                            }
                          : {
                              color: 'var(--text-primary)',
                              opacity: 0.72,
                              backgroundColor: "transparent",
                              borderColor: "transparent",
                              ...subgroupTransition,
                            };
                        return (
                          <div key={subKey} className="mt-2 pl-2 border-l" style={{ borderColor: `${subgroupAccent}33` }}>
                            <div
                              className="mb-1 flex w-full items-center rounded-xl border border-solid text-sm font-semibold"
                              style={subgroupStyle}
                              onMouseEnter={() => subgroupId && setHoveredPage(subgroupId)}
                              onMouseLeave={() => setHoveredPage(null)}
                            >
                              {subgroupId ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    router.push(resolveNavTarget({ id: subgroupId, requiredTier: subgroup.requiredTier }));
                                    setExpandedGroups((prev) => ({ ...prev, [subKey]: true }));
                                  }}
                                  className="flex-1 px-3 py-3 text-left bg-transparent flex items-center gap-2"
                                  style={{ color: "inherit" }}
                                >
                                  {navLabel(subgroup)}
                                  {subgroupLock && <TierBadge tier={subgroupLock} />}
                                </button>
                              ) : (
                                <span className="flex-1 px-3 py-3 flex items-center gap-2" style={{ color: "inherit" }}>
                                  {navLabel(subgroup)}
                                  {subgroupLock && <TierBadge tier={subgroupLock} />}
                                </span>
                              )}
                              <button
                                type="button"
                                aria-label={isSubExpanded ? t('nav.collapse', { name: navLabel(subgroup) }) : t('nav.expand', { name: navLabel(subgroup) })}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setExpandedGroups((prev) => ({ ...prev, [subKey]: !isSubExpanded }));
                                }}
                                className="flex h-9 w-9 items-center justify-center rounded-lg bg-transparent"
                                style={{ color: "inherit" }}
                              >
                                <ChevronDown
                                  size={14}
                                  style={{ transform: isSubExpanded ? "rotate(0deg)" : "rotate(-90deg)", transition: "transform 0.2s" }}
                                />
                              </button>
                            </div>
                            {isSubExpanded ? (
                              <div className="space-y-1">
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
          <button
            type="button"
            onClick={toggleSidebar}
            className="absolute -right-9 top-4 flex h-14 w-9 items-center justify-center rounded-r-xl border border-l-0 opacity-0 transition-opacity duration-150 group-hover/sidebar:opacity-100 focus-visible:opacity-100"
            style={{
              backgroundColor: "color-mix(in srgb, var(--bg-card) 95%, transparent)",
              borderColor: border,
              color: 'var(--text-secondary)',
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
            }}
            aria-label={t('nav.hideSidebar')}
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
            backgroundColor: "color-mix(in srgb, var(--bg-card) 95%, transparent)",
            borderColor: border,
            color: 'var(--text-secondary)',
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
          }}
          aria-label={t('nav.showSidebar')}
        >
          <ChevronRight size={18} />
          <span className="text-[10px] font-semibold uppercase tracking-wide">{t('nav.menu')}</span>
        </button>
      )}
    </>
  );
}
