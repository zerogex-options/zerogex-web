"use client";

/**
 * WallAlertsBell — the header's wall-alert inbox.
 *
 * A bell with an unread count; clicking opens the latest alerts (marked read
 * as they are shown) with links to manage them. Rendered only for members whose
 * plan includes wall alerts (Basic and up), so nobody else pays for the poll.
 *
 * Same trigger / popup conventions as NewsHeadlinesBadge (compact, mobile and
 * labelled variants), so the header's badges feel like one set. The data comes
 * from the shared store in hooks/useWallAlertsFeed — every instance on the page
 * shares one poll.
 */

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Bell, BellPlus, X } from "lucide-react";
import { useLanguage, usePageT } from "@/core/LanguageContext";
import { useHasTierAccess } from "@/hooks/useAuthSession";
import { markAllWallAlertsRead, useWallAlertsFeed } from "@/hooks/useWallAlertsFeed";
import { wallAlertCopyFor } from "@/core/wallAlertsCopy";
import { WallAlertRow } from "./WallAlertRow";
import { dict } from "./WallAlertsBell.i18n";

interface WallAlertsBellProps {
  compact?: boolean;
  mobile?: boolean;
  label?: string;
}

export default function WallAlertsBell({ compact = false, mobile = false, label }: WallAlertsBellProps) {
  const entitled = useHasTierAccess("basic");
  if (!entitled) return null;
  return <WallAlertsBellInner compact={compact} mobile={mobile} label={label} />;
}

function WallAlertsBellInner({
  compact,
  mobile,
  label,
}: Required<Pick<WallAlertsBellProps, "compact" | "mobile">> & { label?: string }) {
  const t = usePageT(dict);
  const { locale } = useLanguage();
  const copy = useMemo(() => wallAlertCopyFor(locale), [locale]);
  const { data } = useWallAlertsFeed(true);
  const [open, setOpen] = useState(false);
  // Ids that were unread when the popup opened, so they stay highlighted for
  // this look even though opening marks them read on the server.
  const [highlight, setHighlight] = useState<Set<number>>(new Set());
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const popupRef = useRef<HTMLDivElement | null>(null);

  const entries = data?.entries ?? [];
  const unread = data?.unread ?? 0;

  const toggle = () => {
    if (open) {
      setOpen(false);
      return;
    }
    setHighlight(new Set(entries.filter((e) => !e.read).map((e) => e.id)));
    setOpen(true);
    if (unread > 0) void markAllWallAlertsRead();
  };

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (wrapperRef.current?.contains(target)) return;
      if (popupRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const border = "var(--color-border)";
  const cardBg = "color-mix(in srgb, var(--bg-card) 96%, transparent)";
  const iconSize = compact ? 18 : 20;
  const ariaLabel = unread > 0 ? t("ariaUnread", { n: unread }) : t("aria");

  const trigger = (
    <button
      type="button"
      onClick={toggle}
      className={label ? "zg-msheet-tool relative" : "relative rounded-full border transition-colors"}
      style={
        label
          ? undefined
          : {
              borderColor: border,
              color: unread > 0 ? "var(--color-brand-accent)" : "var(--text-secondary)",
              backgroundColor: "transparent",
              padding: compact ? "6px" : "9px",
              cursor: "pointer",
            }
      }
      aria-label={ariaLabel}
      aria-expanded={open}
      title={t("title")}
    >
      <Bell size={label ? 20 : iconSize} strokeWidth={2.2} />
      {label && <span>{label}</span>}
      {unread > 0 && (
        <span
          aria-hidden
          className="tabular-nums"
          style={{
            position: "absolute",
            top: compact ? "-5px" : "-6px",
            right: compact ? "-5px" : "-6px",
            minWidth: "16px",
            height: "16px",
            padding: "0 4px",
            borderRadius: "999px",
            background: "var(--color-brand-coral)",
            color: "#ffffff",
            fontSize: "10px",
            fontWeight: 700,
            lineHeight: "16px",
            textAlign: "center",
          }}
        >
          {unread > 99 ? "99+" : unread}
        </span>
      )}
    </button>
  );

  const usePortal = compact || mobile;
  const positioning: React.CSSProperties = mobile
    ? { position: "fixed", top: "calc(var(--zgx-header-height, 56px) + 10px)", left: "50%", transform: "translateX(-50%)" }
    : compact
      ? { position: "fixed", top: "calc(var(--zgx-header-height, 56px) + 10px)", right: "12px" }
      : { position: "absolute", right: 0, top: "calc(100% + 10px)" };

  const popup = open && (
    <div
      ref={popupRef}
      role="dialog"
      aria-label={t("title")}
      className="rounded-xl border"
      style={{
        ...positioning,
        width: "min(92vw, 380px)",
        maxHeight: "min(70vh, 520px)",
        overflowY: "auto",
        background: cardBg,
        borderColor: border,
        boxShadow: "0 12px 32px rgba(0, 0, 0, 0.28)",
        zIndex: 70,
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
      }}
    >
      <div
        className="px-4 py-3 border-b flex items-center justify-between gap-2"
        style={{ borderColor: border, position: "sticky", top: 0, background: cardBg, zIndex: 1 }}
      >
        <div className="flex items-center gap-2">
          <Bell size={16} style={{ color: "var(--color-brand-primary)" }} />
          <span className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--text-primary)" }}>
            {t("title")}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/account/alerts"
            onClick={() => setOpen(false)}
            className="text-[11px] font-semibold"
            style={{ color: "var(--color-info)" }}
          >
            {t("manage")}
          </Link>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-md p-1"
            style={{ color: "var(--text-secondary)" }}
            aria-label={t("dismiss")}
          >
            <X size={14} />
          </button>
        </div>
      </div>
      {entries.length === 0 ? (
        <div className="p-6 text-center">
          <div className="text-xs font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
            {t("emptyTitle")}
          </div>
          <div className="text-[11px] leading-snug mb-3" style={{ color: "var(--text-secondary)" }}>
            {t("emptyBody")}
          </div>
          <Link
            href="/account/alerts"
            onClick={() => setOpen(false)}
            className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-full"
            style={{ backgroundColor: "var(--color-info)", color: "var(--color-on-info, #ffffff)" }}
          >
            <BellPlus size={12} /> {t("setUp")}
          </Link>
        </div>
      ) : (
        <>
          <ul className="divide-y" style={{ borderColor: border }}>
            {entries.map((entry) => (
              <li
                key={entry.id}
                className="px-4 py-3"
                style={{ backgroundColor: highlight.has(entry.id) ? "var(--color-info-soft)" : "transparent" }}
              >
                <WallAlertRow entry={entry} copy={copy} locale={locale} compact />
              </li>
            ))}
          </ul>
          <div className="px-4 py-2.5 border-t text-center" style={{ borderColor: border }}>
            <Link
              href="/account/alerts"
              onClick={() => setOpen(false)}
              className="text-[11px] font-semibold"
              style={{ color: "var(--color-info)" }}
            >
              {t("viewAll")}
            </Link>
          </div>
        </>
      )}
    </div>
  );

  return (
    <div ref={wrapperRef} className="relative" style={{ flexShrink: 0 }}>
      {trigger}
      {open && usePortal ? createPortal(popup, document.body) : popup}
    </div>
  );
}
