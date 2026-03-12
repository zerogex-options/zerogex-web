"use client";

import { useState } from "react";
import { Info, X } from "lucide-react";
import { useVolatilityGauge } from "@/hooks/useApiData";
import { useTheme } from "@/core/ThemeContext";
import { colors } from "@/core/colors";
import { interpolateGaugeColor } from "./VolatilityGauges";

// ── Zone data ─────────────────────────────────────────────────────────────────

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
  { range: "4–6",  label: "Elevated",   vix: "VIX ~19–27", desc: "Above-average vol. Some nervousness; traders are actively buying protection.", color: "#f59e0b" },
  { range: "6–8",  label: "High Speed", vix: "VIX ~27–38", desc: "High fear. Significant market stress — corrections or sharp selloffs in progress.", color: "#f97316" },
  { range: "8–10", label: "Redline",    vix: "VIX 38+",    desc: "Extreme panic. Crisis or crash conditions. Rare but highly dangerous; tail risk is elevated.", color: "#ef4444" },
];

const TACHOMETER_ZONES: ZoneRow[] = [
  { range: "0–2",  label: "Hard Braking",  desc: "Fear collapsing rapidly. VIX spiked and is now falling hard — the panic is unwinding fast.", color: "#22c55e" },
  { range: "2–4",  label: "Decelerating",  desc: "Volatility trending lower. Conditions are improving; fear is slowly draining out of the market.", color: "#84cc16" },
  { range: "4–6",  label: "Steady",        desc: "No meaningful acceleration in either direction. VIX is range-bound; trend is neutral.", color: "#f59e0b" },
  { range: "6–8",  label: "Accelerating",  desc: "VIX climbing at a notable pace. Conditions are deteriorating; hedge accordingly.", color: "#f97316" },
  { range: "8–10", label: "Full Throttle", desc: "Fear spiking hard. VIX is surging across multiple time scales simultaneously.", color: "#ef4444" },
];

// ── Inline info panel ─────────────────────────────────────────────────────────

interface InfoPanelProps {
  type: "speedometer" | "tachometer";
  isDark: boolean;
}

function InfoPanel({ type, isDark }: InfoPanelProps) {
  const isSpeed = type === "speedometer";
  const zones = isSpeed ? SPEEDOMETER_ZONES : TACHOMETER_ZONES;
  const textColor = isDark ? colors.light : colors.dark;
  const mutedColor = isDark ? "rgba(242,242,242,0.5)" : "rgba(23,23,23,0.5)";
  const dividerColor = isDark ? "rgba(150,143,146,0.15)" : "rgba(150,143,146,0.18)";

  return (
    <div className="mt-4 flex flex-col gap-3">
      <div style={{ borderTop: `1px solid ${dividerColor}` }} />

      {/* Derivation */}
      <p className="text-xs leading-relaxed" style={{ color: mutedColor }}>
        {isSpeed ? (
          <>
            Maps <strong style={{ color: textColor }}>$VIX.X</strong> to a 0–10 scale
            via a log curve fitted to the historical VIX distribution. Equal gauge steps
            represent proportionally equal changes in realised fear, not raw VIX points.
          </>
        ) : (
          <>
            Rate of change of VIX across five time scales (5&nbsp;min → 2&nbsp;hrs),
            weighted toward recent moves. Normalised by realised per-bar VIX vol so
            that <strong style={{ color: textColor }}>+1σ → 10</strong> and{" "}
            <strong style={{ color: textColor }}>−1σ → 0</strong>. Reading of 5 = neutral.
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
}

function GaugeCard({ type, value, zoneLabel, isDark }: GaugeCardProps) {
  const [panelOpen, setPanelOpen] = useState(false);
  const isSpeed = type === "speedometer";
  const valueColor = interpolateGaugeColor(value);

  const cardBg = isDark ? colors.cardDark : colors.cardLight;
  const shadowBase = isDark
    ? "0 4px 12px rgba(0,0,0,0.3), 0 1px 3px rgba(0,0,0,0.2)"
    : "0 4px 12px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.05)";
  const shadowHover = isDark
    ? "0 8px 20px rgba(0,0,0,0.4), 0 2px 6px rgba(0,0,0,0.3)"
    : "0 8px 20px rgba(0,0,0,0.12), 0 2px 6px rgba(0,0,0,0.08)";

  return (
    <div
      className="p-6 rounded-2xl transition-all duration-300 hover:scale-[1.02]"
      style={{
        backgroundColor: cardBg,
        border: `1px solid ${colors.muted}`,
        boxShadow: shadowBase,
      }}
      onMouseEnter={(e) => { e.currentTarget.style.boxShadow = shadowHover; }}
      onMouseLeave={(e) => { e.currentTarget.style.boxShadow = shadowBase; }}
    >
      {/* Title row */}
      <div className="flex justify-between items-start mb-3">
        <h3
          className="text-xs font-semibold tracking-wider uppercase"
          style={{ color: colors.muted }}
        >
          {isSpeed ? "Speedometer" : "Tachometer"}
        </h3>
        <button
          onClick={() => setPanelOpen((v) => !v)}
          className={`inline-flex items-center transition-opacity ${panelOpen ? "opacity-100" : "opacity-60 hover:opacity-100"}`}
          style={{ color: panelOpen ? valueColor : colors.muted }}
          type="button"
          title={panelOpen ? "Close" : `What is the ${isSpeed ? "speedometer" : "tachometer"}?`}
        >
          {panelOpen ? <X size={14} /> : <Info size={14} />}
        </button>
      </div>

      {/* Zone label — the only value shown */}
      <div
        className="text-4xl font-bold"
        style={{ color: valueColor }}
      >
        {zoneLabel}
      </div>

      {/* Expandable info panel */}
      {panelOpen && <InfoPanel type={type} isDark={isDark} />}
    </div>
  );
}

// ── VIX card ──────────────────────────────────────────────────────────────────

interface VixCardProps {
  vix: number;
  timestamp: string;
  isDark: boolean;
}

function VixCard({ vix, timestamp, isDark }: VixCardProps) {
  const textColor = isDark ? colors.light : colors.dark;
  const cardBg = isDark ? colors.cardDark : colors.cardLight;
  const shadowBase = isDark
    ? "0 4px 12px rgba(0,0,0,0.3), 0 1px 3px rgba(0,0,0,0.2)"
    : "0 4px 12px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.05)";
  const shadowHover = isDark
    ? "0 8px 20px rgba(0,0,0,0.4), 0 2px 6px rgba(0,0,0,0.3)"
    : "0 8px 20px rgba(0,0,0,0.12), 0 2px 6px rgba(0,0,0,0.08)";

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
      className="p-6 rounded-2xl transition-all duration-300 hover:scale-[1.02]"
      style={{
        backgroundColor: cardBg,
        border: `1px solid ${colors.muted}`,
        boxShadow: shadowBase,
      }}
      onMouseEnter={(e) => { e.currentTarget.style.boxShadow = shadowHover; }}
      onMouseLeave={(e) => { e.currentTarget.style.boxShadow = shadowBase; }}
    >
      <div className="flex justify-between items-start mb-3">
        <h3
          className="text-xs font-semibold tracking-wider uppercase"
          style={{ color: colors.muted }}
        >
          VIX
        </h3>
      </div>

      <div className="text-4xl font-bold mb-2" style={{ color: textColor }}>
        {vix.toFixed(2)}
      </div>

      {timestamp && (
        <div className="text-sm font-semibold" style={{ color: colors.muted }}>
          as of {formatEt(timestamp)}
        </div>
      )}
    </div>
  );
}

// ── Public export — three cards in a row ──────────────────────────────────────

export default function VolatilityCard() {
  const { theme } = useTheme();
  const { data } = useVolatilityGauge(30000);
  const isDark = theme === "dark";

  if (!data) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <GaugeCard
        type="speedometer"
        value={data.speedometer}
        zoneLabel={data.speedometer_label}
        isDark={isDark}
      />
      <GaugeCard
        type="tachometer"
        value={data.tachometer}
        zoneLabel={data.tachometer_label}
        isDark={isDark}
      />
      <VixCard
        vix={data.vix}
        timestamp={data.timestamp}
        isDark={isDark}
      />
    </div>
  );
}
