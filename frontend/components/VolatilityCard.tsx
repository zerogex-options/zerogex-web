"use client";

import { useState } from "react";
import { Info, X } from "lucide-react";
import { useVolatilityGauge } from "@/hooks/useApiData";
import { useTheme } from "@/core/ThemeContext";
import { colors } from "@/core/colors";
import VolatilityGauges from "./VolatilityGauges";

// ── Tooltip content ───────────────────────────────────────────────────────────

interface ZoneRow {
  range: string;
  label: string;
  vix?: string;
  desc: string;
  color: string;
}

const SPEEDOMETER_ZONES: ZoneRow[] = [
  { range: "0–2",  label: "Idle",       vix: "VIX ~10–14", desc: "Ultra-low volatility. Markets are calm and complacent — the classic 'low vol' environment.", color: "#22c55e" },
  { range: "2–4",  label: "Cruising",   vix: "VIX ~14–19", desc: "Below-average vol. Normal conditions; no meaningful fear premium.", color: "#84cc16" },
  { range: "4–6",  label: "Elevated",   vix: "VIX ~19–27", desc: "Above-average vol. Some nervousness; traders are buying protection.", color: "#f59e0b" },
  { range: "6–8",  label: "High Speed", vix: "VIX ~27–38", desc: "High fear. Significant market stress — corrections or sharp selloffs.", color: "#f97316" },
  { range: "8–10", label: "Redline",    vix: "VIX 38+",    desc: "Extreme panic. Crisis or crash conditions; rare but highly dangerous.", color: "#ef4444" },
];

const TACHOMETER_ZONES: ZoneRow[] = [
  { range: "0–2",  label: "Hard Braking",  desc: "Fear collapsing rapidly. VIX spiked and is now falling hard — the panic is unwinding.", color: "#22c55e" },
  { range: "2–4",  label: "Decelerating",  desc: "Volatility trending lower. Conditions are improving; fear is draining out of the market.", color: "#84cc16" },
  { range: "4–6",  label: "Steady",        desc: "No meaningful acceleration in either direction. VIX is range-bound.", color: "#f59e0b" },
  { range: "6–8",  label: "Accelerating",  desc: "VIX climbing at a notable pace. Conditions are deteriorating; hedge accordingly.", color: "#f97316" },
  { range: "8–10", label: "Full Throttle", desc: "Fear spiking hard. VIX surging rapidly across multiple time scales simultaneously.", color: "#ef4444" },
];

// ── Info panel ────────────────────────────────────────────────────────────────

type PanelKey = "speedometer" | "tachometer" | null;

interface InfoPanelProps {
  type: "speedometer" | "tachometer";
  onClose: () => void;
  isDark: boolean;
}

function InfoPanel({ type, onClose, isDark }: InfoPanelProps) {
  const isSpeed = type === "speedometer";
  const zones = isSpeed ? SPEEDOMETER_ZONES : TACHOMETER_ZONES;
  const bg = isDark
    ? "linear-gradient(160deg, rgba(52,47,49,0.99) 0%, rgba(36,32,34,0.99) 100%)"
    : "rgba(255,255,255,0.99)";
  const borderColor = isDark ? "rgba(150,143,146,0.25)" : "rgba(150,143,146,0.3)";
  const textColor = isDark ? colors.light : colors.dark;
  const mutedColor = isDark ? "rgba(242,242,242,0.45)" : "rgba(23,23,23,0.45)";
  const dividerColor = isDark ? "rgba(150,143,146,0.15)" : "rgba(150,143,146,0.2)";

  return (
    <div
      style={{
        background: bg,
        border: `1px solid ${borderColor}`,
        borderRadius: "12px",
        padding: "18px 20px",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        boxShadow: isDark
          ? "0 16px 48px rgba(0,0,0,0.5), 0 4px 12px rgba(0,0,0,0.3)"
          : "0 16px 48px rgba(0,0,0,0.12), 0 4px 12px rgba(0,0,0,0.08)",
        width: "100%",
        boxSizing: "border-box" as const,
      }}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <div
            className="text-sm font-bold tracking-wide uppercase mb-1"
            style={{ color: textColor }}
          >
            {isSpeed ? "Speedometer" : "Tachometer"}
          </div>
          <div className="text-xs font-semibold" style={{ color: mutedColor }}>
            {isSpeed
              ? "How fast is the market moving?"
              : "How fast is volatility accelerating?"}
          </div>
        </div>
        <button
          onClick={onClose}
          className="flex-shrink-0 p-1 rounded opacity-50 hover:opacity-100 transition-opacity"
          style={{ color: textColor }}
        >
          <X size={14} />
        </button>
      </div>

      {/* Description */}
      <p className="text-xs leading-relaxed mb-3" style={{ color: mutedColor }}>
        {isSpeed ? (
          <>
            Maps the current <strong style={{ color: textColor }}>$VIX.X</strong> level
            to a 0–10 scale using a logarithmic curve fitted to the historical
            distribution of VIX readings. Higher = more fear.
          </>
        ) : (
          <>
            Measures the <strong style={{ color: textColor }}>rate of change</strong> of
            VIX across five time scales (5&nbsp;min → 2&nbsp;hrs), weighted toward
            recent moves. Normalised by realised per-bar VIX volatility so that
            +1σ maps to&nbsp;10 and −1σ maps to&nbsp;0. Center (5) = neutral.
          </>
        )}
      </p>

      <div style={{ borderTop: `1px solid ${dividerColor}`, marginBottom: "10px" }} />

      {/* Zone table */}
      <div className="flex flex-col gap-1.5">
        {zones.map((z) => (
          <div key={z.range} className="flex items-start gap-2.5">
            {/* Color dot */}
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: z.color,
                flexShrink: 0,
                marginTop: 4,
                boxShadow: `0 0 5px ${z.color}60`,
              }}
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-1.5 flex-wrap">
                <span
                  className="text-xs font-bold"
                  style={{ color: z.color }}
                >
                  {z.range}
                </span>
                <span
                  className="text-xs font-bold"
                  style={{ color: textColor }}
                >
                  {z.label}
                </span>
                {z.vix && (
                  <span className="text-xs font-semibold" style={{ color: mutedColor }}>
                    {z.vix}
                  </span>
                )}
              </div>
              <p className="text-xs leading-snug mt-0.5" style={{ color: mutedColor }}>
                {z.desc}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main card ─────────────────────────────────────────────────────────────────

export default function VolatilityCard() {
  const { theme } = useTheme();
  const { data } = useVolatilityGauge(30000);
  const [openPanel, setOpenPanel] = useState<PanelKey>(null);

  const isDark = theme === "dark";
  const border = "rgba(150,143,146,0.25)";
  const mutedColor = isDark ? "rgba(242,242,242,0.4)" : "rgba(23,23,23,0.4)";
  const cardBg = isDark
    ? `linear-gradient(135deg, ${colors.cardDark} 0%, rgba(42,38,40,0.6) 100%)`
    : colors.cardLight;

  const formatEt = (ts: string) => {
    try {
      return new Date(ts).toLocaleTimeString("en-US", {
        timeZone: "America/New_York",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }) + " ET";
    } catch {
      return "";
    }
  };

  return (
    <div
      className="p-5 rounded-2xl transition-all duration-300"
      style={{
        background: cardBg,
        border: `1px solid ${border}`,
        boxShadow: isDark
          ? "0 4px 12px rgba(0,0,0,0.3), 0 1px 3px rgba(0,0,0,0.2)"
          : "0 4px 12px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.05)",
      }}
    >
      {/* Card header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3
            className="text-xs font-semibold tracking-wider uppercase"
            style={{ color: colors.muted }}
          >
            Volatility Monitor
          </h3>
          {data && (
            <div className="flex items-center gap-2 mt-0.5">
              <span
                className="text-xs font-semibold"
                style={{ color: mutedColor }}
              >
                VIX{" "}
                <span
                  className="font-bold"
                  style={{ color: isDark ? colors.light : colors.dark }}
                >
                  {data.vix.toFixed(2)}
                </span>
              </span>
              {data.timestamp && (
                <span className="text-xs" style={{ color: mutedColor }}>
                  · {formatEt(data.timestamp)}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Gauges + side-by-side info panels */}
      <div className="flex flex-col gap-4">
        {/* Gauge visuals */}
        <div className="flex items-center justify-center">
          <VolatilityGauges theme={theme} />
        </div>

        {/* Zone labels + info buttons */}
        <div className="grid grid-cols-2 gap-3">
          {/* Speedometer info */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1.5">
              <span
                className="text-xs font-bold tracking-wide uppercase"
                style={{ color: mutedColor }}
              >
                Speed
              </span>
              <button
                onClick={() =>
                  setOpenPanel(openPanel === "speedometer" ? null : "speedometer")
                }
                className="inline-flex items-center opacity-50 hover:opacity-100 transition-opacity"
                style={{ color: isDark ? colors.light : colors.dark }}
                type="button"
                title="What is the speedometer?"
              >
                <Info size={13} />
              </button>
            </div>
            {data && (
              <>
                <div
                  className="text-sm font-bold"
                  style={{ color: isDark ? colors.light : colors.dark }}
                >
                  {data.speedometer_label}
                </div>
                <div
                  className="text-xs font-semibold"
                  style={{ color: mutedColor }}
                >
                  {data.speedometer.toFixed(1)} / 10
                </div>
              </>
            )}
          </div>

          {/* Tachometer info */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1.5">
              <span
                className="text-xs font-bold tracking-wide uppercase"
                style={{ color: mutedColor }}
              >
                Accel
              </span>
              <button
                onClick={() =>
                  setOpenPanel(openPanel === "tachometer" ? null : "tachometer")
                }
                className="inline-flex items-center opacity-50 hover:opacity-100 transition-opacity"
                style={{ color: isDark ? colors.light : colors.dark }}
                type="button"
                title="What is the tachometer?"
              >
                <Info size={13} />
              </button>
            </div>
            {data && (
              <>
                <div
                  className="text-sm font-bold"
                  style={{ color: isDark ? colors.light : colors.dark }}
                >
                  {data.tachometer_label}
                </div>
                <div
                  className="text-xs font-semibold"
                  style={{ color: mutedColor }}
                >
                  {data.tachometer.toFixed(1)} / 10
                </div>
              </>
            )}
          </div>
        </div>

        {/* Expandable info panel */}
        {openPanel && (
          <InfoPanel
            type={openPanel}
            onClose={() => setOpenPanel(null)}
            isDark={isDark}
          />
        )}
      </div>
    </div>
  );
}
