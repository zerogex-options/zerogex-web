'use client';

import { useId, useMemo, useState } from 'react';
import { BarChart3 } from 'lucide-react';

// Horizontal-strike-profile card for the shareable moment page. Mirrors the
// ReplayScrubber's right-hand strike panel so the snapshot reads the same way
// as the live scrubber a user just came from — including the Split / Net /
// Combined gamma views. Hand-drawn as a single SVG (rather than Recharts)
// because the Combined view overlays a purple Net bar on top of the call/put
// split at the same row, which Recharts' grouped/stacked bars can't express.

type GexMode = 'split' | 'net' | 'combined';

// Purple overlay bar for the Combined view — the per-strike NET GEX drawn on
// top of the call/put split. Matches the Strike Profile chart and the main
// replay panel exactly (a deep violet distinct from the bull/bear split bars).
const NET_BAR_COLOR = '#7C3AED';

interface SnapshotStrike {
  strike: number | null;
  net_gex: number | null;
  call_gex?: number | null;
  put_gex?: number | null;
}

interface StrikeProfileSnapshotProps {
  strikes: SnapshotStrike[];
  spot?: number | null;
  gammaFlip?: number | null;
  callWall?: number | null;
  putWall?: number | null;
}

interface Row {
  strike: number;
  net: number;
  call: number;
  put: number;
}

function formatMagnitude(v: number): string {
  if (!Number.isFinite(v)) return '—';
  const abs = Math.abs(v);
  const sign = v < 0 ? '-' : '';
  if (abs >= 1e9) return `${sign}${(abs / 1e9).toFixed(abs >= 1e10 ? 0 : 1)}B`;
  if (abs >= 1e6) return `${sign}${(abs / 1e6).toFixed(abs >= 1e7 ? 0 : 1)}M`;
  if (abs >= 1e3) return `${sign}${(abs / 1e3).toFixed(abs >= 1e4 ? 0 : 1)}K`;
  return `${sign}${abs.toFixed(0)}`;
}

// Nice round tick values for the price/strike axis: pick a {1,2,5}×10^k step
// that lands ~`target` labels across [lo, hi] and walk the ladder. Keeps the
// strike-axis labels on round numbers instead of drifting with the chain's
// actual spacing — same helper the ReplayScrubber uses.
function niceTicks(lo: number, hi: number, target: number): number[] {
  if (!Number.isFinite(lo) || !Number.isFinite(hi) || hi <= lo) return [];
  const range = hi - lo;
  const rough = range / Math.max(1, target);
  const magnitude = Math.pow(10, Math.floor(Math.log10(rough)));
  const norm = rough / magnitude;
  let step: number;
  if (norm < 1.5) step = 1 * magnitude;
  else if (norm < 3.5) step = 2 * magnitude;
  else if (norm < 7.5) step = 5 * magnitude;
  else step = 10 * magnitude;
  const start = Math.ceil(lo / step) * step;
  const ticks: number[] = [];
  const count = Math.floor((hi - start) / step + 1e-9) + 1;
  for (let i = 0; i < count; i += 1) {
    const v = start + i * step;
    if (v > hi + 1e-9) break;
    ticks.push(v);
  }
  return ticks;
}

function formatPriceTick(v: number, step: number): string {
  if (!Number.isFinite(v)) return '';
  const decimals = step >= 1 ? 0 : step >= 0.1 ? 1 : 2;
  return v.toFixed(decimals);
}

export default function StrikeProfileSnapshot({
  strikes,
  spot,
  gammaFlip,
  callWall,
  putWall,
}: StrikeProfileSnapshotProps) {
  const clipId = `snap-clip-${useId().replace(/[^a-zA-Z0-9-]/g, '')}`;

  const rows = useMemo<Row[]>(() => {
    // /replay/frame returns one row per (strike, expiration), so a strike can
    // appear more than once; sum call/put/net across expirations into a single
    // per-strike row (call + put stays consistent with net since each source
    // row already satisfies call + put = net). This keeps the profile one bar
    // per strike instead of overlapping bars for multi-expiration strikes.
    const byStrike = new Map<number, Row>();
    for (const s of strikes) {
      if (s.strike == null || s.net_gex == null) continue;
      const strike = s.strike;
      const call = s.call_gex != null && Number.isFinite(s.call_gex) ? s.call_gex : 0;
      const put = s.put_gex != null && Number.isFinite(s.put_gex) ? s.put_gex : 0;
      const existing = byStrike.get(strike);
      if (existing) {
        existing.net += s.net_gex;
        existing.call += call;
        existing.put += put;
      } else {
        byStrike.set(strike, { strike, net: s.net_gex, call, put });
      }
    }
    // Ascending so yForPrice (higher price = higher on chart) lays them out
    // like an option chain, highest strike at the top.
    return Array.from(byStrike.values()).sort((a, b) => a.strike - b.strike);
  }, [strikes]);

  // Whether the payload carries per-strike call/put gamma. Drives whether the
  // Split/Combined toggle is offered at all.
  const hasSplitData = useMemo(
    () => rows.some((r) => r.call !== 0 || r.put !== 0),
    [rows],
  );

  // Default to Split (matching the Strike Profile chart); clamp to Net when
  // the payload is net-only so we never render empty split bars.
  const [gexMode, setGexMode] = useState<GexMode>('split');
  const effMode: GexMode = hasSplitData ? gexMode : 'net';

  // Peak magnitude for the active mode: Net → max|net|, Split → max(|call|,
  // |put|), Combined → max(|call|,|put|,|net|). Matches how the Strike Profile
  // chart scales its gamma column.
  const peak = useMemo(() => {
    let p = 0;
    for (const r of rows) {
      const n = Math.abs(r.net);
      const c = Math.abs(r.call);
      const pu = Math.abs(r.put);
      const m =
        effMode === 'net' ? n : effMode === 'split' ? Math.max(c, pu) : Math.max(c, pu, n);
      if (m > p) p = m;
    }
    return p * 1.05 || 1;
  }, [rows, effMode]);

  // Price band the strikes span, padded so the top/bottom rungs aren't glued
  // to the plot edge.
  const { yLo, yHi } = useMemo(() => {
    let lo = Number.POSITIVE_INFINITY;
    let hi = Number.NEGATIVE_INFINITY;
    for (const r of rows) {
      if (r.strike < lo) lo = r.strike;
      if (r.strike > hi) hi = r.strike;
    }
    if (!Number.isFinite(lo) || !Number.isFinite(hi) || hi <= lo) {
      return { yLo: 0, yHi: 1 };
    }
    const pad = (hi - lo) * 0.03 || 1;
    return { yLo: lo - pad, yHi: hi + pad };
  }, [rows]);

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-6 text-sm text-[var(--color-text-secondary)]">
        No per-strike GEX rows for this moment.
      </div>
    );
  }

  // ── SVG geometry ──
  const CW = 720;
  const CH = 560;
  const PLOT_TOP = 30;
  const PLOT_BOTTOM = 512;
  const PLOT_HEIGHT = PLOT_BOTTOM - PLOT_TOP;
  const STRIKE_COL_W = 52;
  const PLOT_X0 = STRIKE_COL_W;
  const PLOT_X1 = CW - 12;
  const CENTER = (PLOT_X0 + PLOT_X1) / 2;
  const HALF = (PLOT_X1 - PLOT_X0) / 2;

  const yForPrice = (price: number) =>
    PLOT_TOP + (1 - (price - yLo) / Math.max(1e-9, yHi - yLo)) * PLOT_HEIGHT;

  const priceTicks = niceTicks(yLo, yHi, Math.max(6, Math.round(PLOT_HEIGHT / 30)));
  const priceStep = priceTicks.length >= 2 ? priceTicks[1] - priceTicks[0] : 1;

  const barH = Math.max(2, Math.min(12, (PLOT_HEIGHT / Math.max(1, rows.length)) * 0.6));

  const refLines: Array<{ level: number; label: string; color: string }> = [];
  if (spot != null && Number.isFinite(spot))
    refLines.push({ level: spot, label: `Spot ${spot.toFixed(2)}`, color: 'var(--color-text-primary)' });
  if (gammaFlip != null && Number.isFinite(gammaFlip))
    refLines.push({ level: gammaFlip, label: `Flip ${gammaFlip.toFixed(2)}`, color: 'var(--color-warning)' });
  if (callWall != null && Number.isFinite(callWall))
    refLines.push({ level: callWall, label: `Call Wall ${callWall.toFixed(2)}`, color: 'var(--color-bear)' });
  if (putWall != null && Number.isFinite(putWall))
    refLines.push({ level: putWall, label: `Put Wall ${putWall.toFixed(2)}`, color: 'var(--color-bull)' });

  const legend =
    effMode === 'net'
      ? []
      : [
          { label: 'Call', color: 'var(--color-bull)' },
          { label: 'Put', color: 'var(--color-bear)' },
          ...(effMode === 'combined' ? [{ label: 'Net', color: NET_BAR_COLOR }] : []),
        ];

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-[10px] uppercase tracking-[0.22em] font-bold text-[var(--color-text-secondary)]">
          Dealer {effMode === 'net' ? 'net ' : ''}GEX · strike profile
        </div>
        {/* Gamma display mode cycle: Split → Net → Combined → Split. Shown only
            when the payload carries call/put gamma. Mirrors the Strike Profile
            chart and the main replay panel. */}
        {hasSplitData && (
          <button
            type="button"
            onClick={() =>
              setGexMode((m) => (m === 'split' ? 'net' : m === 'net' ? 'combined' : 'split'))
            }
            title={`Gamma mode: ${
              gexMode === 'split'
                ? 'Call/Put split'
                : gexMode === 'net'
                  ? 'Net only'
                  : 'Combined (Call/Put split with the Net overlaid)'
            } (click to cycle)`}
            className="inline-flex items-center gap-1.5 rounded-md border border-[var(--color-border)] px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] transition-colors hover:bg-[var(--color-surface-subtle)]"
            style={{
              color: gexMode !== 'net' ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
              background: gexMode !== 'net' ? 'var(--color-surface-subtle)' : 'var(--color-surface)',
            }}
          >
            <BarChart3 size={13} />
            {gexMode === 'split' ? 'Split' : gexMode === 'net' ? 'Net' : 'Combined'}
          </button>
        )}
      </div>

      <div className="mt-3 w-full overflow-x-auto">
        <svg
          role="img"
          aria-label="Dealer GEX strike profile snapshot"
          width="100%"
          viewBox={`0 0 ${CW} ${CH}`}
          preserveAspectRatio="xMinYMin meet"
          className="block w-full"
          style={{ aspectRatio: `${CW} / ${CH}`, minWidth: '520px' }}
        >
          <defs>
            <clipPath id={clipId}>
              <rect x={PLOT_X0} y={PLOT_TOP} width={PLOT_X1 - PLOT_X0} height={PLOT_HEIGHT} />
            </clipPath>
          </defs>

          {/* Horizontal grid + strike-price labels on the round-number ladder. */}
          {priceTicks.map((p) => {
            const y = yForPrice(p);
            return (
              <g key={`grid-${p}`}>
                <line
                  x1={PLOT_X0}
                  x2={PLOT_X1}
                  y1={y}
                  y2={y}
                  stroke="var(--color-border)"
                  opacity={0.4}
                />
                <text
                  x={PLOT_X0 - 6}
                  y={y + 3.5}
                  textAnchor="end"
                  fontSize={11}
                  fill="var(--color-text-secondary)"
                >
                  {formatPriceTick(p, priceStep)}
                </text>
              </g>
            );
          })}

          {/* Center (zero) line. */}
          <line
            x1={CENTER}
            x2={CENTER}
            y1={PLOT_TOP}
            y2={PLOT_BOTTOM}
            stroke="var(--color-border)"
            opacity={0.55}
          />

          {/* ── Horizontal strike-profile bars ── */}
          <g clipPath={`url(#${clipId})`}>
            {rows.map((r) => {
              const y = yForPrice(r.strike);
              const netPositive = r.net >= 0;
              const netW = (Math.abs(r.net) / peak) * HALF;

              // Net view: a single signed bar (bull right / bear left).
              if (effMode === 'net') {
                if (r.net === 0) return null;
                return (
                  <rect
                    key={`gex-${r.strike}`}
                    x={netPositive ? CENTER : CENTER - Math.max(0, netW)}
                    y={y - barH / 2}
                    width={Math.max(0, netW)}
                    height={barH}
                    fill={netPositive ? 'var(--color-bull)' : 'var(--color-bear)'}
                    opacity={0.9}
                  />
                );
              }

              // Split & Combined: calls push right, puts push left. Combined
              // adds the purple Net bar on top, same thickness, pointing right
              // for net-positive and left for net-negative.
              const callW = (Math.abs(r.call) / peak) * HALF;
              const putW = (Math.abs(r.put) / peak) * HALF;
              const isCombined = effMode === 'combined';
              if (r.call === 0 && r.put === 0 && !(isCombined && r.net !== 0)) {
                return null;
              }
              return (
                <g key={`gex-${r.strike}`}>
                  {r.call !== 0 && (
                    <rect
                      x={CENTER}
                      y={y - barH / 2}
                      width={Math.max(0, callW)}
                      height={barH}
                      fill="var(--color-bull)"
                      opacity={0.9}
                    />
                  )}
                  {r.put !== 0 && (
                    <rect
                      x={CENTER - Math.max(0, putW)}
                      y={y - barH / 2}
                      width={Math.max(0, putW)}
                      height={barH}
                      fill="var(--color-bear)"
                      opacity={0.9}
                    />
                  )}
                  {isCombined && r.net !== 0 && (
                    <rect
                      x={netPositive ? CENTER : CENTER - Math.max(0, netW)}
                      y={y - barH / 2}
                      width={Math.max(0, netW)}
                      height={barH}
                      fill={NET_BAR_COLOR}
                      opacity={0.9}
                    />
                  )}
                </g>
              );
            })}
          </g>

          {/* Reference levels: spot, flip, call wall, put wall — horizontal
              lines with right-anchored labels, clipped to the plot box. */}
          <g clipPath={`url(#${clipId})`}>
            {refLines.map((rl) => {
              const y = yForPrice(rl.level);
              return (
                <g key={rl.label}>
                  <line
                    x1={PLOT_X0}
                    x2={PLOT_X1}
                    y1={y}
                    y2={y}
                    stroke={rl.color}
                    strokeDasharray="5 3"
                    opacity={0.75}
                  />
                  <text
                    x={PLOT_X1 - 4}
                    y={y - 4}
                    textAnchor="end"
                    fontSize={10}
                    fontWeight={700}
                    fill={rl.color}
                  >
                    {rl.label}
                  </text>
                </g>
              );
            })}
          </g>

          {/* Magnitude axis. */}
          <text x={PLOT_X0} y={PLOT_BOTTOM + 20} fontSize={10} fill="var(--color-text-secondary)" textAnchor="start">
            −{formatMagnitude(peak)}
          </text>
          <text x={CENTER} y={PLOT_BOTTOM + 20} fontSize={10} fill="var(--color-text-secondary)" textAnchor="middle">
            0
          </text>
          <text x={PLOT_X1} y={PLOT_BOTTOM + 20} fontSize={10} fill="var(--color-text-secondary)" textAnchor="end">
            +{formatMagnitude(peak)}
          </text>
          <text
            x={CENTER}
            y={PLOT_BOTTOM + 38}
            fontSize={11}
            fill="var(--color-text-primary)"
            textAnchor="middle"
            fontWeight={600}
          >
            Dealer GEX {effMode === 'split' ? '(Call / Put)' : effMode === 'net' ? '(Net)' : '(Combined)'}
          </text>

          {/* Colour legend for split/combined so the purple Net overlay reads
              unambiguously. */}
          {legend.map((item, i, arr) => {
            const slot = 48;
            const x = PLOT_X1 - (arr.length - i) * slot;
            return (
              <g key={item.label}>
                <rect x={x} y={PLOT_TOP - 17} width={9} height={9} fill={item.color} rx={1.5} />
                <text
                  x={x + 12}
                  y={PLOT_TOP - 9}
                  fontSize={10}
                  fill="var(--color-text-secondary)"
                  fontWeight={700}
                >
                  {item.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
