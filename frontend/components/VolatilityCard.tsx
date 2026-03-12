"use client";

import { useState } from "react";
import { Info, X } from "lucide-react";
import { useVolatilityGauge } from "@/hooks/useApiData";
import { useTheme } from "@/core/ThemeContext";
import { colors } from "@/core/colors";
import { SingleGauge, interpolateGaugeColor } from "./VolatilityGauges";

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

// ── Info panel ────────────────────────────────────────────────────────────────

interface InfoPanelProps {
  type: "speedometer" | "tachometer";
  onClose: () => void;
  isDark: boolean;
}

function InfoPanel({ type, onClose, isDark }: InfoPanelProps) {
  const isSpeed = type === "speedometer";
  const zones = isSpeed ? SPEEDOMETER_ZONES : TACHOMETER_ZONES;
  const textColor = isDark ? colors.light : colors.dark;
  const mutedColor = isDark ? "rgba(242,242,242,0.5)" : "rgba(23,23,23,0.5)";
  const dividerColor = isDark ? "rgba(150,143,146,0.15)" : "rgba(150,143,146,0.18)";
  const panelBg = isDark ? "rgba(42,38,40,0.7)" : "rgba(248,246,248,0.85)";
  const panelBorder = isDark ? "rgba(150,143,146,0.2)" : "rgba(150,143,146,0.25)";

  return (
    <div
      style={{
        background: panelBg,
        border: `1px solid ${panelBorder}`,
        borderRadius: "12px",
        padding: "16px 18px",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
      }}
    >
      {/* Panel header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <div className="text-sm font-bold tracking-wide mb-0.5" style={{ color: textColor }}>
            {isSpeed ? "Speedometer" : "Tachometer"}
          </div>
          <div className="text-xs font-semibold" style={{ color: mutedColor }}>
            {isSpeed ? "How fast is the market moving?" : "How fast is volatility accelerating?"}
          </div>
        </div>
        <button
          onClick={onClose}
          className="flex-shrink-0 p-1 rounded opacity-40 hover:opacity-100 transition-opacity"
          style={{ color: textColor }}
        >
          <X size={13} />
        </button>
      </div>

      {/* Derivation */}
      <p className="text-xs leading-relaxed mb-3" style={{ color: mutedColor }}>
        {isSpeed ? (
          <>
            Maps the current{" "}
            <strong style={{ color: textColor }}>$VIX.X</strong> level to a 0–10 scale
            using a logarithmic curve fitted to the historical distribution of VIX readings.
            The log transform means equal steps on the gauge represent proportionally equal
            changes in realised fear, not raw VIX points.
          </>
        ) : (
          <>
            Measures the{" "}
            <strong style={{ color: textColor }}>rate of change</strong> of VIX across
            five time scales (5&nbsp;min → 2&nbsp;hrs), each weighted toward the most
            recent moves. The composite score is then normalised by the realised per-bar
            volatility of VIX itself, so that <strong style={{ color: textColor }}>+1σ → 10</strong>{" "}
            and <strong style={{ color: textColor }}>−1σ → 0</strong>. A reading of 5
            means VIX acceleration is exactly neutral.
          </>
        )}
      </p>

      <div style={{ borderTop: `1px solid ${dividerColor}`, marginBottom: "12px" }} />

      {/* Zone rows */}
      <div className="flex flex-col gap-2">
        {zones.map((z) => (
          <div key={z.range} className="flex items-start gap-3">
            <div
              style={{
                width: 9,
                height: 9,
                borderRadius: "50%",
                background: z.color,
                flexShrink: 0,
                marginTop: 3,
                boxShadow: `0 0 6px ${z.color}70`,
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

// ── Gauge column ──────────────────────────────────────────────────────────────

interface GaugeColumnProps {
  type: "speedometer" | "tachometer";
  value: number;
  label: string;
  vix: number;
  isDark: boolean;
  theme: "light" | "dark";
  gaugeSize: number;
}

function GaugeColumn({ type, value, label, vix, isDark, theme, gaugeSize }: GaugeColumnProps) {
  const [panelOpen, setPanelOpen] = useState(false);
  const isSpeed = type === "speedometer";
  const valueColor = interpolateGaugeColor(value);
  const textColor = isDark ? colors.light : colors.dark;
  const mutedColor = isDark ? "rgba(242,242,242,0.45)" : "rgba(23,23,23,0.45)";
  const divider = isDark ? "rgba(150,143,146,0.15)" : "rgba(150,143,146,0.18)";

  return (
    <div className="flex flex-col gap-4 flex-1 min-w-0">
      {/* Gauge SVG */}
      <div className="flex justify-center">
        <SingleGauge
          value={value}
          title={isSpeed ? "SPEED" : "ACCEL"}
          zoneLabel={label}
          vix={vix}
          theme={theme}
          gaugeId={isSpeed ? "spd-card" : "tch-card"}
          sizePx={gaugeSize}
        />
      </div>

      {/* Label row */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span
            className="text-xs font-bold tracking-widest uppercase"
            style={{ color: mutedColor }}
          >
            {isSpeed ? "Speedometer" : "Tachometer"}
          </span>
          <button
            onClick={() => setPanelOpen((v) => !v)}
            className={`inline-flex items-center transition-opacity ${panelOpen ? "opacity-100" : "opacity-40 hover:opacity-90"}`}
            style={{ color: panelOpen ? valueColor : (isDark ? colors.light : colors.dark) }}
            type="button"
            title={panelOpen ? "Close explanation" : `What is the ${isSpeed ? "speedometer" : "tachometer"}?`}
          >
            {panelOpen ? <X size={13} /> : <Info size={13} />}
          </button>
        </div>

        <div className="text-2xl font-bold mb-0.5" style={{ color: valueColor }}>
          {label}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold" style={{ color: mutedColor }}>
            {value.toFixed(1)} / 10
          </span>
          <span style={{ color: divider }}>·</span>
          <span className="text-sm font-semibold" style={{ color: mutedColor }}>
            VIX{" "}
            <span style={{ color: textColor, fontWeight: 700 }}>{vix.toFixed(2)}</span>
          </span>
        </div>
      </div>

      {/* Expandable info panel */}
      {panelOpen && (
        <InfoPanel
          type={type}
          onClose={() => setPanelOpen(false)}
          isDark={isDark}
        />
      )}
    </div>
  );
}

// ── Main card ─────────────────────────────────────────────────────────────────

export default function VolatilityCard() {
  const { theme } = useTheme();
  const { data } = useVolatilityGauge(30000);

  const isDark = theme === "dark";
  const border = "rgba(150,143,146,0.25)";
  const mutedColor = isDark ? "rgba(242,242,242,0.4)" : "rgba(23,23,23,0.4)";
  const cardBg = isDark
    ? `linear-gradient(135deg, ${colors.cardDark} 0%, rgba(42,38,40,0.6) 100%)`
    : colors.cardLight;
  const dividerColor = isDark ? "rgba(150,143,146,0.15)" : "rgba(150,143,146,0.2)";

  const formatEt = (ts: string) => {
    try {
      return (
        new Date(ts).toLocaleTimeString("en-US", {
          timeZone: "America/New_York",
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        }) + " ET"
      );
    } catch {
      return "";
    }
  };

  // Gauge size: scales with viewport via CSS, but we set a generous px value
  // and let the SVG viewBox do the rest. 280px is the "target" on large screens.
  const GAUGE_SIZE = 280;

  return (
    <div
      className="p-6 rounded-2xl"
      style={{
        background: cardBg,
        border: `1px solid ${border}`,
        boxShadow: isDark
          ? "0 4px 12px rgba(0,0,0,0.3), 0 1px 3px rgba(0,0,0,0.2)"
          : "0 4px 12px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.05)",
      }}
    >
      {/* Card header */}
      <div className="flex items-center justify-between mb-6">
        <h3
          className="text-xs font-semibold tracking-wider uppercase"
          style={{ color: colors.muted }}
        >
          Volatility Monitor
        </h3>
        {data && (
          <span className="text-xs font-semibold" style={{ color: mutedColor }}>
            {data.timestamp && formatEt(data.timestamp)}
          </span>
        )}
      </div>

      {data ? (
        /* Two-column gauge layout */
        <div className="flex flex-col md:flex-row gap-8 md:gap-10">
          {/* Speedometer column */}
          <GaugeColumn
            type="speedometer"
            value={data.speedometer}
            label={data.speedometer_label}
            vix={data.vix}
            isDark={isDark}
            theme={theme}
            gaugeSize={GAUGE_SIZE}
          />

          {/* Vertical divider (desktop only) */}
          <div
            className="hidden md:block flex-shrink-0"
            style={{ width: "1px", background: dividerColor, alignSelf: "stretch" }}
          />

          {/* Tachometer column */}
          <GaugeColumn
            type="tachometer"
            value={data.tachometer}
            label={data.tachometer_label}
            vix={data.vix}
            isDark={isDark}
            theme={theme}
            gaugeSize={GAUGE_SIZE}
          />
        </div>
      ) : (
        <div
          className="flex items-center justify-center py-12 text-sm font-semibold"
          style={{ color: mutedColor }}
        >
          Loading volatility data…
        </div>
      )}
    </div>
  );
}
