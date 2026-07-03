'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link2, Pause, Play, Twitter } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { capture } from '@/core/telemetry/posthog-client';

// Interactive replay of one trading day's per-minute GEX frames. Pure
// client-side once the initial range payload is hydrated — scrubbing
// renders from in-memory state with no per-frame network call.
//
// Layout: single SVG that shares one price/strike Y-axis between the
// left-side candlestick chart (5-min OHLC bars aggregated from the same
// per-minute payload the GEX frames use) and the right-side horizontal
// strike-profile bars, mirroring the GEX Strike Profile page so a
// viewer's spatial intuition transfers. Scrubbing still advances one
// minute at a time and the GEX ladder still updates every minute — the
// candlestick just presents that minute inside its 5-min bucket. The
// bucket that contains the cursor grows minute-by-minute (open pinned,
// close/high/low expand as bars come in), past buckets stay sealed at
// their full OHLC, and future buckets render at 25% opacity and light
// to 100% as the cursor sweeps in.

interface Frame {
  timestamp: string;
  gamma_flip: number | null;
  strikes: Array<{ strike: number | null; net_gex: number | null }>;
}

interface Candle {
  timestamp: string;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
  up_volume: number | null;
  down_volume: number | null;
  volume: number | null;
}

interface ReplayScrubberProps {
  symbol: string;
  sessionDate: string;
  initialFrames: Frame[];
  initialCandles: Candle[];
  siteUrl: string;
}

const PLAY_SPEEDS = [1, 4, 16, 60] as const;
type PlaySpeed = (typeof PLAY_SPEEDS)[number];

// Opacity for candles whose timestamp is later than the scrubber
// cursor — 75% transparent per the design so the "not yet reached"
// portion of the tape reads as ghosted context that will light up as
// the playhead sweeps into it.
const FUTURE_CANDLE_OPACITY = 0.25;

function formatTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'America/New_York',
      hour12: false,
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function isoToMinuteToken(iso: string): string {
  // 2026-06-29T14:30:00Z → 1430 (used by /snapshot/[time] permalink)
  try {
    const dt = new Date(iso);
    const parts = new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'America/New_York',
    }).formatToParts(dt);
    const hh = parts.find((p) => p.type === 'hour')?.value ?? '00';
    const mm = parts.find((p) => p.type === 'minute')?.value ?? '00';
    return `${hh}${mm}`;
  } catch {
    return '0930';
  }
}

// Pick `desired` evenly-spaced indices from 0..count-1 inclusive,
// deduping in case rounding lands two picks on the same integer. Used
// for both axes so the first and last labels always fall on the endpoints
// with the same spacing between every intermediate tick — no more
// "second-to-last tick is one bar away from the last" collisions at the
// chart edges.
function evenlySpacedIndices(count: number, desired: number): number[] {
  if (count <= 0) return [];
  if (count <= desired) return Array.from({ length: count }, (_, i) => i);
  const out: number[] = [];
  const denom = Math.max(1, desired - 1);
  for (let i = 0; i < desired; i += 1) {
    out.push(Math.round((i * (count - 1)) / denom));
  }
  return Array.from(new Set(out));
}

// Nice round tick values for a price axis: pick a step from the
// {1, 2, 5} × 10^k ladder that produces roughly ``target`` labels
// across [lo, hi], then walk the ladder at that step. Beats picking
// N evenly-spaced strikes from the chain — the price-axis ticks
// stay on round numbers (e.g. 715, 720, 725…) instead of drifting
// with the strike list's actual spacing.
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
  // Multiply-count rather than accumulate — repeated += drifts at
  // sub-integer steps (e.g. 0.1 accumulates FP error and the last
  // tick drops out at 0.7 * 10 = 7.000000000001).
  const count = Math.floor((hi - start) / step + 1e-9) + 1;
  for (let i = 0; i < count; i += 1) {
    const v = start + i * step;
    if (v > hi + 1e-9) break;
    ticks.push(v);
  }
  return ticks;
}

// Format a price-axis label with just enough precision to disambiguate
// neighbours at the chosen tick step, so a $5-step axis reads 715 / 720
// / 725 (no trailing .00) and a $0.10-step axis reads 715.0 / 715.1.
function formatPriceTick(v: number, step: number): string {
  if (!Number.isFinite(v)) return '';
  const decimals = step >= 1 ? 0 : step >= 0.1 ? 1 : 2;
  return v.toFixed(decimals);
}

// Abbreviate large magnitudes (dealer GEX runs to billions on SPX).
// "1.2B", "-450M", "12K" — matches how a trader reads OI / notional.
function formatMagnitude(v: number): string {
  if (!Number.isFinite(v)) return '—';
  const abs = Math.abs(v);
  const sign = v < 0 ? '-' : '';
  if (abs >= 1e9) return `${sign}${(abs / 1e9).toFixed(abs >= 1e10 ? 0 : 1)}B`;
  if (abs >= 1e6) return `${sign}${(abs / 1e6).toFixed(abs >= 1e7 ? 0 : 1)}M`;
  if (abs >= 1e3) return `${sign}${(abs / 1e3).toFixed(abs >= 1e4 ? 0 : 1)}K`;
  return `${sign}${abs.toFixed(0)}`;
}

// 5-min OHLC bucket for the candlestick tape. Backend still ships
// per-minute candles (same rows the per-minute GEX frames come from);
// we aggregate on the client so the scrubber, the GEX ladder, and the
// growing current-bucket candle all stay minute-aligned to one payload.
const FIVE_MIN_MS = 5 * 60_000;

interface CandleBucket {
  bucketStart: string;
  bucketStartMs: number;
  bucketEndMs: number;
  members: Candle[];
  fullOpen: number | null;
  fullHigh: number | null;
  fullLow: number | null;
  fullClose: number | null;
}

// Group 1-min candles by their 5-min floor and precompute the sealed
// OHLC of each bucket. Bucket keys are UTC-aligned to 5 min; the RTH
// open (9:30 ET) already lines up with a 5-min boundary in both EST
// and EDT so 9:30, 9:35, … bucket cleanly.
function bucketize5Min(candles: Candle[]): CandleBucket[] {
  const map = new Map<number, CandleBucket>();
  for (const c of candles) {
    const t = new Date(c.timestamp).getTime();
    if (!Number.isFinite(t)) continue;
    const key = Math.floor(t / FIVE_MIN_MS) * FIVE_MIN_MS;
    let b = map.get(key);
    if (!b) {
      b = {
        bucketStart: new Date(key).toISOString(),
        bucketStartMs: key,
        bucketEndMs: key + FIVE_MIN_MS,
        members: [],
        fullOpen: null,
        fullHigh: null,
        fullLow: null,
        fullClose: null,
      };
      map.set(key, b);
    }
    b.members.push(c);
  }
  const arr = Array.from(map.values()).sort(
    (a, b) => a.bucketStartMs - b.bucketStartMs,
  );
  for (const b of arr) {
    b.members.sort(
      (x, y) => new Date(x.timestamp).getTime() - new Date(y.timestamp).getTime(),
    );
    const first = b.members[0];
    const last = b.members[b.members.length - 1];
    b.fullOpen = first?.open ?? null;
    b.fullClose = last?.close ?? null;
    let h = Number.NEGATIVE_INFINITY;
    let l = Number.POSITIVE_INFINITY;
    for (const m of b.members) {
      if (m.high != null && Number.isFinite(m.high) && m.high > h) h = m.high;
      if (m.low != null && Number.isFinite(m.low) && m.low < l) l = m.low;
    }
    b.fullHigh = Number.isFinite(h) ? h : null;
    b.fullLow = Number.isFinite(l) ? l : null;
  }
  return arr;
}

// OHLC of the bucket considering only members whose timestamp ≤ limit.
// Drives the "growing" current bucket — open pins to the first minute
// that arrived, close tracks whichever minute the scrubber is on, and
// high/low expand as new minutes come in. For a fully-past bucket
// (limit ≥ bucketEnd) this returns the same values as the precomputed
// fullOHLC; for a fully-future bucket every member is skipped and all
// four come back null.
function partialBucketOHLC(
  bucket: CandleBucket,
  limitMs: number,
): { open: number | null; high: number | null; low: number | null; close: number | null } {
  let openVal: number | null = null;
  let closeVal: number | null = null;
  let h = Number.NEGATIVE_INFINITY;
  let l = Number.POSITIVE_INFINITY;
  for (const m of bucket.members) {
    const t = new Date(m.timestamp).getTime();
    if (!Number.isFinite(t) || t > limitMs) continue;
    if (openVal == null && m.open != null) openVal = m.open;
    if (m.close != null) closeVal = m.close;
    if (m.high != null && Number.isFinite(m.high) && m.high > h) h = m.high;
    if (m.low != null && Number.isFinite(m.low) && m.low < l) l = m.low;
  }
  return {
    open: openVal,
    high: Number.isFinite(h) ? h : null,
    low: Number.isFinite(l) ? l : null,
    close: closeVal,
  };
}

export default function ReplayScrubber({
  symbol,
  sessionDate,
  initialFrames,
  initialCandles,
  siteUrl,
}: ReplayScrubberProps) {
  const frames = initialFrames;
  const candles = initialCandles;
  const [cursor, setCursor] = useState<number>(frames.length > 0 ? frames.length - 1 : 0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState<PlaySpeed>(4);
  const [pinA, setPinA] = useState<number | null>(null);
  const [pinB, setPinB] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const playRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const currentFrame = frames[cursor] ?? frames[0];
  const cursorTimestamp = currentFrame?.timestamp ?? null;

  // Union of every strike seen across the session. Locks the strike
  // ladder so it doesn't jitter mid-playback when a strike drops in or
  // out of a frame's payload (nulls are filtered per-frame below).
  const allStrikes = useMemo(() => {
    const set = new Set<number>();
    for (const f of frames) {
      for (const s of f.strikes ?? []) {
        if (s.strike != null) set.add(s.strike);
      }
    }
    return Array.from(set).sort((a, b) => a - b);
  }, [frames]);

  // Strike → net GEX map for the cursor's minute. Zero-fill any union
  // strike missing from this frame so every strike-row on the ladder
  // renders (even if just as an empty rung).
  const strikeGexByStrike = useMemo(() => {
    const byStrike = new Map<number, number>();
    for (const s of currentFrame?.strikes ?? []) {
      if (s.strike != null && s.net_gex != null) byStrike.set(s.strike, s.net_gex);
    }
    return byStrike;
  }, [currentFrame]);

  const gammaFlip = currentFrame?.gamma_flip ?? null;

  // Session-wide GEX peak so the horizontal-bar magnitude axis stays
  // pinned as the user scrubs (otherwise the widest bar this minute
  // would drift with playback and every strike's bar would visually
  // resize even when its own value hadn't changed).
  const gexPeak = useMemo(() => {
    let peak = 0;
    for (const f of frames) {
      for (const s of f.strikes ?? []) {
        const v = s.net_gex;
        if (v == null || !Number.isFinite(v)) continue;
        const abs = Math.abs(v);
        if (abs > peak) peak = abs;
      }
    }
    return peak * 1.05 || 1;
  }, [frames]);

  // Union price range so candles and strikes share a Y-axis without
  // clipping. Candles set the tape's high/low; strikes contribute the
  // strike-ladder ceiling/floor. Padded ±3% so the highest and lowest
  // extremes aren't glued to the chart edge.
  const yBounds = useMemo(() => {
    let lo = Number.POSITIVE_INFINITY;
    let hi = Number.NEGATIVE_INFINITY;
    for (const c of candles) {
      if (c.low != null && Number.isFinite(c.low) && c.low < lo) lo = c.low;
      if (c.high != null && Number.isFinite(c.high) && c.high > hi) hi = c.high;
    }
    for (const s of allStrikes) {
      if (s < lo) lo = s;
      if (s > hi) hi = s;
    }
    if (!Number.isFinite(lo) || !Number.isFinite(hi) || hi <= lo) {
      return { lo: 0, hi: 1 };
    }
    const pad = (hi - lo) * 0.03 || 1;
    return { lo: lo - pad, hi: hi + pad };
  }, [candles, allStrikes]);

  useEffect(() => {
    if (!isPlaying) {
      if (playRef.current) clearInterval(playRef.current);
      playRef.current = null;
      return;
    }
    playRef.current = setInterval(
      () => {
        setCursor((prev) => {
          const next = prev + 1;
          return next >= frames.length ? 0 : next;
        });
      },
      Math.max(50, Math.round(1000 / speed)),
    );
    return () => {
      if (playRef.current) clearInterval(playRef.current);
      playRef.current = null;
    };
  }, [isPlaying, speed, frames.length]);

  const handleScrub = useCallback((value: number) => {
    setCursor(value);
    setIsPlaying(false);
  }, []);

  const dropPin = useCallback(
    (which: 'A' | 'B') => {
      if (which === 'A') setPinA(cursor);
      else setPinB(cursor);
    },
    [cursor],
  );

  const clearPins = useCallback(() => {
    setPinA(null);
    setPinB(null);
  }, []);

  const minuteToken = cursorTimestamp ? isoToMinuteToken(cursorTimestamp) : '0930';
  const snapshotPath = `/replay/${symbol}/${sessionDate}/snapshot/${minuteToken}`;
  const snapshotUrl = `${siteUrl}${snapshotPath}`;

  const handleCopyShare = async () => {
    try {
      await navigator.clipboard.writeText(snapshotUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
      capture('replay_share_clicked', {
        symbol,
        session_date: sessionDate,
        minute: minuteToken,
        channel: 'copy_link',
      });
    } catch {
      window.prompt('Copy this URL', snapshotUrl);
    }
  };

  const tweetBody = `${symbol} GEX surface at ${formatTime(cursorTimestamp ?? '')} ET on ${sessionDate}.`;
  const tweetHref = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
    tweetBody,
  )}&url=${encodeURIComponent(snapshotUrl)}`;

  // Diff between the two pins, when both are dropped. Computed inline
  // since the per-frame strike payload is small (~60 rows × 2 frames).
  const diffRows = useMemo(() => {
    if (pinA == null || pinB == null) return null;
    const a = frames[pinA];
    const b = frames[pinB];
    if (!a || !b) return null;
    const byStrike = new Map<number, { a: number; b: number }>();
    for (const s of a.strikes) {
      if (s.strike != null && s.net_gex != null) {
        byStrike.set(s.strike, { a: s.net_gex, b: 0 });
      }
    }
    for (const s of b.strikes) {
      if (s.strike != null && s.net_gex != null) {
        const entry = byStrike.get(s.strike);
        if (entry) entry.b = s.net_gex;
        else byStrike.set(s.strike, { a: 0, b: s.net_gex });
      }
    }
    return Array.from(byStrike.entries())
      .map(([strike, { a, b }]) => ({
        strike,
        delta: b - a,
        fill: b - a >= 0 ? 'var(--color-bull)' : 'var(--color-bear)',
      }))
      .sort((x, y) => y.strike - x.strike);
  }, [pinA, pinB, frames]);

  if (frames.length === 0) {
    return (
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-6 text-sm text-[var(--color-text-secondary)]">
        No frames available for this session.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Player controls */}
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-[10px] uppercase tracking-[0.22em] font-bold text-[var(--color-text-secondary)]">
              Now showing
            </div>
            <div className="mt-0.5 font-mono text-lg font-bold">
              {cursorTimestamp ? formatTime(cursorTimestamp) : '—'} ET
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setIsPlaying((p) => !p)}
              className="inline-flex items-center gap-1.5 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-surface-subtle)]"
            >
              {isPlaying ? <Pause size={13} /> : <Play size={13} />}
              {isPlaying ? 'Pause' : 'Play'}
            </button>
            <div className="inline-flex overflow-hidden rounded-md border border-[var(--color-border)] text-[10px] uppercase tracking-[0.14em]">
              {PLAY_SPEEDS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSpeed(s)}
                  className="px-2 py-1.5 transition-colors"
                  style={{
                    background:
                      speed === s ? 'var(--color-surface-subtle)' : 'var(--color-surface)',
                    color:
                      speed === s
                        ? 'var(--color-text-primary)'
                        : 'var(--color-text-secondary)',
                    fontWeight: 700,
                  }}
                >
                  {s}×
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => dropPin('A')}
              className="inline-flex items-center gap-1.5 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] hover:bg-[var(--color-surface-subtle)]"
              style={{ color: pinA != null ? 'var(--color-warning)' : 'var(--color-text-primary)' }}
            >
              Pin A {pinA != null && cursorTimestamp ? `· ${formatTime(frames[pinA].timestamp)}` : ''}
            </button>
            <button
              type="button"
              onClick={() => dropPin('B')}
              className="inline-flex items-center gap-1.5 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] hover:bg-[var(--color-surface-subtle)]"
              style={{ color: pinB != null ? 'var(--color-bull)' : 'var(--color-text-primary)' }}
            >
              Pin B {pinB != null && cursorTimestamp ? `· ${formatTime(frames[pinB].timestamp)}` : ''}
            </button>
            {(pinA != null || pinB != null) && (
              <button
                type="button"
                onClick={clearPins}
                className="text-[10px] uppercase tracking-[0.18em] font-bold text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
              >
                Clear pins
              </button>
            )}
          </div>
        </div>

        <div className="mt-4">
          <input
            type="range"
            min={0}
            max={frames.length - 1}
            value={cursor}
            onChange={(e) => handleScrub(Number(e.target.value))}
            className="w-full"
            aria-label="Scrub through replay frames"
          />
          <div className="mt-1 flex justify-between font-mono text-[10px] text-[var(--color-text-secondary)]">
            <span>{formatTime(frames[0]?.timestamp ?? '')}</span>
            <span>{formatTime(frames[frames.length - 1]?.timestamp ?? '')}</span>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleCopyShare}
            className="inline-flex items-center gap-1.5 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] hover:bg-[var(--color-surface-subtle)]"
          >
            <Link2 size={13} /> {copied ? 'Copied' : 'Snapshot this minute'}
          </button>
          <a
            href={tweetHref}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() =>
              capture('replay_share_clicked', {
                symbol,
                session_date: sessionDate,
                minute: minuteToken,
                channel: 'twitter',
              })
            }
            className="inline-flex items-center gap-1.5 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] hover:bg-[var(--color-surface-subtle)]"
          >
            <Twitter size={13} /> Share to X
          </a>
        </div>
      </div>

      {/* Combined candles + strike-profile overlay */}
      <ReplayOverlayChart
        symbol={symbol}
        candles={candles}
        strikes={allStrikes}
        strikeGex={strikeGexByStrike}
        gexPeak={gexPeak}
        yLo={yBounds.lo}
        yHi={yBounds.hi}
        gammaFlip={gammaFlip}
        cursorTimestamp={cursorTimestamp}
        pinATimestamp={pinA != null ? frames[pinA]?.timestamp ?? null : null}
        pinBTimestamp={pinB != null ? frames[pinB]?.timestamp ?? null : null}
      />

      {/* Pin diff — kept as its own card since it's a delta view between
          two moments, not something you overlay on live price action. */}
      {diffRows && (
        <div className="rounded-xl border-2 px-5 py-4" style={{ borderColor: 'var(--color-warning)', background: 'var(--color-surface)' }}>
          <div className="flex items-baseline justify-between gap-3">
            <div className="text-[10px] uppercase tracking-[0.22em] font-bold text-[var(--color-text-secondary)]">
              Pin diff · A→B
            </div>
            {pinA != null && pinB != null && (
              <div className="font-mono text-xs text-[var(--color-text-secondary)]">
                {formatTime(frames[pinA].timestamp)} → {formatTime(frames[pinB].timestamp)}
              </div>
            )}
          </div>
          <div className="mt-3 h-[380px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                layout="vertical"
                data={diffRows}
                margin={{ top: 8, right: 24, left: 16, bottom: 8 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis
                  type="number"
                  stroke="var(--color-text-secondary)"
                  tickFormatter={formatMagnitude}
                />
                <YAxis
                  type="category"
                  dataKey="strike"
                  stroke="var(--color-text-secondary)"
                  width={64}
                  tickFormatter={(v) => Number(v).toFixed(0)}
                  interval="preserveStartEnd"
                />
                <Tooltip
                  contentStyle={{
                    background: 'var(--color-surface)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 6,
                    fontSize: 12,
                  }}
                  formatter={(value) => [
                    typeof value === 'number' ? formatMagnitude(value) : '—',
                    'Δ Net GEX',
                  ]}
                  labelFormatter={(label) => `Strike $${label}`}
                />
                <ReferenceLine x={0} stroke="var(--color-border)" />
                <Bar dataKey="delta" isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}

interface ReplayOverlayChartProps {
  symbol: string;
  candles: Candle[];
  strikes: number[];
  strikeGex: Map<number, number>;
  gexPeak: number;
  yLo: number;
  yHi: number;
  gammaFlip: number | null;
  cursorTimestamp: string | null;
  pinATimestamp: string | null;
  pinBTimestamp: string | null;
}

// Combined candles + strike-profile chart. Single SVG canvas so both
// panels share exactly one Y-axis (price = strike), mirroring the layout
// of the GEX Strike Profile page. Future candles (later than the
// cursor) render at FUTURE_CANDLE_OPACITY and light to 1.0 as the
// playhead sweeps over them.
function ReplayOverlayChart({
  symbol,
  candles,
  strikes,
  strikeGex,
  gexPeak,
  yLo,
  yHi,
  gammaFlip,
  cursorTimestamp,
  pinATimestamp,
  pinBTimestamp,
}: ReplayOverlayChartProps) {
  // ── Layout ──
  // Candles occupy the left ~60% of the canvas, strike labels sit in a
  // narrow column, and the horizontal GEX bars extend from a center line
  // in the right panel — matches MarketMakerExposures so the muscle-
  // memory transfers.
  const CW = 1200;
  const CH = 560;
  const PLOT_TOP = 24;
  const PLOT_BOTTOM = 500;
  const PLOT_HEIGHT = PLOT_BOTTOM - PLOT_TOP;
  const LEFT_X = 0;
  const LEFT_W = 720;
  const STRIKE_X = LEFT_X + LEFT_W;
  const STRIKE_W = 64;
  const GAP = 12;
  const MID_X = STRIKE_X + STRIKE_W + GAP;
  const MID_W = CW - MID_X - 8;
  const MID_CENTER = MID_X + MID_W / 2;

  const usableCandles = useMemo(
    () =>
      candles.filter(
        (c) =>
          c.open != null && c.high != null && c.low != null && c.close != null,
      ),
    [candles],
  );

  // Aggregate the per-minute payload into 5-min OHLC buckets — the
  // candlestick tape displays 5-min bars while the scrubber, the pins,
  // and the GEX ladder all stay at 1-min resolution. The bucket the
  // cursor lives in grows minute-by-minute; past buckets stay sealed;
  // future buckets show their eventual OHLC at 25% opacity.
  const buckets = useMemo(() => bucketize5Min(usableCandles), [usableCandles]);

  const cursorMs = cursorTimestamp
    ? new Date(cursorTimestamp).getTime()
    : Number.POSITIVE_INFINITY;
  const pinAMs = pinATimestamp
    ? new Date(pinATimestamp).getTime()
    : null;
  const pinBMs = pinBTimestamp
    ? new Date(pinBTimestamp).getTime()
    : null;

  const yForPrice = useCallback(
    (price: number) =>
      PLOT_TOP + (1 - (price - yLo) / Math.max(1e-9, yHi - yLo)) * PLOT_HEIGHT,
    [yLo, yHi, PLOT_TOP, PLOT_HEIGHT],
  );

  // Time-based x mapping so both the 5-min bucket candles and the
  // minute-precise cursor/pin lines project onto one continuous
  // timeline. The domain runs from the first bucket's start to the
  // last bucket's end (i.e. the last bucket's start + 5 min) so a
  // cursor in the final bucket still has room to advance visually
  // through its 5 minutes.
  const timelineStartMs =
    buckets.length > 0 ? buckets[0].bucketStartMs : 0;
  const timelineEndMs =
    buckets.length > 0
      ? buckets[buckets.length - 1].bucketEndMs
      : timelineStartMs + 1;

  const xForTime = useCallback(
    (ms: number) => {
      const usableW = LEFT_W - 24;
      if (buckets.length === 0) return LEFT_X + 12;
      if (buckets.length === 1 || timelineEndMs === timelineStartMs) {
        return LEFT_X + 12 + usableW / 2;
      }
      if (!Number.isFinite(ms)) return LEFT_X + 12;
      const ratio = (ms - timelineStartMs) / (timelineEndMs - timelineStartMs);
      const clamped = Math.max(0, Math.min(1, ratio));
      return LEFT_X + 12 + clamped * usableW;
    },
    [buckets.length, timelineStartMs, timelineEndMs, LEFT_X, LEFT_W],
  );

  // Per-bucket render OHLC + opacity. Bucket start > cursor → dim
  // preview at the sealed OHLC. Otherwise we recompute OHLC from just
  // the members already reached; if that yields no data (e.g. bucket
  // start ≤ cursor but every minute in the bucket is still future),
  // fall back to the sealed OHLC at dim opacity so the tape stays
  // continuous instead of leaving a gap.
  const renderedBuckets = useMemo(() => {
    return buckets.map((b) => {
      if (b.bucketStartMs > cursorMs) {
        return {
          bucket: b,
          open: b.fullOpen,
          high: b.fullHigh,
          low: b.fullLow,
          close: b.fullClose,
          opacity: FUTURE_CANDLE_OPACITY,
        };
      }
      const partial = partialBucketOHLC(b, cursorMs);
      const reached =
        partial.open != null &&
        partial.high != null &&
        partial.low != null &&
        partial.close != null;
      if (reached) {
        return {
          bucket: b,
          open: partial.open,
          high: partial.high,
          low: partial.low,
          close: partial.close,
          opacity: 1,
        };
      }
      return {
        bucket: b,
        open: b.fullOpen,
        high: b.fullHigh,
        low: b.fullLow,
        close: b.fullClose,
        opacity: FUTURE_CANDLE_OPACITY,
      };
    });
  }, [buckets, cursorMs]);

  const currentBar = useMemo(() => {
    if (!Number.isFinite(cursorMs)) return null;
    return (
      renderedBuckets.find(
        (r) =>
          r.bucket.bucketStartMs <= cursorMs && cursorMs < r.bucket.bucketEndMs,
      ) ?? null
    );
  }, [renderedBuckets, cursorMs]);

  // Sparse tick labels so ~78-bucket sessions don't wallpaper the axis.
  // Evenly-spaced picker: puts the first tick at bucket 0, the last at
  // buckets.length-1, and (desired-2) evenly interpolated between them.
  const timeTicks = useMemo(
    () => evenlySpacedIndices(buckets.length, 8),
    [buckets.length],
  );

  // Y-axis price labels — computed from the price range, NOT from the
  // strike list. Picking every N-th strike gave ragged intervals like
  // 774/771/768/765/762/758/755 (step drifts between 3 and 4) because
  // the strike chain isn't a uniform ladder to sample from. Anchoring
  // to a {1,2,5}×10^k step guarantees a consistent gap between every
  // label and lands them on round numbers a trader reads without
  // arithmetic. Density target scales with plot height so a tall chart
  // uses more labels and a compact one uses fewer.
  const priceTickTarget = Math.max(6, Math.round(PLOT_HEIGHT / 34));
  const priceTicks = useMemo(
    () => niceTicks(yLo, yHi, priceTickTarget),
    [yLo, yHi, priceTickTarget],
  );
  const priceStep = priceTicks.length >= 2 ? priceTicks[1] - priceTicks[0] : 1;

  // Bucket-to-bucket pixel spacing is what a 5-min step maps to on the
  // shared time axis — derived from timeline extents rather than
  // (usableW / bucketCount-1) so the arithmetic stays exact even when
  // the session's first candle isn't flush with its bucket start.
  const bucketSpacingPx = useMemo(() => {
    if (buckets.length < 2 || timelineEndMs === timelineStartMs) {
      return LEFT_W - 24;
    }
    return (FIVE_MIN_MS / (timelineEndMs - timelineStartMs)) * (LEFT_W - 24);
  }, [buckets.length, timelineStartMs, timelineEndMs, LEFT_W]);
  const candleWidth = Math.max(2, Math.min(9, bucketSpacingPx * 0.65));

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-4">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div className="text-[10px] uppercase tracking-[0.22em] font-bold text-[var(--color-text-secondary)]">
          {symbol} price · dealer net GEX · strike profile
        </div>
        {currentBar && (
          <div className="font-mono text-[11px] text-[var(--color-text-secondary)]">
            O {currentBar.open?.toFixed(2)} · H {currentBar.high?.toFixed(2)} · L{' '}
            {currentBar.low?.toFixed(2)} · C{' '}
            <span className="text-[var(--color-text-primary)] font-bold">
              {currentBar.close?.toFixed(2)}
            </span>
          </div>
        )}
      </div>
      <div className="mt-3 w-full overflow-x-auto">
        <svg
          role="img"
          aria-label={`${symbol} replay overlay: candles left, horizontal strike profile right, shared price axis`}
          width="100%"
          viewBox={`0 0 ${CW} ${CH}`}
          preserveAspectRatio="xMinYMin meet"
          className="block w-full"
          style={{ aspectRatio: `${CW} / ${CH}` }}
        >
          {/* Shared horizontal grid lines + price labels on the round-
              number tick ladder. The label price is a chart-axis value
              — the strike bars still render at their actual strike
              positions — but a wick at $743.20 and a strike bar at 743
              line up under the same '743' label because both use the
              same yForPrice mapping. */}
          {priceTicks.map((p) => {
            const y = yForPrice(p);
            return (
              <g key={`grid-${p}`}>
                <line
                  x1={LEFT_X}
                  x2={STRIKE_X}
                  y1={y}
                  y2={y}
                  stroke="var(--color-border)"
                  opacity={0.4}
                />
                <line
                  x1={MID_X}
                  x2={MID_X + MID_W}
                  y1={y}
                  y2={y}
                  stroke="var(--color-border)"
                  opacity={0.4}
                />
                <text
                  x={STRIKE_X + STRIKE_W / 2}
                  y={y + 3.5}
                  textAnchor="middle"
                  fontSize={11}
                  fill="var(--color-text-secondary)"
                >
                  {formatPriceTick(p, priceStep)}
                </text>
              </g>
            );
          })}

          {/* Gamma flip line stretches across BOTH panels so it reads as
              a single regime marker regardless of which panel you're
              looking at. */}
          {gammaFlip != null && (() => {
            const y = yForPrice(gammaFlip);
            return (
              <g>
                <line
                  x1={LEFT_X}
                  x2={MID_X + MID_W}
                  y1={y}
                  y2={y}
                  stroke="var(--color-warning)"
                  strokeDasharray="4 3"
                  opacity={0.75}
                />
                <text
                  x={MID_X + MID_W - 4}
                  y={y - 4}
                  textAnchor="end"
                  fontSize={10}
                  fontWeight={700}
                  fill="var(--color-warning)"
                >
                  Flip {gammaFlip.toFixed(2)}
                </text>
              </g>
            );
          })()}

          {/* ── LEFT PANEL: 5-min candles ── */}
          {renderedBuckets.length === 0 ? (
            <text
              x={LEFT_X + LEFT_W / 2}
              y={(PLOT_TOP + PLOT_BOTTOM) / 2}
              textAnchor="middle"
              fontSize={12}
              fill="var(--color-text-secondary)"
            >
              No underlying candles available for this session.
            </text>
          ) : (
            renderedBuckets.map((rb) => {
              if (
                rb.open == null ||
                rb.high == null ||
                rb.low == null ||
                rb.close == null
              ) {
                return null;
              }
              const x = xForTime(rb.bucket.bucketStartMs);
              const isUp = rb.close >= rb.open;
              const color = isUp ? 'var(--color-bull)' : 'var(--color-bear)';
              const hollow = rb.close > rb.open;
              const yO = yForPrice(rb.open);
              const yC = yForPrice(rb.close);
              const yH = yForPrice(rb.high);
              const yL = yForPrice(rb.low);
              const bodyTop = Math.min(yO, yC);
              const bodyH = Math.max(1, Math.abs(yO - yC));
              const bodyBottom = bodyTop + bodyH;
              return (
                <g key={`cdl-${rb.bucket.bucketStart}`} opacity={rb.opacity}>
                  {hollow ? (
                    <>
                      <line
                        x1={x}
                        x2={x}
                        y1={yH}
                        y2={bodyTop}
                        stroke={color}
                        strokeWidth={1}
                      />
                      <line
                        x1={x}
                        x2={x}
                        y1={bodyBottom}
                        y2={yL}
                        stroke={color}
                        strokeWidth={1}
                      />
                    </>
                  ) : (
                    <line
                      x1={x}
                      x2={x}
                      y1={yH}
                      y2={yL}
                      stroke={color}
                      strokeWidth={1}
                    />
                  )}
                  <rect
                    x={x - candleWidth / 2}
                    y={bodyTop}
                    width={candleWidth}
                    height={bodyH}
                    fill={hollow ? 'none' : color}
                    stroke={color}
                    strokeWidth={hollow ? 1 : 0}
                  />
                </g>
              );
            })
          )}

          {/* Time axis labels below the candles panel. Edge-anchor the
              first and last labels so they stay flush inside the plot
              bounds instead of clipping against the SVG frame or
              overlapping the strike-labels column. */}
          {timeTicks.map((idx, tickPos) => {
            const b = buckets[idx];
            if (!b) return null;
            const isFirst = tickPos === 0;
            const isLast = tickPos === timeTicks.length - 1;
            const x = xForTime(b.bucketStartMs);
            return (
              <text
                key={`t-${b.bucketStart}`}
                x={x}
                y={PLOT_BOTTOM + 20}
                textAnchor={isFirst ? 'start' : isLast ? 'end' : 'middle'}
                fontSize={10}
                fill="var(--color-text-secondary)"
              >
                {formatTime(b.bucketStart)}
              </text>
            );
          })}

          {/* ── RIGHT PANEL: horizontal strike-profile bars ── */}
          <line
            x1={MID_CENTER}
            x2={MID_CENTER}
            y1={PLOT_TOP}
            y2={PLOT_BOTTOM}
            stroke="var(--color-border)"
            opacity={0.55}
          />
          {strikes.map((strike) => {
            const net = strikeGex.get(strike) ?? 0;
            if (net === 0) return null;
            const y = yForPrice(strike);
            const w = (Math.abs(net) / gexPeak) * (MID_W / 2);
            const positive = net >= 0;
            const barH = Math.max(
              2,
              Math.min(9, (PLOT_HEIGHT / Math.max(1, strikes.length)) * 0.6),
            );
            return (
              <rect
                key={`gex-${strike}`}
                x={positive ? MID_CENTER : MID_CENTER - Math.max(0, w)}
                y={y - barH / 2}
                width={Math.max(0, w)}
                height={barH}
                fill={positive ? 'var(--color-bull)' : 'var(--color-bear)'}
                opacity={0.9}
              />
            );
          })}
          <text
            x={MID_X + 6}
            y={PLOT_BOTTOM + 20}
            fontSize={10}
            fill="var(--color-text-secondary)"
          >
            −{formatMagnitude(gexPeak)}
          </text>
          <text
            x={MID_CENTER}
            y={PLOT_BOTTOM + 20}
            textAnchor="middle"
            fontSize={10}
            fill="var(--color-text-secondary)"
          >
            0
          </text>
          <text
            x={MID_X + MID_W - 6}
            y={PLOT_BOTTOM + 20}
            textAnchor="end"
            fontSize={10}
            fill="var(--color-text-secondary)"
          >
            +{formatMagnitude(gexPeak)}
          </text>
          <text
            x={LEFT_X + 4}
            y={PLOT_TOP - 8}
            fontSize={10}
            fill="var(--color-text-secondary)"
            fontWeight={700}
          >
            {symbol} · price
          </text>
          <text
            x={MID_X}
            y={PLOT_TOP - 8}
            fontSize={10}
            fill="var(--color-text-secondary)"
            fontWeight={700}
          >
            Dealer net GEX
          </text>

          {/* Overlays: pins first (they're context markers), cursor on
              top so it always wins the visual competition. Anchoring to
              the exact minute (not to the containing 5-min bucket) so
              the playhead slides visibly minute-by-minute inside a
              bucket instead of stepping in 5-min hops. */}
          {pinAMs != null && buckets.length > 0 && (
            <TimeMarker
              x={xForTime(pinAMs)}
              top={PLOT_TOP}
              bottom={PLOT_BOTTOM}
              label="A"
              color="var(--color-warning)"
              dashed
            />
          )}
          {pinBMs != null && buckets.length > 0 && (
            <TimeMarker
              x={xForTime(pinBMs)}
              top={PLOT_TOP}
              bottom={PLOT_BOTTOM}
              label="B"
              color="var(--color-bull)"
              dashed
            />
          )}
          {Number.isFinite(cursorMs) && buckets.length > 0 && (
            <TimeMarker
              x={xForTime(cursorMs)}
              top={PLOT_TOP}
              bottom={PLOT_BOTTOM}
              label="Now"
              color="var(--color-text-primary)"
            />
          )}
        </svg>
      </div>
    </div>
  );
}

function TimeMarker({
  x,
  top,
  bottom,
  label,
  color,
  dashed = false,
}: {
  x: number;
  top: number;
  bottom: number;
  label: string;
  color: string;
  dashed?: boolean;
}) {
  return (
    <g>
      <line
        x1={x}
        x2={x}
        y1={top}
        y2={bottom}
        stroke={color}
        strokeWidth={1.4}
        strokeDasharray={dashed ? '4 3' : undefined}
        opacity={0.9}
      />
      <rect
        x={x - 18}
        y={top - 18}
        width={36}
        height={14}
        rx={2}
        fill={color}
        opacity={0.9}
      />
      <text
        x={x}
        y={top - 8}
        textAnchor="middle"
        fontSize={10}
        fontWeight={700}
        fill="var(--color-surface)"
      >
        {label}
      </text>
    </g>
  );
}
