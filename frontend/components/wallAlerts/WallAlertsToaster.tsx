"use client";

/**
 * WallAlertsToaster — announces wall alerts that arrive while ZeroGEX is open.
 *
 * Mounted once (in the Header). A new alert shows as a toast in the visible
 * tab, or — when the member switched desktop notifications on for this browser
 * (/account/alerts) and the tab is in the background — as a system
 * notification. Each alert is announced by ONE tab: the claim in
 * core/wallAlertsPrefs.ts is shared through localStorage, so three open tabs
 * do not produce three pop-ups.
 *
 * Arrivals come from the shared feed store (hooks/useWallAlertsFeed), which
 * never reports what was already waiting at page load — history belongs in the
 * bell, not in a burst of toasts.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { BellRing, X } from "lucide-react";
import { useLanguage, usePageT } from "@/core/LanguageContext";
import { useHasTierAccess } from "@/hooks/useAuthSession";
import { onNewWallAlerts, useWallAlertsFeed } from "@/hooks/useWallAlertsFeed";
import { formatWallAlert, type WallAlertFeedEntry } from "@/core/wallAlerts";
import { wallAlertCopyFor } from "@/core/wallAlertsCopy";
import { claimAnnouncement, desktopEnabled } from "@/core/wallAlertsPrefs";
import { TONE_COLOR } from "./WallAlertRow";
import { dict } from "./WallAlertsBell.i18n";

const TOAST_MS = 12_000;
const MAX_TOASTS = 3;

export default function WallAlertsToaster() {
  const entitled = useHasTierAccess("basic");
  if (!entitled) return null;
  return <WallAlertsToasterInner />;
}

function WallAlertsToasterInner() {
  const t = usePageT(dict);
  const { locale } = useLanguage();
  const copy = useMemo(() => wallAlertCopyFor(locale), [locale]);
  // Subscribing keeps the shared poll alive even on pages whose header bell is
  // CSS-hidden (phones), so arrivals are still announced.
  useWallAlertsFeed(true);
  // Starts empty and only fills from the feed callback, which runs in the
  // browser, so the portal below never renders on the server.
  const [toasts, setToasts] = useState<WallAlertFeedEntry[]>([]);
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((e) => e.id !== id));
    const handle = timers.current.get(id);
    if (handle) clearTimeout(handle);
    timers.current.delete(id);
  }, []);

  useEffect(() => {
    const allTimers = timers.current;
    const off = onNewWallAlerts((entries) => {
      const hidden = document.visibilityState === "hidden";
      const show: WallAlertFeedEntry[] = [];
      for (const entry of entries) {
        if (!claimAnnouncement(entry.id)) continue;
        if (hidden) {
          if (desktopEnabled()) {
            const f = formatWallAlert(entry.payload, copy);
            try {
              const note = new Notification(f.headline, {
                body: f.detail,
                tag: `zgx-wall-alert-${entry.id}`,
                icon: "/favicon.ico",
              });
              note.onclick = () => {
                window.focus();
                note.close();
              };
            } catch {
              /* some browsers only allow notifications from a service worker */
            }
          }
          continue;
        }
        show.push(entry);
      }
      if (show.length === 0) return;
      setToasts((prev) => [...prev, ...show].slice(-MAX_TOASTS));
      for (const entry of show) {
        allTimers.set(
          entry.id,
          setTimeout(() => dismiss(entry.id), TOAST_MS),
        );
      }
    });
    return () => {
      off();
      for (const handle of allTimers.values()) clearTimeout(handle);
      allTimers.clear();
    };
  }, [copy, dismiss]);

  if (toasts.length === 0) return null;

  return createPortal(
    <div
      aria-live="polite"
      className="fixed z-[80] flex flex-col gap-2"
      style={{ right: 16, bottom: 16, left: "auto", width: "min(calc(100vw - 32px), 360px)" }}
    >
      {toasts.map((entry) => {
        const f = formatWallAlert(entry.payload, copy);
        const color = TONE_COLOR[f.tone];
        return (
          <div
            key={entry.id}
            role="status"
            className="rounded-xl border p-3 flex items-start gap-3"
            style={{
              background: "color-mix(in srgb, var(--bg-card) 97%, transparent)",
              borderColor: "var(--color-border)",
              borderLeft: `4px solid ${color}`,
              boxShadow: "0 12px 32px rgba(0, 0, 0, 0.28)",
              backdropFilter: "blur(16px)",
              WebkitBackdropFilter: "blur(16px)",
            }}
          >
            <BellRing size={16} style={{ color, flexShrink: 0, marginTop: 2 }} />
            <a href={`/dashboard?symbol=${encodeURIComponent(entry.payload.symbol)}`} className="min-w-0 flex-1" title={t("openChart", { symbol: entry.payload.symbol })}>
              <div className="text-[9px] font-bold tracking-wider" style={{ color }}>
                {f.kindChip}
              </div>
              <div className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>
                {f.headline}
              </div>
              <div className="text-[11px] leading-snug tabular-nums" style={{ color: "var(--text-secondary)" }}>
                {f.detail}
              </div>
              {f.tierLabel ? (
                <div className="text-[10px] mt-0.5" style={{ color: "var(--text-secondary)" }}>
                  {f.facts[0]}
                </div>
              ) : null}
            </a>
            <button
              type="button"
              onClick={() => dismiss(entry.id)}
              className="rounded-md p-0.5"
              style={{ color: "var(--text-secondary)" }}
              aria-label={t("dismiss")}
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>,
    document.body,
  );
}
