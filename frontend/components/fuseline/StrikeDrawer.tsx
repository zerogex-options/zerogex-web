'use client';

import { useEffect, useRef, useState } from 'react';

import {
  formatGamma,
  formatSizeDelta,
  type ChangeWindow,
  type StrikeChange,
} from '@/core/fuselineRadar';
import { safeTimeLabel } from '@/core/flowSeriesCharts';

/**
 * One strike's story, opened from the ladder. Only one is open at a time, and
 * it sits under the chart rather than over it, so inspecting a strike never
 * hides the candles.
 *
 * Plots the numbers, not just labels: the strike's modeled net gamma through
 * the session, with the change window's start marked so the outline on the
 * ladder can be found on the line.
 */

export interface StrikeDrawerProps {
  title: string;
  subtitle: string;
  now: number | null;
  changes: Record<ChangeWindow, StrikeChange>;
  windowMin: ChangeWindow;
  rankText: string;
  /** 0DTE share of this strike's gross exposure, 0..1, or null if unknown. */
  zeroDteShare: number | null;
  routeText: string;
  /** Session history, oldest first. */
  history: { t: number; v: number }[];
  /** The newest reading's time, for the window-start marker. */
  nowT: number | null;
  onClose: () => void;
}

function changeText(c: StrikeChange): string {
  if (c.state === 'unavailable' || c.sizeDelta == null) return 'Unavailable';
  const pct = c.pct != null && c.state !== 'steady' ? ` (${c.pct >= 0 ? '+' : ''}${Math.round(c.pct * 100)}%)` : '';
  const word =
    c.state === 'strengthening' ? '▲ strengthening' : c.state === 'weakening' ? '▼ weakening' : 'within the threshold';
  return `${formatSizeDelta(c.sizeDelta)}${pct} · ${word}`;
}

function HistoryChart({ history, nowT, windowMin }: { history: { t: number; v: number }[]; nowT: number | null; windowMin: number }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(0);
  const [hover, setHover] = useState<{ x: number; t: number; v: number } | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver((e) => setWidth(Math.floor(e[0]?.contentRect.width ?? 0)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const W = Math.max(280, width || 600);
  const H = 170;
  const l = 60; const r = 12; const t = 14; const b = 22;
  if (history.length < 2) {
    return (
      <div ref={ref} className="py-6 text-center text-xs italic" style={{ color: 'var(--color-text-secondary)' }}>
        Not enough history for this strike yet.
      </div>
    );
  }
  const t0 = history[0].t;
  const t1 = Math.max(history[history.length - 1].t, nowT ?? 0);
  let mn = Math.min(0, ...history.map((p) => p.v));
  let mx = Math.max(0, ...history.map((p) => p.v));
  const pad = (mx - mn) * 0.12 || 1;
  mn -= pad; mx += pad;
  const x = (tt: number) => l + ((tt - t0) / Math.max(1, t1 - t0)) * (W - l - r);
  const y = (v: number) => t + ((mx - v) / (mx - mn)) * (H - t - b);
  const path = history.map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`).join('');
  const last = history[history.length - 1];
  const ws = nowT != null ? nowT - windowMin * 60_000 : null;
  const step = Math.max(30, Math.ceil(((t1 - t0) / 60_000) / 6 / 30) * 30) * 60_000;
  const ticks: number[] = [];
  for (let tt = Math.ceil(t0 / step) * step; tt <= t1; tt += step) ticks.push(tt);

  return (
    <div ref={ref} className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} role="img" aria-label="This strike's modeled net gamma through the session" style={{ display: 'block' }}>
        {[...new Set([Math.max(...history.map((p) => p.v)), 0, Math.min(...history.map((p) => p.v))])]
          .filter((v, i, all) => i === 0 || Math.abs(y(v) - y(all[i - 1])) > 12 || v === 0)
          .map((v) => (
          <g key={v}>
            <line x1={l} x2={W - r} y1={y(v)} y2={y(v)} stroke="var(--color-border)" strokeOpacity={v === 0 ? 1 : 0.45} />
            <text x={l - 6} y={y(v) + 3.5} textAnchor="end" fontSize={10} fill="var(--color-text-secondary)" style={{ fontFamily: 'var(--font-mono)' }}>
              {v === 0 ? '0' : formatGamma(v).replace('+', '')}
            </text>
          </g>
        ))}
        {ticks.map((tt) => (
          <text key={tt} x={x(tt)} y={H - 6} textAnchor="middle" fontSize={10} fill="var(--color-text-secondary)" style={{ fontFamily: 'var(--font-mono)' }}>
            {safeTimeLabel(new Date(tt).toISOString())}
          </text>
        ))}
        {ws != null && ws >= t0 && (
          <>
            <line x1={x(ws)} x2={x(ws)} y1={t} y2={H - b} stroke="var(--color-text-secondary)" strokeDasharray="3 3" />
            <text x={x(ws) - 4} y={t + 9} textAnchor="end" fontSize={10} fill="var(--color-text-secondary)">{windowMin} min ago</text>
          </>
        )}
        <path d={path} fill="none" stroke="var(--color-text-primary)" strokeWidth={2} strokeLinejoin="round" />
        <circle cx={x(last.t)} cy={y(last.v)} r={4.5} fill={last.v >= 0 ? 'var(--color-gamma-pos)' : 'var(--color-gamma-neg)'} stroke="var(--color-surface)" strokeWidth={2} />
        {hover && <line x1={hover.x} x2={hover.x} y1={t} y2={H - b} stroke="var(--color-text-secondary)" pointerEvents="none" />}
        <rect
          x={l}
          y={t}
          width={W - l - r}
          height={H - t - b}
          fill="transparent"
          onMouseMove={(e) => {
            const box = e.currentTarget.ownerSVGElement?.getBoundingClientRect();
            if (!box) return;
            const tt = t0 + (((e.clientX - box.left) / box.width) * W - l) / (W - l - r) * (t1 - t0);
            let best = history[0];
            for (const p of history) if (Math.abs(p.t - tt) < Math.abs(best.t - tt)) best = p;
            setHover({ x: x(best.t), t: best.t, v: best.v });
          }}
          onMouseLeave={() => setHover(null)}
        />
      </svg>
      {hover && (
        <div
          className="pointer-events-none absolute top-1 rounded-md border px-2 py-1 text-xs tabular-nums"
          style={{ left: Math.min(hover.x + 10, W - 130), backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
        >
          {safeTimeLabel(new Date(hover.t).toISOString())} ET · {formatGamma(hover.v)}
        </div>
      )}
    </div>
  );
}

export default function StrikeDrawer(props: StrikeDrawerProps) {
  const { title, subtitle, now, changes, windowMin, rankText, zeroDteShare, routeText, history, nowT, onClose } = props;
  const stats: [string, string][] = [
    ['Modeled net gamma now', now == null ? 'Unavailable' : `${formatGamma(now)} ${now >= 0 ? 'positive' : 'negative'}`],
    ['Change, 1 min', changeText(changes[1])],
    ['Change, 4 min', changeText(changes[4])],
    ['Change, 20 min', changeText(changes[20])],
    ['Size today', rankText],
    ['Expiry mix', zeroDteShare == null ? 'Loading…' : `0DTE ${Math.round(zeroDteShare * 100)}% · later ${100 - Math.round(zeroDteShare * 100)}%`],
    ['On your route', routeText],
    ['Against past sessions', 'Coming later'],
  ];
  return (
    <section
      className="mt-4 rounded-2xl border p-4"
      style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
      aria-label={`${title} history`}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h3 className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>
          {title}
          <span className="ml-2 text-xs font-normal" style={{ color: 'var(--color-text-secondary)' }}>{subtitle}</span>
        </h3>
        <button type="button" onClick={onClose} className="rounded px-2 py-1 text-xs max-sm:min-h-8" style={{ color: 'var(--color-text-secondary)' }}>
          Close
        </button>
      </div>
      <dl className="mt-3 grid gap-x-5 gap-y-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))' }}>
        {stats.map(([k, v]) => (
          <div key={k} className="min-w-0">
            <dt className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--color-text-secondary)' }}>{k}</dt>
            <dd className="mt-0.5 text-sm tabular-nums" style={{ color: 'var(--color-text-primary)' }}>{v}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-3">
        <HistoryChart history={history} nowT={nowT} windowMin={windowMin} />
      </div>
      <p className="mt-2 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
        Modeled from open interest, which updates once a day. Intraday strengthening or weakening is the same book
        repricing as price, time and volatility move, mostly as price moves nearer or farther. It is not positions
        opening or closing, and a large concentration does not guarantee a pin or a reaction.
      </p>
    </section>
  );
}
