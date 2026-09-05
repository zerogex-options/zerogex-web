'use client';

import { useMemo } from 'react';

import { classifyRegime } from '@/core/regime';

interface MsiGaugeProps {
  score: number | null;
  size?: number;
  label?: string;
  subLabel?: string;
}

export default function MsiGauge({ score, size = 260, label = 'Composite Score', subLabel }: MsiGaugeProps) {
  const strokeWidth = Math.max(14, size * 0.06);
  // Leave enough padding for the tick labels (0 / 100) that render just
  // outside the arc; otherwise they clip at the SVG edges.
  const tickPadding = 18;
  const radius = size / 2 - strokeWidth / 2 - tickPadding;
  const cx = size / 2;
  const cy = size / 2;
  const startAngle = 180;
  const endAngle = 360;
  const angleRange = endAngle - startAngle;

  // Bands, labels and copy come from core/regime.ts. This component used to
  // carry its own copy of all three, which had already drifted: it still said
  // "Broken or dislocated; mean-reversion only" for the bottom band after that
  // description was found to be backwards (it is the band with the LEAST
  // forward travel). One source of truth avoids the next drift.
  const band = classifyRegime(score);
  const safeScore = score != null && Number.isFinite(score) ? Math.max(0, Math.min(100, score)) : null;

  const segments = useMemo(() => {
    const arcs = [
      { from: 0, to: 20, color: 'var(--regime-reversal)' },
      { from: 20, to: 40, color: 'var(--regime-chop)' },
      { from: 40, to: 70, color: 'var(--regime-controlled)' },
      { from: 70, to: 100, color: 'var(--regime-trend)' },
    ];
    return arcs.map((a) => arcPath(cx, cy, radius, startAngle + (a.from / 100) * angleRange, startAngle + (a.to / 100) * angleRange));
  }, [cx, cy, radius, angleRange]);

  const needleAngle = safeScore != null ? startAngle + (safeScore / 100) * angleRange : startAngle + 90;
  const needlePos = polar(cx, cy, radius - strokeWidth / 2 - 2, needleAngle);

  return (
    <div className="flex flex-col items-center" style={{ maxWidth: '100%' }}>
      <svg
        width={size}
        height={size / 1.6}
        viewBox={`0 0 ${size} ${size / 1.6}`}
        style={{ maxWidth: '100%', height: 'auto', display: 'block', overflow: 'visible' }}
        preserveAspectRatio="xMidYMid meet"
      >
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
          { from: 0, to: 20, color: 'var(--regime-reversal)' },
          { from: 20, to: 40, color: 'var(--regime-chop)' },
          { from: 40, to: 70, color: 'var(--regime-controlled)' },
          { from: 70, to: 100, color: 'var(--regime-trend)' },
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
        <div className="text-3xl sm:text-4xl md:text-5xl font-black leading-none break-words" style={{ color: band.color }}>
          {safeScore != null ? safeScore.toFixed(2) : '—'}
        </div>
        <div className="text-xs uppercase tracking-[0.18em] text-[var(--color-text-secondary)] mt-2">{label}</div>
        <div className="mt-1 text-sm font-semibold" style={{ color: band.color }}>{band.label}</div>
        {subLabel ? (
          <div className="text-xs text-[var(--color-text-secondary)] mt-0.5">{subLabel}</div>
        ) : (
          <div className="text-xs text-[var(--color-text-secondary)] mt-0.5">{band.copy}</div>
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
