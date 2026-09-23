"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { ArrowUpRight, ChevronDown, ChevronRight, Moon, Sun } from "lucide-react";
import { NAV_ITEM_IDS, type NavGroup, type NavItem, type NavSubgroup } from "@/core/navigation";
import type { TierId } from "@/core/auth";
import type { Theme } from "@/core/types";
import { useTheme } from "@/core/ThemeContext";
import { useLanguage } from "@/core/LanguageContext";
import { LOCALE_META } from "@/core/i18n/locales";
import { lockPageScroll } from "@/core/scrollLock";
import { PALETTES } from "./ThemeDropdown";
import TierBadge from "./TierBadge";
import BetaBadge from "./BetaBadge";

/**
 * The phone menu: a full-height sheet under the mobile top bar.
 *
 * It replaced a list that expanded INSIDE the sticky header — a transparent,
 * blurred bar — so the menu was read through a haze of whatever page sat
 * beneath it, its rows were 12px text on ~32px targets, and every control that
 * did not fit anywhere else (snapshot, calendar, headlines, palette, language,
 * dark mode) was crammed into the top bar beside the logo, which left the logo
 * a few pixels wide. The sheet is opaque, portalled to <body> (the header's
 * backdrop-filter would otherwise become the containing block of a fixed
 * child), locks the page behind it, and gives each row a thumb-sized target.
 *
 * Order is by how often a phone visitor needs it: the market they are looking
 * at, the page they want next, then the one-off tools and display settings,
 * then the account.
 */

type Entry = { id?: string; requiredTier?: NavItem["requiredTier"] };
type LabelEntry = { label: string; labelKey?: NavItem["labelKey"] };
export type MobileNavGroup = NavGroup & { items: NavItem[]; subgroups: NavSubgroup[] };

// Mirrors Navigation.tsx's isNavItemActive (pinned by tests/navigationActive):
// exact match, or a prefix match for dated-permalink sections that yields to
// any descendant with its own nav entry.
function isActive(pathname: string | null, item: { id: string; matchPrefix?: boolean }): boolean {
  if (!pathname) return false;
  if (pathname === item.id) return true;
  if (item.matchPrefix !== true) return false;
  if (!pathname.startsWith(`${item.id}/`)) return false;
  return !NAV_ITEM_IDS.has(pathname);
}

interface MobileMenuSheetProps {
  open: boolean;
  onClose: () => void;
  /** DOM id, referenced by the menu button's aria-controls. */
  id: string;
  theme: Theme;
  onToggleTheme: () => void;
  groups: MobileNavGroup[];
  pathname: string | null;
  expanded: Record<string, boolean>;
  onToggleExpanded: (key: string) => void;
  navLabel: (entry: LabelEntry) => string;
  lockedTier: (entry: Entry) => TierId | null;
  resolveNavTarget: (entry: { id: string; requiredTier?: NavItem["requiredTier"] }) => string;
  /** Symbol, quote and session block — owned by Header, which prices it. */
  market: ReactNode;
  /** Account / upgrade / sign-in actions. */
  account: ReactNode;
  /** Labelled tool tiles (calendar, headlines, snapshot). */
  tools: ReactNode;
}

export default function MobileMenuSheet({
  open,
  onClose,
  id,
  theme,
  onToggleTheme,
  groups,
  pathname,
  expanded,
  onToggleExpanded,
  navLabel,
  lockedTier,
  resolveNavTarget,
  market,
  account,
  tools,
}: MobileMenuSheetProps) {
  const { palette, setPalette } = useTheme();
  const { locale, setLocale, t } = useLanguage();
  const sheetRef = useRef<HTMLDivElement | null>(null);

  // Hold the page still while the sheet is up, and let Escape close it (a
  // hardware keyboard on a tablet, or a desktop window narrowed to phone width).
  useEffect(() => {
    if (!open) return;
    const release = lockPageScroll();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    sheetRef.current?.focus({ preventScroll: true });
    return () => {
      document.removeEventListener("keydown", onKey);
      release();
    };
  }, [open, onClose]);

  // The sheet is the phone and tablet surface. If the window grows past the lg
  // breakpoint while it is open (a tablet rotating, a desktop window widening),
  // close it rather than leave a locked page behind the desktop chrome.
  useEffect(() => {
    if (!open) return;
    const mql = window.matchMedia("(min-width: 1024px)");
    const onChange = (e: MediaQueryListEvent) => {
      if (e.matches) onClose();
    };
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  const renderItem = (item: NavItem) => {
    const lock = lockedTier(item);
    const target = resolveNavTarget(item);
    const content = (
      <>
        <span className="zg-msheet-row-label">{navLabel(item)}</span>
        {lock && <TierBadge tier={lock} />}
        {item.beta && <BetaBadge />}
        {item.external ? (
          <ArrowUpRight size={16} aria-hidden className="zg-msheet-row-icon" />
        ) : (
          <ChevronRight size={16} aria-hidden className="zg-msheet-row-icon" />
        )}
      </>
    );
    if (item.external) {
      const offsite = target.startsWith("http");
      return (
        <li key={item.id}>
          <a
            href={target}
            target={offsite ? "_blank" : undefined}
            rel={offsite ? "noreferrer" : undefined}
            className="zg-msheet-row"
            onClick={onClose}
          >
            {content}
          </a>
        </li>
      );
    }
    const active = isActive(pathname, item);
    return (
      <li key={item.id}>
        <Link
          href={target}
          className="zg-msheet-row"
          data-active={active ? "true" : undefined}
          aria-current={active ? "page" : undefined}
          onClick={onClose}
        >
          {content}
        </Link>
      </li>
    );
  };

  const renderSubgroup = (group: MobileNavGroup, sub: NavSubgroup) => {
    const key = `${group.label}::${sub.label}`;
    const isOpen = expanded[key] ?? false;
    const lock = lockedTier(sub);
    const subId = sub.id;
    const active = subId != null && pathname === subId;
    const chevron = (
      <ChevronDown
        size={16}
        aria-hidden
        style={{ transform: isOpen ? "none" : "rotate(-90deg)", transition: "transform var(--dur-2) var(--ease-standard)" }}
      />
    );
    return (
      <li key={key} className="zg-msheet-sub">
        {subId ? (
          // Two destinations, so the row splits: the label opens the
          // subgroup's own dashboard, the chevron expands its pages.
          <div className="zg-msheet-sub-head">
            <Link
              href={resolveNavTarget({ id: subId, requiredTier: sub.requiredTier })}
              className="zg-msheet-row zg-msheet-row--sub"
              data-active={active ? "true" : undefined}
              aria-current={active ? "page" : undefined}
              onClick={onClose}
            >
              <span className="zg-msheet-row-label">{navLabel(sub)}</span>
              {lock && <TierBadge tier={lock} />}
            </Link>
            <button
              type="button"
              className="zg-msheet-sub-toggle"
              aria-expanded={isOpen}
              aria-label={isOpen ? t("nav.collapse", { name: navLabel(sub) }) : t("nav.expand", { name: navLabel(sub) })}
              onClick={() => onToggleExpanded(key)}
            >
              {chevron}
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="zg-msheet-row zg-msheet-row--sub"
            aria-expanded={isOpen}
            onClick={() => onToggleExpanded(key)}
          >
            <span className="zg-msheet-row-label">{navLabel(sub)}</span>
            {lock && <TierBadge tier={lock} />}
            <span className="zg-msheet-row-icon">{chevron}</span>
          </button>
        )}
        {isOpen && <ul className="zg-msheet-list zg-msheet-list--nested">{sub.items.map(renderItem)}</ul>}
      </li>
    );
  };

  return createPortal(
    <div
      id={id}
      ref={sheetRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label="Site menu"
      className="zg-msheet lg:hidden"
    >
      <section className="zg-msheet-market">{market}</section>

      <nav aria-label="Site" className="zg-msheet-nav">
        {groups.map((group) => {
          const isOpen = expanded[group.label] ?? false;
          return (
            <section key={group.label} className="zg-msheet-group">
              <button
                type="button"
                className="zg-msheet-group-head"
                aria-expanded={isOpen}
                onClick={() => onToggleExpanded(group.label)}
              >
                <span>{navLabel(group)}</span>
                <ChevronDown
                  size={16}
                  aria-hidden
                  style={{ transform: isOpen ? "none" : "rotate(-90deg)", transition: "transform var(--dur-2) var(--ease-standard)" }}
                />
              </button>
              {isOpen && (
                <ul className="zg-msheet-list">
                  {group.items.map(renderItem)}
                  {group.subgroups.map((sub) => renderSubgroup(group, sub))}
                </ul>
              )}
            </section>
          );
        })}
      </nav>

      <section className="zg-msheet-section" aria-label="Tools">
        <div className="zg-eyebrow zg-msheet-section-title">Tools</div>
        <div className="zg-msheet-tools">{tools}</div>
      </section>

      <section className="zg-msheet-section" aria-label="Display">
        <div className="zg-eyebrow zg-msheet-section-title">Display</div>
        <div className="zg-msheet-seg" role="group" aria-label={t("menu.toggleTheme")}>
          <button
            type="button"
            aria-pressed={theme !== "dark"}
            data-active={theme !== "dark" ? "true" : undefined}
            onClick={() => {
              if (theme === "dark") onToggleTheme();
            }}
          >
            <Sun size={16} aria-hidden /> Light
          </button>
          <button
            type="button"
            aria-pressed={theme === "dark"}
            data-active={theme === "dark" ? "true" : undefined}
            onClick={() => {
              if (theme !== "dark") onToggleTheme();
            }}
          >
            <Moon size={16} aria-hidden /> Dark
          </button>
        </div>

        <div className="zg-msheet-swatches" role="listbox" aria-label="Theme palettes">
          {PALETTES.map((p) => {
            const selected = p.id === palette;
            return (
              <button
                key={p.id}
                type="button"
                role="option"
                aria-selected={selected}
                data-active={selected ? "true" : undefined}
                onClick={() => setPalette(p.id)}
                className="zg-msheet-swatch"
              >
                <span aria-hidden className="zg-msheet-swatch-chip">
                  {p.swatch.map((c, i) => (
                    <span key={i} style={{ background: c }} />
                  ))}
                </span>
                <span className="zg-msheet-swatch-name">{p.name}</span>
              </button>
            );
          })}
        </div>

        <div className="zg-msheet-seg zg-msheet-seg--locales" role="listbox" aria-label={t("language.select")}>
          {LOCALE_META.map((l) => {
            const selected = l.code === locale;
            return (
              <button
                key={l.code}
                type="button"
                role="option"
                lang={l.code}
                aria-selected={selected}
                aria-label={l.label}
                data-active={selected ? "true" : undefined}
                onClick={() => setLocale(l.code)}
              >
                {l.code.toUpperCase()}
              </button>
            );
          })}
        </div>
      </section>

      <section className="zg-msheet-section zg-msheet-account">{account}</section>
    </div>,
    document.body,
  );
}
