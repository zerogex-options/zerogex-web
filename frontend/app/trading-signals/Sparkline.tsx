'use client';

/**
 * Tiny inline equity-curve sparkline.
 *
 * Purpose-built: hand-rolled SVG rather than a Recharts <ResponsiveContainer>
 * because at ~30 leaderboard rows the overhead of a full Recharts instance
 * per row noticeably janks the initial paint. The API is narrow — an array
 * of numbers + a color — and the mark stays honest (baseline reference line,
 * end-point dot, no chartjunk).
 */

import { useMemo } from 'react';

interface Props {
  values: number[];
  color: string;
  baseline?: number;
  width?: number;
  height?: number;
  showEndDot?: boolean;
  ariaLabel?: string;
}

export default function Sparkline({
  values,
  color,
  baseline,
  width = 96,
  height = 28,
  showEndDot = true,
  ariaLabel,
}: Props) {
  const path = useMemo(() => buildPath(values, width, height), [values, width, height]);
  const baselineY = useMemo(() => {
    if (baseline === undefined) return null;
    const [min, max] = extents(values);
    if (max === min) return height / 2;
    return height - ((baseline - min) / (max - min)) * height;
  }, [baseline, values, height]);

  const endDot = useMemo(() => {
    if (!showEndDot || values.length === 0) return null;
    const [min, max] = extents(values);
    const x = width - 1;
    const y = max === min ? height / 2 : height - ((values[values.length - 1] - min) / (max - min)) * height;
    return { x, y };
  }, [values, width, height, showEndDot]);

  if (values.length < 2) {
    return (
      <svg
        width={width}
        height={height}
        role="img"
        aria-label={ariaLabel ?? 'awaiting data'}
        style={{ display: 'block', overflow: 'visible' }}
      >
        <line
          x1={0}
          x2={width}
          y1={height / 2}
          y2={height / 2}
          stroke="var(--color-border)"
          strokeWidth={1}
          strokeDasharray="3 3"
        />
      </svg>
    );
  }

  return (
    <svg
      width={width}
      height={height}
      role="img"
      aria-label={ariaLabel ?? 'equity curve'}
      style={{ display: 'block', overflow: 'visible' }}
    >
      {baselineY !== null ? (
        <line
          x1={0}
          x2={width}
          y1={baselineY}
          y2={baselineY}
          stroke="var(--color-border)"
          strokeWidth={1}
          strokeDasharray="3 3"
        />
      ) : null}
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {endDot ? <circle cx={endDot.x} cy={endDot.y} r={2.2} fill={color} /> : null}
    </svg>
  );
}

function extents(values: number[]): [number, number] {
  let min = Infinity;
  let max = -Infinity;
  for (const v of values) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
  return [min, max];
}

function buildPath(values: number[], w: number, h: number): string {
  if (values.length === 0) return '';
  const [min, max] = extents(values);
  const range = max - min || 1;
  const step = values.length === 1 ? 0 : w / (values.length - 1);
  return values
    .map((v, i) => {
      const x = i * step;
      const y = h - ((v - min) / range) * h;
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(' ');
}
