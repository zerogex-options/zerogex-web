"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CircleUserRound, LogIn, LogOut, Rocket, User } from "lucide-react";
import TierBadge from "./TierBadge";
import { useLanguage } from "@/core/LanguageContext";
import { normalizeTier } from "@/core/auth";
import { useAuthSession } from "@/hooks/useAuthSession";

interface AccountMenuProps {
  /** Anchors the panel to the trigger's left edge instead of its right. */
  align?: "start" | "end";
  /** Compact trigger for the collapsed header and the mobile top bar. */
  compact?: boolean;
}

/**
 * The header account control — avatar trigger plus the identity-first dropdown
 * behind it.
 *
 * Two things it fixes over the inline version it replaces. First, the trigger
 * now says WHO is signed in: signed-in members get their initials on the brand
 * accent, guests keep the outline glyph, so the two states are no longer
 * pixel-identical. Second, the panel opens with an identity block (email +
 * plan) the way every established platform's account menu does, and its rows
 * have real hover/active states — the previous ones had no hover feedback at
 * all, which is the sort of thing that reads as unfinished without anyone
 * being able to name why.
 *
 * It also existed twice in Header.tsx (once for the collapsed rail, once for
 * the expanded one) and the two copies had already drifted — the expanded one
 * shipped hardcoded English "Logout"/"Login" past the translation layer.
 */
export default function AccountMenu({ align = "end", compact = false }: AccountMenuProps) {
  const { t } = useLanguage();
  const router = useRouter();
  const { data: authSession, refresh: refreshAuth } = useAuthSession();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuId = useId();

  const isAuthed = !!authSession?.authenticated;
  const email = authSession?.user?.email ?? null;
  const tier = normalizeTier(authSession?.user?.tier ?? "public");
  const canUpgrade = tier !== "pro" && tier !== "admin";

  // Initials from the local part of the address: "jane.doe@x.io" → "JD",
  // "trader@x.io" → "TR". Never more than two glyphs, so the plate stays square.
  const initials = (() => {
    const local = email?.split("@")[0] ?? "";
    const parts = local.split(/[._\-+]/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return (local.slice(0, 2) || "ZG").toUpperCase();
  })();

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
    };
    // Escape returns focus to the trigger, so keyboard users aren't dropped
    // back at the top of the document when the panel closes.
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      triggerRef.current?.focus();
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const handleLogout = async () => {
    const csrfResponse = await fetch("/api/auth/csrf");
    const csrf = (await csrfResponse.json()) as { csrfToken: string };
    await fetch("/api/auth/logout", {
      method: "POST",
      headers: { "x-csrf-token": csrf.csrfToken },
    });
    localStorage.removeItem("zgx_symbol");
    await refreshAuth();
    router.push("/login");
  };

  const go = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-label={t("menu.openProfile")}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        className={
          isAuthed
            ? `zg-avatar${compact ? " zg-avatar--sm" : ""}`
            : `zg-icon-btn${compact ? " zg-icon-btn--sm" : ""}`
        }
        data-active={open ? "true" : undefined}
      >
        {isAuthed ? initials : <CircleUserRound size={compact ? 16 : 18} />}
      </button>

      {open && (
        <div
          id={menuId}
          role="menu"
          className="zg-menu"
          style={align === "start" ? { left: 0 } : { right: 0 }}
        >
          <div className="zg-menu-head">
            <span className="zg-avatar" aria-hidden style={{ cursor: "default" }}>
              {isAuthed ? initials : <CircleUserRound size={18} />}
            </span>
            <span className="zg-menu-head-text">
              <span className="zg-menu-email" title={email ?? undefined}>
                {email ?? t("menu.notSignedIn")}
              </span>
              <span>
                <TierBadge tier={tier} />
              </span>
            </span>
          </div>

          <div className="zg-menu-sep" />

          {isAuthed && (
            <button type="button" role="menuitem" className="zg-menu-item" onClick={() => go("/account")}>
              <User size={16} />
              {t("menu.account")}
            </button>
          )}
          {canUpgrade && (
            <button
              type="button"
              role="menuitem"
              className="zg-menu-item zg-menu-item--accent"
              onClick={() => go("/pricing")}
            >
              <Rocket size={16} />
              {t("menu.upgrade")}
            </button>
          )}
          <button
            type="button"
            role="menuitem"
            className="zg-menu-item"
            onClick={() => {
              setOpen(false);
              if (isAuthed) {
                void handleLogout();
                return;
              }
              router.push("/login");
            }}
          >
            {isAuthed ? <LogOut size={16} /> : <LogIn size={16} />}
            {isAuthed ? t("menu.logout") : t("menu.login")}
          </button>
        </div>
      )}
    </div>
  );
}
