"use client";

/**
 * ChartSymbolMenu — the Gamma Chart's symbol switcher, worn as the chart's own
 * title. The big ticker above the price IS the control: click it (or press
 * Down on it) and a menu of every picker symbol opens under it, grouped by
 * asset class the way every symbol dropdown in the app groups them
 * (core/symbols SYMBOL_GROUPS, headings from SymbolOptions' dictionary).
 *
 * It replaced a row of seven symbol buttons that took a third of the toolbar,
 * and the native <select> the phone layout used, so desktop and phone switch
 * symbols the same way.
 *
 * Keyboard: Down or Enter opens it on the current symbol; Up / Down / Home /
 * End move through the symbols; Escape closes it and returns focus to the
 * title; Tab closes it. A press anywhere outside closes it too.
 */

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { Check, ChevronDown } from "lucide-react";
import type { UnderlyingSymbol } from "@/core/TimeframeContext";
import { SYMBOL_DESCRIPTIONS, SYMBOL_GROUPS } from "@/core/symbols";
import { usePageT } from "@/core/LanguageContext";
import { dict } from "./SymbolOptions.i18n";

export default function ChartSymbolMenu({
  value,
  onChange,
  fontSize,
}: {
  value: UnderlyingSymbol;
  onChange: (symbol: UnderlyingSymbol) => void;
  /** The title's type size, so the control reads as the heading it replaces. */
  fontSize: number;
}) {
  const t = usePageT(dict);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const menuId = useId();

  // A press outside the title and its menu closes the menu without moving focus.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  // Opening lands on the symbol already showing, so Up and Down start there.
  useEffect(() => {
    if (!open) return;
    menuRef.current?.querySelector<HTMLButtonElement>('[aria-checked="true"]')?.focus();
  }, [open]);

  const items = () => Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]') ?? []);
  const close = (refocus: boolean) => {
    setOpen(false);
    if (refocus) triggerRef.current?.focus();
  };
  const pick = (s: UnderlyingSymbol) => {
    close(true);
    if (s !== value) onChange(s);
  };

  const onMenuKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const list = items();
    const at = list.indexOf(document.activeElement as HTMLButtonElement);
    const focus = (i: number) => list[(i + list.length) % list.length]?.focus();
    if (e.key === "ArrowDown") {
      e.preventDefault();
      focus(at + 1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      focus(at - 1);
    } else if (e.key === "Home") {
      e.preventDefault();
      focus(0);
    } else if (e.key === "End") {
      e.preventDefault();
      focus(list.length - 1);
    } else if (e.key === "Escape") {
      e.preventDefault();
      close(true);
    } else if (e.key === "Tab") {
      close(false);
    }
  };

  return (
    <div ref={wrapRef} className="relative inline-flex">
      <button
        ref={triggerRef}
        type="button"
        className="zg-gc-symbtn"
        style={{ fontSize }}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={`Symbol: ${value}. Change symbol`}
        title="Change symbol"
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" && !open) {
            e.preventDefault();
            setOpen(true);
          }
        }}
      >
        {value}
        <ChevronDown size={Math.round(fontSize * 0.6)} strokeWidth={2.4} aria-hidden className="zg-gc-symbtn-caret" />
      </button>
      {open && (
        <div ref={menuRef} id={menuId} role="menu" aria-label="Symbol" className="zg-gc-menu" onKeyDown={onMenuKeyDown}>
          {SYMBOL_GROUPS.map((group) => (
            <div key={group.assetClass} role="group" aria-label={t(group.assetClass)}>
              <div className="zg-gc-menu-heading" aria-hidden>
                {t(group.assetClass)}
              </div>
              {group.symbols.map((s) => (
                <button
                  key={s}
                  type="button"
                  role="menuitemradio"
                  aria-checked={s === value}
                  tabIndex={-1}
                  className="zg-gc-menu-item"
                  onClick={() => pick(s)}
                >
                  <span className="zg-gc-menu-ticker">{s}</span>
                  <span className="zg-gc-menu-desc">{SYMBOL_DESCRIPTIONS[s]}</span>
                  <span className="zg-gc-menu-check" aria-hidden>
                    {s === value && <Check size={14} strokeWidth={2.4} />}
                  </span>
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
