"use client";

/**
 * PairGammaHeatmap — two center-pinned, row-aligned single-column GEX heatmaps.
 *
 * Each column lists a ticker's available strikes in DESCENDING order with the
 * Net GEX at each strike, color-coded with the exact scheme the /gex-heatmap
 * chart uses (orange = positive, warm white = neutral, dark blue = negative,
 * brightness = magnitude). The two columns are aligned on "like" price levels:
 * the strike nearest each ticker's spot is the shared center row, and both
 * columns fan out by strike from there — so SPY 600 lines up with SPX 6000,
 * SPY 601 with SPX 6005, and so on, regardless of the absolute price gap.
 *
 * Tiny colored arrows in the left gutter of each cell mark where Spot, the
 * Gamma Flip, the Call/Put Walls and Max Pain fall, with the actual level
 * value printed inside the arrow.
 *
 * The color math (anchor RGBs + signed-sqrt intensity curve + 98th-percentile
 * clip) is copied verbatim from GammaHeatmapCanvas so the two surfaces match.
 */

import { useMemo } from "react";
import { gexScaleFactor, GEX_UNIT_LABEL, type GexUnit } from "@/core/GexUnitContext";
import LoadingSpinner from "./LoadingSpinner";
import ErrorMessage from "./ErrorMessage";

export interface HeatmapCell {
  strike: number;
  net_gex: number;
}

export interface HeatmapColumnInput {
  symbol: string;
  cells: HeatmapCell[];
  spot: number | null;
  gammaFlip: number | null;
  callWall: number | null;
  putWall: number | null;
  maxPain: number | null;
  loading: boolean;
  error: string | null;
}

// ---- Color scheme (verbatim from GammaHeatmapCanvas.tsx) --------------------
type RGB = { r: number; g: number; b: number };
const BEARISH: RGB = { r: 44, g: 72, b: 117 }; // negative GEX -> dark blue
const NEUTRAL: RGB = { r: 255, g: 246, b: 237 }; // zero -> warm white
const BULLISH: RGB = { r: 255, g: 133, b: 49 }; // positive GEX -> orange

const blend = (a: RGB, b: RGB, t: number): RGB => ({
  r: Math.round(a.r + (b.r - a.r) * t),
  g: Math.round(a.g + (b.g - a.g) * t),
  b: Math.round(a.b + (b.b - a.b) * t),
});

// ratio in [-1, 1]
function colorForRatio(ratio: number): RGB {
  if (ratio >= 0) return blend(NEUTRAL, BULLISH, Math.min(1, ratio));
  return blend(BEARISH, NEUTRAL, Math.min(1, 1 + ratio));
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor(sorted.length * p)));
  return sorted[idx];
}

function cssRgb(c: RGB): string {
  return `rgb(${c.r}, ${c.g}, ${c.b})`;
}

// Pick a legible text color for a given cell fill.
function textOn(c: RGB): string {
  const lum = 0.299 * c.r + 0.587 * c.g + 0.114 * c.b;
  return lum > 150 ? "#141B29" : "#FFF3E9";
}

// ---- Level arrow config -----------------------------------------------------
type LevelKey = "spot" | "flip" | "call" | "put" | "pain";
const LEVEL_META: Record<LevelKey, { label: string; color: string; text: string }> = {
  spot: { label: "Spot", color: "#0EA5E9", text: "#FFFFFF" },
  flip: { label: "Gamma Flip", color: "#8B5CF6", text: "#FFFFFF" },
  call: { label: "Call Wall", color: "#16A34A", text: "#FFFFFF" },
  put: { label: "Put Wall", color: "#DC2626", text: "#FFFFFF" },
  pain: { label: "Max Pain", color: "#F59E0B", text: "#141B29" },
};
const LEVEL_ORDER: LevelKey[] = ["spot", "flip", "call", "put", "pain"];

// ---- Layout constants -------------------------------------------------------
const ROW_H = 22; // px per strike row — identical across both columns => aligned
const GUTTER = 96; // left gutter (arrows) width
const MAX_SIDE = 30; // strikes shown on each side of the spot-nearest center

// ---- Number formatting ------------------------------------------------------
function fmtGex(scaledDollars: number): string {
  const m = scaledDollars / 1_000_000;
  const a = Math.abs(m);
  const s = m < 0 ? "-" : "";
  if (a >= 1000) return `${s}${(a / 1000).toFixed(1)}B`;
  if (a >= 100) return `${s}${a.toFixed(0)}M`;
  if (a >= 1) return `${s}${a.toFixed(1)}M`;
  if (a === 0) return "0";
  return `${s}${a.toFixed(2)}M`;
}

function fmtLevel(v: number): string {
  const a = Math.abs(v);
  if (a >= 1000) return v.toFixed(0);
  return Number.isInteger(v) ? v.toFixed(0) : v.toFixed(2);
}

function fmtStrike(v: number): string {
  return Number.isInteger(v) ? v.toFixed(0) : v.toFixed(1);
}

// ---- Per-column derivation --------------------------------------------------
interface BuiltColumn {
  sorted: HeatmapCell[]; // descending by strike
  centerIdx: number; // index of the strike nearest spot
  up: number; // rows above center that exist (capped to MAX_SIDE)
  down: number; // rows below center that exist (capped to MAX_SIDE)
}

function buildColumn(cells: HeatmapCell[], spot: number | null): BuiltColumn | null {
  const clean = cells
    .map((c) => ({ strike: Number(c.strike), net_gex: Number(c.net_gex) }))
    .filter((c) => Number.isFinite(c.strike));
  if (clean.length === 0) return null;
  const sorted = clean.sort((a, b) => b.strike - a.strike);

  // Center on the strike nearest spot; if spot is missing, use the median strike.
  let centerIdx = Math.floor(sorted.length / 2);
  if (spot != null && Number.isFinite(spot)) {
    let best = Infinity;
    sorted.forEach((c, i) => {
      const d = Math.abs(c.strike - spot);
      if (d < best) {
        best = d;
        centerIdx = i;
      }
    });
  }
  const up = Math.min(MAX_SIDE, centerIdx);
  const down = Math.min(MAX_SIDE, sorted.length - 1 - centerIdx);
  return { sorted, centerIdx, up, down };
}

// Offset (steps above the center strike, positive = higher strike) of the row
// nearest to `value`, or null if it falls outside the visible window.
function offsetForValue(col: BuiltColumn, value: number | null): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  let bestIdx = 0;
  let best = Infinity;
  col.sorted.forEach((c, i) => {
    const d = Math.abs(c.strike - value);
    if (d < best) {
      best = d;
      bestIdx = i;
    }
  });
  const offset = col.centerIdx - bestIdx;
  if (offset > col.up || offset < -col.down) return null;
  return offset;
}

interface ColumnModel {
  input: HeatmapColumnInput;
  built: BuiltColumn | null;
  cellByOffset: Map<number, HeatmapCell>;
  arrowsByOffset: Map<number, LevelKey[]>;
  levelValues: Record<LevelKey, number | null>;
  clip: number;
  gexScale: number;
}

function buildModel(input: HeatmapColumnInput, gexUnit: GexUnit): ColumnModel {
  const built = buildColumn(input.cells, input.spot);
  const cellByOffset = new Map<number, HeatmapCell>();
  const arrowsByOffset = new Map<number, LevelKey[]>();
  const levelValues: Record<LevelKey, number | null> = {
    spot: input.spot,
    flip: input.gammaFlip,
    call: input.callWall,
    put: input.putWall,
    pain: input.maxPain,
  };

  const absVals: number[] = [];
  if (built) {
    for (let o = -built.down; o <= built.up; o++) {
      const cell = built.sorted[built.centerIdx - o];
      if (cell) {
        cellByOffset.set(o, cell);
        if (Number.isFinite(cell.net_gex)) absVals.push(Math.abs(cell.net_gex));
      }
    }
    for (const key of LEVEL_ORDER) {
      const o = offsetForValue(built, levelValues[key]);
      if (o == null) continue;
      const list = arrowsByOffset.get(o) ?? [];
      list.push(key);
      arrowsByOffset.set(o, list);
    }
  }

  const clip = Math.max(1, percentile(absVals, 0.98));
  // Unit scaling is applied per-column with that ticker's own spot.
  const gexScale = gexScaleFactor(gexUnit, input.spot);
  return { input, built, cellByOffset, arrowsByOffset, levelValues, clip, gexScale };
}

// ---- Small presentational bits ---------------------------------------------
function LevelArrow({ meta, value }: { meta: { label: string; color: string; text: string }; value: number }) {
  return (
    <span
      title={`${meta.label}: ${fmtLevel(value)}`}
      className="inline-flex items-center font-mono font-semibold"
      style={{
        background: meta.color,
        color: meta.text,
        fontSize: 9,
        lineHeight: 1,
        height: 15,
        paddingLeft: 4,
        paddingRight: 8,
        borderRadius: 2,
        whiteSpace: "nowrap",
        clipPath: "polygon(0 0, 82% 0, 100% 50%, 82% 100%, 0 100%)",
      }}
    >
      {fmtLevel(value)}
    </span>
  );
}

function HeatmapColumn({
  model,
  offsets,
  gexUnit,
}: {
  model: ColumnModel;
  offsets: number[];
  gexUnit: GexUnit;
}) {
  const { input, cellByOffset, arrowsByOffset, clip, gexScale } = model;
  const unitLabel = GEX_UNIT_LABEL[gexUnit];

  return (
    <div className="flex flex-col" style={{ minWidth: GUTTER + 138 }}>
      {/* Column header */}
      <div className="flex items-baseline justify-between px-1 mb-1" style={{ paddingLeft: GUTTER }}>
        <span className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
          {input.symbol}
        </span>
        <span className="text-[11px] font-mono" style={{ color: "var(--text-secondary)" }}>
          {input.spot != null ? `$${input.spot.toFixed(2)}` : "--"}
        </span>
      </div>
      {/* Sub-header: strike / net gex labels over the cell area */}
      <div
        className="flex items-center justify-between px-1.5 mb-0.5 text-[9px] uppercase tracking-wider"
        style={{ marginLeft: GUTTER, color: "var(--text-muted)" }}
      >
        <span>Strike</span>
        <span>Net GEX ({unitLabel})</span>
      </div>

      {input.error ? (
        <div style={{ marginLeft: GUTTER }}>
          <ErrorMessage message={input.error} />
        </div>
      ) : input.loading && cellByOffset.size === 0 ? (
        <div style={{ marginLeft: GUTTER }} className="py-6">
          <LoadingSpinner />
        </div>
      ) : cellByOffset.size === 0 ? (
        <div
          style={{ marginLeft: GUTTER, color: "var(--text-secondary)" }}
          className="text-center text-xs py-6"
        >
          No strike data
        </div>
      ) : (
        <div>
          {offsets.map((o) => {
            const cell = cellByOffset.get(o);
            const arrows = arrowsByOffset.get(o) ?? [];
            const isCenter = o === 0;

            let bg = "transparent";
            let color = "var(--text-muted)";
            if (cell && Number.isFinite(cell.net_gex)) {
              const norm = Math.min(Math.abs(cell.net_gex) / clip, 1);
              const ratio = Math.sign(cell.net_gex) * Math.sqrt(norm);
              const rgb = colorForRatio(ratio);
              bg = cssRgb(rgb);
              color = textOn(rgb);
            }

            return (
              <div key={o} className="flex items-stretch" style={{ height: ROW_H }}>
                {/* Left gutter: level arrows pointing into the cell */}
                <div
                  className="flex items-center justify-end gap-0.5 pr-1"
                  style={{ width: GUTTER, flex: "0 0 auto" }}
                >
                  {arrows.map((key) => {
                    const value = model.levelValues[key];
                    if (value == null) return null;
                    return <LevelArrow key={key} meta={LEVEL_META[key]} value={value} />;
                  })}
                </div>
                {/* Strike cell */}
                <div
                  className="flex-1 flex items-center justify-between px-1.5 font-mono text-[11px]"
                  style={{
                    background: bg,
                    color,
                    borderTop: "1px solid var(--bg-card)",
                    outline: isCenter ? "1px solid rgba(148,163,184,0.55)" : "none",
                    outlineOffset: -1,
                  }}
                >
                  {cell ? (
                    <>
                      <span className="font-semibold">{fmtStrike(cell.strike)}</span>
                      <span>{fmtGex((cell.net_gex || 0) * gexScale)}</span>
                    </>
                  ) : (
                    <span className="opacity-30">·</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function PairGammaHeatmap({
  left,
  right,
  gexUnit,
}: {
  left: HeatmapColumnInput;
  right: HeatmapColumnInput;
  gexUnit: GexUnit;
}) {
  // Re-derive the models whenever inputs or the unit change (gexScale depends
  // on the unit + each ticker's spot).
  const leftModel = useMemo(() => buildModel(left, gexUnit), [left, gexUnit]);
  const rightModel = useMemo(() => buildModel(right, gexUnit), [right, gexUnit]);

  const { offsets } = useMemo(() => {
    const up = Math.max(leftModel.built?.up ?? 0, rightModel.built?.up ?? 0);
    const down = Math.max(leftModel.built?.down ?? 0, rightModel.built?.down ?? 0);
    const out: number[] = [];
    for (let o = up; o >= -down; o--) out.push(o);
    return { offsets: out };
  }, [leftModel, rightModel]);

  return (
    <div>
      {/* Legend */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-4">
        {LEVEL_ORDER.map((key) => (
          <div key={key} className="flex items-center gap-1.5">
            <span
              className="inline-block"
              style={{
                width: 14,
                height: 11,
                background: LEVEL_META[key].color,
                borderRadius: 2,
                clipPath: "polygon(0 0, 78% 0, 100% 50%, 78% 100%, 0 100%)",
              }}
            />
            <span className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
              {LEVEL_META[key].label}
            </span>
          </div>
        ))}
        <div className="flex items-center gap-1.5 ml-auto">
          <span className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
            Net GEX
          </span>
          <span
            className="inline-block rounded"
            style={{
              width: 120,
              height: 11,
              background: `linear-gradient(to right, ${cssRgb(BEARISH)}, ${cssRgb(NEUTRAL)}, ${cssRgb(BULLISH)})`,
            }}
          />
          <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
            − / +
          </span>
        </div>
      </div>

      <div className="flex gap-4">
        <HeatmapColumn model={leftModel} offsets={offsets} gexUnit={gexUnit} />
        <HeatmapColumn model={rightModel} offsets={offsets} gexUnit={gexUnit} />
      </div>
    </div>
  );
}
