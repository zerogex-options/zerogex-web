"use client";

import { useState } from "react";
import { useApiData } from "@/hooks/useApiData";
import { Theme } from "@/core/types";

interface VolatilityGaugeData {
  timestamp: string;
  vix: number;
  level: number;
  level_label: string;
  momentum: number;
  momentum_label: string;
  cache_bars: number;
  latest_bars?: Array<{ timestamp: string; close: number }>;
}

// ── Color interpolation ───────────────────────────────────────────────────────

const COLOR_STOPS: Array<{ pos: number; rgb: [number, number, number] }> = [
  { pos: 0,  rgb: [34,  197, 94]  }, // #22c55e  green
  { pos: 2,  rgb: [132, 204, 22]  }, // #84cc16  lime
  { pos: 5,  rgb: [245, 158, 11]  }, // #f59e0b  amber
  { pos: 7,  rgb: [249, 115, 22]  }, // #f97316  orange
  { pos: 10, rgb: [239, 68,  68]  }, // #ef4444  red
];

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

export function interpolateGaugeColor(value: number): string {
  const v = Math.max(0, Math.min(10, value));
  for (let i = 0; i < COLOR_STOPS.length - 1; i++) {
    const a = COLOR_STOPS[i];
    const b = COLOR_STOPS[i + 1];
    if (v <= b.pos) {
      const t = (v - a.pos) / (b.pos - a.pos);
      const r = Math.round(lerp(a.rgb[0], b.rgb[0], t));
      const g = Math.round(lerp(a.rgb[1], b.rgb[1], t));
      const bl = Math.round(lerp(a.rgb[2], b.rgb[2], t));
      return `rgb(${r},${g},${bl})`;
    }
  }
  return "rgb(239,68,68)";
}

// ── SVG helpers ───────────────────────────────────────────────────────────────

function polarXY(
  cx: number,
  cy: number,
  r: number,
  angleDeg: number
): [number, number] {
  const rad = (angleDeg * Math.PI) / 180;
  return [cx + r * Math.cos(rad), cy - r * Math.sin(rad)];
}

function buildArcSegment(
  cx: number,
  cy: number,
  outerR: number,
  innerR: number,
  startAngle: number,
  endAngle: number
): string {
  const f = (n: number) => n.toFixed(3);
  const [ox1, oy1] = polarXY(cx, cy, outerR, startAngle);
  const [ox2, oy2] = polarXY(cx, cy, outerR, endAngle);
  const [ix2, iy2] = polarXY(cx, cy, innerR, endAngle);
  const [ix1, iy1] = polarXY(cx, cy, innerR, startAngle);
  return [
    `M ${f(ox1)} ${f(oy1)}`,
    `A ${outerR} ${outerR} 0 0 1 ${f(ox2)} ${f(oy2)}`,
    `L ${f(ix2)} ${f(iy2)}`,
    `A ${innerR} ${innerR} 0 0 0 ${f(ix1)} ${f(iy1)}`,
    "Z",
  ].join(" ");
}

// ── Single gauge ──────────────────────────────────────────────────────────────

const NUM_SEGS = 20;
const SEG_ANGLE = 180 / NUM_SEGS; // 9° per segment
const GAP = 0.45;

export interface SingleGaugeProps {
  value: number;
  title: string;
  zoneLabel: string;
  vix?: number;
  theme: Theme;
  gaugeId: string;
  /** Rendered pixel width of the SVG. Height is computed proportionally. */
  sizePx?: number;
}

export function SingleGauge({
  value,
  title,
  zoneLabel,
  vix,
  theme,
  gaugeId,
  sizePx,
}: SingleGaugeProps) {
  const [hovered, setHovered] = useState(false);

  const v = Math.max(0, Math.min(10, isFinite(value) ? value : 0));
  const isDark = theme === "dark";

  // SVG geometry — fixed in viewBox space (0 0 100 62)
  const cx = 50, cy = 51;
  const outerR = 41, innerR = 29;
  const needleLen = outerR - 4;
  const VIEW_W = 100, VIEW_H = 62;

  // Rendered pixel dimensions
  const pxW = sizePx ?? 88;
  const pxH = Math.round(pxW * (VIEW_H / VIEW_W));

  const needleAngle = (v / 10) * 180 - 90;
  const needleColor = interpolateGaugeColor(v);

  const trackColor = isDark ? "rgba(242,242,242,0.07)" : "rgba(23,23,23,0.07)";
  const mutedColor = isDark ? "rgba(242,242,242,0.32)" : "rgba(23,23,23,0.32)";
  const hubBg = isDark ? "var(--color-bg)" : "var(--color-text-primary)";
  const bgPanelColor = isDark
    ? "linear-gradient(160deg, rgba(52,47,49,0.92) 0%, rgba(36,32,34,0.92) 100%)"
    : "linear-gradient(160deg, rgba(255,255,255,0.95) 0%, rgba(240,238,240,0.95) 100%)";
  const borderColor = isDark
    ? "rgba(150,143,146,0.18)"
    : "rgba(150,143,146,0.28)";

  const segments = Array.from({ length: NUM_SEGS }, (_, i) => {
    const segStart = 180 - i * SEG_ANGLE;
    const segEnd = 180 - (i + 1) * SEG_ANGLE;
    const midValue = ((i + 0.5) / NUM_SEGS) * 10;
    const color = interpolateGaugeColor(midValue);
    const isActive = (i / NUM_SEGS) * 10 < v;
    return (
      <path
        key={i}
        d={buildArcSegment(
          cx, cy,
          outerR - 0.5, innerR + 0.5,
          segStart - GAP, segEnd + GAP
        )}
        fill={color}
        opacity={isActive ? 1 : 0.1}
      />
    );
  });

  const ticks = Array.from({ length: 11 }, (_, i) => {
    const tickAngle = 180 - i * 18;
    const isMajor = i % 5 === 0;
    const r1 = outerR + (isMajor ? 4 : 2.5);
    const r2 = outerR + (isMajor ? 9 : 5.5);
    const [x1, y1] = polarXY(cx, cy, r1, tickAngle);
    const [x2, y2] = polarXY(cx, cy, r2, tickAngle);
    return (
      <line
        key={i}
        x1={x1.toFixed(2)} y1={y1.toFixed(2)}
        x2={x2.toFixed(2)} y2={y2.toFixed(2)}
        stroke={mutedColor}
        strokeWidth={isMajor ? 1.2 : 0.65}
      />
    );
  });

  const scaleLabels = [0, 5, 10].map((lv) => {
    const angle = 180 - lv * 18;
    const [lx, ly] = polarXY(cx, cy, outerR + 15, angle);
    return (
      <text
        key={lv}
        x={lx.toFixed(2)}
        y={ly.toFixed(2)}
        textAnchor="middle"
        dominantBaseline="middle"
        fill={mutedColor}
        fontSize={5.5}
        fontFamily="DM Sans, sans-serif"
        fontWeight="600"
      >
        {lv}
      </text>
    );
  });

  return (
    <div
      className="relative flex flex-col items-center"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ cursor: "default" }}
    >
      <div
        style={{
          background: bgPanelColor,
          border: `1px solid ${borderColor}`,
          borderRadius: "10px",
          padding: "4px 6px 2px",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          boxShadow: isDark
            ? "0 2px 12px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.04)"
            : "0 2px 12px rgba(0,0,0,0.10), inset 0 1px 0 rgba(255,255,255,0.8)",
        }}
      >
        <svg
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          style={{ width: pxW, height: pxH, display: "block" }}
        >
          <defs>
            <filter id={`ngl-${gaugeId}`} x="-120%" y="-120%" width="340%" height="340%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="1.8" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id={`hgl-${gaugeId}`} x="-80%" y="-80%" width="260%" height="260%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          <path d={buildArcSegment(cx, cy, outerR, innerR, 180, 0)} fill={trackColor} />
          {segments}
          <path
            d={buildArcSegment(cx, cy, outerR + 1.5, outerR + 0.5, 180, 0)}
            fill={isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"}
          />
          {ticks}
          {scaleLabels}

          <g
            style={{
              transform: `rotate(${needleAngle}deg)`,
              transformOrigin: `${cx}px ${cy}px`,
              transition: "transform 0.55s cubic-bezier(0.34, 1.56, 0.64, 1)",
            }}
            filter={`url(#ngl-${gaugeId})`}
          >
            <line
              x1={cx} y1={cy + 5}
              x2={cx} y2={cy - needleLen}
              stroke={needleColor}
              strokeWidth={1.7}
              strokeLinecap="round"
            />
            <circle cx={cx} cy={cy - needleLen} r={1.2} fill={needleColor} opacity={0.9} />
          </g>

          <circle cx={cx} cy={cy} r={5.5} fill={needleColor} opacity={0.18} filter={`url(#hgl-${gaugeId})`} />
          <circle cx={cx} cy={cy} r={4} fill={needleColor} opacity={0.5} />
          <circle cx={cx} cy={cy} r={2.8} fill={needleColor} />
          <circle cx={cx} cy={cy} r={1.2} fill={hubBg} opacity={0.8} />

          <text
            x={cx} y={cy - 14}
            textAnchor="middle"
            fill={needleColor}
            fontSize={10.5}
            fontWeight="800"
            fontFamily="DM Sans, sans-serif"
          >
            {v.toFixed(1)}
          </text>

        </svg>
      </div>

      {/* Hover tooltip (only shown at small sizes where zone label isn't visible nearby) */}
      {hovered && vix !== undefined && !sizePx && (
        <div
          className="absolute z-50 pointer-events-none"
          style={{ bottom: "calc(100% + 8px)", left: "50%", transform: "translateX(-50%)" }}
        >
          <div
            style={{
              background: isDark
                ? "linear-gradient(135deg, rgba(66,61,63,0.98) 0%, rgba(42,38,40,0.98) 100%)"
                : "rgba(255,255,255,0.98)",
              border: `1px solid ${isDark ? "rgba(150,143,146,0.3)" : "rgba(150,143,146,0.25)"}`,
              borderRadius: "8px",
              padding: "7px 12px",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              boxShadow: "0 6px 24px rgba(0,0,0,0.3)",
              whiteSpace: "nowrap",
            }}
          >
            <div style={{ color: isDark ? "rgba(242,242,242,0.55)" : "rgba(23,23,23,0.55)", fontSize: "11px", fontWeight: 600, marginBottom: "3px" }}>
              VIX: <span style={{ color: needleColor, fontWeight: 800 }}>{vix.toFixed(2)}</span>
            </div>
            <div style={{ color: needleColor, fontSize: "12px", fontWeight: 700 }}>{zoneLabel}</div>
          </div>
          <div style={{ position: "absolute", top: "100%", left: "50%", transform: "translateX(-50%)", width: 0, height: 0, borderLeft: "6px solid transparent", borderRight: "6px solid transparent", borderTop: `6px solid ${isDark ? "rgba(66,61,63,0.98)" : "rgba(255,255,255,0.98)"}` }} />
        </div>
      )}
    </div>
  );
}

// ── Public composite (compact, for embedding) ─────────────────────────────────

interface VolatilityGaugesProps {
  theme: Theme;
  compact?: boolean;
}

export default function VolatilityGauges({ theme, compact }: VolatilityGaugesProps) {
  const { data } = useApiData<VolatilityGaugeData>("/api/volatility/gauge", {
    refreshInterval: 30000,
  });

  if (!data) return null;

  const isDark = theme === "dark";
  const sizePx = compact ? 72 : 88;

  return (
    <div className="flex items-center gap-2">
      <SingleGauge
        value={data.level}
        title=""
        zoneLabel={data.level_label}
        vix={data.vix}
        theme={theme}
        gaugeId="spd"
        sizePx={sizePx}
      />
      <div style={{ width: "1px", height: compact ? "34px" : "44px", background: isDark ? "rgba(150,143,146,0.18)" : "rgba(150,143,146,0.22)", flexShrink: 0 }} />
      <SingleGauge
        value={data.momentum}
        title=""
        zoneLabel={data.momentum_label}
        vix={data.vix}
        theme={theme}
        gaugeId="tch"
        sizePx={sizePx}
      />
    </div>
  );
}
