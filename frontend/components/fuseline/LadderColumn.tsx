'use client';

import { useEffect, useRef, useState } from 'react';

import type { ChartSideColumnContext } from '@/components/GammaTerminalChart';
import {
  barFraction,
  formatLadderDelta,
  placeLabels,
  viewScale,
  type ChangeState,
  type Instrument,
  type LadderCurve,
  type LadderView,
} from '@/core/fuselineRadar';

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
 * marker on the next relevant strike. That is why Combined draws its net bar
 * in the sign colors rather than the dashboard rail's violet.
 *
 * Three views of the same strikes:
 * - Net: one bar, the strike's net gamma, outlined at the window start.
 * - Split: the call side to the right in blue and the put side to the left in
 *   amber, each outlined at the window start, so a strike whose net barely
 *   moved can still show both sides growing.
 * - Combined: both sides faded, with the net as a narrower solid bar on top
 *   and the net's outline.
 * The arrows and figures are the NET change in every view, so switching views
 * never changes which strikes are flagged.
 *
 * Bar SCALE (Barrie's request): by default the bars are normalized to the
 * strikes in view (core/fuselineRadar viewScale: the largest bar within twice
 * the 95th percentile), so a giant strike elsewhere no longer shrinks everything
 * on screen to a tick. An outlier past that is drawn full length with an end
 * cap and its value. With
 * normalizing off they measure against the whole board, as before. Either way
 * the scale eases to its new value as the reader pans and zooms rather than
 * jumping, and the ▲/▼ flags never depend on it: they measure against the
 * whole board, so zooming cannot change which strikes are flagged.
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
  /** The call and put sides now and at the window start (call >= 0, put <= 0). */
  call: number | null;
  put: number | null;
  callThen: number | null;
  putThen: number | null;
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
  view: LadderView;
  /** The whole-board scale: the largest net (Net) or the largest side (Split, Combined). */
  maxAbs: number;
  /** Scale to the strikes in view, clamping outliers, instead of the whole board. */
  normalize: boolean;
  curve: LadderCurve;
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

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;

/**
 * The scale as drawn: eases to each new target over a fifth of a second, in
 * log space so a tenfold change moves as evenly as a twofold one. A pan that
 * moves the target every frame simply keeps re-aiming the ease, which is what
 * reads as smooth. Snaps when the reader prefers reduced motion.
 */
function useEasedScale(target: number, ms = 200): number {
  const [shown, setShown] = useState(target);
  const shownRef = useRef(target);
  useEffect(() => {
    const from = shownRef.current;
    if (from === target) return;
    let id = 0;
    if (!(from > 0) || !(target > 0) || prefersReducedMotion()) {
      shownRef.current = target;
      id = requestAnimationFrame(() => setShown(target));
      return () => cancelAnimationFrame(id);
    }
    const a = Math.log(from);
    const b = Math.log(target);
    // The clock starts on the first frame, not when the target changed: the
    // render that moved the target can itself take longer than the whole ease,
    // and timing from before it would skip straight to the end.
    let t0: number | null = null;
    const step = () => {
      const now = performance.now();
      if (t0 == null) t0 = now;
      const u = Math.min(1, (now - t0) / ms);
      const v = Math.exp(a + (b - a) * (1 - (1 - u) ** 3));
      shownRef.current = v;
      setShown(v);
      if (u < 1) id = requestAnimationFrame(step);
    };
    id = requestAnimationFrame(step);
    return () => cancelAnimationFrame(id);
  }, [target, ms]);
  return shown;
}

/**
 * The sizes that set the view's scale: a row's solid bars, one vote each.
 * Outlines are left out, so a giant strike does not vote twice (bar and
 * outline) and pull the scale up to itself; an outline past the scale is
 * simply clipped with its bar.
 */
function drawnSizes(r: LadderRow, view: LadderView): (number | null)[] {
  if (view === 'net') return [r.now];
  if (view === 'split') return [r.call, r.put];
  return [r.call, r.put, r.now];
}

export default function LadderColumn({
  ctx, rows, view, maxAbs, normalize, curve, windowMin, display, selected, onSelect, describe, dimmed,
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
  const visible = rows.filter((r) => {
    const y = yPrice(r.price);
    return y >= top && y <= bottom;
  });
  // The scale: the strikes in view, or the whole board. An empty view falls
  // back to the board, so the bars never divide by nothing.
  const inView = normalize ? viewScale(visible.flatMap((r) => drawnSizes(r, view))) : 0;
  const scale = useEasedScale(Math.max(1, inView > 0 ? inView : maxAbs));
  const len = (v: number) => Math.max(1.5, barFraction(v, scale, curve).frac * half);
  const clipped = (v: number | null) => v != null && barFraction(v, scale, curve).clipped;
  const x0 = (v: number, l: number) => (v >= 0 ? cx : cx - l);
  const POS = 'var(--color-gamma-pos)';
  const NEG = 'var(--color-gamma-neg)';
  const outline = (x: number, w: number, y: number, k: string) => (
    <rect key={k} x={x} y={y - barH / 2 - 1.5} width={w} height={barH + 3} rx={2} fill="none" stroke="var(--text-secondary)" />
  );
  // One strike's bars for the chosen view. Calls always to the right and puts
  // always to the left, whatever sign the feed hands back.
  const bars = (r: LadderRow, y: number) => {
    const rx = Math.min(2, barH / 2);
    const net = (h: number) => {
      const ln = len(r.now);
      return <rect key="net" x={x0(r.now, ln)} y={y - h / 2} width={ln} height={h} rx={Math.min(2, h / 2)} fill={r.now >= 0 ? POS : NEG} />;
    };
    const netOutline = r.then != null ? outline(x0(r.then, len(r.then)), len(r.then), y, 'net-then') : null;
    if (view === 'net') return [net(barH), netOutline];
    const faded = view === 'combined' ? 0.35 : 1;
    const out = [];
    if (r.call != null) out.push(<rect key="call" x={cx} y={y - barH / 2} width={len(r.call)} height={barH} rx={rx} fill={POS} opacity={faded} />);
    if (r.put != null) out.push(<rect key="put" x={cx - len(r.put)} y={y - barH / 2} width={len(r.put)} height={barH} rx={rx} fill={NEG} opacity={faded} />);
    if (view === 'split') {
      if (r.callThen != null) out.push(outline(cx, len(r.callThen), y, 'call-then'));
      if (r.putThen != null) out.push(outline(cx - len(r.putThen), len(r.putThen), y, 'put-then'));
    } else {
      out.push(net(Math.max(2, barH * 0.5)), netOutline);
    }
    return out;
  };
  const mono = { fontFamily: 'var(--font-mono)' } as const;

  // Clipped bars: the solid bars that ran past the scale. Each gets a cap at
  // its tip and, where it fits, its size. Outlines are clipped silently: the
  // cap on the bar already says the row is off the scale.
  const solidBars = (r: LadderRow): { side: 1 | -1; v: number }[] => {
    if (view === 'net') return [{ side: r.now >= 0 ? 1 : -1, v: r.now }];
    const out: { side: 1 | -1; v: number }[] = [];
    if (r.call != null) out.push({ side: 1, v: r.call });
    if (r.put != null) out.push({ side: -1, v: r.put });
    if (view === 'combined') out.push({ side: r.now >= 0 ? 1 : -1, v: r.now });
    return out;
  };
  const clips = visible.flatMap((r) =>
    solidBars(r).filter((b) => clipped(b.v)).map((b) => ({ r, ...b, key: `${r.k}:${b.side}` })),
  );
  // One label per side of a row (Combined's net shares its side with a faded
  // bar, and the larger of the two is the one worth naming), placed biggest
  // first so neighbors never overprint.
  const clipLabelSets = ([1, -1] as const).map((side) => {
    const best = new Map<number, { v: number; y: number }>();
    for (const c of clips) {
      if (c.side !== side) continue;
      const v = Math.max(best.get(c.r.k)?.v ?? 0, Math.abs(c.v));
      best.set(c.r.k, { v, y: yPrice(c.r.price) });
    }
    return {
      side,
      best,
      kept: placeLabels([...best].map(([k, b]) => ({ key: k, y: b.y, priority: b.v })), font + 2),
    };
  });

  // Labels that fit. Strike numbers: the selected and next strikes first, then
  // round strikes, then the rest where there is room. Change figures: the
  // biggest changes first, faded rows after live ones. Anything that would
  // overprint a label already placed is left off; the bar's outline still
  // shows its change.
  const gapPx = font + 3;
  const strikeLabels = placeLabels(
    visible.map((r) => ({
      key: r.k,
      y: yPrice(r.price),
      priority: (selected === r.k ? 8 : 0) + (r.next ? 4 : 0) + (r.k % 25 === 0 ? 2 : 0) + (r.k % 10 === 0 ? 1 : 0),
    })),
    gapPx,
  );
  const changeLabels = placeLabels(
    visible
      .filter((r) => (r.state === 'strengthening' || r.state === 'weakening') && r.sizeDelta != null)
      .map((r) => ({
        key: r.k,
        y: yPrice(r.price),
        priority: Math.abs(r.sizeDelta ?? 0) * (r.faded ? 0.25 : 1) + (selected === r.k ? 1e15 : 0),
      })),
    gapPx,
  );

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
        <text x={right - 2} y={top - 8} textAnchor="end" fontSize={font} fill="var(--text-secondary)" style={mono}>
          {view === 'net' ? `${windowMin} min` : `${windowMin} min net`}
        </text>
      )}
      <line x1={cx} x2={cx} y1={top} y2={bottom} stroke="var(--border-default)" />
      <g opacity={dimmed ? 0.35 : 1}>
        {visible.map((r) => {
          const y = yPrice(r.price);
          const showLabel = strikeLabels.has(r.k);
          const showChange = changeLabels.has(r.k);
          return (
            <g key={r.k} opacity={r.faded && selected !== r.k ? 0.4 : 1}>
              {bars(r, y)}
              {clips.filter((c) => c.r.k === r.k).map((c) => {
                const tip = cx + c.side * half;
                return <line key={`cap${c.key}`} x1={tip} x2={tip} y1={y - barH / 2 - 2} y2={y + barH / 2 + 2} stroke="var(--text-primary)" strokeWidth={1.5} />;
              })}
              {clipLabelSets.map(({ side, best, kept }) => {
                if (!kept.has(r.k)) return null;
                const text = formatLadderDelta(best.get(r.k)?.v ?? 0);
                const w = text.length * (font - 1) * 0.62 + 4;
                const tip = cx + side * half;
                const x = side > 0 ? tip - 3 - w : tip + 3;
                return (
                  <g key={`clip${side}`} pointerEvents="none">
                    <rect x={x} y={y - (font - 1) / 2 - 1.5} width={w} height={font + 2} rx={2} fill="var(--bg-card)" opacity={0.85} />
                    <text x={x + 2} y={y + (font - 1) * 0.35} fontSize={font - 1} fill="var(--text-primary)" style={mono}>{text}</text>
                  </g>
                );
              })}
              {showLabel && (
                <text x={left + 2} y={y + font * 0.35} fontSize={font} fill="var(--text-primary)" style={mono}>{r.label}</text>
              )}
              {showChange && (
                <text x={right - 2} y={y + font * 0.35} textAnchor="end" fontSize={chgW ? font : font - 1} fill="var(--text-primary)" style={mono}>
                  {r.state === 'strengthening' ? '▲' : '▼'}{chgW > 0 && r.sizeDelta != null ? ` ${formatLadderDelta(r.sizeDelta)}` : ''}
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
