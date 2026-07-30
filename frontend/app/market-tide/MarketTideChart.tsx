"use client";

/**
 * The Tide — a hand-rolled SVG area chart of the market-wide flow score over
 * time. Flow floods green above the zero baseline, ebbs red below. Intraday
 * mode shows the current session's 5-minute series (frozen at the 16:00 ET
 * close after hours); daily mode shows one close per session. Colored entirely
 * through CSS tokens so it re-skins across palettes and light/dark instantly —
 * the same approach as the Gamma Terminal.
 */

import { useMemo, useState, type CSSProperties } from "react";
import { finite, type MarketTideHistoryMode, type MarketTideHistoryPoint } from "./data";

const VW = 1000;
const VH = 300;
const L = 46;
const R = 16;
const T = 16;
const B = 30;
const PW = VW - L - R;
const PH = VH - T - B;

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

  const geom = useMemo(() => {
    const rows = points.filter((p) => finite(p.score) != null);
    const vals = rows.map((p) => finite(p.score) as number);
    if (vals.length === 0) return null;
    const n = vals.length;
    const maxAbs = Math.max(20, ...vals.map((v) => Math.abs(v))) * 1.12;
    const x = (i: number) => L + (n === 1 ? PW / 2 : (i / (n - 1)) * PW);
    const y = (v: number) => T + (1 - (v + maxAbs) / (2 * maxAbs)) * PH;
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

    const step = Math.max(1, Math.round(n / (mode === "daily" ? 5 : 6)));
    const ticks = rows
      .map((p, i) => ({ i, cx: x(i), label: mode === "daily" ? etDay(p.timestamp) : etTime(p.timestamp) }))
      .filter((t) => t.i % step === 0 || t.i === n - 1);

    return { rows, vals, n, x, y, yBase, maxAbs, area, segs, grid, ticks, baseFrac: (yBase - T) / PH };
  }, [points, mode]);

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
  const svgStyle: CSSProperties = { fontFamily: "var(--font-mono)", display: "block", width: "100%", height: "auto" };

  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * VW;
    let i = Math.round(((px - L) / PW) * (n - 1));
    i = Math.max(0, Math.min(n - 1, i));
    setHover(i);
  };

  const hoverRow = hi != null ? rows[hi] : null;
  const tipLeftPct = hi != null ? (x(hi) / VW) * 100 : 0;
  const flip = tipLeftPct > 68;

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${VW} ${VH}`}
        preserveAspectRatio="xMidYMid meet"
        style={svgStyle}
        role="img"
        aria-label={`Market Tide ${mode === "daily" ? "daily trend" : "today"} — latest ${fmt(lastVal)}`}
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
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
              stroke={g.zero ? "var(--border-strong)" : "var(--color-border)"}
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
        <text x={L + 40} y={T + 15} fontSize="10" letterSpacing="1.4" fill="var(--color-bull)" opacity="0.55">
          FLOOD
        </text>
        <text x={L + 40} y={T + PH - 8} fontSize="10" letterSpacing="1.4" fill="var(--color-bear)" opacity="0.55">
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
          <text key={t.i} x={t.cx} y={VH - 9} textAnchor="middle" fontSize="10" fill="var(--text-muted)">
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
          className="pointer-events-none absolute z-10 rounded-lg border px-2.5 py-2 text-xs font-mono tabular-nums shadow-lg"
          style={{
            background: "var(--bg-card)",
            borderColor: "var(--border-strong)",
            left: `${flip ? tipLeftPct - 2 : tipLeftPct + 2}%`,
            top: `${(y(vals[hi]) / VH) * 100}%`,
            transform: flip ? "translate(-100%, -50%)" : "translate(0, -50%)",
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
