"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Info } from "lucide-react";
import { useExpandedCard } from "./ExpandableCard";

interface TooltipWrapperProps {
  text: string;
  children?: React.ReactNode;
  inlineInExpanded?: boolean;
}

type TooltipPlacement = "top" | "bottom";

type TooltipLayout = {
  top: number;
  left: number;
  placement: TooltipPlacement;
  arrowLeft: number;
};

const TOOLTIP_WIDTH = 360;
const TOOLTIP_GAP = 12;
const VIEWPORT_PADDING = 16;

export default function TooltipWrapper({
  text,
  children,
  inlineInExpanded = true,
}: TooltipWrapperProps) {
  const [show, setShow] = useState(false);
  const [layout, setLayout] = useState<TooltipLayout | null>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const expanded = useExpandedCard();
  const tooltipId = useId();

  const updateLayout = useCallback(() => {
    if (!triggerRef.current || typeof window === "undefined") return;

    const rect = triggerRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const estimatedHeight = Math.min(160, Math.max(72, Math.ceil(text.length / 56) * 24 + 28));

    const centeredLeft = rect.left + rect.width / 2 - TOOLTIP_WIDTH / 2;
    const clampedLeft = Math.min(
      Math.max(centeredLeft, VIEWPORT_PADDING),
      viewportWidth - TOOLTIP_WIDTH - VIEWPORT_PADDING,
    );

    const roomAbove = rect.top - VIEWPORT_PADDING;
    const placement: TooltipPlacement = roomAbove >= estimatedHeight + TOOLTIP_GAP
      ? "top"
      : "bottom";

    const top = placement === "top"
      ? rect.top - TOOLTIP_GAP
      : rect.bottom + TOOLTIP_GAP;

    const triggerCenter = rect.left + rect.width / 2;
    const arrowLeft = Math.min(
      TOOLTIP_WIDTH - 20,
      Math.max(20, triggerCenter - clampedLeft),
    );

    setLayout({ top, left: clampedLeft, placement, arrowLeft });
  }, [text]);


  useEffect(() => {
    if (!show) return;

    updateLayout();

    const handleViewportChange = () => updateLayout();
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setShow(false);
      }
    };

    window.addEventListener("resize", handleViewportChange);
    window.addEventListener("scroll", handleViewportChange, true);
    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("scroll", handleViewportChange, true);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [show, updateLayout]);

  if (expanded && inlineInExpanded) {
    return (
      <div
        className="mt-4 rounded-xl border px-6 py-4 text-base leading-relaxed md:text-lg"
        style={{
          background: "var(--color-chart-tooltip-bg)",
          borderColor: "var(--color-border)",
          color: "var(--color-chart-tooltip-text)",
          boxShadow: "0 12px 28px var(--color-info-soft)",
          maxWidth: "880px",
        }}
      >
        <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--color-text-secondary)" }}>
          Tooltip details
        </div>
        <div style={{ opacity: 0.92 }}>{text}</div>
      </div>
    );
  }

  const tooltipNode = show && layout && typeof document !== "undefined"
    ? createPortal(
        <div
          role="tooltip"
          id={tooltipId}
          className="pointer-events-none fixed z-[9999] rounded-lg border px-4 py-3 text-sm leading-relaxed"
          style={{
            top: layout.placement === "top" ? layout.top : layout.top,
            left: layout.left,
            transform: layout.placement === "top" ? "translateY(-100%)" : undefined,
            width: `${TOOLTIP_WIDTH}px`,
            background: "var(--color-chart-tooltip-bg)",
            color: "var(--color-chart-tooltip-text)",
            borderColor: "var(--color-border)",
            boxShadow: "0 8px 24px var(--color-info-soft), 0 2px 8px rgba(0,0,0,0.08)",
          }}
        >
          <div
            aria-hidden="true"
            className="absolute h-3 w-3 rotate-45 border"
            style={{
              left: layout.arrowLeft - 6,
              background: "var(--color-chart-tooltip-bg)",
              borderColor: "var(--color-border)",
              top: layout.placement === "top" ? "calc(100% - 7px)" : "-7px",
              borderLeftWidth: layout.placement === "top" ? 0 : 1,
              borderTopWidth: layout.placement === "top" ? 0 : 1,
              borderRightWidth: layout.placement === "top" ? 1 : 0,
              borderBottomWidth: layout.placement === "top" ? 1 : 0,
            }}
          />
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--color-text-secondary)" }}>
            Context
          </div>
          <div>{text}</div>
        </div>,
        document.body,
      )
    : null;

  return (
    <div ref={triggerRef} style={{ position: "relative", display: "inline-flex" }}>
      <button
        aria-describedby={show ? tooltipId : undefined}
        aria-label="Show additional context"
        onMouseEnter={() => {
          updateLayout();
          setShow(true);
        }}
        onMouseLeave={() => setShow(false)}
        onFocus={() => {
          updateLayout();
          setShow(true);
        }}
        onBlur={() => setShow(false)}
        className="inline-flex items-center opacity-60 transition-opacity duration-200 hover:opacity-100 focus:opacity-100"
        style={{
          cursor: "help",
          background: "none",
          border: "none",
          padding: 0,
        }}
        type="button"
        onClick={(e) => e.stopPropagation()}
      >
        {children || <Info size={14} />}
      </button>
      {tooltipNode}
    </div>
  );
}
