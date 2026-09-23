"use client";

/**
 * The Tide — a hand-rolled SVG area chart of the market-wide flow score over
 * time. Flow floods green above the zero baseline, ebbs red below. Intraday
 * mode shows the current session's 5-minute series (frozen at the 16:00 ET
 * close after hours); daily mode shows one close per session. Colored entirely
 * through CSS tokens so it re-skins across palettes and light/dark instantly —
 * the same approach as the Gamma Terminal.
 */

import { useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useMeasuredWidth } from "@/components/useMeasuredWidth";
import { finite, type MarketTideHistoryMode, type MarketTideHistoryPoint } from "./data";

// ── Canvas ────────────────────────────────────────────────────────────────────
// The desktop board is a fixed 1000×300 viewBox scaled to the card. A phone
// card is ~310px wide, which drew that board's 10-unit labels at 3px, so a
// phone gets its own canvas instead: viewBox width = the card's measured CSS
// width (1 unit = 1px, so the same 10-unit labels are real 10px text), a
// landscape-ish height, tighter gutters, and fewer time labels. The pattern is
// GammaTerminalChart's ChartCanvas / compactCanvas.
interface TideCanvas {
  compact: boolean;
  VW: number;
  VH: number;
  L: number;
  R: number;
  T: number;
  B: number;
  PW: number;
  PH: number;
  /** Target number of x labels. */
  xLabels: number;
}

const DESKTOP_CANVAS: TideCanvas = {
  compact: false,
  VW: 1000,
  VH: 300,
  L: 46,
  R: 16,
  T: 16,
  B: 30,
  PW: 1000 - 46 - 16,
  PH: 300 - 16 - 30,
  xLabels: 6,
};

function compactCanvas(width: number): TideCanvas {
  const VW = Math.max(260, Math.round(width));
  const VH = Math.min(240, Math.max(180, Math.round(VW * 0.62)));
  const L = 30;
  const R = 6;
  const T = 12;
  const B = 22;
  // About one time label per 110px: four on a phone, six on a tablet card.
  const xLabels = Math.max(4, Math.min(6, Math.round(VW / 110)));
  return { compact: true, VW, VH, L, R, T, B, PW: VW - L - R, PH: VH - T - B, xLabels };
}

const etTime = (iso: string) =>
  new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
const etDay = (iso: string) =>
  new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
  }).format(new Date(iso));
const fmt = (v: number) => `${v > 0 ? "+" : ""}${v.toFixed(1)}`;

export default function MarketTideChart({
  points,
  mode,
  live,
}: {
  points: MarketTideHistoryPoint[];
  mode: MarketTideHistoryMode;
  live: boolean;
}) {
  const [hover, setHover] = useState<number | null>(null);
  // Phones and tablets (below lg, where the app runs its phone chrome) draw
  // the measured canvas: a tablet card is 600-990px, which scaled the desktop
  // board's 10-unit labels to 6-7px.
  const compactViewport = useIsMobile(1024);
  const [measureRef, measuredWidth] = useMeasuredWidth<HTMLDivElement>();
  const canvas = useMemo(
    () => (compactViewport && measuredWidth != null && measuredWidth > 0 ? compactCanvas(measuredWidth) : DESKTOP_CANVAS),
    [compactViewport, measuredWidth],
  );
  const { compact, VW, VH, L, R, T, PW, PH } = canvas;

  const geom = useMemo(() => {
    // Read off `canvas` here rather than the destructured locals below, so the
    // memo depends on the one canvas object (see the hooks lint rules).
    const { compact: isCompact, xLabels, L: gL, T: gT, PW: gPW, PH: gPH } = canvas;
    const rows = points.filter((p) => finite(p.score) != null);
    const vals = rows.map((p) => finite(p.score) as number);
    if (vals.length === 0) return null;
    const n = vals.length;
    const maxAbs = Math.max(20, ...vals.map((v) => Math.abs(v))) * 1.12;
    const x = (i: number) => gL + (n === 1 ? gPW / 2 : (i / (n - 1)) * gPW);
    const y = (v: number) => gT + (1 - (v + maxAbs) / (2 * maxAbs)) * gPH;
    const yBase = y(0);

    let area = `M ${x(0)} ${y(vals[0])}`;
    vals.forEach((v, i) => (area += ` L ${x(i)} ${y(v)}`));
    area += ` L ${x(n - 1)} ${yBase} L ${x(0)} ${yBase} Z`;

    const segs: { x1: number; y1: number; x2: number; y2: number; up: boolean }[] = [];
    for (let i = 1; i < n; i++) {
      segs.push({
        x1: x(i - 1),
        y1: y(vals[i - 1]),
        x2: x(i),
        y2: y(vals[i]),
        up: (vals[i] + vals[i - 1]) / 2 >= 0,
      });
    }

    const grid = [maxAbs, maxAbs / 2, 0, -maxAbs / 2, -maxAbs].map((v) => ({
      v,
      yy: y(v),
      zero: v === 0,
    }));

    const step = Math.max(1, Math.round(n / (isCompact ? xLabels : mode === "daily" ? 5 : 6)));
    const ticks = rows
      .map((p, i) => ({ i, cx: x(i), label: mode === "daily" ? etDay(p.timestamp) : etTime(p.timestamp) }))
      .filter((t) => t.i % step === 0 || t.i === n - 1);

    // The last label is always drawn; a stride label that would crowd it (the
    // compact canvas has ~70px between labels) gives way to it.
    const minGap = isCompact ? 40 : 0;
    const lastX = x(n - 1);
    const spaced = ticks.filter((t) => t.i === n - 1 || lastX - t.cx >= minGap);

    return { rows, vals, n, x, y, yBase, maxAbs, area, segs, grid, ticks: spaced, baseFrac: (yBase - gT) / gPH };
  }, [points, mode, canvas]);

  // ── Touch ── a finger has no hover. The SVG claims only horizontal
  // gestures (touch-action: pan-y), so a vertical swipe still scrolls the
  // page, while a tap drops the readout where it lands (a tap on a chart
  // already showing one lifts it) and a horizontal drag scrubs it. Mouse
  // input keeps the plain hover below.
  const touchRef = useRef<{ startX: number; moved: boolean; had: boolean } | null>(null);
  // A tap is followed by emulated mouse events at the same point; they must
  // not re-open a readout the tap just closed.
  const lastTouchAtRef = useRef(0);

  if (!geom) {
    return (
      <div
        className="flex h-[220px] items-center justify-center text-sm text-[var(--text-secondary)]"
        role="img"
        aria-label="Market Tide chart — no data yet"
      >
        {live ? "Building today's tide…" : "No tide history for this window yet."}
      </div>
    );
  }

  const { rows, vals, n, x, y, area, segs, grid, ticks, baseFrac } = geom;
  const lastIdx = n - 1;
  const lastVal = vals[lastIdx];
  const lastColor = lastVal >= 0 ? "var(--color-bull)" : "var(--color-bear)";

  const hi = hover != null && hover >= 0 && hover < n ? hover : null;
  const svgStyle: CSSProperties = {
    fontFamily: "var(--font-mono)",
    display: "block",
    width: "100%",
    height: "auto",
    ...(compact ? { touchAction: "pan-y", WebkitTouchCallout: "none", userSelect: "none" } : {}),
  };

  const indexAt = (clientX: number, rect: DOMRect) => {
    const px = ((clientX - rect.left) / rect.width) * VW;
    const i = Math.round(((px - L) / PW) * (n - 1));
    return Math.max(0, Math.min(n - 1, i));
  };
  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    setHover(indexAt(e.clientX, e.currentTarget.getBoundingClientRect()));
  };
  const onTouchDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (e.pointerType !== "touch") return;
    lastTouchAtRef.current = Date.now();
    touchRef.current = { startX: e.clientX, moved: false, had: hover != null };
  };
  const onTouchMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    const t = touchRef.current;
    if (e.pointerType !== "touch" || !t) return;
    lastTouchAtRef.current = Date.now();
    if (!t.moved && Math.abs(e.clientX - t.startX) < 6) return;
    t.moved = true;
    setHover(indexAt(e.clientX, e.currentTarget.getBoundingClientRect()));
  };
  const onTouchUp = (e: ReactPointerEvent<SVGSVGElement>) => {
    const t = touchRef.current;
    touchRef.current = null;
    if (e.pointerType !== "touch" || !t || t.moved) return;
    lastTouchAtRef.current = Date.now();
    if (e.type === "pointercancel") return; // the page took the gesture (a scroll)
    setHover(t.had ? null : indexAt(e.clientX, e.currentTarget.getBoundingClientRect()));
  };

  const hoverRow = hi != null ? rows[hi] : null;
  const tipLeftPct = hi != null ? (x(hi) / VW) * 100 : 0;
  const flip = tipLeftPct > 68;

  return (
    <div className="relative" ref={measureRef}>
      {/* Until the card is measured a phone would see the desktop board at
          3px type for a frame; it stays invisible there until then. */}
      <svg
        viewBox={`0 0 ${VW} ${VH}`}
        preserveAspectRatio="xMidYMid meet"
        style={svgStyle}
        className={measuredWidth == null ? "max-lg:invisible" : undefined}
        role="img"
        aria-label={`Market Tide ${mode === "daily" ? "daily trend" : "today"} — latest ${fmt(lastVal)}`}
        onMouseMove={(e) => {
          if (touchRef.current || Date.now() - lastTouchAtRef.current < 800) return;
          onMove(e);
        }}
        onMouseLeave={() => {
          if (Date.now() - lastTouchAtRef.current < 800) return;
          setHover(null);
        }}
        onPointerDown={onTouchDown}
        onPointerMove={onTouchMove}
        onPointerUp={onTouchUp}
        onPointerCancel={onTouchUp}
      >
        <defs>
          <linearGradient id="mt-tide" x1="0" y1={T} x2="0" y2={T + PH} gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="var(--color-bull)" stopOpacity="0.4" />
            <stop offset={baseFrac.toFixed(3)} stopColor="var(--color-bull)" stopOpacity="0.02" />
            <stop offset={baseFrac.toFixed(3)} stopColor="var(--color-bear)" stopOpacity="0.02" />
            <stop offset="1" stopColor="var(--color-bear)" stopOpacity="0.4" />
          </linearGradient>
        </defs>

        {/* grid + axis labels */}
        {grid.map((g, k) => (
          <g key={k}>
            <line
              x1={L}
              y1={g.yy}
              x2={VW - R}
              y2={g.yy}
              stroke={g.zero ? "var(--border-strong)" : "var(--border-default)"}
              strokeWidth={g.zero ? 1.4 : 1}
              strokeDasharray={g.zero ? undefined : "2 4"}
            />
            <text x={L - 8} y={g.yy + 3} textAnchor="end" fontSize="10" fill="var(--text-muted)">
              {g.v > 0 ? "+" : ""}
              {Math.round(g.v)}
            </text>
          </g>
        ))}

        {/* zone words */}
        <text x={L + (compact ? 8 : 40)} y={T + (compact ? 12 : 15)} fontSize="10" letterSpacing={compact ? 1 : 1.4} fill="var(--color-bull)" opacity="0.55">
          FLOOD
        </text>
        <text x={L + (compact ? 8 : 40)} y={T + PH - (compact ? 6 : 8)} fontSize="10" letterSpacing={compact ? 1 : 1.4} fill="var(--color-bear)" opacity="0.55">
          EBB
        </text>

        {/* area + bicolor line */}
        <path d={area} fill="url(#mt-tide)" />
        {segs.map((s, k) => (
          <line
            key={k}
            x1={s.x1}
            y1={s.y1}
            x2={s.x2}
            y2={s.y2}
            stroke={s.up ? "var(--color-bull)" : "var(--color-bear)"}
            strokeWidth="2"
            strokeLinecap="round"
          />
        ))}

        {/* x ticks */}
        {ticks.map((t) => (
          <text
            key={t.i}
            x={t.cx}
            y={VH - (compact ? 6 : 9)}
            // The compact canvas has no gutter past the plot, so the end labels
            // align inward instead of centering off the card edge.
            textAnchor={compact && t.i === n - 1 ? "end" : compact && t.cx - L < 16 ? "start" : "middle"}
            fontSize="10"
            fill="var(--text-muted)"
          >
            {t.label}
          </text>
        ))}

        {/* live cursor */}
        {live && mode === "intraday" && (
          <circle className="zg-gc-ping" cx={x(lastIdx)} cy={y(lastVal)} r="5" fill="none" stroke="var(--color-accent-hot)" strokeWidth="1.4" />
        )}
        <circle cx={x(lastIdx)} cy={y(lastVal)} r="4" fill={lastColor} stroke="var(--bg-card)" strokeWidth="1.5" />

        {/* crosshair */}
        {hi != null && (
          <g pointerEvents="none">
            <line x1={x(hi)} y1={T} x2={x(hi)} y2={T + PH} stroke="var(--border-strong)" strokeWidth="1" strokeDasharray="3 3" />
            <circle cx={x(hi)} cy={y(vals[hi])} r="4" fill="none" strokeWidth="2" stroke={vals[hi] >= 0 ? "var(--color-bull)" : "var(--color-bear)"} />
          </g>
        )}
      </svg>

      {hoverRow && hi != null && (
        <div
          className="pointer-events-none absolute z-10 border px-2.5 py-2 text-xs font-mono tabular-nums"
          style={{
            borderRadius: "var(--radius-panel)",
            background: "var(--bg-card)",
            borderColor: "var(--border-strong)",
            left: `${flip ? tipLeftPct - 2 : tipLeftPct + 2}%`,
            // A phone pins the readout to the top edge, clear of the finger.
            top: compact ? 0 : `${(y(vals[hi]) / VH) * 100}%`,
            transform: compact ? (flip ? "translate(-100%, 0)" : "none") : flip ? "translate(-100%, -50%)" : "translate(0, -50%)",
            minWidth: 118,
          }}
        >
          <div className="flex justify-between gap-4">
            <span className="text-[var(--text-secondary)]">{mode === "daily" ? "Session" : "Time"}</span>
            <b>{mode === "daily" ? etDay(hoverRow.timestamp) : etTime(hoverRow.timestamp)}</b>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-[var(--text-secondary)]">Tide</span>
            <b style={{ color: (finite(hoverRow.score) ?? 0) >= 0 ? "var(--color-bull)" : "var(--color-bear)" }}>
              {fmt(finite(hoverRow.score) ?? 0)}
            </b>
          </div>
        </div>
      )}
    </div>
  );
}
