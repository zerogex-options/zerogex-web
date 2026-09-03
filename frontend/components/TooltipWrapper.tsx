"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { Info } from "lucide-react";
import { useExpandedCard } from "./ExpandableCard";
import {
  estimateTooltipHeight,
  resolveTooltipGeometry,
  type TooltipGeometry,
  type TooltipPlacement,
} from "@/core/tooltipPlacement";

interface TooltipWrapperProps {
  text: string;
  children?: React.ReactNode;
  inlineInExpanded?: boolean;
  placement?: "auto" | TooltipPlacement;
}

/**
 * useLayoutEffect that degrades to useEffect on the server. The measurement
 * pass has to land before paint or the tooltip visibly jumps from its estimate
 * to its measured position; React warns when useLayoutEffect runs during SSR, and
 * these components are server-rendered even though they are client components.
 */
const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

export default function TooltipWrapper({
  text,
  children,
  inlineInExpanded = true,
  placement = "auto",
}: TooltipWrapperProps) {
  const [show, setShow] = useState(false);
  const [layout, setLayout] = useState<TooltipGeometry | null>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const expanded = useExpandedCard();
  const tooltipId = useId();

  const updateLayout = useCallback(() => {
    if (!triggerRef.current || typeof window === "undefined") return;

    const rect = triggerRef.current.getBoundingClientRect();
    setLayout(
      resolveTooltipGeometry({
        anchor: { top: rect.top, bottom: rect.bottom, left: rect.left, width: rect.width },
        viewport: { width: window.innerWidth, height: window.innerHeight },
        // The rendered box once it exists, the estimate only for the first
        // frame. Guessing was the whole bug: a long tooltip is however tall it
        // is, and no formula over character counts knows that as well as the
        // DOM does.
        height: tooltipRef.current?.offsetHeight || estimateTooltipHeight(text),
        placement,
      }),
    );
  }, [placement, text]);

  // The estimate positions the first frame; this corrects it against the real
  // box before the browser paints, so a long tooltip never appears off screen
  // and never visibly snaps back into it.
  useIsomorphicLayoutEffect(() => {
    if (!show) return;
    updateLayout();
    // updateLayout reads the node it just measured but only ever writes a
    // layout object, so this settles in one pass instead of looping.
  }, [show, updateLayout]);

  useEffect(() => {
    if (!show) return;

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
          ref={tooltipRef}
          role="tooltip"
          id={tooltipId}
          className="pointer-events-none fixed z-[9999] rounded-lg border px-4 py-3 text-sm leading-relaxed"
          style={{
            top: layout.top,
            left: layout.left,
            width: `${layout.width}px`,
            maxHeight: `${layout.maxHeight}px`,
            overflowY: layout.clipped ? "auto" : "visible",
            background: "var(--color-chart-tooltip-bg)",
            color: "var(--color-chart-tooltip-text)",
            borderColor: "var(--color-border)",
            boxShadow: "0 8px 24px var(--color-info-soft), 0 2px 8px rgba(0,0,0,0.08)",
          }}
        >
          {layout.showArrow && (
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
          )}
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
