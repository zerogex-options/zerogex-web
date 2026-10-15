'use client';

/**
 * The Technicals page's one chart: the session's five-minute candles with
 * VWAP, the opening range, the gamma flip, both walls and the pin on the same
 * price axis, volume underneath, and numbered markers that match the page's
 * event list. Drawn in pixels against the measured width (not a scaled
 * viewBox), so type stays the same size from a phone to a wide monitor.
 *
 * Geometry decisions live in core/technicalsSession (priceDomain, spreadTags)
 * where they are tested; this file only draws.
 */

import { useLayoutEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { useChipInk, useLevelInk } from '@/hooks/useChartTheme';
import { useChartReadout } from '@/hooks/useChartReadout';
import { ET_HM, etMinuteOfDay, generateNiceTicks, trimEdgeTicks } from '@/core/technicalsCharts';
import {
  ORB_NEAR_FRACTION,
  fmtLevel,
  priceDomain,
  spreadTags,
  type Candle,
  type SessionEvent,
} from '@/core/technicalsSession';

const SLOT_MS = 5 * 60_000;
const MONO = 'var(--font-mono)';

export interface SessionVolumeBar {
  ms: number;
  volume: number;
  spike: boolean;
  /** Share of the bar's volume that traded on upticks, 0–100. */
  buyingPct: number | null;
}

export interface SessionVwapPoint {
  ms: number;
  vwap: number;
}

export interface SessionChartLevels {
  flip: number | null;
  callWall: number | null;
  putWall: number | null;
  pin: number | null;
}

export interface SessionChartLayers {
  vwap: boolean;
  orb: boolean;
  levels: boolean;
  volume: boolean;
  events: boolean;
}

interface Props {
  candles: Candle[];
  vwap: SessionVwapPoint[];
  volume: SessionVolumeBar[];
  orb: { high: number; low: number; startMs: number; endMs: number } | null;
  levels: SessionChartLevels;
  last: number | null;
  sessionStartMs: number;
  sessionEndMs: number;
  events: SessionEvent[];
  layers: SessionChartLayers;
  compact: boolean;
  ariaLabel: string;
}

interface Tag {
  key: string;
  name: string;
  value: number;
  color: string;
  outline?: boolean;
  /** Off the visible scale: drawn at the edge with an arrow. */
  edge?: 'top' | 'bottom';
}

export default function TechnicalsSessionChart({
  candles,
  vwap,
  volume,
  orb,
  levels,
  last,
  sessionStartMs,
  sessionEndMs,
  events,
  layers,
  compact,
  ariaLabel,
}: Props) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(0);
  const readout = useChartReadout(wrapRef);
  const { index: hoverIdx, setIndex: setHoverIdx } = readout;
  const chipInk = useChipInk();
  const levelInk = useLevelInk();

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const update = () => setWidth(el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const TAG_W = compact ? 66 : 78;
  const PLOT_H = compact ? 280 : 380;
  const VOL_H = layers.volume ? (compact ? 44 : 60) : 0;
  const VOL_GAP = VOL_H ? 10 : 0;
  const AXIS_H = 22;
  const totalH = PLOT_H + VOL_GAP + VOL_H + AXIS_H;
  const plotW = Math.max(0, width - TAG_W - 6);
  const yTop = 10;
  const yBottom = PLOT_H - 10;

  const spanMs = Math.max(SLOT_MS, sessionEndMs - sessionStartMs);
  const slots = Math.max(1, Math.round(spanMs / SLOT_MS));
  const slotW = plotW / slots;
  const x = (ms: number) => ((ms - sessionStartMs) / SLOT_MS + 0.5) * slotW;

  const levelValues = layers.levels ? [levels.flip, levels.callWall, levels.putWall, levels.pin] : [];
  const domain = useMemo(() => {
    const vals: number[] = [];
    for (const c of candles) vals.push(c.high, c.low);
    if (layers.vwap) for (const p of vwap) vals.push(p.vwap);
    if (layers.orb && orb) vals.push(orb.high, orb.low);
    if (vals.length === 0 && last != null) vals.push(last);
    return priceDomain(vals, levelValues);
    // levelValues is rebuilt every render; its members are the real deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candles, vwap, orb, last, layers.vwap, layers.orb, layers.levels, levels.flip, levels.callWall, levels.putWall, levels.pin]);

  const candleByMs = useMemo(() => {
    const m = new Map<number, Candle>();
    for (const c of candles) m.set(c.ms, c);
    return m;
  }, [candles]);
  const vwapByMs = useMemo(() => {
    const m = new Map<number, number>();
    for (const p of vwap) m.set(p.ms, p.vwap);
    return m;
  }, [vwap]);
  const volumeByMs = useMemo(() => {
    const m = new Map<number, SessionVolumeBar>();
    for (const v of volume) m.set(v.ms, v);
    return m;
  }, [volume]);

  if (width === 0 || !domain) {
    return <div ref={wrapRef} style={{ width: '100%', height: totalH }} aria-hidden="true" />;
  }

  const y = (p: number) => yTop + ((domain.max - p) / (domain.max - domain.min)) * (yBottom - yTop);
  const inDomain = (p: number) => p >= domain.min && p <= domain.max;
  const ticks = trimEdgeTicks(generateNiceTicks(domain.min, domain.max));
  const lastCandle = candles.length ? candles[candles.length - 1] : null;
  const nowX = lastCandle ? x(lastCandle.ms) + slotW / 2 : 0;
  const latestVwap = vwap.length ? vwap[vwap.length - 1].vwap : null;

  // ── Price tags on the right edge ─────────────────────────────────────────
  const tags: Tag[] = [];
  const pushLevel = (key: string, name: string, value: number | null, color: string, outline = false) => {
    if (value == null || !Number.isFinite(value)) return;
    tags.push({
      key,
      name,
      value,
      color,
      outline,
      edge: inDomain(value) ? undefined : value > domain.max ? 'top' : 'bottom',
    });
  };
  if (layers.levels) {
    pushLevel('callWall', 'CALL WALL', levels.callWall, 'var(--color-bear)');
    pushLevel('putWall', 'PUT WALL', levels.putWall, 'var(--color-bull)');
    pushLevel('flip', 'FLIP', levels.flip, 'var(--color-flip)');
    pushLevel('pin', 'PIN', levels.pin, 'var(--color-pin)');
  }
  if (layers.orb && orb) {
    pushLevel('orbHigh', 'ORB HIGH', orb.high, 'var(--color-hazy)', true);
    pushLevel('orbLow', 'ORB LOW', orb.low, 'var(--color-hazy)', true);
  }
  if (layers.vwap && latestVwap != null) pushLevel('vwap', 'VWAP', latestVwap, 'var(--color-warning)');
  if (last != null) pushLevel('last', 'LAST', last, 'var(--color-accent-hot)');
  const tagYs = spreadTags(
    tags.map((t) => (t.edge === 'top' ? yTop : t.edge === 'bottom' ? yBottom : y(t.value))),
    16,
    yTop + 7,
    yBottom - 7,
  );

  // Level names inside the plot, right-aligned above their lines. A name that
  // would sit on top of another is skipped; its tag still carries the price.
  const names = tags
    .filter((t) => !t.edge && t.key !== 'last' && t.key !== 'vwap')
    .map((t) => ({ ...t, ly: y(t.value) - 4 }))
    .sort((a, b) => a.ly - b.ly);
  const drawnNames: typeof names = [];
  for (const n of names) {
    if (drawnNames.every((d) => Math.abs(d.ly - n.ly) >= 11)) drawnNames.push(n);
  }

  // ── Time axis ────────────────────────────────────────────────────────────
  const hours = spanMs / 3_600_000;
  const stepMin = compact ? (hours <= 7 ? 120 : 240) : hours <= 7 ? 60 : 120;
  const timeTicks: Array<{ ms: number; label: string }> = [];
  for (let ms = sessionStartMs; ms < sessionEndMs; ms += SLOT_MS) {
    const m = etMinuteOfDay(ms);
    if (m >= 0 && m % stepMin === 0) timeTicks.push({ ms, label: ET_HM.format(new Date(ms)) });
  }

  const volMax = volume.reduce((m, v) => Math.max(m, v.volume), 0);
  const volTop = PLOT_H + VOL_GAP;
  const axisTop = volTop + VOL_H;

  const onPointer = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (candles.length === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left;
    if (px < 0 || px > plotW) {
      setHoverIdx(null);
      return;
    }
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < candles.length; i += 1) {
      const d = Math.abs(x(candles[i].ms) - px);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    setHoverIdx(best);
  };

  const hover = hoverIdx != null ? candles[hoverIdx] ?? null : null;
  const bodyW = Math.max(1, Math.min(9, slotW * 0.62));

  return (
    <div ref={wrapRef} style={{ position: 'relative', width: '100%' }}>
      <svg
        width={width}
        height={totalH}
        role="img"
        aria-label={ariaLabel}
        style={{ display: 'block', touchAction: 'pan-y' }}
        onPointerMove={onPointer}
        onPointerDown={onPointer}
        onPointerLeave={readout.onPointerLeave}
        onPointerCancel={readout.onPointerCancel}
      >
        {/* Price grid */}
        {ticks.map((t) => (
          <g key={`grid-${t}`}>
            <line x1={0} x2={plotW} y1={y(t)} y2={y(t)} stroke="var(--color-grid-line)" strokeWidth={1} />
            {/* A card-colored halo keeps the label readable where candles cross it. */}
            <text x={4} y={y(t) - 4} fontFamily={MONO} fontSize={10} fill="var(--text-muted)" stroke="var(--bg-card)" strokeWidth={3} paintOrder="stroke">
              {fmtLevel(t).replace(/\.00$/, '')}
            </text>
          </g>
        ))}

        {/* The part of the session still to come */}
        {lastCandle && nowX < plotW && (
          <g>
            <rect x={nowX} y={0} width={plotW - nowX} height={axisTop} fill="var(--bg-subtle)" fillOpacity={0.55} />
            <line x1={nowX} x2={nowX} y1={0} y2={axisTop} stroke="var(--border-default)" strokeWidth={1} />
          </g>
        )}

        {/* Opening range: the band, its outer fifths, the forming window */}
        {layers.orb && orb && inDomain(orb.high) && inDomain(orb.low) && (
          <g>
            {(() => {
              const bx = Math.max(0, x(orb.startMs) - slotW / 2);
              const wx = Math.max(bx, x(orb.endMs) - slotW / 2);
              const yh = y(orb.high);
              const yl = y(orb.low);
              const fifth = (yl - yh) * ORB_NEAR_FRACTION;
              return (
                <>
                  <rect x={bx} y={yh} width={plotW - bx} height={yl - yh} fill="var(--color-hazy)" fillOpacity={0.06} />
                  <rect x={bx} y={yh} width={plotW - bx} height={fifth} fill="var(--color-hazy)" fillOpacity={0.08} />
                  <rect x={bx} y={yl - fifth} width={plotW - bx} height={fifth} fill="var(--color-hazy)" fillOpacity={0.08} />
                  <rect x={bx} y={yh} width={wx - bx} height={yl - yh} fill="var(--color-hazy)" fillOpacity={0.12} />
                  <line x1={bx} x2={plotW} y1={yh} y2={yh} stroke="var(--color-hazy)" strokeOpacity={0.8} strokeWidth={1} />
                  <line x1={bx} x2={plotW} y1={yl} y2={yl} stroke="var(--color-hazy)" strokeOpacity={0.8} strokeWidth={1} />
                  {!compact && (
                    <text x={wx + 6} y={yh - 5} fontFamily={MONO} fontSize={9} letterSpacing="0.1em" fill={levelInk('var(--color-hazy)')}>
                      OPENING RANGE
                    </text>
                  )}
                </>
              );
            })()}
          </g>
        )}

        {/* Gamma levels */}
        {layers.levels && (
          <g>
            {levels.callWall != null && inDomain(levels.callWall) && (
              <line x1={0} x2={plotW} y1={y(levels.callWall)} y2={y(levels.callWall)} stroke="var(--color-bear)" strokeWidth={1.2} strokeDasharray="6 4" />
            )}
            {levels.pin != null && inDomain(levels.pin) && (
              <line x1={0} x2={plotW} y1={y(levels.pin)} y2={y(levels.pin)} stroke="var(--color-pin)" strokeWidth={1.2} strokeDasharray="2 3" />
            )}
            {levels.flip != null && inDomain(levels.flip) && (
              <line x1={0} x2={plotW} y1={y(levels.flip)} y2={y(levels.flip)} stroke="var(--color-flip)" strokeWidth={1.4} strokeDasharray="8 4" />
            )}
            {levels.putWall != null && inDomain(levels.putWall) && (
              <line x1={0} x2={plotW} y1={y(levels.putWall)} y2={y(levels.putWall)} stroke="var(--color-bull)" strokeWidth={1.2} strokeDasharray="6 4" />
            )}
          </g>
        )}
        {drawnNames.map((n) => (
          <text key={`name-${n.key}`} x={plotW - 4} y={n.ly} textAnchor="end" fontFamily={MONO} fontSize={9} letterSpacing="0.1em" fill={levelInk(n.color)}>
            {n.name}
          </text>
        ))}

        {/* VWAP */}
        {layers.vwap && vwap.length > 1 && (
          <polyline
            points={vwap.map((p) => `${x(p.ms).toFixed(1)},${y(p.vwap).toFixed(1)}`).join(' ')}
            fill="none"
            stroke="var(--color-warning)"
            strokeWidth={1.6}
            strokeDasharray="5 3"
          />
        )}

        {/* Candles */}
        {candles.map((c) => {
          const up = c.close >= c.open;
          const color = up ? 'var(--color-bull)' : 'var(--color-bear)';
          const cx = x(c.ms);
          const top = y(Math.max(c.open, c.close));
          const bot = y(Math.min(c.open, c.close));
          return (
            <g key={`c-${c.ms}`}>
              <line x1={cx} x2={cx} y1={y(c.high)} y2={y(c.low)} stroke={color} strokeWidth={1} />
              <rect x={cx - bodyW / 2} y={top} width={bodyW} height={Math.max(1, bot - top)} fill={color} />
            </g>
          );
        })}

        {/* Last price */}
        {last != null && inDomain(last) && lastCandle && (
          <line x1={x(lastCandle.ms)} x2={plotW} y1={y(last)} y2={y(last)} stroke="var(--color-accent-hot)" strokeWidth={1.2} strokeDasharray="1 3" />
        )}

        {/* Event markers, numbered to match the list */}
        {layers.events &&
          events
            .filter((e) => e.marker != null && e.markerSide)
            .map((e) => {
              const c = candleByMs.get(e.ms);
              const ref = c ? (e.markerSide === 'above' ? c.high : c.low) : e.price;
              if (ref == null) return null;
              const cy = Math.min(yBottom - 9, Math.max(yTop + 9, y(ref) + (e.markerSide === 'above' ? -13 : 13)));
              const cx = x(e.ms);
              if (cx < 0 || cx > plotW) return null;
              const stroke = e.tone === 'warning' ? 'var(--color-warning)' : 'var(--color-hazy)';
              return (
                <g key={`m-${e.id}`}>
                  <circle cx={cx} cy={cy} r={8} fill="var(--bg-card)" stroke={stroke} strokeWidth={1.4} />
                  <text x={cx} y={cy + 3.5} textAnchor="middle" fontFamily={MONO} fontSize={10} fontWeight={600} fill="var(--text-primary)">
                    {e.marker}
                  </text>
                </g>
              );
            })}

        {/* Hover crosshair */}
        {hover && <line x1={x(hover.ms)} x2={x(hover.ms)} y1={0} y2={axisTop} stroke="var(--text-muted)" strokeOpacity={0.6} strokeWidth={1} strokeDasharray="3 3" />}

        {/* Right-edge price tags */}
        {tags.map((t, i) => {
          const ty = tagYs[i];
          const arrow = t.edge === 'top' ? '▲ ' : t.edge === 'bottom' ? '▼ ' : '';
          return (
            <g key={`tag-${t.key}`}>
              <rect
                x={plotW + 4}
                y={ty - 7.5}
                width={TAG_W - 2}
                height={15}
                rx={2}
                fill={t.outline ? 'var(--bg-card)' : t.color}
                stroke={t.outline ? t.color : 'none'}
                strokeWidth={t.outline ? 1 : 0}
              />
              <text
                x={plotW + 4 + (TAG_W - 2) / 2}
                y={ty + 3.5}
                textAnchor="middle"
                fontFamily={MONO}
                fontSize={compact ? 9 : 10}
                fontWeight={600}
                fill={t.outline ? 'var(--text-primary)' : chipInk(t.color)}
              >
                {arrow}
                {fmtLevel(t.value)}
              </text>
              {t.edge && <title>{`${t.name} ${fmtLevel(t.value)}, off the visible scale`}</title>}
            </g>
          );
        })}

        {/* Volume strip */}
        {layers.volume && volMax > 0 && (
          <g transform={`translate(0, ${volTop})`}>
            {volume.map((v) => {
              const h = Math.max(1, (v.volume / volMax) * (VOL_H - 4));
              const fill = v.spike ? ((v.buyingPct ?? 50) >= 50 ? 'var(--color-bull)' : 'var(--color-bear)') : 'var(--text-muted)';
              return <rect key={`v-${v.ms}`} x={x(v.ms) - bodyW / 2} y={VOL_H - h} width={bodyW} height={h} fill={fill} fillOpacity={v.spike ? 0.9 : 0.3} />;
            })}
            <line x1={0} x2={plotW} y1={VOL_H + 0.5} y2={VOL_H + 0.5} stroke="var(--border-default)" strokeWidth={1} />
            <text x={4} y={9} fontFamily={MONO} fontSize={9} letterSpacing="0.1em" fill="var(--text-muted)">
              VOLUME
            </text>
          </g>
        )}

        {/* Time axis */}
        <g transform={`translate(0, ${axisTop})`}>
          {timeTicks.map((t) => (
            <g key={`t-${t.ms}`}>
              <line x1={x(t.ms) - slotW / 2} x2={x(t.ms) - slotW / 2} y1={0} y2={5} stroke="var(--text-muted)" strokeWidth={1} />
              <text x={x(t.ms) - slotW / 2} y={16} textAnchor="middle" fontFamily={MONO} fontSize={10} fill="var(--text-muted)">
                {t.label}
              </text>
            </g>
          ))}
        </g>
      </svg>

      {hover && (
        <div
          className="zg-panel"
          style={{
            position: 'absolute',
            top: 8,
            left: x(hover.ms) > plotW / 2 ? 8 : undefined,
            right: x(hover.ms) > plotW / 2 ? undefined : TAG_W + 14,
            padding: '8px 10px',
            pointerEvents: 'none',
            fontFamily: MONO,
            fontSize: 11,
            fontVariantNumeric: 'tabular-nums',
            minWidth: 150,
          }}
        >
          <div style={{ color: 'var(--text-muted)', marginBottom: 4 }}>{ET_HM.format(new Date(hover.ms))} ET</div>
          {(
            [
              ['O', hover.open],
              ['H', hover.high],
              ['L', hover.low],
              ['C', hover.close],
            ] as const
          ).map(([k, v]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
              <span style={{ color: 'var(--text-secondary)' }}>{k}</span>
              <span style={{ color: 'var(--text-primary)' }}>{fmtLevel(v)}</span>
            </div>
          ))}
          {vwapByMs.get(hover.ms) != null && (
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
              <span style={{ color: 'var(--text-secondary)' }}>VWAP</span>
              <span style={{ color: 'var(--color-warning)' }}>{fmtLevel(vwapByMs.get(hover.ms))}</span>
            </div>
          )}
          {volumeByMs.get(hover.ms) && (
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
              <span style={{ color: 'var(--text-secondary)' }}>Vol</span>
              <span style={{ color: 'var(--text-primary)' }}>{volumeByMs.get(hover.ms)!.volume.toLocaleString('en-US')}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
