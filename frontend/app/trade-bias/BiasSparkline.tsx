'use client';

import { useMemo } from 'react';
import { TradeBiasHistoryRow } from './data';

// Lightweight, dependency-free intraday view of the signed bias over the
// session: an area around the 0-line, green above / red below, with the last
// point emphasized. (A richer Recharts view can replace this later — the
// composite page's IntradayChart is the template.)
export default function BiasSparkline({
  history,
  height = 160,
}: {
  history: TradeBiasHistoryRow[];
  height?: number;
}) {
  const width = 800; // viewBox width; the SVG scales to its container
  const pad = 6;

  const geom = useMemo(() => {
    if (history.length < 2) return null;
    const n = history.length;
    const midY = height / 2;
    const scaleY = (height / 2 - pad) / 100; // ±100 → half height
    const x = (i: number) => pad + (i / (n - 1)) * (width - 2 * pad);
    const y = (v: number) => midY - Math.max(-100, Math.min(100, v)) * scaleY;

    const pts = history.map((r, i) => ({ x: x(i), y: y(r.biasScore), v: r.biasScore }));
    const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
    // Area closes back along the 0-line so fills read as "distance from neutral".
    const area = `${line} L${pts[pts.length - 1].x.toFixed(1)},${midY} L${pts[0].x.toFixed(1)},${midY} Z`;
    const last = pts[pts.length - 1];
    return { pts, line, area, midY, last };
  }, [history, height]);

  if (!geom) {
    return (
      <div
        className="rounded-lg border flex items-center justify-center text-xs text-[var(--color-text-secondary)]"
        style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface-subtle)', height }}
      >
        Not enough history yet — the bias plots here as it accumulates.
      </div>
    );
  }

  const lastColor =
    geom.last.v > 0 ? 'var(--color-bull)' : geom.last.v < 0 ? 'var(--color-bear)' : 'var(--color-warning)';

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      style={{ width: '100%', height }}
      role="img"
      aria-label="Intraday bias trend"
    >
      <defs>
        <linearGradient id="biasFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--color-bull)" stopOpacity="0.35" />
          <stop offset="50%" stopColor="var(--color-bull)" stopOpacity="0.02" />
          <stop offset="50%" stopColor="var(--color-bear)" stopOpacity="0.02" />
          <stop offset="100%" stopColor="var(--color-bear)" stopOpacity="0.35" />
        </linearGradient>
      </defs>
      {/* neutral 0-line */}
      <line
        x1={pad}
        y1={geom.midY}
        x2={width - pad}
        y2={geom.midY}
        stroke="var(--color-border)"
        strokeWidth={1}
        strokeDasharray="4 4"
      />
      <path d={geom.area} fill="url(#biasFill)" />
      <path d={geom.line} fill="none" stroke="var(--color-text-secondary)" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
      <circle cx={geom.last.x} cy={geom.last.y} r={3.5} fill={lastColor} />
    </svg>
  );
}
