'use client';

import { useMemo } from 'react';
import type { ScoreHistoryPoint } from '@/core/signalHelpers';

interface SignalSparklineProps {
  points: ScoreHistoryPoint[];
  height?: number;
  min?: number;
  max?: number;
  strokeColor?: string;
  fillColor?: string;
}

export default function SignalSparkline({
  points,
  height = 48,
  min = -100,
  max = 100,
  strokeColor = 'var(--color-warning)',
  fillColor = 'rgba(255, 166, 0, 0.12)',
}: SignalSparklineProps) {
  const width = 200;

  const path = useMemo(() => {
    if (!points.length) return { line: '', area: '', lastX: 0, lastY: 0 };
    const n = points.length;
    const xs = points.map((_, i) => (n === 1 ? width / 2 : (i / (n - 1)) * width));
    const ys = points.map((p) => {
      const clamped = Math.max(min, Math.min(max, p.score));
      const t = (clamped - min) / (max - min);
      return height - t * height;
    });
    let line = '';
    xs.forEach((x, i) => {
      line += `${i === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${ys[i].toFixed(2)} `;
    });
    const zeroY = height - ((0 - min) / (max - min)) * height;
    const area = `${line} L ${xs[n - 1].toFixed(2)} ${zeroY.toFixed(2)} L ${xs[0].toFixed(2)} ${zeroY.toFixed(2)} Z`;
    return { line, area, lastX: xs[n - 1], lastY: ys[n - 1] };
  }, [points, height, min, max]);

  if (!points.length) {
    return (
      <div className="flex items-center justify-center text-[11px] text-[var(--color-text-secondary)]" style={{ height }}>
        No history yet
      </div>
    );
  }

  const zeroY = height - ((0 - min) / (max - min)) * height;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} preserveAspectRatio="none">
      <line x1={0} y1={zeroY} x2={width} y2={zeroY} stroke="var(--color-border)" strokeDasharray="2 3" strokeWidth={1} />
      <path d={path.area} fill={fillColor} stroke="none" />
      <path d={path.line} fill="none" stroke={strokeColor} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={path.lastX} cy={path.lastY} r={2.25} fill={strokeColor} />
    </svg>
  );
}
