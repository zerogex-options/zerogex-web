"use client";

/**
 * SymbolSelect — the styled native underlying dropdown that sits in a gamma
 * ladder's header. Extracted from Pair Comparison so the Gamma Terminal's
 * ladders render the identical control; a native <select> keeps it keyboard-
 * and screen-reader-friendly with no menu code of its own.
 *
 * `options` defaults to every picker symbol. A surface that must keep two
 * columns distinct passes the subset it allows (e.g. everything but the
 * primary symbol) rather than special-casing a self-comparison after the fact.
 *
 * `disabled` is for a surface rendering FROZEN data — the public, delayed
 * terminal, whose snapshot covers one pair of symbols and cannot refetch.
 * The control stays in place (so the header keeps its shape and still names
 * the symbol) and says why it will not open.
 */

import { ChevronDown } from "lucide-react";
import type { UnderlyingSymbol } from "@/core/TimeframeContext";
import { SYMBOLS } from "@/core/symbols";

export default function SymbolSelect({
  value,
  onChange,
  ariaLabel,
  options = SYMBOLS,
  disabled = false,
  disabledTitle,
}: {
  value: UnderlyingSymbol;
  onChange: (s: UnderlyingSymbol) => void;
  ariaLabel: string;
  options?: readonly UnderlyingSymbol[];
  disabled?: boolean;
  /** Tooltip explaining why the control is frozen. */
  disabledTitle?: string;
}) {
  return (
    <div className="relative inline-flex items-center">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as UnderlyingSymbol)}
        aria-label={ariaLabel}
        disabled={disabled}
        title={disabled ? disabledTitle : undefined}
        className="appearance-none font-mono font-bold"
        style={{
          fontSize: 14,
          letterSpacing: "0.04em",
          color: disabled ? "var(--text-secondary)" : "var(--text-primary)",
          background: "var(--bg-card)",
          border: "1px solid var(--border-default)",
          borderRadius: "var(--radius-control)",
          padding: "3px 22px 3px 8px",
          cursor: disabled ? "default" : "pointer",
          opacity: disabled ? 0.75 : 1,
        }}
      >
        {options.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
      <ChevronDown size={13} style={{ position: "absolute", right: 5, pointerEvents: "none", color: "var(--text-secondary)" }} />
    </div>
  );
}
