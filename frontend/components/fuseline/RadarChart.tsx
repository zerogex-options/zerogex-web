'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

import {
  niceStep,
  formatPrice,
  formatSizeDelta,
  type Candle,
  type ChangeState,
  type Instrument,
  type PlanLevels,
} from '@/core/fuselineRadar';
import { safeTimeLabel } from '@/core/flowSeriesCharts';

/**
 * The radar's main canvas, Layout A: a conventional time-by-price candle chart
 * with the trade plan drawn on it, and the gamma ladder to the right of the
 * price axis on the same price scale.
 *
 * Three channels, never mixed: SIGN is the bar's color (blue positive, amber
 * negative, --color-gamma-*), CHANGE is shape (the outline is the window
 * start, the arrows mark a change past the threshold), and the PLAN is the
 * site's purple (--color-king): the Fuse, the targets, the route bands and the
 * marker on the next relevant strike. Candles stay neutral so none of the
 * three has to compete with price.
 *
 * Hand-rolled SVG like the site's other candle charts: Recharts has no candle,
 * and the ladder has to share the chart's exact price scale.
 */

export interface LadderRow {
  /** SPX strike, the row's identity. */
  k: number;
  /** Where the row sits on the displayed price axis. */
  price: number;
  label: string;
  now: number;
  then: number | null;
  state: ChangeState;
  sizeDelta: number | null;
  /** Behind the Fuse, past the last target, or too small to matter today. */
  faded: boolean;
  /** The next relevant strike on the route. */
  next: boolean;
}

export interface RadarChartProps {
  candles: Candle[];
  /** Epoch ms at the left and right edges of the time axis. */
  xFrom: number;
  xTo: number;
  /** The newest terrain reading, drawn as the Now line. */
  nowT: number | null;
  candleMinutes: number;
  yRange: [number, number];
  levels: PlanLevels;
  spot: number | null;
  refs: { name: string; price: number }[];
  rows: LadderRow[];
  maxAbs: number;
  showLadder: boolean;
  windowMin: number;
  display: Instrument;
  selected: number | null;
  onSelect: (k: number | null) => void;
  /** Hover content for one ladder row. */
  describeRow: (row: LadderRow) => ReactNode;
}

interface Tip {
  x: number;
  y: number;
  content: ReactNode;
}

function useWidth<T extends HTMLElement>(): [React.RefObject<T | null>, number] {
  const ref = useRef<T | null>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = Math.floor(entries[0]?.contentRect.width ?? 0);
      setWidth((prev) => (prev === w ? prev : w));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width];
}

const MIN = 60_000;
const iso = (ms: number) => new Date(ms).toISOString();

export default function RadarChart(props: RadarChartProps) {
  const {
    candles, xFrom, xTo, nowT, candleMinutes, yRange, levels, spot, refs, rows, maxAbs,
    showLadder, windowMin, display, selected, onSelect, describeRow,
  } = props;
  const [wrapRef, measured] = useWidth<HTMLDivElement>();
  const [tip, setTip] = useState<Tip | null>(null);
  const [crossX, setCrossX] = useState<number | null>(null);

  const W = Math.max(300, measured || 900);
  const phone = W < 640;
  const H = phone ? 400 : 480;
  const top = 22;
  const bottom = 24;
  const axisW = phone ? 52 : 62;
  const ladderW = showLadder ? Math.round(Math.min(230, Math.max(phone ? 120 : 176, W * 0.24))) : 0;
  const sideW = ladderW ? ladderW + 10 : 0;
  const plotL = 0;
  const plotR = W - sideW - axisW;
  const plotW = plotR - plotL;
  const axisL = plotR;
  const ladderL = W - ladderW;
  const yb = H - bottom;
  const [lo, hi] = yRange;
  const y = (p: number) => top + ((hi - p) / (hi - lo)) * (yb - top);
  const x = (t: number) => plotL + ((t - xFrom) / Math.max(1, xTo - xFrom)) * plotW;
  const inView = (p: number | null): p is number => p != null && p >= lo && p <= hi;

  const showTip = (e: React.MouseEvent, content: ReactNode) => {
    const box = wrapRef.current?.getBoundingClientRect();
    if (!box) return;
    let tx = e.clientX - box.left + 14;
    let ty = e.clientY - box.top + 14;
    if (tx > box.width - 270) tx = e.clientX - box.left - 270;
    if (ty > box.height - 120) ty = e.clientY - box.top - 120;
    setTip({ x: Math.max(4, tx), y: Math.max(4, ty), content });
  };

  // Price grid.
  const step = niceStep(hi - lo);
  const grid: number[] = [];
  for (let p = Math.ceil(lo / step) * step; p <= hi; p += step) grid.push(p);

  // Time labels on the half hour, or the hour when narrow.
  const tStep = (plotW < 420 ? 60 : 30) * MIN;
  const ticks: number[] = [];
  for (let t = Math.ceil(xFrom / tStep) * tStep; t <= xTo; t += tStep) ticks.push(t);

  const slotW = (plotW * candleMinutes * MIN) / Math.max(1, xTo - xFrom);
  const bodyW = Math.max(2, slotW * 0.62);
  const { fuse, t1, t2 } = levels;
  const routeOn = fuse != null && t1 != null && spot != null;

  const band = (a: number, b: number, opacity: number, key: string) => (
    <rect
      key={key}
      x={plotL}
      width={plotW}
      y={y(Math.max(a, b))}
      height={Math.abs(y(a) - y(b))}
      fill="var(--color-king)"
      fillOpacity={opacity}
      clipPath="url(#fr-plot)"
    />
  );

  const planLine = (p: number | null, label: string, dashed: boolean) => {
    if (!inView(p)) return null;
    const yy = y(p);
    const text = `${label} ${formatPrice(p)}`;
    const tw = text.length * 6.4 + 12;
    return (
      <g key={label}>
        <line x1={plotL} x2={axisL} y1={yy} y2={yy} stroke="var(--color-king)" strokeWidth={dashed ? 1.5 : 2} strokeDasharray={dashed ? '7 4' : undefined} />
        <rect x={plotL + 6} y={yy - 9} width={tw} height={16} rx={4} fill="var(--color-surface)" stroke="var(--color-king)" />
        <text x={plotL + 12} y={yy + 3} fontSize={10} fontWeight={600} fill="var(--color-king)" style={{ fontFamily: 'var(--font-mono)' }}>
          {text}
        </text>
      </g>
    );
  };

  // Ladder geometry.
  // Row height from the real strike spacing: 5 SPX points near spot, a hair
  // more once carried onto ES, wider where the listing thins out.
  let gap = Infinity;
  for (let i = 1; i < rows.length; i += 1) {
    const d = Math.abs(rows[i].price - rows[i - 1].price);
    if (d > 0) gap = Math.min(gap, d);
  }
  if (!Number.isFinite(gap)) gap = 5;
  const rowSp = (gap / (hi - lo)) * (yb - top);
  const barH = Math.max(3, Math.min(12, rowSp * 0.5));
  const labelW = phone ? 40 : 46;
  const chgW = phone ? 0 : 54;
  const barArea = ladderW - labelW - chgW;
  const cx = ladderL + labelW + barArea / 2;
  const half = barArea / 2 - 4;
  const len = (v: number) => Math.max(1.5, (Math.abs(v) / Math.max(1, maxAbs)) * half);
  const left = (v: number, l: number) => (v >= 0 ? cx : cx - l);
  const visibleRows = rows.filter((r) => inView(r.price));

  const select = (k: number) => {
    setTip(null);
    onSelect(selected === k ? null : k);
  };

  const onPlotMove = (e: React.MouseEvent<SVGRectElement>) => {
    const svg = e.currentTarget.ownerSVGElement;
    if (!svg || candles.length === 0) return;
    const box = svg.getBoundingClientRect();
    const px = ((e.clientX - box.left) / box.width) * W;
    const t = xFrom + ((px - plotL) / plotW) * (xTo - xFrom);
    let best = candles[0];
    for (const c of candles) if (c.t <= t) best = c;
    setCrossX(x(best.t + (candleMinutes * MIN) / 2));
    showTip(
      e,
      <>
        <div className="font-semibold">{safeTimeLabel(iso(best.t))} ET · {candleMinutes}-min candle</div>
        <div className="tabular-nums" style={{ color: 'var(--color-text-secondary)' }}>
          O {formatPrice(best.o)} H {formatPrice(best.h)} L {formatPrice(best.l)} C {formatPrice(best.c)}
        </div>
      </>,
    );
  };

  return (
    <div ref={wrapRef} className="relative w-full">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        height={H}
        role="img"
        aria-label="Price chart with your trade plan and the modeled gamma ladder"
        style={{ display: 'block' }}
      >
        <defs>
          <clipPath id="fr-plot">
            <rect x={plotL} y={top} width={plotW} height={yb - top} />
          </clipPath>
        </defs>
        <rect x={plotL} y={top} width={plotW} height={yb - top} fill="var(--color-surface-subtle)" stroke="var(--color-border)" strokeOpacity={0.5} />

        {grid.map((p) => (
          <g key={`g${p}`}>
            <line x1={plotL} x2={axisL} y1={y(p)} y2={y(p)} stroke="var(--color-border)" strokeOpacity={0.45} />
            <text x={axisL + 6} y={y(p) + 3.5} fontSize={10} fill="var(--color-text-secondary)" style={{ fontFamily: 'var(--font-mono)' }}>
              {step < 5 ? p.toFixed(1) : p.toFixed(0)}
            </text>
          </g>
        ))}

        {/* Route bands: purple is the plan's channel and nothing else's. */}
        {routeOn && band(fuse, spot, 0.045, 'b-retrace')}
        {routeOn && band(spot, t1, 0.09, 'b-active')}
        {routeOn && t2 != null && band(t1, t2, 0.045, 'b-ext')}

        {/* Reference levels carry the names; the ladder carries the change. */}
        {refs.filter((r) => inView(r.price)).map((r) => (
          <g key={r.name}>
            <line x1={plotL} x2={plotR} y1={y(r.price)} y2={y(r.price)} stroke="var(--color-text-secondary)" strokeDasharray="1.5 3" />
            <text x={plotR - 6} y={y(r.price) - 4} textAnchor="end" fontSize={10} fill="var(--color-text-secondary)">
              {r.name}
            </text>
          </g>
        ))}

        {/* Candles, neutral, so color stays free for the terrain. */}
        <g clipPath="url(#fr-plot)">
          {candles.map((c) => {
            const mid = x(c.t + (candleMinutes * MIN) / 2);
            const up = c.c >= c.o;
            const yt = y(Math.max(c.o, c.c));
            const hh = Math.max(1, Math.abs(y(c.o) - y(c.c)));
            return (
              <g key={c.t} opacity={0.8}>
                <line x1={mid} x2={mid} y1={y(c.h)} y2={y(c.l)} stroke="var(--color-text-primary)" />
                <rect
                  x={mid - bodyW / 2}
                  y={yt}
                  width={bodyW}
                  height={hh}
                  fill={up ? 'var(--color-surface-subtle)' : 'var(--color-text-primary)'}
                  stroke="var(--color-text-primary)"
                />
              </g>
            );
          })}
        </g>

        {nowT != null && nowT >= xFrom && nowT <= xTo && (
          <>
            <line x1={x(nowT)} x2={x(nowT)} y1={top} y2={yb} stroke="var(--color-border)" strokeDasharray="3 3" />
            <text x={x(nowT)} y={top - 8} textAnchor="middle" fontSize={10} fill="var(--color-text-secondary)" style={{ fontFamily: 'var(--font-mono)' }}>
              {safeTimeLabel(iso(nowT))}
            </text>
          </>
        )}

        {selected != null && (() => {
          const row = rows.find((r) => r.k === selected);
          return row && inView(row.price) ? (
            <line x1={plotL} x2={axisL} y1={y(row.price)} y2={y(row.price)} stroke="var(--color-text-primary)" strokeOpacity={0.35} strokeDasharray="2 4" />
          ) : null;
        })()}

        {planLine(fuse, 'Fuse', false)}
        {planLine(t1, 'T1', true)}
        {planLine(t2, 'T2', true)}

        {inView(spot) && (
          <g>
            <line x1={plotL} x2={axisL} y1={y(spot)} y2={y(spot)} stroke="var(--color-text-primary)" strokeDasharray="2 2" />
            <rect x={axisL + 2} y={y(spot) - 8} width={axisW - 4} height={16} rx={3} fill="var(--color-text-primary)" />
            <text x={axisL + 6} y={y(spot) + 3.5} fontSize={10} fontWeight={600} fill="var(--color-surface)" style={{ fontFamily: 'var(--font-mono)' }}>
              {spot.toFixed(phone ? 1 : 2)}
            </text>
          </g>
        )}

        {ticks.map((t, i) => (
          <text key={t} x={x(t)} y={H - 8} textAnchor={i === 0 && x(t) < 20 ? 'start' : 'middle'} fontSize={10} fill="var(--color-text-secondary)" style={{ fontFamily: 'var(--font-mono)' }}>
            {safeTimeLabel(iso(t))}
          </text>
        ))}

        {crossX != null && <line x1={crossX} x2={crossX} y1={top} y2={yb} stroke="var(--color-text-secondary)" strokeOpacity={0.6} pointerEvents="none" />}
        <rect
          x={plotL}
          y={top}
          width={plotW}
          height={yb - top}
          fill="transparent"
          onMouseMove={onPlotMove}
          onMouseLeave={() => { setCrossX(null); setTip(null); }}
        />

        {/* The ladder: same price scale, one row per strike in view. */}
        {ladderW > 0 && (
          <g>
            <text x={ladderL + 2} y={top - 8} fontSize={10} fill="var(--color-text-secondary)" style={{ fontFamily: 'var(--font-mono)' }}>
              {display} strike
            </text>
            {chgW > 0 && (
              <text x={W - 2} y={top - 8} textAnchor="end" fontSize={10} fill="var(--color-text-secondary)" style={{ fontFamily: 'var(--font-mono)' }}>
                {windowMin} min
              </text>
            )}
            <line x1={cx} x2={cx} y1={top} y2={yb} stroke="var(--color-border)" />
            {visibleRows.map((r) => {
              const yy = y(r.price);
              const ln = len(r.now);
              const showLabel = rowSp >= 12 || r.k % 10 === 0 || r.next || selected === r.k;
              const changed = r.state === 'strengthening' || r.state === 'weakening';
              return (
                <g key={r.k} opacity={r.faded && selected !== r.k ? 0.4 : 1}>
                  <rect x={left(r.now, ln)} y={yy - barH / 2} width={ln} height={barH} rx={Math.min(2, barH / 2)} fill={r.now >= 0 ? 'var(--color-gamma-pos)' : 'var(--color-gamma-neg)'} />
                  {r.then != null && (
                    <rect x={left(r.then, len(r.then))} y={yy - barH / 2 - 1.5} width={len(r.then)} height={barH + 3} rx={2} fill="none" stroke="var(--color-text-secondary)" />
                  )}
                  {showLabel && (
                    <text x={ladderL + 2} y={yy + 3.5} fontSize={10} fill="var(--color-text-primary)" style={{ fontFamily: 'var(--font-mono)' }}>
                      {r.label}
                    </text>
                  )}
                  {chgW > 0 && changed && r.sizeDelta != null && (
                    <text x={W - 2} y={yy + 3.5} textAnchor="end" fontSize={10} fill="var(--color-text-primary)" style={{ fontFamily: 'var(--font-mono)' }}>
                      {r.state === 'strengthening' ? '▲' : '▼'} {formatSizeDelta(r.sizeDelta).replace(/^[+-]/, '')}
                    </text>
                  )}
                  {chgW === 0 && changed && (
                    <text x={W - 2} y={yy + 3.5} textAnchor="end" fontSize={8} fill="var(--color-text-primary)">
                      {r.state === 'strengthening' ? '▲' : '▼'}
                    </text>
                  )}
                  {r.next && <circle cx={ladderL - 4} cy={yy} r={3} fill="var(--color-king)" />}
                </g>
              );
            })}
            {selected != null && (() => {
              const r = visibleRows.find((q) => q.k === selected);
              return r ? (
                <rect x={ladderL - 8 + 1} y={y(r.price) - rowSp / 2 + 1} width={ladderW + 8 - 2} height={rowSp - 2} rx={4} fill="none" stroke="var(--color-text-secondary)" />
              ) : null;
            })()}
            {visibleRows.map((r) => (
              <rect
                key={`hit${r.k}`}
                x={ladderL - 8}
                y={y(r.price) - rowSp / 2}
                width={ladderW + 8}
                height={rowSp}
                rx={4}
                fill="transparent"
                className="cursor-pointer outline-none focus-visible:stroke-[var(--color-king)]"
                role="button"
                tabIndex={0}
                aria-label={`${display} ${r.label}: open its history`}
                aria-pressed={selected === r.k}
                onMouseMove={(e) => showTip(e, describeRow(r))}
                onMouseLeave={() => setTip(null)}
                onClick={() => select(r.k)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(r.k); }
                }}
              />
            ))}
          </g>
        )}
      </svg>
      {tip && (
        <div
          className="pointer-events-none absolute z-10 max-w-[260px] rounded-lg border px-2.5 py-2 text-xs shadow-lg"
          style={{ left: tip.x, top: tip.y, backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
        >
          {tip.content}
        </div>
      )}
    </div>
  );
}
