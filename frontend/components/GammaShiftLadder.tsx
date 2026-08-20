'use client';

/**
 * GammaShiftLadder — "Gamma Shift"
 *
 * The industry standard GEX view shows a *snapshot*: where dealer gamma sits
 * right now (walls, flip, profile).  Every competitor stops there.  This
 * component shows the **derivative** — how dealer gamma at each strike has
 * *changed* between two points in time (A → B) — so a trader sees which walls
 * are BUILDING and which are ERODING, not just where they are.
 *
 * Everything is computed client-side from data the app already caches: the
 * per-strike gamma time series (``useStrikeProfileTimeseries``) holds ~78
 * buckets of rewind, each carrying every strike's net/call/put gamma and open
 * interest plus that bucket's spot, gamma flip and call/put walls.  Pick any
 * two buckets and diff them — no new endpoint required.
 *
 * Encoding (unambiguous, sign-honest):
 *   • GREEN bar → net dealer gamma at that strike ROSE (more positive / more
 *     long-gamma here → more pinning, vol-suppressing force).
 *   • RED bar   → net dealer gamma FELL (more negative / more short-gamma here
 *     → more accelerant, vol-amplifying force).
 *   Bar length is proportional to the size of the change.
 *
 * Two lenses on the change:
 *   • "Net change"   — raw ΔGEX = gamma(B) − gamma(A) at the strike.
 *   • "Positioning"  — the part of the change driven by open-interest changing
 *     (contracts actually added/removed), separated from pure re-pricing of the
 *     existing book as spot/IV moved.  This is the honest "did dealers really
 *     reposition here, or did the same book just re-value?" signal that raw
 *     level-differencing conflates.
 */

import { useMemo, useRef, useState, useCallback, type ReactNode } from 'react';
import { ArrowUp, ArrowDown, ArrowRight, Info } from 'lucide-react';
import {
  useStrikeProfileTimeseries,
  type StrikeProfileBucket,
} from '@/hooks/useStrikeProfileTimeseries';
import { useChartTheme } from '@/hooks/useChartTheme';
import { useTimeframe } from '@/core/TimeframeContext';
import { useChartExpirations } from '@/hooks/useChartExpirations';
import { useGexUnit, gexScaleFactor, GEX_UNIT_LABEL } from '@/core/GexUnitContext';
import { useStrikeFilter } from '@/core/StrikeFilterContext';
import { formatGexCompact } from '@/core/signalHelpers';
import ChartCaption from './ChartCaption';
import ExpirationMultiSelect from './ExpirationMultiSelect';
import TooltipWrapper from './TooltipWrapper';

// ────────────────────────────────────────────────────────────────────────────
// helpers
// ────────────────────────────────────────────────────────────────────────────

/** Coerce the loosely-typed (number | string | null) API fields to a finite
 * number, defaulting to 0.  The timeseries payload arrives as strings from PG
 * numeric columns in some builds, so every read goes through this. */
function num(v: number | string | null | undefined): number {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  const n = parseFloat(String(v ?? ''));
  return Number.isFinite(n) ? n : 0;
}

/** Signed compact-USD, always showing the sign for non-zero values. */
function fmtSigned(value: number): string {
  if (!Number.isFinite(value) || value === 0) return '$0';
  const body = formatGexCompact(Math.abs(value)); // "$1.2B"
  return `${value > 0 ? '+' : '−'}${body}`;
}

function fmtTime(iso: string | null | undefined): string {
  if (!iso) return '--:--';
  try {
    return new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'America/New_York',
    }).format(new Date(iso));
  } catch {
    return '--:--';
  }
}

/** Nearest strike-tick label (drops trailing .0). */
function fmtStrike(strike: number): string {
  return Number.isInteger(strike) ? String(strike) : strike.toFixed(strike < 50 ? 1 : 0);
}

// ────────────────────────────────────────────────────────────────────────────
// per-strike diff model
// ────────────────────────────────────────────────────────────────────────────

interface ShiftRow {
  strike: number;
  netA: number;
  netB: number;
  dNet: number; // netB - netA  (signed dollars, per-1% convention)
  positioning: number; // OI-driven component of dNet
  repricing: number; // dNet - positioning
  callOiA: number;
  callOiB: number;
  putOiA: number;
  putOiB: number;
}

interface StrikeAgg {
  net: number;
  callGamma: number;
  putGamma: number;
  callOi: number;
  putOi: number;
}

function aggregateBucket(bucket: StrikeProfileBucket): Map<number, StrikeAgg> {
  const map = new Map<number, StrikeAgg>();
  for (const s of bucket.strikes ?? []) {
    const strike = num(s.strike);
    if (!Number.isFinite(strike) || strike <= 0) continue;
    const prev = map.get(strike);
    const add: StrikeAgg = {
      net: num(s.net_gamma),
      callGamma: num(s.call_gamma),
      putGamma: num(s.put_gamma),
      callOi: num(s.call_oi),
      putOi: num(s.put_oi),
    };
    if (prev) {
      prev.net += add.net;
      prev.callGamma += add.callGamma;
      prev.putGamma += add.putGamma;
      prev.callOi += add.callOi;
      prev.putOi += add.putOi;
    } else {
      map.set(strike, add);
    }
  }
  return map;
}

/**
 * Decompose the change in one leg's dollar gamma into a positioning
 * (OI-driven) part.  Using a per-contract dollar-gamma unit taken from the
 * reference snapshot (A when it carries OI, else B), the positioning part is
 * ``unitGamma × ΔOI`` — the gamma attributable to contracts being added or
 * removed, holding per-contract gamma fixed.  The remainder (returned by the
 * caller as dNet − positioning) is re-pricing of the surviving book.
 */
function positioningLeg(gammaA: number, oiA: number, gammaB: number, oiB: number): number {
  const unit = oiA > 0 ? gammaA / oiA : oiB > 0 ? gammaB / oiB : 0;
  return unit * (oiB - oiA);
}

function buildRows(a: StrikeProfileBucket, b: StrikeProfileBucket): ShiftRow[] {
  const ma = aggregateBucket(a);
  const mb = aggregateBucket(b);
  const strikes = new Set<number>([...ma.keys(), ...mb.keys()]);
  const rows: ShiftRow[] = [];
  const ZERO: StrikeAgg = { net: 0, callGamma: 0, putGamma: 0, callOi: 0, putOi: 0 };
  for (const strike of strikes) {
    const A = ma.get(strike) ?? ZERO;
    const B = mb.get(strike) ?? ZERO;
    const dNet = B.net - A.net;
    const positioning =
      positioningLeg(A.callGamma, A.callOi, B.callGamma, B.callOi) +
      positioningLeg(A.putGamma, A.putOi, B.putGamma, B.putOi);
    rows.push({
      strike,
      netA: A.net,
      netB: B.net,
      dNet,
      positioning,
      repricing: dNet - positioning,
      callOiA: A.callOi,
      callOiB: B.callOi,
      putOiA: A.putOi,
      putOiB: B.putOi,
    });
  }
  rows.sort((x, y) => x.strike - y.strike);
  return rows;
}

// ────────────────────────────────────────────────────────────────────────────
// time range selector (two draggable handles over the bucket timeline)
// ────────────────────────────────────────────────────────────────────────────

function RangeSelector({
  buckets,
  aIdx,
  bIdx,
  onChange,
  accent,
}: {
  buckets: StrikeProfileBucket[];
  aIdx: number;
  bIdx: number;
  onChange: (a: number, b: number) => void;
  accent: string;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const last = buckets.length - 1;
  const pct = (i: number) => (last <= 0 ? 0 : (i / last) * 100);

  const idxFromClientX = useCallback(
    (clientX: number): number => {
      const el = trackRef.current;
      if (!el) return 0;
      const r = el.getBoundingClientRect();
      const frac = Math.max(0, Math.min(1, (clientX - r.left) / Math.max(1, r.width)));
      return Math.round(frac * last);
    },
    [last],
  );

  const startDrag = useCallback(
    (which: 'a' | 'b') => (e: React.PointerEvent) => {
      e.preventDefault();
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
      const move = (ev: PointerEvent) => {
        const idx = idxFromClientX(ev.clientX);
        if (which === 'a') onChange(Math.min(idx, bIdx - 1), bIdx);
        else onChange(aIdx, Math.max(idx, aIdx + 1));
      };
      const up = () => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
    },
    [aIdx, bIdx, idxFromClientX, onChange],
  );

  const handle = (which: 'a' | 'b', i: number, label: string) => (
    <button
      type="button"
      onPointerDown={startDrag(which)}
      role="slider"
      aria-label={`${which === 'a' ? 'From' : 'To'} time`}
      aria-valuetext={label}
      aria-valuemin={0}
      aria-valuemax={last}
      aria-valuenow={i}
      className="absolute top-1/2 flex h-5 w-5 -translate-x-1/2 -translate-y-1/2 cursor-grab touch-none items-center justify-center rounded-full active:cursor-grabbing"
      style={{
        left: `${pct(i)}%`,
        background: 'var(--bg-card)',
        border: `2px solid ${accent}`,
        boxShadow: '0 1px 4px rgba(0,0,0,0.25)',
      }}
    >
      <span className="text-[9px] font-bold" style={{ color: accent }}>
        {which === 'a' ? 'A' : 'B'}
      </span>
    </button>
  );

  return (
    <div className="select-none">
      <div ref={trackRef} className="relative h-6">
        {/* base track */}
        <div
          className="absolute top-1/2 h-1 w-full -translate-y-1/2 rounded-full"
          style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-default)' }}
        />
        {/* selected segment */}
        <div
          className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full"
          style={{ left: `${pct(aIdx)}%`, width: `${pct(bIdx) - pct(aIdx)}%`, background: accent, opacity: 0.55 }}
        />
        {handle('a', aIdx, fmtTime(buckets[aIdx]?.timestamp))}
        {handle('b', bIdx, fmtTime(buckets[bIdx]?.timestamp))}
      </div>
      <div className="mt-1.5 flex justify-between text-[11px]" style={{ color: 'var(--text-muted)' }}>
        <span>
          <span style={{ color: accent, fontWeight: 700 }}>A</span> from ·{' '}
          <span className="font-mono">{fmtTime(buckets[aIdx]?.timestamp)}</span>
        </span>
        <span>
          <span style={{ color: accent, fontWeight: 700 }}>B</span> to ·{' '}
          <span className="font-mono">{fmtTime(buckets[bIdx]?.timestamp)}</span>
          {bIdx === last ? ' (now)' : ''}
        </span>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// small presentational bits
// ────────────────────────────────────────────────────────────────────────────

function StatTile({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div
      className="rounded-xl px-3 py-2"
      style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-default)' }}
    >
      <div className="text-[11px] uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
        {label}
      </div>
      <div className="font-mono text-lg font-bold" style={{ color }}>
        {value}
      </div>
    </div>
  );
}

interface WallMove {
  key: string;
  label: string;
  a: number;
  b: number;
  read: string;
  tone: 'up' | 'down' | 'flat';
}

const PRESETS: { key: string; label: string; buckets: number | 'session' }[] = [
  { key: '15m', label: 'Last 15m', buckets: 3 },
  { key: '30m', label: 'Last 30m', buckets: 6 },
  { key: '1h', label: 'Last 1h', buckets: 12 },
  { key: 'session', label: 'Since open', buckets: 'session' },
];

// ────────────────────────────────────────────────────────────────────────────
// main component
// ────────────────────────────────────────────────────────────────────────────

export default function GammaShiftLadder({ symbol: symbolProp }: { symbol?: string }) {
  const chart = useChartTheme();
  const { symbol: ctxSymbol } = useTimeframe();
  const symbol = symbolProp ?? ctxSymbol;
  // Tab-shared expiration selection, reconciled to the expirations this symbol
  // can actually serve (a pick made on another symbol's chart must not leak a
  // foreign date into the param). Empty selection = "all", the default.
  const { available, selection, setSelection, param: expParam } = useChartExpirations(symbol, true);
  const { gexUnit } = useGexUnit();
  const { activeOnly } = useStrikeFilter();

  // '5min' shares the cache key the GEX Strike Profile page already warms, and
  // 78 five-minute buckets ≈ a full RTH session of rewind depth.
  const { buckets, loading, error } = useStrikeProfileTimeseries(symbol, '5min', expParam);

  const [preset, setPreset] = useState<string>('session');
  // Custom A/B are stored as indices; while a preset is active they are derived
  // from the live edge each render so B tracks the latest bucket automatically.
  const [custom, setCustom] = useState<{ a: number; b: number } | null>(null);

  const n = buckets.length;
  const { aIdx, bIdx } = useMemo(() => {
    if (n < 2) return { aIdx: 0, bIdx: Math.max(0, n - 1) };
    if (preset === 'custom' && custom) {
      const b = Math.min(Math.max(custom.b, 1), n - 1);
      const a = Math.min(Math.max(custom.a, 0), b - 1);
      return { aIdx: a, bIdx: b };
    }
    const b = n - 1;
    const p = PRESETS.find((x) => x.key === preset);
    const back = p?.buckets === 'session' ? b : typeof p?.buckets === 'number' ? p.buckets : 6;
    return { aIdx: Math.max(0, b - back), bIdx: b };
  }, [n, preset, custom]);

  const bucketA = buckets[aIdx];
  const bucketB = buckets[bIdx];
  const [lens, setLens] = useState<'net' | 'positioning'>('net');

  const scale = useMemo(
    () => gexScaleFactor(gexUnit, bucketB ? num(bucketB.close) : null),
    [gexUnit, bucketB],
  );

  const rows = useMemo(
    () => (bucketA && bucketB ? buildRows(bucketA, bucketB) : []),
    [bucketA, bucketB],
  );

  const spot = bucketB ? num(bucketB.close) : 0;

  // Window the ladder to a readable set: active strikes bracketing spot, always
  // keeping the wall/flip levels visible even if they sit outside the window.
  const view = useMemo(() => {
    if (rows.length === 0) return { shown: [] as ShiftRow[], maxAbs: 0, totalUp: 0, totalDown: 0 };
    const val = (r: ShiftRow) => (lens === 'net' ? r.dNet : r.positioning);

    const wallStrikes = new Set<number>();
    for (const bkt of [bucketA, bucketB]) {
      [bkt?.call_wall, bkt?.put_wall, bkt?.gamma_flip].forEach((w) => {
        const s = num(w);
        if (s > 0) wallStrikes.add(s);
      });
    }

    let pool = rows;
    if (activeOnly) {
      pool = rows.filter(
        (r) =>
          r.callOiB + r.putOiB > 0 ||
          r.callOiA + r.putOiA > 0 ||
          wallStrikes.has(r.strike),
      );
      if (pool.length === 0) pool = rows;
    }

    // ±13 strikes around spot, unioned with wall/flip strikes.
    const WINDOW = 13;
    const asc = [...pool].sort((a, b) => a.strike - b.strike);
    let pivot = asc.findIndex((r) => r.strike >= spot);
    if (pivot < 0) pivot = asc.length - 1;
    const lo = Math.max(0, pivot - WINDOW);
    const hi = Math.min(asc.length, pivot + WINDOW + 1);
    const windowed = new Set(asc.slice(lo, hi).map((r) => r.strike));
    asc.forEach((r) => {
      if (wallStrikes.has(r.strike)) windowed.add(r.strike);
    });

    const shown = asc.filter((r) => windowed.has(r.strike));
    let maxAbs = 0;
    let totalUp = 0;
    let totalDown = 0;
    for (const r of rows) {
      const v = val(r);
      if (v > 0) totalUp += v;
      else totalDown += v;
    }
    for (const r of shown) maxAbs = Math.max(maxAbs, Math.abs(val(r)));
    return { shown: shown.reverse(), maxAbs, totalUp, totalDown };
  }, [rows, lens, activeOnly, spot, bucketA, bucketB]);

  // Wall / flip migration between A and B.
  const wallMoves = useMemo<WallMove[]>(() => {
    if (!bucketA || !bucketB) return [];
    const out: WallMove[] = [];
    const cwA = num(bucketA.call_wall);
    const cwB = num(bucketB.call_wall);
    const pwA = num(bucketA.put_wall);
    const pwB = num(bucketB.put_wall);
    const fA = num(bucketA.gamma_flip);
    const fB = num(bucketB.gamma_flip);

    if (cwA > 0 && cwB > 0) {
      const d = cwB - cwA;
      out.push({
        key: 'cw',
        label: 'Call Wall',
        a: cwA,
        b: cwB,
        tone: d > 0 ? 'up' : d < 0 ? 'down' : 'flat',
        read:
          d === 0
            ? 'held — resistance steady'
            : d > 0
              ? 'lifted — ceiling rising, more room above'
              : 'dropped — resistance pulled lower',
      });
    }
    if (pwA > 0 && pwB > 0) {
      const d = pwB - pwA;
      out.push({
        key: 'pw',
        label: 'Put Wall',
        a: pwA,
        b: pwB,
        tone: d > 0 ? 'up' : d < 0 ? 'down' : 'flat',
        read:
          d === 0
            ? 'held — support steady'
            : d > 0
              ? 'lifted — floor firming higher'
              : 'dropped — support giving way lower',
      });
    }
    if (fA > 0 && fB > 0) {
      const d = fB - fA;
      const distB = spot > 0 ? fB - spot : 0;
      const towardSpot = Math.abs(fB - spot) < Math.abs(fA - spot);
      out.push({
        key: 'flip',
        label: 'Gamma Flip',
        a: fA,
        b: fB,
        tone: d > 0 ? 'up' : d < 0 ? 'down' : 'flat',
        read:
          d === 0
            ? `steady, ${distB >= 0 ? 'above' : 'below'} spot`
            : towardSpot
              ? 'sliding toward spot — cushion thinning, fragility rising'
              : 'sliding away from spot — regime firming up',
      });
    }
    return out;
  }, [bucketA, bucketB, spot]);

  // Biggest movers by the active lens.
  const movers = useMemo(() => {
    const val = (r: ShiftRow) => (lens === 'net' ? r.dNet : r.positioning);
    const sorted = [...rows].sort((a, b) => Math.abs(val(b)) - Math.abs(val(a)));
    const up = sorted.filter((r) => val(r) > 0).slice(0, 3);
    const down = sorted.filter((r) => val(r) < 0).slice(0, 3);
    return { up, down, val };
  }, [rows, lens]);

  // One-line narrative.
  const narrative = useMemo(() => {
    if (!bucketA || !bucketB || rows.length === 0) return '';
    const val = (r: ShiftRow) => (lens === 'net' ? r.dNet : r.positioning);
    const topUp = [...rows].sort((a, b) => val(b) - val(a))[0];
    const topDown = [...rows].sort((a, b) => val(a) - val(b))[0];
    const parts: string[] = [];
    if (topUp && val(topUp) > 0) {
      const side = topUp.strike >= spot ? 'above spot' : 'below spot';
      parts.push(
        `dealers added the most gamma at ${fmtStrike(topUp.strike)} (${fmtSigned(
          val(topUp) * scale,
        )}, ${side})`,
      );
    }
    if (topDown && val(topDown) < 0) {
      const side = topDown.strike >= spot ? 'above spot' : 'below spot';
      parts.push(
        `shed the most at ${fmtStrike(topDown.strike)} (${fmtSigned(val(topDown) * scale)}, ${side})`,
      );
    }
    const flip = wallMoves.find((w) => w.key === 'flip');
    const tail = flip ? ` Gamma flip ${flip.read.split('—')[0].trim()}.` : '';
    if (parts.length === 0) return 'Little net repositioning between the two snapshots.';
    return `Between ${fmtTime(bucketA.timestamp)} and ${fmtTime(bucketB.timestamp)} ET, ${parts.join(
      '; ',
    )}.${tail}`;
  }, [bucketA, bucketB, rows, lens, spot, scale, wallMoves]);

  // ── render guards ─────────────────────────────────────────────────────────
  const card = 'rounded-2xl p-5 sm:p-6';
  const cardStyle = { background: 'var(--bg-card)', border: '1px solid var(--border-default)' } as const;

  // The expiry filter renders in EVERY state (error / loading / too-few-buckets
  // included) so a filtered selection that returns no data can always be
  // switched back to "All" without leaving the card.
  const expiryControl = (
    <ExpirationMultiSelect
      options={available}
      selected={selection}
      onChange={setSelection}
      label="Expiry"
      disabled={available.length === 0}
    />
  );

  if (error) {
    return (
      <div className={card} style={cardStyle}>
        <Heading symbol={symbol} control={expiryControl} />
        <div className="flex h-[280px] items-center justify-center text-sm" style={{ color: chart.bear }}>
          {error === 'No data available yet'
            ? `No gamma timeseries for ${symbol} yet.`
            : `Failed to load gamma timeseries: ${error}`}
        </div>
      </div>
    );
  }
  if ((loading && n === 0) || n === 0) {
    return (
      <div className={card} style={cardStyle}>
        <Heading symbol={symbol} control={expiryControl} />
        <div className="flex h-[280px] items-center justify-center text-sm" style={{ color: 'var(--text-secondary)' }}>
          Loading gamma timeseries…
        </div>
      </div>
    );
  }
  if (n < 2) {
    return (
      <div className={card} style={cardStyle}>
        <Heading symbol={symbol} control={expiryControl} />
        <div className="flex h-[280px] items-center justify-center px-6 text-center text-sm" style={{ color: 'var(--text-secondary)' }}>
          Only one snapshot so far — Gamma Shift needs two points in time. Check back after the next update.
        </div>
      </div>
    );
  }

  const bull = chart.bull;
  const bear = chart.bear;
  const accent = chart.accent || 'var(--color-accent)';

  return (
    <div className={card} style={cardStyle}>
      <Heading symbol={symbol} control={expiryControl} />

      {/* ── time selection ─────────────────────────────────────────────── */}
      <div className="mb-4 mt-5">
        <div className="mb-2 flex items-baseline justify-between gap-2">
          <span className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
            Time window
          </span>
          <span
            className="rounded-md px-2 py-1 font-mono text-sm font-semibold"
            style={{
              color: 'var(--text-primary)',
              background: 'var(--bg-subtle)',
              border: '1px solid var(--border-default)',
            }}
          >
            {fmtTime(bucketA?.timestamp)} <span style={{ color: 'var(--text-muted)' }}>→</span>{' '}
            {fmtTime(bucketB?.timestamp)} <span style={{ color: 'var(--text-muted)' }}>ET</span>
          </span>
        </div>
        <p className="mb-3 text-[11px]" style={{ color: 'var(--text-muted)' }}>
          Compare an earlier moment against the latest data. Choose how far back to look — or drag the
          handles for any two times.
        </p>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {PRESETS.map((p) => {
            const activeP = preset === p.key;
            return (
              <button
                key={p.key}
                type="button"
                onClick={() => {
                  setPreset(p.key);
                  setCustom(null);
                }}
                className="rounded-full px-3 py-1 text-xs font-medium transition-colors"
                style={{
                  background: activeP ? accent : 'var(--bg-subtle)',
                  color: activeP ? '#fff' : 'var(--text-secondary)',
                  border: `1px solid ${activeP ? accent : 'var(--border-default)'}`,
                }}
              >
                {p.label}
              </button>
            );
          })}
          {preset === 'custom' && (
            <span
              className="rounded-full px-3 py-1 text-xs font-medium"
              style={{ background: accent, color: '#fff', border: `1px solid ${accent}` }}
            >
              Custom
            </span>
          )}
        </div>
        <RangeSelector
          buckets={buckets}
          aIdx={aIdx}
          bIdx={bIdx}
          accent={accent}
          onChange={(a, b) => {
            setPreset('custom');
            setCustom({ a, b });
          }}
        />
      </div>

      {/* ── headline stats ─────────────────────────────────────────────── */}
      <div className="mb-4 grid grid-cols-3 gap-2">
        <StatTile label="Gamma added" value={fmtSigned(view.totalUp * scale)} color={bull} />
        <StatTile label="Gamma shed" value={fmtSigned(view.totalDown * scale)} color={bear} />
        <StatTile
          label="Net shift"
          value={fmtSigned((view.totalUp + view.totalDown) * scale)}
          color={view.totalUp + view.totalDown >= 0 ? bull : bear}
        />
      </div>

      {/* ── narrative ──────────────────────────────────────────────────── */}
      {narrative && (
        <p className="mb-4 text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
          {narrative}
        </p>
      )}

      {/* ── how to read ────────────────────────────────────────────────── */}
      <div
        className="mb-3 rounded-lg px-3 py-2 text-[11px] leading-relaxed"
        style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-default)', color: 'var(--text-secondary)' }}
      >
        <strong style={{ color: 'var(--text-primary)' }}>How to read:</strong> each row is a strike.
        A bar grows{' '}
        <span style={{ color: bull, fontWeight: 700 }}>right (green)</span> where dealers{' '}
        <strong>added</strong> gamma and{' '}
        <span style={{ color: bear, fontWeight: 700 }}>left (red)</span> where they{' '}
        <strong>removed</strong> it between your two times. Longer bar = bigger change. The dashed line
        marks the current price.
      </div>

      {/* ── legend + lens ──────────────────────────────────────────────── */}
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3 text-[11px]" style={{ color: 'var(--text-muted)' }}>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-4 rounded-sm" style={{ background: bear }} /> removed / more short-γ
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-4 rounded-sm" style={{ background: bull }} /> added / more long-γ
          </span>
        </div>
        <LensToggle lens={lens} setLens={setLens} accent={accent} />
      </div>
      <p className="mb-2 text-[11px]" style={{ color: 'var(--text-muted)' }}>
        {lens === 'net'
          ? 'Total change — every reason gamma moved between the two times (dealers repositioning, plus the existing book re-pricing as spot moved).'
          : 'Repositioning — only the part from dealers actually opening or closing contracts; strips out price-driven re-pricing.'}
      </p>

      {/* column headers */}
      <div
        className="mb-1 flex items-center gap-2 px-2 text-[10px] font-semibold uppercase tracking-wide"
        style={{ color: 'var(--text-muted)' }}
      >
        <div className="w-16 shrink-0 text-right">Strike</div>
        <div className="flex-1 text-center">← removed · added →</div>
        <div className="w-20 shrink-0 text-right">Change</div>
      </div>

      <Ladder
        shown={view.shown}
        maxAbs={view.maxAbs}
        spot={spot}
        scale={scale}
        lens={lens}
        bull={bull}
        bear={bear}
        accent={accent}
        callWallB={num(bucketB?.call_wall)}
        putWallB={num(bucketB?.put_wall)}
        flipB={num(bucketB?.gamma_flip)}
      />

      {/* ── wall migration + movers ────────────────────────────────────── */}
      <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <h4 className="mb-2 text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>
            Wall migration
          </h4>
          <div className="space-y-2">
            {wallMoves.length === 0 && (
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                No resolved walls in this window.
              </p>
            )}
            {wallMoves.map((w) => (
              <WallRow key={w.key} move={w} bull={bull} bear={bear} muted="var(--text-muted)" />
            ))}
          </div>
        </div>
        <div>
          <h4 className="mb-2 text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>
            Biggest movers
          </h4>
          <div className="grid grid-cols-2 gap-x-4">
            <MoverList title="Building" rows={movers.up} val={movers.val} scale={scale} color={bull} />
            <MoverList title="Eroding" rows={movers.down} val={movers.val} scale={scale} color={bear} />
          </div>
        </div>
      </div>

      {/* ── methodology caveat ─────────────────────────────────────────── */}
      <p className="mt-5 text-[11px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
        Modeled dealer gamma (calls positive, puts negative open-interest convention); actual dealer
        inventory is not directly observable from public option-chain data. Values shown {GEX_UNIT_LABEL[gexUnit]}.{' '}
        {lens === 'net'
          ? '“Total change” is the full change in dealer gamma at each strike between your two times — both genuine repositioning and re-pricing of the existing book as spot and implied vol moved.'
          : '“Repositioning” isolates the part of the change driven by open interest — contracts actually opened or closed — separating real dealer repositioning from price-driven re-pricing (a first-order estimate).'}
      </p>

      <ChartCaption />
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// sub-render helpers
// ────────────────────────────────────────────────────────────────────────────

function Heading({ symbol, control }: { symbol: string; control?: ReactNode }) {
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="zg-h3" style={{ color: 'var(--text-primary)' }}>
          Gamma Shift
        </h3>
        <TooltipWrapper text="How dealer gamma at each strike has CHANGED between two points in time — not just where it sits now. Green means gamma rose at that strike (more long-gamma / pinning force); red means it fell (more short-gamma / accelerant). Set the two times with the presets, or drag the From and To handles. The Expiry filter scopes every number on the card to the selected expirations (default: all).">
          <Info size={14} />
        </TooltipWrapper>
        <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
          {symbol}
        </span>
        {control && <span className="ml-auto">{control}</span>}
      </div>
      <p className="mt-1 text-sm leading-snug" style={{ color: 'var(--text-secondary)' }}>
        See how dealer gamma at each strike{' '}
        <strong style={{ color: 'var(--text-primary)' }}>changed</strong> from an earlier moment to
        now — which walls are building, and which are eroding.
      </p>
    </div>
  );
}

function LensToggle({
  lens,
  setLens,
  accent,
}: {
  lens: 'net' | 'positioning';
  setLens: (l: 'net' | 'positioning') => void;
  accent: string;
}) {
  const opt = (key: 'net' | 'positioning', label: string) => {
    const on = lens === key;
    return (
      <button
        key={key}
        type="button"
        onClick={() => setLens(key)}
        className="rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors"
        style={{
          background: on ? accent : 'transparent',
          color: on ? '#fff' : 'var(--text-secondary)',
        }}
      >
        {label}
      </button>
    );
  };
  return (
    <div
      className="inline-flex rounded-lg p-0.5"
      style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-default)' }}
    >
      {opt('net', 'Total change')}
      {opt('positioning', 'Repositioning')}
    </div>
  );
}

function Ladder({
  shown,
  maxAbs,
  spot,
  scale,
  lens,
  bull,
  bear,
  accent,
  callWallB,
  putWallB,
  flipB,
}: {
  shown: ShiftRow[];
  maxAbs: number;
  spot: number;
  scale: number;
  lens: 'net' | 'positioning';
  bull: string;
  bear: string;
  accent: string;
  callWallB: number;
  putWallB: number;
  flipB: number;
}) {
  const val = (r: ShiftRow) => (lens === 'net' ? r.dNet : r.positioning);
  const safeMax = maxAbs > 0 ? maxAbs : 1;

  const tag = (strike: number): { text: string; color: string } | null => {
    if (strike === callWallB) return { text: 'Call Wall', color: bear };
    if (strike === putWallB) return { text: 'Put Wall', color: bull };
    if (strike === flipB) return { text: 'Flip', color: accent };
    return null;
  };

  return (
    <div
      className="rounded-xl p-2"
      style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-default)' }}
    >
      {shown.map((r, i) => {
        const v = val(r) * scale;
        const w = Math.min(50, (Math.abs(val(r)) / safeMax) * 50);
        const pos = v >= 0;
        const label = tag(r.strike);
        // spot divider: spot sits between this row and the one above (higher strike)
        const prev = shown[i - 1];
        const showSpotAbove =
          spot > 0 && prev && prev.strike >= spot && r.strike < spot;
        return (
          <div key={r.strike}>
            {showSpotAbove && <SpotDivider spot={spot} accent={accent} />}
            <div className="group flex items-center gap-2 py-[3px]" title={tooltipFor(r, scale, lens)}>
              {/* strike label */}
              <div className="w-16 shrink-0 text-right">
                <span
                  className="font-mono text-xs font-semibold"
                  style={{ color: label ? label.color : 'var(--text-secondary)' }}
                >
                  {fmtStrike(r.strike)}
                </span>
                {label && (
                  <span className="ml-1 hidden text-[9px] font-bold sm:inline" style={{ color: label.color }}>
                    {label.text}
                  </span>
                )}
              </div>
              {/* diverging bar track */}
              <div className="relative h-4 flex-1">
                <div
                  className="absolute top-0 h-full"
                  style={{ left: '50%', width: '1px', background: 'var(--border-strong)' }}
                />
                <div
                  className="absolute top-1/2 h-[10px] -translate-y-1/2 rounded-[2px]"
                  style={{
                    background: pos ? bull : bear,
                    ...(pos ? { left: '50%', width: `${w}%` } : { right: '50%', width: `${w}%` }),
                  }}
                />
              </div>
              {/* value */}
              <div className="w-20 shrink-0 text-right">
                <span className="font-mono text-[11px]" style={{ color: pos ? bull : bear }}>
                  {fmtSigned(v)}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SpotDivider({ spot, accent }: { spot: number; accent: string }) {
  return (
    <div className="flex items-center gap-2 py-1">
      <div className="w-16 shrink-0" />
      <div className="relative h-0 flex-1">
        <div className="absolute inset-x-0 top-0 border-t border-dashed" style={{ borderColor: accent, opacity: 0.7 }} />
      </div>
      <div className="w-20 shrink-0 text-right">
        <span className="font-mono text-[10px] font-bold" style={{ color: accent }}>
          spot {fmtStrike(spot)}
        </span>
      </div>
    </div>
  );
}

function tooltipFor(r: ShiftRow, scale: number, lens: 'net' | 'positioning'): string {
  const dNet = fmtSigned(r.dNet * scale);
  const pos = fmtSigned(r.positioning * scale);
  const rep = fmtSigned(r.repricing * scale);
  const oi = `ΔOI  calls ${signedInt(r.callOiB - r.callOiA)}, puts ${signedInt(r.putOiB - r.putOiA)}`;
  return (
    `Strike ${fmtStrike(r.strike)}\n` +
    `Net γ: ${fmtSigned(r.netA * scale)} → ${fmtSigned(r.netB * scale)}\n` +
    `Δ net: ${dNet}\n` +
    `  · positioning: ${pos}\n` +
    `  · re-pricing: ${rep}\n` +
    `${oi}\n` +
    `(showing ${lens === 'net' ? 'net change' : 'positioning'})`
  );
}

function signedInt(v: number): string {
  const r = Math.round(v);
  return `${r > 0 ? '+' : ''}${r.toLocaleString()}`;
}

function WallRow({
  move,
  bull,
  bear,
  muted,
}: {
  move: WallMove;
  bull: string;
  bear: string;
  muted: string;
}) {
  const Icon = move.tone === 'up' ? ArrowUp : move.tone === 'down' ? ArrowDown : ArrowRight;
  const color = move.tone === 'up' ? bull : move.tone === 'down' ? bear : muted;
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-16 shrink-0 font-semibold" style={{ color: 'var(--text-secondary)' }}>
        {move.label}
      </span>
      <span className="font-mono" style={{ color: 'var(--text-primary)' }}>
        {fmtStrike(move.a)}
      </span>
      <Icon size={13} style={{ color }} />
      <span className="font-mono font-semibold" style={{ color }}>
        {fmtStrike(move.b)}
      </span>
      <span className="truncate" style={{ color: muted }}>
        {move.read}
      </span>
    </div>
  );
}

function MoverList({
  title,
  rows,
  val,
  scale,
  color,
}: {
  title: string;
  rows: ShiftRow[];
  val: (r: ShiftRow) => number;
  scale: number;
  color: string;
}) {
  return (
    <div>
      <div className="mb-1 text-[11px] font-semibold" style={{ color }}>
        {title}
      </div>
      {rows.length === 0 ? (
        <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
          —
        </div>
      ) : (
        rows.map((r) => (
          <div key={r.strike} className="flex items-center justify-between text-[11px]">
            <span className="font-mono" style={{ color: 'var(--text-secondary)' }}>
              {fmtStrike(r.strike)}
            </span>
            <span className="font-mono" style={{ color }}>
              {fmtSigned(val(r) * scale)}
            </span>
          </div>
        ))
      )}
    </div>
  );
}
