"use client";

/**
 * PairGammaHeatmap — two center-pinned, strike-aligned Net-GEX ladders that
 * read like a pro trading terminal (the Gamma Chart's design language).
 *
 * Each column lists a symbol's strikes in DESCENDING order with the Net GEX at
 * each strike, tinted by sign + magnitude (orange = positive/pinning, navy =
 * negative/trending; stronger tint = larger magnitude). Both columns are
 * aligned on "like" price levels: the strike nearest each symbol's spot is the
 * shared center row and both fan out by strike-step from there — so the SHAPE
 * of dealer positioning around spot can be read across two symbols regardless
 * of the absolute price gap (SPY ~600 beside QQQ ~500, SPX ~6000, …).
 *
 * The centered spot strike is highlighted as a pill; the heaviest-|GEX| strike
 * in view is starred; and the dealer-gamma levels (Gamma Flip, Call/Put Walls,
 * Max Pain) mark their rows with a colored inset rail + a one-letter tag, with
 * the live values echoed as chips in each column header. All chrome is bound to
 * theme tokens so it tracks light/dark and every palette; only the semantic
 * sign tint (orange/navy) is fixed, exactly like the Gamma Chart's heatmap.
 *
 * Layout is fully fluid: the two columns flex to share the available width and
 * shrink to 0 (min-w-0), so the pair fits a phone instead of forcing a wide
 * fixed-gutter horizontal scroll the way the previous version did.
 */

import { useMemo, type ReactNode } from "react";
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
  /** Day change % for the header badge (optional — omitted in some modes). */
  changePercent?: number | null;
  isPositive?: boolean;
  loading: boolean;
  error: string | null;
  /** The symbol dropdown, injected by the page so the ladder stays presentational. */
  control?: ReactNode;
}

// ---- Signed sign colors (semantic, fixed like the Gamma Chart heatmap) ------
// Positive Net GEX = dealer long gamma (pinning) → warm; negative = short
// gamma (trending) → cool. Bound to theme tokens so the hue tracks the palette
// while the sign meaning stays constant.
const POS_COLOR = "var(--heat-mid)"; // orange/coral
const NEG_COLOR = "var(--color-info)"; // navy blue
// Peak translucency cap — kept moderate so the header text stays legible over
// the tint in every theme (the tint is layered over --bg-card).
const MAX_TINT = 55;

// ---- Level marker config (tokenized chrome) --------------------------------
type LevelKey = "spot" | "flip" | "call" | "put" | "pain";
// Two-letter codes (GF / CW / PW / MP) read far clearer on the row rail than a
// single cryptic letter, and the column-header legend spells each one out.
const LEVEL_META: Record<LevelKey, { label: string; short: string; code: string; color: string }> = {
  spot: { label: "Spot", short: "Spot", code: "SP", color: "var(--color-accent-hot)" },
  flip: { label: "Gamma Flip", short: "Flip", code: "GF", color: "var(--color-warning)" },
  call: { label: "Call Wall", short: "Call", code: "CW", color: "var(--color-bear)" },
  put: { label: "Put Wall", short: "Put", code: "PW", color: "var(--color-bull)" },
  pain: { label: "Max Pain", short: "Pain", code: "MP", color: "var(--color-accent-hot)" },
};
// Order the rail draws in when levels collide on one row.
const LEVEL_ORDER: LevelKey[] = ["flip", "call", "put", "pain"];

// ---- Layout constants -------------------------------------------------------
const ROW_H = 20; // px per strike row — identical across both columns => aligned
const MAX_SIDE = 20; // strikes shown on each side of the spot-nearest center

// ---- Number formatting ------------------------------------------------------
function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor(sorted.length * p)));
  return sorted[idx];
}

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

function fmtSpot(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return "--";
  // Drop the cents on index-scale prices (SPX ~6,000 / NDX ~20,000) so the
  // header spot doesn't get truncated in a narrow phone column; keep 2dp for
  // ETF-scale prices where the cents matter.
  const opts = Math.abs(v) >= 1000 ? { maximumFractionDigits: 0 } : { minimumFractionDigits: 2, maximumFractionDigits: 2 };
  return v.toLocaleString(undefined, opts);
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
  peakOffset: number | null;
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
  let peakOffset: number | null = null;
  let peakAbs = -1;
  if (built) {
    for (let o = -built.down; o <= built.up; o++) {
      const cell = built.sorted[built.centerIdx - o];
      if (cell) {
        cellByOffset.set(o, cell);
        if (Number.isFinite(cell.net_gex)) {
          const abs = Math.abs(cell.net_gex);
          absVals.push(abs);
          if (abs > peakAbs) {
            peakAbs = abs;
            peakOffset = o;
          }
        }
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
  const gexScale = gexScaleFactor(gexUnit, input.spot);
  return { input, built, cellByOffset, arrowsByOffset, levelValues, clip, gexScale, peakOffset };
}

// Signed translucent tint for a cell, layered over --bg-card. Signed-sqrt curve
// (matches the Gamma Chart heatmap) so mid magnitudes stay visible; capped so
// text-primary reads over it in every theme. Empty/near-zero → transparent, so
// the row recedes into the card (dark-low → tinted-high, like the reference).
function cellTint(netGex: number, clip: number): string {
  if (!Number.isFinite(netGex) || netGex === 0) return "transparent";
  const norm = Math.min(Math.abs(netGex) / clip, 1);
  const t = Math.sqrt(norm);
  const pct = Math.round(t * MAX_TINT);
  if (pct <= 0) return "transparent";
  const color = netGex >= 0 ? POS_COLOR : NEG_COLOR;
  return `color-mix(in srgb, ${color} ${pct}%, transparent)`;
}

// ---- Small presentational bits ---------------------------------------------
// Header legend entry — the key for the on-row rail tags. Just the colored code
// tag + value (no outer box, no repeated word); the full name is in the title.
// Always rendered for every level (GF/CW/PW/MP) so the legend is the same size
// in both columns; an unavailable level shows a muted "NA".
function LevelChip({ meta, value }: { meta: (typeof LEVEL_META)[LevelKey]; value: number | null }) {
  const has = value != null && Number.isFinite(value);
  return (
    <span
      className="inline-flex items-center gap-1 font-mono"
      title={has ? `${meta.label}: ${fmtLevel(value as number)}` : `${meta.label}: not available`}
      style={{ whiteSpace: "nowrap" }}
    >
      <RailTag meta={meta} />
      <span style={{ fontSize: 10, fontWeight: 600, color: has ? "var(--text-primary)" : "var(--text-muted)", fontVariantNumeric: "tabular-nums" }}>
        {has ? fmtLevel(value as number) : "NA"}
      </span>
    </span>
  );
}

// Two-letter rail tag drawn at the left edge of a level row. Colored glyph on a
// faint same-color fill (like LevelChip) so it stays legible in every theme —
// a solid fill with --text-inverse went white-on-amber in light palettes.
function RailTag({ meta }: { meta: (typeof LEVEL_META)[LevelKey] }) {
  return (
    <span
      title={meta.label}
      className="inline-flex items-center justify-center font-mono"
      style={{
        minWidth: 15,
        height: 12,
        padding: "0 2px",
        fontSize: 8,
        fontWeight: 800,
        letterSpacing: "0.02em",
        borderRadius: 2,
        color: meta.color,
        background: `color-mix(in srgb, ${meta.color} 18%, transparent)`,
        border: `1px solid color-mix(in srgb, ${meta.color} 55%, transparent)`,
        flex: "0 0 auto",
      }}
    >
      {meta.code}
    </span>
  );
}

function ChangeBadge({ changePercent, isPositive }: { changePercent?: number | null; isPositive?: boolean }) {
  if (changePercent == null || !Number.isFinite(changePercent)) return null;
  const pos = isPositive ?? changePercent >= 0;
  const color = pos ? "var(--color-bull)" : "var(--color-bear)";
  return (
    <span
      className="font-mono"
      style={{
        fontSize: 11,
        fontWeight: 700,
        padding: "1px 6px",
        borderRadius: "var(--radius-control)",
        color,
        background: `color-mix(in srgb, ${color} 14%, transparent)`,
        fontVariantNumeric: "tabular-nums",
        whiteSpace: "nowrap",
      }}
    >
      {pos ? "+" : ""}
      {changePercent.toFixed(2)}%
    </span>
  );
}

function RegimeChip({ spot, flip }: { spot: number | null; flip: number | null }) {
  if (spot == null || flip == null || !Number.isFinite(spot) || !Number.isFinite(flip)) return null;
  const long = spot >= flip;
  const color = long ? "var(--color-bull)" : "var(--color-bear)";
  return (
    <span className="zg-chip" style={{ ["--chip-color" as string]: color, fontSize: 9.5, padding: "1px 6px" }}>
      {long ? "Long Γ" : "Short Γ"}
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
  const { input, cellByOffset, arrowsByOffset, clip, gexScale, peakOffset } = model;
  const unitLabel = GEX_UNIT_LABEL[gexUnit];
  const lv = model.levelValues;

  return (
    <div className="min-w-0 flex flex-col">
      {/* Column header — dropdown + regime, then spot + change, then level legend */}
      <div
        className="px-2 pt-2 pb-2 flex flex-col gap-1.5"
        style={{ borderBottom: "1px solid var(--border-default)", background: "var(--bg-subtle)" }}
      >
        <div className="flex items-center justify-between gap-2 min-w-0">
          <div className="min-w-0">{input.control}</div>
          <RegimeChip spot={input.spot} flip={input.gammaFlip} />
        </div>
        <div className="flex items-baseline justify-between gap-2 min-w-0">
          <span
            className="font-mono truncate"
            style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", fontVariantNumeric: "tabular-nums", lineHeight: 1 }}
          >
            {input.spot != null ? `$${fmtSpot(input.spot)}` : "--"}
          </span>
          <ChangeBadge changePercent={input.changePercent} isPositive={input.isPositive} />
        </div>
        {/* Live level legend — the key for the on-row rail tags (GF/CW/PW/MP).
            All four always render (missing → "NA") so both columns stay the
            same size. */}
        <div className="flex flex-wrap gap-x-2.5 gap-y-1">
          {(["flip", "call", "put", "pain"] as LevelKey[]).map((k) => (
            <LevelChip key={k} meta={LEVEL_META[k]} value={lv[k]} />
          ))}
        </div>
      </div>

      {/* Sub-header: strike / net gex labels */}
      <div className="flex items-center justify-between px-2 py-1 text-[9px] uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
        <span>Strike</span>
        <span>Net GEX ({unitLabel})</span>
      </div>

      {input.error ? (
        <div className="px-2">
          <ErrorMessage message={input.error} />
        </div>
      ) : input.loading && cellByOffset.size === 0 ? (
        <div className="py-8">
          <LoadingSpinner />
        </div>
      ) : cellByOffset.size === 0 ? (
        <div className="text-center text-xs py-8" style={{ color: "var(--text-secondary)" }}>
          No strike data
        </div>
      ) : (
        <div>
          {offsets.map((o) => {
            const cell = cellByOffset.get(o);
            const arrows = arrowsByOffset.get(o) ?? [];
            const isCenter = o === 0;
            const isPeak = o === peakOffset;

            const bg = cell ? cellTint(cell.net_gex, clip) : "transparent";
            // The leading level for this row drives the inset rail color.
            const railColor = arrows.length > 0 ? LEVEL_META[arrows[0]].color : null;

            return (
              <div key={o} className="flex items-stretch" style={{ height: ROW_H }}>
                <div
                  className="flex-1 min-w-0 flex items-center justify-between gap-1 px-1.5 font-mono"
                  style={{
                    fontSize: 11,
                    background: bg,
                    color: "var(--text-primary)",
                    borderTop: "1px solid var(--bg-card)",
                    boxShadow: railColor ? `inset 3px 0 0 ${railColor}` : undefined,
                    outline: isCenter ? "1.5px solid var(--color-accent-hot)" : "none",
                    outlineOffset: -1.5,
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {cell ? (
                    <>
                      <span className="flex items-center gap-1 min-w-0">
                        {arrows.map((k) => (
                          <RailTag key={k} meta={LEVEL_META[k]} />
                        ))}
                        {isCenter ? (
                          <span
                            className="inline-flex items-center gap-0.5"
                            style={{
                              fontWeight: 700,
                              padding: "0.5px 5px",
                              borderRadius: "var(--radius-pill)",
                              background: "var(--text-primary)",
                              color: "var(--bg-card)",
                            }}
                          >
                            {fmtStrike(cell.strike)}
                            <span style={{ fontSize: 8, opacity: 0.8 }}>▸</span>
                          </span>
                        ) : (
                          <span className="font-semibold truncate">{fmtStrike(cell.strike)}</span>
                        )}
                      </span>
                      <span className="whitespace-nowrap flex items-center gap-0.5">
                        {fmtGex((cell.net_gex || 0) * gexScale)}
                        {isPeak && (
                          // currentColor (== the cell's text) so the star stays
                          // as readable as the number beside it on any tint.
                          <span title="Heaviest dealer gamma in view" style={{ color: "currentColor" }}>
                            ★
                          </span>
                        )}
                      </span>
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
    // Each column holds a 140px floor and grows to share the width; the two fit
    // any phone ≥ ~300px. On anything narrower the columns keep their floor and
    // this container scrolls the ladder horizontally instead of clipping it.
    <div className="overflow-x-auto">
      <div className="flex" style={{ gap: 1, background: "var(--border-default)" }}>
        <div style={{ flex: "1 1 140px", minWidth: 140, background: "var(--bg-card)" }}>
          <HeatmapColumn model={leftModel} offsets={offsets} gexUnit={gexUnit} />
        </div>
        <div style={{ flex: "1 1 140px", minWidth: 140, background: "var(--bg-card)" }}>
          <HeatmapColumn model={rightModel} offsets={offsets} gexUnit={gexUnit} />
        </div>
      </div>
    </div>
  );
}
