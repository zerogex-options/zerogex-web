"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Info } from "lucide-react";
import { useVolatilityGauge } from "@/hooks/useApiData";
import { useTheme } from "@/core/ThemeContext";
import { useTimeframe } from "@/core/TimeframeContext";
import { interpolateGaugeColor, SingleGauge } from "./VolatilityGauges";

// ── Zone data ─────────────────────────────────────────────────────────────────

interface ZoneRow {
  range: string;
  label: string;
  vix?: string;
  desc: string;
  color: string;
}

const SPEEDOMETER_ZONES: ZoneRow[] = [
  { range: "0–2",  label: "Subdued",  vix: "VIX ~10–15", desc: "Ultra-low volatility. Markets are calm and complacent — the classic 'low vol' environment.", color: "var(--color-positive)" },
  { range: "2–4",  label: "Low",      vix: "VIX ~15–19", desc: "Below-average vol. Normal conditions; no meaningful fear premium.", color: "var(--color-bull)" },
  { range: "4–6",  label: "Moderate", vix: "VIX ~19–27", desc: "Near the long-run average. Some nervousness; traders are actively buying protection.", color: "var(--color-brand-primary)" },
  { range: "6–8",  label: "Elevated", vix: "VIX ~27–38", desc: "Above-average fear. Significant market stress — corrections or sharp selloffs in progress.", color: "var(--heat-mid)" },
  { range: "8–10", label: "Extreme",  vix: "VIX ~38+",   desc: "Crisis-level fear. Extreme panic conditions. Rare but highly dangerous; tail risk is severely elevated.", color: "var(--color-negative)" },
];

const TACHOMETER_ZONES: ZoneRow[] = [
  { range: "0–2",  label: "Collapsing", desc: "Fear unwinding sharply (–2σ). VIX spiked and is now falling hard — the panic is reversing fast.", color: "var(--color-positive)" },
  { range: "2–4",  label: "Easing",     desc: "Volatility declining. Conditions are improving; fear is slowly draining out of the market.", color: "var(--color-bull)" },
  { range: "4–6",  label: "Stable",     desc: "No meaningful directional move. VIX is range-bound; trend is neutral.", color: "var(--color-brand-primary)" },
  { range: "6–8",  label: "Rising",     desc: "Vol building steadily. Conditions are deteriorating; hedge accordingly.", color: "var(--heat-mid)" },
  { range: "8–10", label: "Surging",    desc: "Fear spiking hard (+2σ). VIX is surging across multiple time scales simultaneously.", color: "var(--color-negative)" },
];

// ── Inline info panel ─────────────────────────────────────────────────────────

interface InfoPanelProps {
  type: "speedometer" | "tachometer";
  isDark: boolean;
}

function InfoPanel({ type, isDark }: InfoPanelProps) {
  const isSpeed = type === "speedometer";
  const zones = isSpeed ? SPEEDOMETER_ZONES : TACHOMETER_ZONES;
  const textColor = 'var(--text-primary)';
  const mutedColor = isDark ? "var(--text-secondary)" : "var(--text-secondary)";
  const dividerColor = isDark ? "var(--border-subtle)" : "var(--border-default)";

  return (
    <div className="flex flex-col gap-3">
      {/* Derivation */}
      <p className="text-xs leading-relaxed" style={{ color: mutedColor }}>
        {isSpeed ? (
          <>
            Maps <strong style={{ color: textColor }}>$VIX.X</strong> to a 0–10 log scale
            anchored to historical percentiles. Equal gauge steps represent proportionally
            equal changes in realised fear, not raw VIX points.
          </>
        ) : (
          <>
            Weighted composite rate-of-change of VIX across five time scales (5&nbsp;min → 2&nbsp;hrs),
            normalised against realised per-bar VIX volatility. Scaled so that{" "}
            <strong style={{ color: textColor }}>±2σ maps to the full 0–10 range</strong> —
            routine intraday moves stay in the middle band; only genuine trend moves reach the extremes.
            Reading of 5 = neutral.
          </>
        )}
      </p>

      <div style={{ borderTop: `1px solid ${dividerColor}` }} />

      {/* Zone rows */}
      <div className="flex flex-col gap-2">
        {zones.map((z) => (
          <div key={z.range} className="flex items-start gap-2.5">
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: z.color,
                flexShrink: 0,
                marginTop: 3,
                boxShadow: `0 0 5px ${z.color}70`,
              }}
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-1.5 flex-wrap">
                <span className="text-xs font-bold" style={{ color: z.color }}>{z.range}</span>
                <span className="text-xs font-bold" style={{ color: textColor }}>{z.label}</span>
                {z.vix && (
                  <span className="text-xs font-semibold" style={{ color: mutedColor }}>{z.vix}</span>
                )}
              </div>
              <p className="text-xs leading-snug mt-0.5" style={{ color: mutedColor }}>{z.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Gauge card (Speedometer or Tachometer) ────────────────────────────────────

interface GaugeCardProps {
  type: "speedometer" | "tachometer";
  value: number;
  zoneLabel: string;
  isDark: boolean;
  vix?: number;
  vixTimestamp?: string;
  indexLabel?: string;
}

function formatEtTimestamp(ts: string): string {
  try {
    return new Date(ts).toLocaleTimeString("en-US", {
      timeZone: "America/New_York",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }) + " ET";
  } catch {
    return "";
  }
}

const INFO_POPUP_WIDTH = 340;
const INFO_POPUP_GAP = 10;
const VIEWPORT_PADDING = 12;

type PopupPlacement = "top" | "bottom";

type PopupLayout = {
  top: number;
  left: number;
  placement: PopupPlacement;
};

function GaugeCard({ type, value, zoneLabel, isDark, vix, vixTimestamp, indexLabel = "VIX" }: GaugeCardProps) {
  const [hoverOpen, setHoverOpen] = useState(false);
  const [layout, setLayout] = useState<PopupLayout | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const isSpeed = type === "speedometer";
  const valueColor = interpolateGaugeColor(value);
  const textColor = 'var(--text-primary)';

  const updateLayout = useCallback(() => {
    if (!triggerRef.current || typeof window === "undefined") return;
    const rect = triggerRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const popupHeight = popupRef.current?.offsetHeight ?? 360;

    const triggerCenter = rect.left + rect.width / 2;
    const rawLeft = triggerCenter - INFO_POPUP_WIDTH / 2;
    const left = Math.min(
      Math.max(rawLeft, VIEWPORT_PADDING),
      viewportWidth - INFO_POPUP_WIDTH - VIEWPORT_PADDING,
    );

    const roomAbove = rect.top - VIEWPORT_PADDING;
    const roomBelow = viewportHeight - rect.bottom - VIEWPORT_PADDING;
    const placement: PopupPlacement =
      roomAbove >= popupHeight + INFO_POPUP_GAP || roomAbove >= roomBelow ? "top" : "bottom";

    const top = placement === "top"
      ? rect.top - INFO_POPUP_GAP
      : rect.bottom + INFO_POPUP_GAP;

    setLayout({ top, left, placement });
  }, []);

  useEffect(() => {
    if (!hoverOpen) return;
    updateLayout();
    const handle = () => updateLayout();
    window.addEventListener("resize", handle);
    window.addEventListener("scroll", handle, true);
    return () => {
      window.removeEventListener("resize", handle);
      window.removeEventListener("scroll", handle, true);
    };
  }, [hoverOpen, updateLayout]);

  useEffect(() => {
    if (!hoverOpen) return;
    const raf = requestAnimationFrame(updateLayout);
    return () => cancelAnimationFrame(raf);
  }, [hoverOpen, updateLayout]);

  const cardBg = 'var(--bg-card)';
  const shadowBase = isDark
    ? "0 4px 12px var(--color-info-soft), 0 1px 3px var(--color-info-soft)"
    : "0 4px 12px var(--color-info-soft), 0 1px 3px var(--border-subtle)";

  const showVix = isSpeed && typeof vix === "number" && Number.isFinite(vix);

  return (
    <div
      className="h-full p-6 rounded-2xl flex flex-col"
      style={{
        backgroundColor: cardBg,
        border: `1px solid ${'var(--text-secondary)'}`,
        boxShadow: shadowBase,
      }}
    >
      {/* Title row */}
      <div className="flex justify-between items-start mb-3">
        <h3
          className="zg-label"
          style={{ color: 'var(--text-secondary)' }}
        >
          {isSpeed ? `Level / ${indexLabel}` : "Momentum"}
        </h3>
        <button
          ref={triggerRef}
          onMouseEnter={() => setHoverOpen(true)}
          onMouseLeave={() => setHoverOpen(false)}
          onFocus={() => setHoverOpen(true)}
          onBlur={() => setHoverOpen(false)}
          className={`inline-flex items-center transition-opacity ${hoverOpen ? "opacity-100" : "opacity-60 hover:opacity-100"}`}
          style={{ color: hoverOpen ? valueColor : 'var(--text-secondary)', cursor: "help", background: "none", border: "none", padding: 0 }}
          type="button"
          aria-label={`What is the ${isSpeed ? "speedometer" : "tachometer"}?`}
        >
          <Info size={14} />
        </button>
      </div>

      {/* Zone label + optional VIX value */}
      <div className="mb-4 flex items-baseline justify-between gap-3 flex-wrap">
        <div
          className="text-2xl sm:text-3xl md:text-4xl font-bold break-words"
          style={{ color: valueColor }}
        >
          {zoneLabel}
        </div>
        {showVix && (
          <div className="flex flex-col items-end">
            <div className="text-2xl sm:text-3xl font-bold break-words" style={{ color: textColor }}>
              {vix!.toFixed(2)}
            </div>
            <div className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
              {indexLabel}
              {vixTimestamp ? ` · ${formatEtTimestamp(vixTimestamp)}` : ""}
            </div>
          </div>
        )}
      </div>

      {/* Gauge icon — flex-1 centers it vertically so the card can stretch
          to match a taller sibling without leaving the gauge stuck at the top. */}
      <div className="flex flex-1 items-center justify-center">
        <SingleGauge
          value={value}
          zoneLabel={zoneLabel}
          theme={isDark ? "dark" : "light"}
          gaugeId={isSpeed ? "spd-card" : "tch-card"}
          sizePx={160}
        />
      </div>

      {/* Hover popup — portal-rendered so it can escape the card's clipping ancestor */}
      {hoverOpen && typeof document !== "undefined" &&
        createPortal(
          <div
            ref={popupRef}
            role="tooltip"
            className="pointer-events-none fixed z-[9999] rounded-xl border px-4 py-3"
            style={{
              top: layout?.top ?? -9999,
              left: layout?.left ?? -9999,
              transform: layout?.placement === "top" ? "translateY(-100%)" : undefined,
              width: `${INFO_POPUP_WIDTH}px`,
              maxHeight: `calc(100vh - ${VIEWPORT_PADDING * 2}px)`,
              overflowY: "auto",
              background: "var(--bg-card)",
              borderColor: "var(--border-default)",
              color: "var(--text-primary)",
              boxShadow: "0 12px 28px var(--color-info-soft), 0 2px 8px rgba(0,0,0,0.12)",
              opacity: layout ? 1 : 0,
            }}
          >
            <InfoPanel type={type} isDark={isDark} />
          </div>,
          document.body,
        )
      }
    </div>
  );
}

// ── Public export — combined level/VIX + momentum ─────────────────────────────

interface VolatilityCardProps {
  // When true, render the two gauges in a single column (stacked) instead
  // of side-by-side. Used by layouts that place this card in a narrow
  // sidebar where the default md:grid-cols-2 would cram the gauges.
  stacked?: boolean;
}

export default function VolatilityCard({ stacked = false }: VolatilityCardProps = {}) {
  const { theme } = useTheme();
  const { symbol } = useTimeframe();
  // QQQ's correct implied-vol input is VXN (Nasdaq-100); SPX/SPY use VIX.
  const volIndex: "VIX" | "VXN" = symbol === "QQQ" ? "VXN" : "VIX";
  const { data } = useVolatilityGauge(30000, volIndex);
  const isDark = theme === "dark";
  const fetchedAt = useMemo(() => data?.timestamp ?? "", [data]);

  if (!data) return null;

  return (
    <div
      className={
        stacked
          ? "grid h-full grid-rows-[1fr_1fr] gap-4"
          : "grid grid-cols-1 md:grid-cols-2 gap-4"
      }
    >
      <GaugeCard
        type="speedometer"
        value={data.level}
        zoneLabel={data.level_label}
        isDark={isDark}
        vix={data.index}
        vixTimestamp={fetchedAt}
        indexLabel={volIndex}
      />
      <GaugeCard
        type="tachometer"
        value={data.momentum}
        zoneLabel={data.momentum_label}
        isDark={isDark}
        indexLabel={volIndex}
      />
    </div>
  );
}
