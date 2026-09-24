"use client";

/**
 * Flow × Gamma map — every supported index plotted by its directional flow
 * (x) and dealer gamma (y). Short gamma sits up top (moves amplify), long
 * gamma down low (moves pinned); call-led flow right, put-led left. The four
 * quadrants read as regimes — squeeze fuel, air pocket, capped grind,
 * supported — so which names are primed to run vs. get pinned reads at a
 * glance. Hand-rolled SVG in CSS tokens, matching the Gamma Terminal.
 */

import { useRef, useState, type CSSProperties } from "react";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useMeasuredWidth } from "@/components/useMeasuredWidth";
import {
  finite,
  formatNumber,
  formatSigned,
  regimePhrase,
  type MarketTideComponent,
} from "./data";

// ── Canvas ────────────────────────────────────────────────────────────────────
// Desktop draws a fixed 560×470 board scaled to its card. On a ~310px phone
// card that put the 10.5-unit labels at 6px and the 15–29-unit bubbles on top
// of each other, so a phone draws a canvas as wide as the card instead (1 unit
// = 1px — see GammaTerminalChart's compactCanvas): real 10px labels, smaller
// bubbles, slimmer gutters.
interface MapCanvas {
  compact: boolean;
  VW: number;
  VH: number;
  L: number;
  R: number;
  T: number;
  PW: number;
  PH: number;
  IT: number;
  IB: number;
  /** Baseline of the two region names above the frame. */
  topNameY: number;
  regionFont: number;
  regionTracking: number;
  axisFont: number;
  /** Distance of the bottom axis title above the canvas bottom. */
  axisTitleGap: number;
  /** x of the rotated gamma axis title. */
  gammaTitleX: number;
  bubbleBase: number;
  bubbleScale: number;
  bubbleFont: number;
}

const DESKTOP_CANVAS: MapCanvas = {
  compact: false,
  VW: 560,
  VH: 470,
  L: 54,
  R: 22,
  T: 26,
  PW: 560 - 54 - 22,
  PH: 470 - 26 - 54,
  IT: 12,
  IB: 12,
  topNameY: 16,
  regionFont: 11,
  regionTracking: 1,
  axisFont: 10.5,
  axisTitleGap: 28,
  gammaTitleX: 16,
  bubbleBase: 15,
  bubbleScale: 14,
  bubbleFont: 12,
};

function compactCanvas(width: number): MapCanvas {
  const VW = Math.max(260, Math.round(width));
  // Near-square on a phone; capped so a tablet-width card isn't a 560px tower.
  const VH = Math.min(460, Math.round(VW * 0.9));
  const L = 26;
  const R = 4;
  const T = 22;
  const B = 30;
  return {
    compact: true,
    VW,
    VH,
    L,
    R,
    T,
    PW: VW - L - R,
    PH: VH - T - B,
    IT: 10,
    IB: 10,
    topNameY: 14,
    regionFont: 10,
    regionTracking: 0.6,
    axisFont: 10,
    axisTitleGap: 10,
    gammaTitleX: 11,
    bubbleBase: 12,
    bubbleScale: 9,
    bubbleFont: 10,
  };
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const SP = " ";

/**
 * Nudges overlapping bubbles apart (a few rounds of pairwise push, clamped to
 * the frame) — phone only, where two indices with near-identical readings
 * (QQQ and NDX, SPY and SPX usually are) otherwise print as one blot. The
 * shift is a bubble-width at most; the readout keeps the exact values.
 */
function spreadBubbles(
  items: { x: number; y: number; r: number }[],
  box: { x0: number; x1: number; y0: number; y1: number },
): { x: number; y: number; r: number }[] {
  const pts = items.map((p) => ({ ...p }));
  for (let round = 0; round < 60; round++) {
    let moved = false;
    for (let a = 0; a < pts.length; a++) {
      for (let b = a + 1; b < pts.length; b++) {
        const dx = pts[b].x - pts[a].x;
        const dy = pts[b].y - pts[a].y;
        const d = Math.hypot(dx, dy);
        const min = pts[a].r + pts[b].r + 2;
        if (d >= min) continue;
        const push = (min - d) / 2;
        const ux = d > 0.01 ? dx / d : 1;
        const uy = d > 0.01 ? dy / d : 0;
        pts[a].x -= ux * push;
        pts[a].y -= uy * push;
        pts[b].x += ux * push;
        pts[b].y += uy * push;
        moved = true;
      }
    }
    for (const p of pts) {
      p.x = clamp(p.x, box.x0 + p.r, box.x1 - p.r);
      p.y = clamp(p.y, box.y0 + p.r, box.y1 - p.r);
    }
    if (!moved) break;
  }
  return pts;
}

export default function FlowGammaMap({ components }: { components: MarketTideComponent[] }) {
  const [hover, setHover] = useState<number | null>(null);
  // Any card narrower than the 560-unit desktop board draws the measured
  // canvas instead of shrinking the board (its region labels read 5-8px in a
  // 290-410px desktop column); phones and tablets always do. See
  // MarketTideChart.
  const compactViewport = useIsMobile(1024);
  const [measureRef, measuredWidth] = useMeasuredWidth<HTMLDivElement>();
  const canvas =
    measuredWidth != null && measuredWidth > 0 && (compactViewport || measuredWidth < DESKTOP_CANVAS.VW)
      ? compactCanvas(measuredWidth)
      : DESKTOP_CANVAS;
  const { compact, VW, VH, L, R, T, PW, PH, IT, IB } = canvas;
  // Taps are followed by emulated mouse events; they must not undo the tap.
  const lastTouchAtRef = useRef(0);
  const fromRecentTouch = () => Date.now() - lastTouchAtRef.current < 800;

  const comps = components.filter((c) => c && c.symbol);
  if (comps.length === 0) {
    return (
      <div
        className="flex h-[260px] items-center justify-center text-sm text-[var(--text-secondary)]"
        role="img"
        aria-label="Flow versus gamma map&nbsp;- no eligible symbols"
      >
        No eligible symbols in this window yet.
      </div>
    );
  }

  const x = (f: number) => L + ((clamp(f, -1, 1) + 1) / 2) * PW;
  const y = (g: number) => T + IT + ((clamp(g, -1, 1) + 1) / 2) * (PH - IT - IB);
  const cx = x(0);
  const cy = T + PH / 2;
  const allShort = comps.every((c) => (finite(c.gamma_score) ?? 0) < 0);

  const svgStyle: CSSProperties = { fontFamily: "var(--font-mono)", display: "block", width: "100%", height: "auto" };
  const hoverC = hover != null ? comps[hover] : null;

  const raw = comps.map((c) => ({
    x: x(finite(c.flow_score) ?? 0),
    y: y(finite(c.gamma_score) ?? 0),
    r: canvas.bubbleBase + (finite(c.weight) ?? 0) * canvas.bubbleScale,
  }));
  const placed = compact ? spreadBubbles(raw, { x0: L, x1: VW - R, y0: T, y1: T + PH }) : raw;

  return (
    <div className="relative" ref={measureRef}>
      {/* A phone would otherwise flash the desktop board at 6px type for a
          frame before its own canvas is measured. */}
      <svg
        viewBox={`0 0 ${VW} ${VH}`}
        preserveAspectRatio="xMidYMid meet"
        style={svgStyle}
        className={measuredWidth == null ? "invisible" : undefined}
        role="img"
        aria-label="Flow versus dealer gamma by ticker"
        onPointerDown={(e) => {
          // A tap on open ground puts the readout away.
          if (e.pointerType !== "touch") return;
          lastTouchAtRef.current = Date.now();
          setHover(null);
        }}
      >
        {/* quadrant tints — top-left air pocket, top-right squeeze fuel */}
        <rect x={L} y={T} width={cx - L} height={PH / 2} fill="var(--color-bear-soft)" />
        <rect x={cx} y={T} width={VW - R - cx} height={PH / 2} fill="var(--color-bull-soft)" />

        {/* region names: top above the frame (clear of the bubble band), bottom in the empty corners */}
        <text x={L} y={canvas.topNameY} fontSize={canvas.regionFont} fontWeight="700" letterSpacing={canvas.regionTracking} fill="var(--color-bear)" opacity="0.9">
          AIR POCKET
        </text>
        <text x={VW - R} y={canvas.topNameY} textAnchor="end" fontSize={canvas.regionFont} fontWeight="700" letterSpacing={canvas.regionTracking} fill="var(--color-bull)" opacity="0.9">
          SQUEEZE FUEL
        </text>
        <text x={L + (compact ? 6 : 8)} y={T + PH - (compact ? 8 : 12)} fontSize={compact ? 10 : 10.5} fontWeight="700" letterSpacing={canvas.regionTracking} fill="var(--text-muted)">
          SUPPORTED
        </text>
        <text x={VW - R - (compact ? 6 : 8)} y={T + PH - (compact ? 8 : 12)} textAnchor="end" fontSize={compact ? 10 : 10.5} fontWeight="700" letterSpacing={canvas.regionTracking} fill="var(--text-muted)">
          CAPPED GRIND
        </text>

        {/* frame + center cross */}
        <rect x={L} y={T} width={PW} height={PH} fill="none" stroke="var(--border-default)" strokeWidth="1" />
        <line x1={L} y1={cy} x2={VW - R} y2={cy} stroke="var(--border-strong)" strokeWidth="1" />
        <line x1={cx} y1={T} x2={cx} y2={T + PH} stroke="var(--border-strong)" strokeWidth="1" />

        {/* axis titles */}
        <text x={cx} y={VH - canvas.axisTitleGap} textAnchor="middle" fontSize={canvas.axisFont} fill="var(--text-secondary)">
          {`◄${SP}put-led${SP}${SP}FLOW${SP}${SP}call-led${SP}►`}
        </text>
        <text transform={`translate(${canvas.gammaTitleX},${T + PH / 2}) rotate(-90)`} textAnchor="middle" fontSize={canvas.axisFont} fill="var(--text-secondary)">
          {`◄${SP}long γ${SP}${SP}GAMMA${SP}${SP}short γ${SP}►`}
        </text>

        {allShort && (
          <text x={cx} y={cy + PH / 4 + 4} textAnchor="middle" fontSize={canvas.axisFont} fill="var(--text-muted)" opacity="0.85">
            {`-${SP}no index is long-gamma right now${SP}-`}
          </text>
        )}

        {/* bubbles */}
        {comps.map((c, i) => {
          const { x: bx, y: by, r } = placed[i];
          const bull = (finite(c.contribution) ?? 0) >= 0;
          return (
            <g
              key={`${c.symbol}-${i}`}
              style={{ cursor: "pointer" }}
              onMouseEnter={() => {
                if (!fromRecentTouch()) setHover(i);
              }}
              onMouseMove={() => {
                if (!fromRecentTouch()) setHover(i);
              }}
              onMouseLeave={() => {
                if (!fromRecentTouch()) setHover(null);
              }}
              onPointerDown={(e) => {
                // A finger has no hover: a tap opens this bubble's readout,
                // and a second tap on it puts the readout away.
                if (e.pointerType !== "touch") return;
                e.stopPropagation();
                lastTouchAtRef.current = Date.now();
                setHover((cur) => (cur === i ? null : i));
              }}
            >
              <circle cx={bx} cy={by} r={r + 2.5} fill="var(--bg-card)" />
              <circle cx={bx} cy={by} r={r} fill={bull ? "var(--color-bull-soft)" : "var(--color-bear-soft)"} stroke={bull ? "var(--color-bull)" : "var(--color-bear)"} strokeWidth="2" />
              <text x={bx} y={by + (compact ? 3.5 : 4)} textAnchor="middle" fontSize={canvas.bubbleFont} fontWeight="700" fill="var(--text-primary)">
                {c.symbol}
              </text>
            </g>
          );
        })}
      </svg>

      {hoverC && (
        <div
          className="pointer-events-none absolute left-1/2 top-2 z-10 max-w-[220px] -translate-x-1/2 border px-3 py-2 text-xs font-mono"
          style={{ borderRadius: "var(--radius-panel)", background: "var(--bg-card)", borderColor: "var(--border-strong)" }}
        >
          <div className="flex items-baseline justify-between gap-3">
            <b className="text-sm">{hoverC.symbol}</b>
            <span className="tabular-nums">
              {(finite(hoverC.gamma_score) ?? 0) < 0 ? "short γ" : "long γ"}
            </span>
          </div>
          <div className="mt-1 flex justify-between gap-4 tabular-nums">
            <span className="text-[var(--text-secondary)]">Flow</span>
            <b style={{ color: (finite(hoverC.flow_score) ?? 0) >= 0 ? "var(--color-bull)" : "var(--color-bear)" }}>{formatNumber(hoverC.flow_score)}</b>
          </div>
          <div className="flex justify-between gap-4 tabular-nums">
            <span className="text-[var(--text-secondary)]">Contribution</span>
            <b style={{ color: (finite(hoverC.contribution) ?? 0) >= 0 ? "var(--color-bull)" : "var(--color-bear)" }}>{formatSigned(hoverC.contribution, 3)}</b>
          </div>
          <p className="mt-1.5 leading-snug text-[var(--text-secondary)]">{regimePhrase(hoverC)}</p>
        </div>
      )}
    </div>
  );
}
