"use client";

import { usePathname, useRouter } from "next/navigation";
import { MarketSession, Theme } from "@/core/types";
import { brandLogo } from "@/core/brand";
import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, Pin } from "lucide-react";
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

// Per-browser pinned-pages list for the sidebar "Favorites" group.
const FAVORITES_STORAGE_KEY = "zg.nav.favorites.v1";

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
          // mailto: — `external` keeps it an <a href> rather than a router.push,
          // and the http-only target/rel check leaves it opening in the same tab
          // so the mail client takes over instead of leaving a blank window.
          { id: "mailto:support@zerogex.io", label: "Support", labelKey: "nav.support" as const, external: true },
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

  // ── Favorites ── Members pin the pages they use most; the pinned set floats to
  // a "Favorites" group at the top of the sidebar so they never have to hunt for
  // a page again. Persisted per-browser. Hydrated after mount so the server and
  // the first client render agree (no favorites-dependent markup during SSR).
  const [favorites, setFavorites] = useState<string[]>([]);
  const [favHydrated, setFavHydrated] = useState(false);
  // One-time hydration from localStorage after mount. Server and the first
  // client render intentionally start with no favorites (so there's no SSR
  // mismatch); this reconciles from storage exactly once — the same deliberate
  // hydration pattern (and eslint carve-out) GammaTerminalChart uses.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(FAVORITES_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      if (Array.isArray(parsed)) {
        setFavorites(parsed.filter((x): x is string => typeof x === "string"));
      }
    } catch {
      /* ignore malformed prefs */
    }
    setFavHydrated(true);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!favHydrated) return;
    try {
      localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(favorites));
    } catch {
      /* storage unavailable */
    }
  }, [favorites, favHydrated]);
  const toggleFavorite = (id: string) => {
    setFavorites((prev) => (prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]));
  };

  // Flat id -> item lookup across every group/subgroup, so a pinned id resolves
  // back to the item the sidebar already knows how to render.
  const itemById = useMemo(() => {
    const m = new Map<string, NavItem>();
    for (const group of navGroups) {
      for (const item of group.items ?? []) m.set(item.id, item);
      for (const sg of group.subgroups ?? []) for (const item of sg.items) m.set(item.id, item);
    }
    return m;
  }, [navGroups]);
  // Pinned items the current member can actually see — the same visibility rule
  // the main menu applies, so a favorite is never a back door to a gated page.
  const favoriteItems = useMemo(() => {
    const canAccess = (entry: { id?: string; requiredTier?: NavItem["requiredTier"] }) =>
      hasTierAccess(normalizeTier(currentTier), navItemRequiredTier(entry.id, entry.requiredTier ?? null));
    return favorites
      .map((id) => itemById.get(id))
      .filter((it): it is NavItem => !!it)
      .filter((it) => {
        if (it.external) return true;
        if (it.requiredTier === "admin") return canAccess(it);
        if (isPublicUser) return canAccess(it);
        return true;
      });
  }, [favorites, itemById, currentTier, isPublicUser]);

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

  // A single nav row: label + optional lock/beta badges + a pin toggle.
  // Defined at component scope so the Favorites group and the normal groups
  // render identical rows. The pin is a role="button" span, not a real
  // <button>, because the row itself is a <button>/<a> and nesting interactive
  // buttons is invalid HTML — the span still gets a keyboard handler + aria.
  //
  // State lives in CSS (.zg-nav-row + data-active) rather than in a
  // hoveredPage state variable and inline styles. Two reasons beyond the
  // obvious: a React state write per pointer move re-rendered the whole
  // sidebar on every row crossing, and inline hover can't express
  // :focus-visible, so keyboard users had no visible row highlight at all.
  // The active row is marked with a left rail — the convention every
  // established console uses — instead of a tinted rounded box that reads
  // as a button rather than a location.
  const renderItem = (page: NavItem) => {
    const isExternal = page.external === true;
    const isActive = pathname === page.id;
    const lock = lockedTier(page);
    const isFav = favorites.includes(page.id);
    const favLabel = isFav
      ? t('nav.removeFavorite', { name: navLabel(page) })
      : t('nav.addFavorite', { name: navLabel(page) });
    const favStar = (
      <span
        role="button"
        tabIndex={0}
        aria-label={favLabel}
        aria-pressed={isFav}
        title={favLabel}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          toggleFavorite(page.id);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            e.stopPropagation();
            toggleFavorite(page.id);
          }
        }}
        className="zg-nav-pin"
        data-pinned={isFav ? "true" : undefined}
      >
        <Pin size={14} fill={isFav ? "currentColor" : "none"} strokeWidth={isFav ? 1.75 : 2} />
      </span>
    );

    const body = (
      <>
        <span className="zg-nav-row-label">{navLabel(page)}</span>
        {lock && <TierBadge tier={lock} />}
        {page.beta && <BetaBadge />}
        {favStar}
      </>
    );

    if (isExternal) {
      const targetHref = resolveNavTarget(page);
      return (
        <Link
          key={page.id}
          href={targetHref}
          target={targetHref.startsWith("http") ? "_blank" : undefined}
          rel={targetHref.startsWith("http") ? "noreferrer" : undefined}
          className="zg-nav-row"
          data-active={isActive ? "true" : undefined}
        >
          {body}
        </Link>
      );
    }

    return (
      <button
        key={page.id}
        onClick={() => router.push(resolveNavTarget(page))}
        className="zg-nav-row"
        data-active={isActive ? "true" : undefined}
        aria-current={isActive ? "page" : undefined}
        type="button"
      >
        {body}
      </button>
    );
  };

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
          <div className="zg-scroll h-full overflow-y-auto px-3 py-5">
            {headerCollapsed && (
              <div className="zg-panel mb-4 p-3" style={{ backgroundColor: 'color-mix(in srgb, var(--bg-card) 79%, transparent)' }}>
                {/* The lockup is trimmed to its artwork, so it's sized by height
                    and centered — the old over-wide, negatively-offset crop
                    existed only to cut the padding out of the SVG export. */}
                <Link href="/" className="flex w-full items-center justify-center overflow-hidden">
                  <Image
                    {...brandLogo(theme === "dark")}
                    alt="ZeroGEX"
                    style={{ height: "84px", width: "auto", maxWidth: "100%", objectFit: "contain" }}
                  />
                </Link>
                {row1Price !== null && (
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <div className="flex flex-col gap-1">
                      <span className="zg-metric" style={{ fontSize: "1.125rem" }}>${row1Price.toFixed(2)}</span>
                      {row1Change !== null && row1ChangePercent !== null && (
                        <div className="zg-datum flex items-center gap-1 px-2 py-0.5 font-semibold text-xs w-fit" style={{ borderRadius: 'var(--radius-control)', backgroundColor: `${row1Positive ? 'var(--color-bull)' : 'var(--color-bear)'}1f`, color: row1Positive ? 'var(--color-bull)' : 'var(--color-bear)' }}>
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
            {favoriteItems.length > 0 && (() => {
              const favExpanded = expandedGroups["__favorites__"] ?? true;
              return (
                <div className="mb-3">
                  <button
                    type="button"
                    onClick={() => setExpandedGroups((prev) => ({ ...prev, __favorites__: !favExpanded }))}
                    className="zg-nav-group mb-1"
                    aria-expanded={favExpanded}
                  >
                    <span className="flex items-center gap-1.5">
                      <Pin size={11} fill="currentColor" strokeWidth={1.75} />
                      {t('nav.group.favorites')}
                    </span>
                    <ChevronDown
                      size={13}
                      style={{ transform: favExpanded ? "rotate(0deg)" : "rotate(-90deg)", transition: "transform 0.2s" }}
                    />
                  </button>
                  {favExpanded ? (
                    <div>{favoriteItems.map(renderItem)}</div>
                  ) : null}
                </div>
              );
            })()}
            {filteredNavGroups.map((group) => {
              const isExpanded = expandedGroups[group.label] ?? false;

              return (
                <div key={group.label} className="mb-3 last:mb-0">
                  <button
                    type="button"
                    onClick={() => setExpandedGroups((prev) => ({ ...prev, [group.label]: !isExpanded }))}
                    className="zg-nav-group mb-1"
                    aria-expanded={isExpanded}
                  >
                    {group.labelKey ? t(group.labelKey) : group.label}
                    <ChevronDown
                      size={13}
                      style={{ transform: isExpanded ? "rotate(0deg)" : "rotate(-90deg)", transition: "transform 0.2s" }}
                    />
                  </button>
                  {isExpanded ? (
                    <div>
                      {group.items.map(renderItem)}
                      {group.subgroups.map((subgroup) => {
                        const subKey = `${group.label}::${subgroup.label}`;
                        const isSubExpanded = expandedGroups[subKey] ?? false;
                        const subgroupId = subgroup.id;
                        const subgroupLock = lockedTier(subgroup);
                        const subgroupActive = subgroupId != null && pathname === subgroupId;
                        return (
                          <div key={subKey} className="mt-1">
                            <div
                              className="zg-nav-row"
                              data-active={subgroupActive ? "true" : undefined}
                              style={{ padding: 0, gap: 0 }}
                            >
                              {subgroupId ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    router.push(resolveNavTarget({ id: subgroupId, requiredTier: subgroup.requiredTier }));
                                    setExpandedGroups((prev) => ({ ...prev, [subKey]: true }));
                                  }}
                                  className="flex-1 min-w-0 px-3 py-2 text-left bg-transparent flex items-center gap-2"
                                  style={{ color: "inherit", font: "inherit", border: 0, cursor: "pointer" }}
                                  aria-current={subgroupActive ? "page" : undefined}
                                >
                                  <span className="zg-nav-row-label">{navLabel(subgroup)}</span>
                                  {subgroupLock && <TierBadge tier={subgroupLock} />}
                                </button>
                              ) : (
                                <span className="flex-1 min-w-0 px-3 py-2 flex items-center gap-2" style={{ color: "inherit" }}>
                                  <span className="zg-nav-row-label">{navLabel(subgroup)}</span>
                                  {subgroupLock && <TierBadge tier={subgroupLock} />}
                                </span>
                              )}
                              <button
                                type="button"
                                aria-label={isSubExpanded ? t('nav.collapse', { name: navLabel(subgroup) }) : t('nav.expand', { name: navLabel(subgroup) })}
                                aria-expanded={isSubExpanded}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setExpandedGroups((prev) => ({ ...prev, [subKey]: !isSubExpanded }));
                                }}
                                className="flex h-8 w-8 shrink-0 items-center justify-center bg-transparent"
                                style={{ color: "inherit", border: 0, cursor: "pointer", borderRadius: "var(--radius-control)" }}
                              >
                                <ChevronDown
                                  size={13}
                                  style={{ transform: isSubExpanded ? "rotate(0deg)" : "rotate(-90deg)", transition: "transform 0.2s" }}
                                />
                              </button>
                            </div>
                            {/* Children indent off a hairline, so depth reads
                                structurally rather than from a second tint. */}
                            {isSubExpanded ? (
                              <div className="ml-3 pl-1 border-l" style={{ borderColor: "var(--border-subtle)" }}>
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
            className="absolute -right-8 top-4 flex h-14 w-8 items-center justify-center border border-l-0 opacity-0 transition-opacity duration-150 group-hover/sidebar:opacity-100 focus-visible:opacity-100"
            style={{
              borderRadius: "0 var(--radius-control) var(--radius-control) 0",
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
          className="hidden md:flex fixed z-30 items-center gap-1 border border-l-0 px-2"
          style={{
            left: 0,
            top: "calc(var(--zgx-header-height, 0px) + 18px)",
            height: "56px",
            borderRadius: "0 var(--radius-control) var(--radius-control) 0",
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
