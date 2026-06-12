"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CalendarDays, X } from "lucide-react";
import { Theme } from "@/core/types";
import { colors } from "@/core/colors";
import {
  getUpcomingOptionsEvents,
  urgencyForDaysUntil,
  urgencyPalette,
  formatRelativeDay,
  formatEventDate,
  type OptionsEvent,
} from "@/core/optionsCalendar";

interface OptionsCalendarBadgeProps {
  theme: Theme;
  compact?: boolean;
  // When true, the popup is centered on the viewport (mobile). When false
  // (desktop, whether collapsed or expanded), the popup is anchored to the
  // right side of the viewport so it lands in the same place users are
  // already used to from the expanded header.
  mobile?: boolean;
}

export default function OptionsCalendarBadge({ theme, compact = false, mobile = false }: OptionsCalendarBadgeProps) {
  const [open, setOpen] = useState(false);
  const [now, setNow] = useState<Date>(() => new Date());
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const popupRef = useRef<HTMLDivElement | null>(null);

  // Refresh "days until" once per hour — calendar-day granularity is fine.
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      const target = e.target as Node;
      // The popup may be portaled outside wrapperRef (compact mode), so we
      // check both refs before closing.
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

  const events = useMemo<OptionsEvent[]>(() => getUpcomingOptionsEvents({ now }), [now]);
  const nextEvent = events[0];
  const nextUrgency = nextEvent ? urgencyForDaysUntil(nextEvent.daysUntil) : "later";
  const palette = urgencyPalette(nextUrgency, colors);

  const border = "var(--color-border)";
  const cardBg = theme === "dark" ? `${colors.cardDark}f5` : `${colors.cardLight}f5`;

  const iconSize = compact ? 18 : 20;

  // The trigger button mirrors the header's theme toggle (transparent +
  // muted icon, accent-tinted on hover). Urgency is conveyed via the corner
  // pill, not the button shell, so all header buttons stay visually
  // uniform.
  const trigger = (
    <button
      type="button"
      onClick={() => setOpen((prev) => !prev)}
      className="relative rounded-full border transition-colors"
      style={{
        borderColor: border,
        color: colors.muted,
        backgroundColor: "transparent",
        padding: compact ? "6px" : "9px",
        cursor: "pointer",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = `${colors.accent}26`;
        e.currentTarget.style.color = colors.accent;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = "transparent";
        e.currentTarget.style.color = colors.muted;
      }}
      aria-label="Options calendar"
      title={
        nextEvent
          ? `${nextEvent.label} — ${formatRelativeDay(nextEvent.daysUntil)}`
          : "Options calendar"
      }
    >
      <CalendarDays size={iconSize} strokeWidth={2.2} />
      {nextEvent && nextUrgency !== "later" && (
        <span
          aria-hidden
          style={{
            position: "absolute",
            top: compact ? "-3px" : "-4px",
            right: compact ? "-3px" : "-4px",
            minWidth: compact ? "16px" : "18px",
            height: compact ? "16px" : "18px",
            padding: "0 4px",
            borderRadius: "999px",
            background: palette.pillBg,
            color: palette.pillFg,
            fontSize: compact ? "9px" : "10px",
            fontWeight: 700,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            lineHeight: 1,
            border: `1px solid ${palette.border}`,
            boxShadow: nextUrgency === "today" ? `0 0 10px ${colors.coral}80` : undefined,
          }}
        >
          {nextUrgency === "today"
            ? "•"
            : nextUrgency === "tomorrow"
              ? "1d"
              : `${nextEvent.daysUntil}d`}
        </span>
      )}
    </button>
  );

  // Popup positioning:
  //  - Mobile: pinned to viewport center (the trigger sits mid-bar, so
  //    anchoring relative to it would push the popup off the left edge).
  //  - Desktop collapsed: trigger is in the upper-left of the header but the
  //    popup should still feel like it's "on the right" (matching the
  //    desktop-expanded experience), so we pin to viewport right.
  //  - Desktop expanded: trigger is already on the right side of the header,
  //    so a button-anchored absolute popup works fine.
  // Both fixed cases are portaled to body to avoid backdrop-filter
  // containing-block surprises in the sticky header.
  const usePortal = compact;
  const popupPositioning: React.CSSProperties = mobile
    ? {
        position: "fixed",
        top: "calc(var(--zgx-header-height, 56px) + 10px)",
        left: "50%",
        transform: "translateX(-50%)",
      }
    : compact
      ? {
          position: "fixed",
          top: "calc(var(--zgx-header-height, 56px) + 10px)",
          right: "12px",
        }
      : {
          position: "absolute",
          right: 0,
          top: "calc(100% + 10px)",
        };

  const popup = open && (
    <div
      ref={popupRef}
      role="dialog"
      aria-label="Upcoming options events"
      className="rounded-xl border"
      style={{
        ...popupPositioning,
        width: "min(92vw, 360px)",
        maxHeight: "min(70vh, 460px)",
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
            className="flex items-center justify-between px-4 py-3 border-b"
            style={{ borderColor: border }}
          >
            <div className="flex items-center gap-2">
              <CalendarDays size={16} style={{ color: colors.primary }} />
              <span
                className="text-xs font-bold uppercase tracking-wider"
                style={{ color: theme === "dark" ? colors.light : colors.dark }}
              >
                Options Calendar
              </span>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-md p-1"
              style={{ color: colors.muted, background: "transparent", cursor: "pointer" }}
              aria-label="Close"
            >
              <X size={14} />
            </button>
          </div>

          {events.length === 0 ? (
            <div
              className="px-4 py-6 text-xs"
              style={{ color: colors.muted, textAlign: "center" }}
            >
              No special options days in the next 45 days.
            </div>
          ) : (
            <ul style={{ listStyle: "none", margin: 0, padding: "8px" }}>
              {events.map((event, idx) => {
                const urgency = urgencyForDaysUntil(event.daysUntil);
                const pal = urgencyPalette(urgency, colors);
                return (
                  <li
                    key={`${event.isoDate}-${event.kind}`}
                    className="rounded-lg border p-3"
                    style={{
                      borderColor: pal.border,
                      background: pal.bg,
                      marginTop: idx === 0 ? 0 : "8px",
                    }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className="text-sm font-bold"
                        style={{ color: pal.fg }}
                      >
                        {event.label}
                      </span>
                      <span
                        className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                        style={{
                          background: pal.pillBg,
                          color: pal.pillFg,
                          border: `1px solid ${pal.border}`,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {formatRelativeDay(event.daysUntil)}
                      </span>
                    </div>
                    <div
                      className="mt-1 text-[11px] font-semibold uppercase tracking-wider"
                      style={{ color: colors.muted }}
                    >
                      {formatEventDate(event.date)}
                    </div>
                    <div
                      className="mt-2 text-xs leading-snug"
                      style={{
                        color: theme === "dark" ? colors.light : colors.dark,
                        opacity: 0.85,
                      }}
                    >
                      {event.description}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          <div
            className="border-t px-4 py-2.5 text-[10px]"
            style={{
              borderColor: border,
              color: colors.muted,
              textAlign: "center",
            }}
          >
            Dates computed from US options calendar conventions.
          </div>
        </div>
  );

  return (
    <div ref={wrapperRef} style={{ position: "relative" }}>
      {trigger}
      {open && usePortal
        ? createPortal(popup, document.body)
        : popup}
    </div>
  );
}
