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
// Layout: candles chart on top so the trader reads price action first,
// horizontal strike profile below so strikes on the Y-axis line up with
// the price axis above. Pin-diff mirrors the same orientation.

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

  // Union of every strike seen across the session. Locks the y-axis so
  // it doesn't jitter mid-playback when a strike drops in or out of a
  // frame's payload (nulls are filtered per-frame below).
  const allStrikes = useMemo(() => {
    const set = new Set<number>();
    for (const f of frames) {
      for (const s of f.strikes ?? []) {
        if (s.strike != null) set.add(s.strike);
      }
    }
    // Sort descending so higher strikes render at the top of the Y-axis
    // once the chart is flipped to a vertical layout — reads like a
    // dealer's ladder, calls up, puts down.
    return Array.from(set).sort((a, b) => b - a);
  }, [frames]);

  // Strike rows for the current minute. Zero-fill any union strike that
  // isn't present in this frame so every frame renders the full ladder
  // (Recharts is unhappy with nulls inside the data array).
  const chartData = useMemo(() => {
    const byStrike = new Map<number, number>();
    for (const s of currentFrame?.strikes ?? []) {
      if (s.strike != null && s.net_gex != null) byStrike.set(s.strike, s.net_gex);
    }
    return allStrikes.map((strike) => {
      const net_gex = byStrike.get(strike) ?? 0;
      return {
        strike,
        net_gex,
        fill: net_gex >= 0 ? 'var(--color-bull)' : 'var(--color-bear)',
      };
    });
  }, [currentFrame, allStrikes]);

  const gammaFlip = currentFrame?.gamma_flip ?? null;

  // Session-wide net_gex bounds so the value axis stays pinned as the
  // user scrubs (Recharts otherwise auto-scales per-frame and the whole
  // chart jitters). Padded ±5% so bars at the extremes aren't glued to
  // the frame edge. Symmetric around zero so the bull/bear scale is
  // comparable — a +2M vs a −1M bar reads honestly.
  const xDomain = useMemo<[number, number]>(() => {
    let peak = 0;
    for (const f of frames) {
      for (const s of f.strikes ?? []) {
        const v = s.net_gex;
        if (v == null || !Number.isFinite(v)) continue;
        const abs = Math.abs(v);
        if (abs > peak) peak = abs;
      }
    }
    const padded = peak * 1.05 || 1;
    return [-padded, padded];
  }, [frames]);

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
  // Sort descending so the diff chart matches the main strike profile's
  // orientation (higher strikes at the top).
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

      {/* Underlying candles — session-long OHLC with a vertical marker
          at the scrubber's cursor so the trader sees where price was
          when the GEX frame below was captured. */}
      <UnderlyingCandles
        symbol={symbol}
        candles={candles}
        cursorTimestamp={cursorTimestamp}
        pinATimestamp={pinA != null ? frames[pinA]?.timestamp ?? null : null}
        pinBTimestamp={pinB != null ? frames[pinB]?.timestamp ?? null : null}
      />

      {/* Horizontal strike profile — strikes on Y so the ladder reads
          top-to-bottom like an option chain, net GEX flips left/right
          from zero so bull/bear pressure is a directional glance. */}
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-4">
        <div className="text-[10px] uppercase tracking-[0.22em] font-bold text-[var(--color-text-secondary)]">
          Dealer net GEX · strike profile
        </div>
        <div className="mt-3 h-[520px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              layout="vertical"
              data={chartData}
              margin={{ top: 8, right: 24, left: 16, bottom: 8 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis
                type="number"
                domain={xDomain}
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
                  'Net GEX',
                ]}
                labelFormatter={(label) => `Strike $${label}`}
              />
              <ReferenceLine x={0} stroke="var(--color-border)" />
              {gammaFlip != null && (
                <ReferenceLine
                  y={gammaFlip}
                  stroke="var(--color-warning)"
                  strokeDasharray="4 2"
                  label={{ value: 'Flip', position: 'right', fill: 'var(--color-warning)', fontSize: 10 }}
                />
              )}
              <Bar dataKey="net_gex" isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Pin diff */}
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

interface UnderlyingCandlesProps {
  symbol: string;
  candles: Candle[];
  cursorTimestamp: string | null;
  pinATimestamp: string | null;
  pinBTimestamp: string | null;
}

// SVG candlestick chart of the session's underlying tape. Kept purpose-
// built for the replay page (rather than reusing the general
// UnderlyingCandlesChart) because we need three overlays — the scrubber
// cursor plus optional pin A / pin B markers — anchored to the frame
// timestamps, and a full-chart component would fetch its own bars on a
// different cadence and not know where the cursor is.
function UnderlyingCandles({
  symbol,
  candles,
  cursorTimestamp,
  pinATimestamp,
  pinBTimestamp,
}: UnderlyingCandlesProps) {
  const usable = useMemo(
    () =>
      candles.filter(
        (c) =>
          c.open != null && c.high != null && c.low != null && c.close != null,
      ),
    [candles],
  );

  const { minPrice, maxPrice } = useMemo(() => {
    let lo = Number.POSITIVE_INFINITY;
    let hi = Number.NEGATIVE_INFINITY;
    for (const c of usable) {
      if (c.low != null && c.low < lo) lo = c.low;
      if (c.high != null && c.high > hi) hi = c.high;
    }
    if (!Number.isFinite(lo) || !Number.isFinite(hi)) {
      return { minPrice: 0, maxPrice: 1 };
    }
    const pad = (hi - lo) * 0.05 || 1;
    return { minPrice: lo - pad, maxPrice: hi + pad };
  }, [usable]);

  const indexOfTimestamp = useCallback(
    (ts: string | null): number | null => {
      if (ts == null || usable.length === 0) return null;
      const targetMs = new Date(ts).getTime();
      if (!Number.isFinite(targetMs)) return null;
      let bestIdx = -1;
      let bestDist = Number.POSITIVE_INFINITY;
      for (let i = 0; i < usable.length; i += 1) {
        const barMs = new Date(usable[i].timestamp).getTime();
        if (!Number.isFinite(barMs)) continue;
        const dist = Math.abs(barMs - targetMs);
        if (dist < bestDist) {
          bestDist = dist;
          bestIdx = i;
        }
      }
      return bestIdx >= 0 ? bestIdx : null;
    },
    [usable],
  );

  const cursorIdx = indexOfTimestamp(cursorTimestamp);
  const pinAIdx = indexOfTimestamp(pinATimestamp);
  const pinBIdx = indexOfTimestamp(pinBTimestamp);

  const priceTicks = useMemo(() => {
    const steps = 5;
    const out: number[] = [];
    for (let i = 0; i <= steps; i += 1) {
      out.push(minPrice + ((maxPrice - minPrice) * i) / steps);
    }
    return out;
  }, [minPrice, maxPrice]);

  const timeTicks = useMemo(() => {
    const desired = 6;
    if (usable.length <= desired) {
      return usable.map((_, i) => i);
    }
    const step = Math.max(1, Math.floor(usable.length / desired));
    const out: number[] = [];
    for (let i = 0; i < usable.length; i += step) out.push(i);
    if (out[out.length - 1] !== usable.length - 1) out.push(usable.length - 1);
    return out;
  }, [usable]);

  if (usable.length === 0) {
    return (
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-4">
        <div className="text-[10px] uppercase tracking-[0.22em] font-bold text-[var(--color-text-secondary)]">
          {symbol} price action
        </div>
        <div className="mt-3 text-xs text-[var(--color-text-secondary)]">
          No underlying candles available for this session — the tape may
          predate the underlying_quotes ingestion window, or the day was a
          non-trading day for the underlying.
        </div>
      </div>
    );
  }

  const width = 1100;
  const height = 300;
  const padLeft = 60;
  const padRight = 20;
  const padTop = 24;
  const padBottom = 30;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  const yPrice = (p: number) =>
    padTop +
    (1 - (p - minPrice) / Math.max(1e-9, maxPrice - minPrice)) * plotH;
  const xStep = plotW / Math.max(1, usable.length - 1);
  const candleWidth = Math.max(1.5, Math.min(6, xStep * 0.7));

  const currentBar = cursorIdx != null ? usable[cursorIdx] : null;

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-4">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div className="text-[10px] uppercase tracking-[0.22em] font-bold text-[var(--color-text-secondary)]">
          {symbol} price action
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
          aria-label={`${symbol} underlying candles for the replay session`}
          width="100%"
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="xMinYMin meet"
          className="block w-full"
          style={{ aspectRatio: `${width} / ${height}` }}
        >
          {priceTicks.map((price) => {
            const y = yPrice(price);
            return (
              <g key={`p-${price.toFixed(4)}`}>
                <line
                  x1={padLeft}
                  x2={width - padRight}
                  y1={y}
                  y2={y}
                  stroke="var(--color-border)"
                  opacity={0.5}
                />
                <text
                  x={padLeft - 8}
                  y={y + 4}
                  textAnchor="end"
                  fontSize="10"
                  fill="var(--color-text-secondary)"
                >
                  ${price.toFixed(2)}
                </text>
              </g>
            );
          })}

          {timeTicks.map((idx) => {
            const x = padLeft + idx * xStep;
            const bar = usable[idx];
            if (!bar) return null;
            return (
              <text
                key={`t-${bar.timestamp}`}
                x={x}
                y={height - padBottom + 16}
                textAnchor="middle"
                fontSize="10"
                fill="var(--color-text-secondary)"
              >
                {formatTime(bar.timestamp)}
              </text>
            );
          })}

          {usable.map((bar, i) => {
            if (
              bar.open == null ||
              bar.high == null ||
              bar.low == null ||
              bar.close == null
            ) {
              return null;
            }
            const x = padLeft + i * xStep;
            const isUp = bar.close >= bar.open;
            const c = isUp ? 'var(--color-bull)' : 'var(--color-bear)';
            const openY = yPrice(bar.open);
            const closeY = yPrice(bar.close);
            const highY = yPrice(bar.high);
            const lowY = yPrice(bar.low);
            const bodyY = Math.min(openY, closeY);
            const bodyH = Math.max(1, Math.abs(openY - closeY));
            return (
              <g key={bar.timestamp}>
                <line
                  x1={x}
                  x2={x}
                  y1={highY}
                  y2={lowY}
                  stroke={c}
                  strokeWidth={1}
                />
                <rect
                  x={x - candleWidth / 2}
                  y={bodyY}
                  width={candleWidth}
                  height={bodyH}
                  fill={isUp ? 'transparent' : c}
                  stroke={c}
                  strokeWidth={1}
                />
              </g>
            );
          })}

          {/* Cursor / pins drawn last so they sit over the bars. */}
          {pinAIdx != null && (
            <CursorOverlay
              x={padLeft + pinAIdx * xStep}
              top={padTop}
              bottom={height - padBottom}
              label="A"
              color="var(--color-warning)"
              dashed
            />
          )}
          {pinBIdx != null && (
            <CursorOverlay
              x={padLeft + pinBIdx * xStep}
              top={padTop}
              bottom={height - padBottom}
              label="B"
              color="var(--color-bull)"
              dashed
            />
          )}
          {cursorIdx != null && (
            <CursorOverlay
              x={padLeft + cursorIdx * xStep}
              top={padTop}
              bottom={height - padBottom}
              label="Now"
              color="var(--color-text-primary)"
            />
          )}
        </svg>
      </div>
    </div>
  );
}

function CursorOverlay({
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
        fontSize="10"
        fontWeight={700}
        fill="var(--color-surface)"
      >
        {label}
      </text>
    </g>
  );
}
