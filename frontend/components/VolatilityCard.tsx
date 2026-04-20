"use client";

import { useMemo, useState } from "react";
import { Info, X } from "lucide-react";
import { useVolatilityGauge } from "@/hooks/useApiData";
import { useTheme } from "@/core/ThemeContext";
import { colors } from "@/core/colors";
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
  const textColor = isDark ? colors.light : colors.dark;
  const mutedColor = isDark ? "var(--text-secondary)" : "var(--text-secondary)";
  const dividerColor = isDark ? "var(--border-subtle)" : "var(--border-default)";

  return (
    <div className="mt-4 flex flex-col gap-3">
      <div style={{ borderTop: `1px solid ${dividerColor}` }} />

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
}

function GaugeCard({ type, value, zoneLabel, isDark }: GaugeCardProps) {
  const [panelOpen, setPanelOpen] = useState(false);
  const isSpeed = type === "speedometer";
  const valueColor = interpolateGaugeColor(value);

  const cardBg = isDark ? colors.cardDark : colors.cardLight;
  const shadowBase = isDark
    ? "0 4px 12px var(--color-info-soft), 0 1px 3px var(--color-info-soft)"
    : "0 4px 12px var(--color-info-soft), 0 1px 3px var(--border-subtle)";
  const shadowHover = isDark
    ? "0 8px 20px var(--color-info-soft), 0 2px 6px var(--color-info-soft)"
    : "0 8px 20px var(--color-info-soft), 0 2px 6px var(--color-info-soft)";

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
          {isSpeed ? "Level" : "Momentum"}
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

      {/* Zone label */}
      <div
        className="text-4xl font-bold mb-4"
        style={{ color: valueColor }}
      >
        {zoneLabel}
      </div>

      {/* Gauge icon */}
      <div className="flex justify-center">
        <SingleGauge
          value={value}
          title={isSpeed ? "SPEED" : "ACCEL"}
          zoneLabel={zoneLabel}
          theme={isDark ? "dark" : "light"}
          gaugeId={isSpeed ? "spd-card" : "tch-card"}
          sizePx={160}
        />
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
    ? "0 4px 12px var(--color-info-soft), 0 1px 3px var(--color-info-soft)"
    : "0 4px 12px var(--color-info-soft), 0 1px 3px var(--border-subtle)";
  const shadowHover = isDark
    ? "0 8px 20px var(--color-info-soft), 0 2px 6px var(--color-info-soft)"
    : "0 8px 20px var(--color-info-soft), 0 2px 6px var(--color-info-soft)";

  const formatEt = (ts: string) => {
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
  const fetchedAt = useMemo(() => data?.timestamp ?? "", [data]);

  if (!data) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <GaugeCard
        type="speedometer"
        value={data.level}
        zoneLabel={data.level_label}
        isDark={isDark}
      />
      <GaugeCard
        type="tachometer"
        value={data.momentum}
        zoneLabel={data.momentum_label}
        isDark={isDark}
      />
      <VixCard
        vix={data.vix}
        timestamp={fetchedAt}
        isDark={isDark}
      />
    </div>
  );
}
