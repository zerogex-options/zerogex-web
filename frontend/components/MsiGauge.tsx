'use client';

import { useMemo } from 'react';

interface MsiGaugeProps {
  score: number | null;
  size?: number;
  label?: string;
  subLabel?: string;
}

function regimeBand(score: number | null): { label: string; color: string; description: string } {
  if (score == null || !Number.isFinite(score)) {
    return { label: 'No data', color: 'var(--color-text-secondary)', description: 'No reading available.' };
  }
  if (score >= 70) return { label: 'Trend / Expansion', color: 'var(--color-bull)', description: 'Directional trades in prevailing bias.' };
  if (score >= 40) return { label: 'Controlled Trend', color: '#75cfa1', description: 'Moderate directional edge; size down.' };
  if (score >= 20) return { label: 'Chop / Range', color: 'var(--color-warning)', description: 'Fade extremes; avoid trend trades.' };
  return { label: 'High-Risk Reversal', color: 'var(--color-bear)', description: 'Broken or dislocated; mean-reversion only.' };
}

export default function MsiGauge({ score, size = 260, label = 'Composite Score', subLabel }: MsiGaugeProps) {
  const radius = size / 2 - 16;
  const cx = size / 2;
  const cy = size / 2;
  const strokeWidth = Math.max(14, size * 0.06);
  const startAngle = 180;
  const endAngle = 360;
  const angleRange = endAngle - startAngle;

  const band = regimeBand(score);
  const safeScore = score != null && Number.isFinite(score) ? Math.max(0, Math.min(100, score)) : null;

  const segments = useMemo(() => {
    const arcs = [
      { from: 0, to: 20, color: 'var(--color-bear)' },
      { from: 20, to: 40, color: 'var(--color-warning)' },
      { from: 40, to: 70, color: '#75cfa1' },
      { from: 70, to: 100, color: 'var(--color-bull)' },
    ];
    return arcs.map((a) => arcPath(cx, cy, radius, startAngle + (a.from / 100) * angleRange, startAngle + (a.to / 100) * angleRange));
  }, [cx, cy, radius, angleRange]);

  const needleAngle = safeScore != null ? startAngle + (safeScore / 100) * angleRange : startAngle + 90;
  const needlePos = polar(cx, cy, radius - strokeWidth / 2 - 2, needleAngle);

  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size / 1.6} viewBox={`0 0 ${size} ${size / 1.6}`}>
        {/* track */}
        <path
          d={arcPath(cx, cy, radius, startAngle, endAngle)}
          stroke="var(--color-border)"
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
        />
        {/* colored segments */}
        {[
          { from: 0, to: 20, color: 'var(--color-bear)' },
          { from: 20, to: 40, color: 'var(--color-warning)' },
          { from: 40, to: 70, color: '#75cfa1' },
          { from: 70, to: 100, color: 'var(--color-bull)' },
        ].map((seg, i) => (
          <path
            key={i}
            d={segments[i]}
            stroke={seg.color}
            strokeWidth={strokeWidth}
            fill="none"
            strokeLinecap="butt"
            opacity={0.88}
          />
        ))}
        {/* tick labels */}
        {[0, 20, 40, 70, 100].map((v) => {
          const a = startAngle + (v / 100) * angleRange;
          const outer = polar(cx, cy, radius + strokeWidth / 2 + 10, a);
          return (
            <text
              key={v}
              x={outer.x}
              y={outer.y}
              fill="var(--color-text-secondary)"
              fontSize={11}
              textAnchor="middle"
              dominantBaseline="middle"
            >
              {v}
            </text>
          );
        })}
        {/* needle */}
        {safeScore != null && (
          <g>
            <line x1={cx} y1={cy} x2={needlePos.x} y2={needlePos.y} stroke="var(--color-text-primary)" strokeWidth={3} strokeLinecap="round" />
            <circle cx={cx} cy={cy} r={6} fill="var(--color-text-primary)" />
          </g>
        )}
      </svg>
      <div className="-mt-4 text-center">
        <div className="text-5xl font-black leading-none" style={{ color: band.color }}>
          {safeScore != null ? safeScore.toFixed(2) : '—'}
        </div>
        <div className="text-xs uppercase tracking-[0.18em] text-[var(--color-text-secondary)] mt-2">{label}</div>
        <div className="mt-1 text-sm font-semibold" style={{ color: band.color }}>{band.label}</div>
        {subLabel ? (
          <div className="text-xs text-[var(--color-text-secondary)] mt-0.5">{subLabel}</div>
        ) : (
          <div className="text-xs text-[var(--color-text-secondary)] mt-0.5">{band.description}</div>
        )}
      </div>
    </div>
  );
}

function polar(cx: number, cy: number, r: number, angleDeg: number) {
  const a = (angleDeg * Math.PI) / 180;
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}

function arcPath(cx: number, cy: number, r: number, startDeg: number, endDeg: number) {
  const start = polar(cx, cy, r, startDeg);
  const end = polar(cx, cy, r, endDeg);
  const largeArc = endDeg - startDeg <= 180 ? 0 : 1;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y}`;
}
