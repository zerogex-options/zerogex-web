'use client';

import { useState } from 'react';

import type { ChartSideColumnContext } from '@/components/GammaTerminalChart';
import { formatSizeDelta, type ChangeState, type Instrument } from '@/core/fuselineRadar';

/**
 * The Fuseline Radar's gamma ladder, drawn inside the dashboard chart in the
 * column the gamma rail uses elsewhere (GammaTerminalChart's `sideColumn`).
 * Drawing it there is what keeps it honest: it reads the chart's own price
 * scale on every render, so it follows the reader's zoom and pan exactly and
 * goes to full screen with the candles.
 *
 * Three channels, never mixed: SIGN is the bar's color (blue positive, amber
 * negative), CHANGE is shape (the outline is the window start, the arrows mark
 * a change past the threshold), and the PLAN is the site purple, here only the
 * marker on the next relevant strike.
 *
 * Pointer events stop at the column, so hovering or clicking a strike never
 * pans the chart, moves its crosshair, or resets its zoom.
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

export interface LadderColumnProps {
  ctx: ChartSideColumnContext;
  rows: LadderRow[];
  maxAbs: number;
  windowMin: number;
  display: Instrument;
  selected: number | null;
  onSelect: (k: number | null) => void;
  /** The hover card's lines for one row, first line bold. */
  describe: (row: LadderRow) => string[];
  /** The chart is rewound: the ladder is still live, so it steps back. */
  dimmed: boolean;
}

const stop = (e: { stopPropagation: () => void }) => e.stopPropagation();

export default function LadderColumn({
  ctx, rows, maxAbs, windowMin, display, selected, onSelect, describe, dimmed,
}: LadderColumnProps) {
  const [hoverK, setHoverK] = useState<number | null>(null);
  const { left, right, top, bottom, yPrice, compact } = ctx;
  const width = right - left;
  const font = compact ? 9 : 10;
  const labelW = compact ? 36 : 46;
  const chgW = compact || width < 170 ? 0 : 52;
  const barArea = width - labelW - chgW;
  const cx = left + labelW + barArea / 2;
  const half = Math.max(4, barArea / 2 - 4);

  // Row height from the real strike spacing at the chart's current zoom.
  let gap = Infinity;
  for (let i = 1; i < rows.length; i += 1) {
    const d = Math.abs(yPrice(rows[i].price) - yPrice(rows[i - 1].price));
    if (d > 0) gap = Math.min(gap, d);
  }
  const rowSp = Number.isFinite(gap) ? gap : 12;
  const barH = Math.max(2.5, Math.min(11, rowSp * 0.5));
  const len = (v: number) => Math.max(1.5, (Math.abs(v) / Math.max(1, maxAbs)) * half);
  const x0 = (v: number, l: number) => (v >= 0 ? cx : cx - l);
  const visible = rows.filter((r) => {
    const y = yPrice(r.price);
    return y >= top && y <= bottom;
  });
  const mono = { fontFamily: 'var(--font-mono)' } as const;

  const hovered = hoverK != null ? visible.find((r) => r.k === hoverK) ?? null : null;
  const card = (() => {
    if (!hovered) return null;
    const lines = describe(hovered);
    const lh = font + 4;
    // Sized to its longest line (monospace), so no line runs off the card.
    const w = Math.max(...lines.map((t) => t.length)) * font * 0.62 + 16;
    const h = lines.length * lh + 10;
    const x = Math.max(4, left - w - 8);
    const y = Math.min(Math.max(top, yPrice(hovered.price) - h / 2), bottom - h);
    return (
      <g pointerEvents="none">
        <rect x={x} y={y} width={w} height={h} rx={5} fill="var(--bg-card)" stroke="var(--border-default)" opacity={0.97} />
        {lines.map((t, i) => (
          <text key={i} x={x + 8} y={y + 6 + lh * (i + 1) - 3} fontSize={font} fill={i === 0 ? 'var(--text-primary)' : 'var(--text-secondary)'} fontWeight={i === 0 ? 600 : 400} style={mono}>
            {t}
          </text>
        ))}
      </g>
    );
  })();

  return (
    <g
      onMouseDown={stop}
      onMouseMove={stop}
      onPointerDown={stop}
      onPointerMove={stop}
      onDoubleClick={stop}
      onWheel={stop}
      aria-label={`Modeled gamma ladder, ${display} strikes`}
    >
      <rect x={left - 6} y={top} width={width + 6} height={bottom - top} fill="var(--bg-subtle)" opacity={0.55} />
      <text x={left + 2} y={top - 8} fontSize={font} fill="var(--text-secondary)" style={mono}>{display} strike</text>
      {chgW > 0 && (
        <text x={right - 2} y={top - 8} textAnchor="end" fontSize={font} fill="var(--text-secondary)" style={mono}>{windowMin} min</text>
      )}
      <line x1={cx} x2={cx} y1={top} y2={bottom} stroke="var(--border-default)" />
      <g opacity={dimmed ? 0.35 : 1}>
        {visible.map((r) => {
          const y = yPrice(r.price);
          const ln = len(r.now);
          const changed = r.state === 'strengthening' || r.state === 'weakening';
          const showLabel = rowSp >= font + 2 || r.k % 10 === 0 || r.next || selected === r.k;
          return (
            <g key={r.k} opacity={r.faded && selected !== r.k ? 0.4 : 1}>
              <rect x={x0(r.now, ln)} y={y - barH / 2} width={ln} height={barH} rx={Math.min(2, barH / 2)} fill={r.now >= 0 ? 'var(--color-gamma-pos)' : 'var(--color-gamma-neg)'} />
              {r.then != null && (
                <rect x={x0(r.then, len(r.then))} y={y - barH / 2 - 1.5} width={len(r.then)} height={barH + 3} rx={2} fill="none" stroke="var(--text-secondary)" />
              )}
              {showLabel && (
                <text x={left + 2} y={y + font * 0.35} fontSize={font} fill="var(--text-primary)" style={mono}>{r.label}</text>
              )}
              {changed && (
                <text x={right - 2} y={y + font * 0.35} textAnchor="end" fontSize={chgW ? font : font - 1} fill="var(--text-primary)" style={mono}>
                  {r.state === 'strengthening' ? '▲' : '▼'}{chgW > 0 && r.sizeDelta != null ? ` ${formatSizeDelta(r.sizeDelta).replace(/^[+-]/, '')}` : ''}
                </text>
              )}
              {r.next && <circle cx={left - 2} cy={y} r={3} fill="var(--color-king)" />}
            </g>
          );
        })}
        {selected != null && (() => {
          const r = visible.find((q) => q.k === selected);
          if (!r) return null;
          const y = yPrice(r.price);
          return <rect x={left - 5} y={y - rowSp / 2 + 1} width={width + 4} height={Math.max(4, rowSp - 2)} rx={4} fill="none" stroke="var(--text-secondary)" />;
        })()}
      </g>
      {dimmed && (
        <text x={left + width / 2} y={bottom - 6} textAnchor="middle" fontSize={font - 1} fill="var(--text-secondary)">
          Live ladder · rewind moves the chart only
        </text>
      )}
      {visible.map((r) => {
        const y = yPrice(r.price);
        return (
          <rect
            key={`hit${r.k}`}
            x={left - 6}
            y={y - rowSp / 2}
            width={width + 6}
            height={Math.max(4, rowSp)}
            fill="transparent"
            className="cursor-pointer outline-none"
            role="button"
            tabIndex={0}
            aria-label={`${display} ${r.label}: open its history`}
            aria-pressed={selected === r.k}
            onMouseEnter={() => setHoverK(r.k)}
            onMouseLeave={() => setHoverK((k) => (k === r.k ? null : k))}
            onFocus={() => setHoverK(r.k)}
            onBlur={() => setHoverK((k) => (k === r.k ? null : k))}
            onClick={() => { setHoverK(null); onSelect(selected === r.k ? null : r.k); }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(selected === r.k ? null : r.k); }
            }}
          />
        );
      })}
      {card}
    </g>
  );
}
