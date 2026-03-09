"use client";

import { useState, useRef } from "react";
import { Info } from "lucide-react";
import { colors } from "@/core/colors";
import { useExpandedCard } from "./ExpandableCard";

interface TooltipWrapperProps {
  text: string;
  children?: React.ReactNode;
  inlineInExpanded?: boolean;
}

export default function TooltipWrapper({
  text,
  children,
  inlineInExpanded = true,
}: TooltipWrapperProps) {
  const [show, setShow] = useState(false);
  const [position, setPosition] = useState<"left" | "right" | "center">(
    "center",
  );
  const buttonRef = useRef<HTMLDivElement>(null);
  const expanded = useExpandedCard();

  const handleMouseEnter = () => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const windowWidth = window.innerWidth;

      if (rect.left < windowWidth / 3) {
        setPosition("right");
      } else if (rect.right > (windowWidth * 2) / 3) {
        setPosition("left");
      } else {
        setPosition("center");
      }
    }
    setShow(true);
  };

  if (expanded && inlineInExpanded) {
    return (
      <div
        className="mt-4 rounded-lg border px-6 py-4 text-base md:text-lg leading-relaxed"
        style={{
          backgroundColor: `${colors.muted}12`,
          borderColor: `${colors.muted}55`,
          color: colors.light,
          maxWidth: "880px",
        }}
      >
        <div style={{ opacity: 0.95 }}>{text}</div>
      </div>
    );
  }

  const getTooltipStyle = () => {
    const baseStyle = {
      position: "absolute" as const,
      top: "calc(100% + 8px)",
      zIndex: 2147483647,
      width: "280px",
      backgroundColor: colors.cardDark,
      color: colors.light,
      border: `1px solid ${colors.muted}`,
      borderRadius: "8px",
      padding: "12px",
      fontSize: "13px",
      lineHeight: "1.5",
      boxShadow: "0 4px 12px rgba(0, 0, 0, 0.3)",
      pointerEvents: "none" as const,
    };

    if (position === "left") {
      return { ...baseStyle, right: 0 };
    }
    if (position === "right") {
      return { ...baseStyle, left: 0 };
    }
    return {
      ...baseStyle,
      left: "50%",
      transform: "translateX(-50%)",
    };
  };

  return (
    <div
      ref={buttonRef}
      style={{ position: "relative", display: "inline-block" }}
    >
      <button
        onMouseEnter={handleMouseEnter}
        onMouseLeave={() => setShow(false)}
        className="inline-flex items-center opacity-60 hover:opacity-100 transition-opacity duration-200"
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
      {show && <div style={getTooltipStyle()}>{text}</div>}
    </div>
  );
}
