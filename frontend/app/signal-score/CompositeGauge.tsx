'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { REGIME_BANDS, classifyRegime } from './regime';

interface CompositeGaugeProps {
  score: number | null;
  size?: number;
}

const START_ANGLE = 135;
const SWEEP = 270;
const TICKS = [
  { value: 0, bold: false },
  { value: 20, bold: false },
  { value: 40, bold: false },
  { value: 50, bold: true },
  { value: 70, bold: false },
  { value: 100, bold: false },
];

export default function CompositeGauge({ score, size = 320 }: CompositeGaugeProps) {
  const strokeWidth = Math.max(16, Math.round(size * 0.06));
  const tickPadding = 22;
  const radius = size / 2 - strokeWidth / 2 - tickPadding;
  const cx = size / 2;
  const cy = size / 2;

  const safeScore = score != null && Number.isFinite(score)
    ? Math.max(0, Math.min(100, score))
    : null;
  const regime = classifyRegime(safeScore);

  const targetAngle = safeScore != null
    ? START_ANGLE + (safeScore / 100) * SWEEP
    : START_ANGLE + SWEEP / 2;

  // Animated needle: smooth tween to the next angle on update.
  const [displayAngle, setDisplayAngle] = useState(targetAngle);
  const rafRef = useRef<number | null>(null);
  const fromRef = useRef(targetAngle);
  const startTsRef = useRef<number | null>(null);
  const prevScoreRef = useRef<number | null>(safeScore);
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    fromRef.current = displayAngle;
    startTsRef.current = null;
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    const duration = 250;
    const animate = (ts: number) => {
      if (startTsRef.current == null) startTsRef.current = ts;
      const elapsed = ts - startTsRef.current;
      const t = Math.min(1, elapsed / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const next = fromRef.current + (targetAngle - fromRef.current) * eased;
      setDisplayAngle(next);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(animate);
      } else {
        rafRef.current = null;
      }
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetAngle]);

  // Pulse needle stroke when |Δ| ≥ 1.
  useEffect(() => {
    const prev = prevScoreRef.current;
    if (prev != null && safeScore != null && Math.abs(safeScore - prev) >= 1) {
      setPulse(true);
      const id = window.setTimeout(() => setPulse(false), 350);
      return () => window.clearTimeout(id);
    }
    prevScoreRef.current = safeScore;
  }, [safeScore]);

  const trackPath = useMemo(
    () => arcPath(cx, cy, radius, START_ANGLE, START_ANGLE + SWEEP),
    [cx, cy, radius],
  );

  const bandSegments = useMemo(
    () => REGIME_BANDS.map((band) => ({
      d: arcPath(
        cx,
        cy,
        radius,
        START_ANGLE + (band.from / 100) * SWEEP,
        START_ANGLE + (band.to / 100) * SWEEP,
      ),
      color: band.regime.color,
    })),
    [cx, cy, radius],
  );

  const needleOuter = polar(cx, cy, radius - strokeWidth / 2 - 4, displayAngle);
  const needleInner = polar(cx, cy, 8, displayAngle);

  const heightPx = size * 0.85;

  return (
    <div
      className="flex flex-col items-center select-none w-full"
      role="img"
      aria-label={
        safeScore != null
          ? `Composite score ${safeScore.toFixed(2)} of 100. Regime: ${regime.label}.`
          : 'Composite score unavailable.'
      }
    >
      <svg
        width={size}
        height={heightPx}
        viewBox={`0 0 ${size} ${heightPx}`}
        style={{ maxWidth: '100%', height: 'auto', display: 'block', overflow: 'visible' }}
      >
        <path
          d={trackPath}
          stroke="var(--color-border)"
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          opacity={0.5}
        />
        {bandSegments.map((seg, i) => (
          <path
            key={i}
            d={seg.d}
            stroke={seg.color}
            strokeWidth={strokeWidth}
            fill="none"
            strokeLinecap="butt"
            opacity={0.85}
          />
        ))}
        {TICKS.map((tick) => {
          const angle = START_ANGLE + (tick.value / 100) * SWEEP;
          const innerR = radius - strokeWidth / 2 - 2;
          const outerR = radius + strokeWidth / 2 + 2;
          const a = polar(cx, cy, innerR, angle);
          const b = polar(cx, cy, outerR, angle);
          const labelPos = polar(cx, cy, radius + strokeWidth / 2 + 14, angle);
          return (
            <g key={tick.value}>
              <line
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke={tick.bold ? 'var(--color-text-primary)' : 'var(--color-text-secondary)'}
                strokeWidth={tick.bold ? 2 : 1}
                opacity={tick.bold ? 0.9 : 0.6}
              />
              <text
                x={labelPos.x}
                y={labelPos.y}
                fill="var(--color-text-secondary)"
                fontSize={tick.bold ? 12 : 11}
                fontWeight={tick.bold ? 600 : 400}
                textAnchor="middle"
                dominantBaseline="middle"
                style={{ fontVariantNumeric: 'tabular-nums' }}
              >
                {tick.value === 50 ? 'Neutral' : tick.value}
              </text>
            </g>
          );
        })}
        {safeScore != null && (
          <g>
            <line
              x1={needleInner.x}
              y1={needleInner.y}
              x2={needleOuter.x}
              y2={needleOuter.y}
              stroke={regime.color}
              strokeWidth={pulse ? 5 : 3}
              strokeLinecap="round"
              style={{ transition: 'stroke-width 250ms ease-out' }}
            />
            <circle cx={cx} cy={cy} r={8} fill="var(--color-text-primary)" />
            <circle cx={cx} cy={cy} r={3} fill={regime.color} />
          </g>
        )}
      </svg>
      <div className="text-center -mt-6">
        <div
          className="text-[56px] font-black leading-none"
          style={{ color: regime.color, fontVariantNumeric: 'tabular-nums', fontFamily: 'var(--font-mono, ui-monospace, SFMono-Regular, Menlo, monospace)' }}
        >
          {safeScore != null ? safeScore.toFixed(2) : '—'}
        </div>
        <div
          className="mt-2 inline-flex items-center gap-1.5 text-[18px] font-semibold"
          style={{ color: regime.color }}
        >
          <span aria-hidden>{regime.glyph}</span>
          <span>{regime.label}</span>
        </div>
      </div>
    </div>
  );
}

function polar(cx: number, cy: number, r: number, angleDeg: number) {
  const a = (angleDeg * Math.PI) / 180;
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}

function arcPath(cx: number, cy: number, r: number, startDeg: number, endDeg: number) {
  if (Math.abs(endDeg - startDeg) < 0.001) {
    const p = polar(cx, cy, r, startDeg);
    return `M ${p.x} ${p.y}`;
  }
  const start = polar(cx, cy, r, startDeg);
  const end = polar(cx, cy, r, endDeg);
  const largeArc = Math.abs(endDeg - startDeg) > 180 ? 1 : 0;
  const sweepFlag = endDeg > startDeg ? 1 : 0;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} ${sweepFlag} ${end.x} ${end.y}`;
}
