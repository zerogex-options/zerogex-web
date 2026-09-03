'use client';

import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { BarChart3, Eye, EyeOff, Link2, Pause, Play, RotateCcw, Twitter, ZoomIn, ZoomOut } from 'lucide-react';
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
import { staggerLabelYs } from './levelStagger';
import {
  expirationOpacityRamp,
  sharesToSegments,
  type ExpirationSegment,
} from '@/core/expirationGradient';

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
  call_wall: number | null;
  put_wall: number | null;
  max_pain: number | null;
  pin_strike: number | null;
  pin_confidence: number | null;
  // net_gex is always present; call_gex / put_gex are the same per-strike
  // dealer-gamma columns (from gex_by_strike) and are optional so the
  // Split / Combined gamma views activate only when the payload carries them.
  strikes: Array<{
    strike: number | null;
    net_gex: number | null;
    call_gex?: number | null;
    put_gex?: number | null;
    // Per-expiration shares of this strike's call / put bar (fractions summing
    // to 1), aligned positionally to the payload's top-level `expirations`
    // legend. Optional: /replay/range only sends them when asked, and a strike
    // the snapshot doesn't cover simply renders as one solid bar.
    call_shares?: number[] | null;
    put_shares?: number[] | null;
  }>;
}

// Gamma display mode for the strike-profile panel, mirroring the Strike
// Profile chart (MarketMakerExposures): Split = call bars right / put bars
// left, Net = a single signed net bar, Combined = the call/put split with the
// per-strike Net overlaid on top.
type GexMode = 'split' | 'net' | 'combined';

// Per-strike dealer gamma for one minute: signed net plus the call/put split
// (call/put default to 0 when the payload is net-only).
interface StrikeGex {
  net: number;
  call: number;
  put: number;
  // Nearest-first expiration segments partitioning the call / put bar. Empty
  // when the frame carries no split for this side.
  callSegs: ExpirationSegment[];
  putSegs: ExpirationSegment[];
}

// Purple overlay bar for the Combined view — the per-strike NET GEX drawn on
// top of the call/put split, pointing right for net-positive and left for
// net-negative. Matches the Strike Profile chart's net overlay exactly (a deep
// violet distinct from the bull/bear split bars) so the two charts read the
// same way.
const NET_BAR_COLOR = '#7C3AED';
// Base opacity every bar (and every expiry segment within one) is drawn at.
const BAR_OPACITY = 0.9;

// Draws one call/put bar as its expiration stack. `totalWidth` is the
// authoritative bar width from the frame and `segs` the shares partitioning
// it, so the segments always add back to the real bar — the split can never
// change a level. dir = +1 grows right (calls), -1 left (puts); the nearest
// DTE sits at the zero baseline, the furthest at the tip. Returns null when
// there's no split, so the caller falls back to a plain solid bar.
function stackSegments(
  keyPrefix: string,
  segs: ExpirationSegment[],
  dir: 1 | -1,
  center: number,
  totalWidth: number,
  y: number,
  barHeight: number,
  fill: string,
  expOpacity: Map<string, number>,
): ReactNode[] | null {
  if (segs.length === 0 || !(totalWidth > 0)) return null;
  const rects: ReactNode[] = [];
  const yTop = y - barHeight / 2;
  let cursor = center;
  for (const { exp, frac } of segs) {
    const w = totalWidth * frac;
    if (!(w > 0)) continue;
    rects.push(
      <rect
        key={`${keyPrefix}-${exp}`}
        x={dir > 0 ? cursor : cursor - w}
        y={yTop}
        width={w}
        height={barHeight}
        fill={fill}
        opacity={(expOpacity.get(exp) ?? 1) * BAR_OPACITY}
      />,
    );
    cursor += dir * w;
  }
  return rects.length ? rects : null;
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
  /** Nearest-first expiration legend the per-strike share arrays index into.
   *  The trailing entry may be the literal "far" (a catch-all for everything
   *  past the payload's expiration cap), which ranks last and therefore takes
   *  the faintest shade. Empty when the payload carries no expiration mix. */
  expirations?: string[];
}

// Stable empty default for the optional expirations legend — a fresh []
// literal in the parameter list would be a new reference every render and
// re-run every memo keyed on it.
const EMPTY_EXPIRATIONS: string[] = [];

const PLAY_SPEEDS = [1, 4, 16, 60] as const;
type PlaySpeed = (typeof PLAY_SPEEDS)[number];

// Opacity for candles whose timestamp is later than the scrubber
// cursor — 75% transparent per the design so the "not yet reached"
// portion of the tape reads as ghosted context that will light up as
// the playhead sweeps into it.
const FUTURE_CANDLE_OPACITY = 0.25;

// Vertical (price/strike-axis) zoom bounds for the overlay chart. yZoom
// multiplies the full padded price half-span around the candle center:
// < 1 magnifies a tighter band of strikes (they spread apart), > 1 pulls
// the axis wider so more of the ladder compresses into view. Mirrors the
// GEX Strike Profile chart's strike-axis zoom (0.4–4.0 there); the range
// is tighter here because the default already frames the whole session.
const Y_ZOOM_MIN = 0.3;
const Y_ZOOM_MAX = 2.0;
const Y_ZOOM_STEP = 1.3;
const Y_ZOOM_DEFAULT = 1.0;

function clampZoom(v: number): number {
  return Math.min(Y_ZOOM_MAX, Math.max(Y_ZOOM_MIN, v));
}

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
// neighbors at the chosen tick step, so a $5-step axis reads 715 / 720
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
  expirations = EMPTY_EXPIRATIONS,
}: ReplayScrubberProps) {
  const frames = initialFrames;
  const candles = initialCandles;
  const [cursor, setCursor] = useState<number>(frames.length > 0 ? frames.length - 1 : 0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState<PlaySpeed>(4);
  const [pinA, setPinA] = useState<number | null>(null);
  const [pinB, setPinB] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  // Gamma display mode for the strike-profile panel. Defaults to 'split' to
  // match the Strike Profile chart; when the payload is net-only it's clamped
  // to 'net' below (and the toggle is hidden), so a net-only session still
  // opens on the single-net-bar ladder it always has.
  const [gexMode, setGexMode] = useState<GexMode>('split');
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

  // Strike → {net, call, put} GEX map for the cursor's minute. call/put are
  // zero-filled when the payload omits them (net-only sessions), which keeps
  // the Net view identical to before and lets Split/Combined render whatever
  // call/put data is present.
  const strikeGexByStrike = useMemo(() => {
    const byStrike = new Map<number, StrikeGex>();
    for (const s of currentFrame?.strikes ?? []) {
      if (s.strike == null || s.net_gex == null) continue;
      byStrike.set(s.strike, {
        net: s.net_gex,
        call: s.call_gex != null && Number.isFinite(s.call_gex) ? s.call_gex : 0,
        put: s.put_gex != null && Number.isFinite(s.put_gex) ? s.put_gex : 0,
        // The shares only subdivide the call/put values above — they never
        // change a bar's length, so a missing or malformed split degrades to a
        // plain solid bar rather than a wrong one.
        callSegs: sharesToSegments(s.call_shares, expirations),
        putSegs: sharesToSegments(s.put_shares, expirations),
      });
    }
    return byStrike;
  }, [currentFrame, expirations]);

  // DTE-ranked shade per expiration, keyed on the session-wide legend so a
  // segment's color never shifts as the playhead moves. The ramp only carries
  // information with more than one expiration in the session.
  const expOpacity = useMemo(() => expirationOpacityRamp(expirations), [expirations]);
  const gradientActive = expirations.length > 1;

  // Whether any frame in the session carries per-strike call/put gamma. When
  // false the payload is Net-only, so the Split/Combined toggle is hidden and
  // the chart behaves exactly as it always has.
  const hasSplitData = useMemo(() => {
    for (const f of frames) {
      for (const s of f.strikes ?? []) {
        if (
          (s.call_gex != null && Number.isFinite(s.call_gex) && s.call_gex !== 0) ||
          (s.put_gex != null && Number.isFinite(s.put_gex) && s.put_gex !== 0)
        ) {
          return true;
        }
      }
    }
    return false;
  }, [frames]);

  // The Net toggle can never be reached without call/put data, but clamp
  // defensively so a stray 'split'/'combined' never renders empty bars.
  const effGexMode: GexMode = hasSplitData ? gexMode : 'net';

  const gammaFlip = currentFrame?.gamma_flip ?? null;
  // Call/put walls for the cursor's minute. They migrate through the
  // session, so they update as you scrub — the same canonical levels the
  // shareable snapshot shows for a given moment.
  const callWall = currentFrame?.call_wall ?? null;
  const putWall = currentFrame?.put_wall ?? null;
  // Max pain migrates through the session too; the release replay payload
  // carries it per frame (null on older rows, then the line simply isn't drawn).
  const maxPain = currentFrame?.max_pain ?? null;
  // Pin Strike rides along per frame too (null on rows written before it
  // shipped, then the line simply isn't drawn).
  const pinStrike = currentFrame?.pin_strike ?? null;

  // Session-wide GEX peak — per mode — so the horizontal-bar magnitude axis
  // stays pinned as the user scrubs (otherwise the widest bar this minute
  // would drift with playback and every strike's bar would visually resize
  // even when its own value hadn't changed). One peak per mode, scaled the
  // same way the Strike Profile chart scales gammaXMax: Net → max |net|,
  // Split → max(|call|, |put|), Combined → max(|call|, |put|, |net|). The peak
  // is pinned across the whole session (not just the visible frame) so bars
  // never resize during scrubbing.
  const gexPeaks = useMemo(() => {
    let net = 0;
    let split = 0;
    let combined = 0;
    for (const f of frames) {
      for (const s of f.strikes ?? []) {
        const n = s.net_gex != null && Number.isFinite(s.net_gex) ? Math.abs(s.net_gex) : 0;
        const c = s.call_gex != null && Number.isFinite(s.call_gex) ? Math.abs(s.call_gex) : 0;
        const p = s.put_gex != null && Number.isFinite(s.put_gex) ? Math.abs(s.put_gex) : 0;
        if (n > net) net = n;
        const sp = Math.max(c, p);
        if (sp > split) split = sp;
        const cm = Math.max(c, p, n);
        if (cm > combined) combined = cm;
      }
    }
    return {
      net: net * 1.05 || 1,
      split: split * 1.05 || 1,
      combined: combined * 1.05 || 1,
    };
  }, [frames]);

  const gexPeak =
    effGexMode === 'net'
      ? gexPeaks.net
      : effGexMode === 'split'
        ? gexPeaks.split
        : gexPeaks.combined;

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
  // Carries the call/put/net deltas so the diff can follow the same
  // Split / Net / Combined mode as the main panel; call/put deltas are 0
  // for a net-only payload (the diff then renders exactly as before).
  interface DiffAcc {
    aNet: number;
    bNet: number;
    aCall: number;
    bCall: number;
    aPut: number;
    bPut: number;
  }
  const diffRows = useMemo(() => {
    if (pinA == null || pinB == null) return null;
    const a = frames[pinA];
    const b = frames[pinB];
    if (!a || !b) return null;
    const byStrike = new Map<number, DiffAcc>();
    const blank = (): DiffAcc => ({
      aNet: 0,
      bNet: 0,
      aCall: 0,
      bCall: 0,
      aPut: 0,
      bPut: 0,
    });
    const num = (v: number | null | undefined) =>
      v != null && Number.isFinite(v) ? v : 0;
    for (const s of a.strikes) {
      if (s.strike == null || s.net_gex == null) continue;
      const e = byStrike.get(s.strike) ?? blank();
      e.aNet = s.net_gex;
      e.aCall = num(s.call_gex);
      e.aPut = num(s.put_gex);
      byStrike.set(s.strike, e);
    }
    for (const s of b.strikes) {
      if (s.strike == null || s.net_gex == null) continue;
      const e = byStrike.get(s.strike) ?? blank();
      e.bNet = s.net_gex;
      e.bCall = num(s.call_gex);
      e.bPut = num(s.put_gex);
      byStrike.set(s.strike, e);
    }
    return Array.from(byStrike.entries())
      .map(([strike, e]) => ({
        strike,
        deltaNet: e.bNet - e.aNet,
        deltaCall: e.bCall - e.aCall,
        deltaPut: e.bPut - e.aPut,
        // Per-cell fill for the Net-mode single bar (sign-colored, as before).
        fill: e.bNet - e.aNet >= 0 ? 'var(--color-bull)' : 'var(--color-bear)',
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
        expOpacity={expOpacity}
        gradientActive={gradientActive}
        gexPeak={gexPeak}
        gexMode={effGexMode}
        canSplit={hasSplitData}
        onCycleGexMode={() =>
          setGexMode((m) => (m === 'split' ? 'net' : m === 'net' ? 'combined' : 'split'))
        }
        yLo={yBounds.lo}
        yHi={yBounds.hi}
        gammaFlip={gammaFlip}
        callWall={callWall}
        putWall={putWall}
        maxPain={maxPain}
        pinStrike={pinStrike}
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
              Pin diff · A→B ·{' '}
              {effGexMode === 'net'
                ? 'Δ Net'
                : effGexMode === 'split'
                  ? 'Δ Call / Put'
                  : 'Δ Combined'}
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
                  formatter={(value, name) => [
                    typeof value === 'number' ? formatMagnitude(value) : '—',
                    typeof name === 'string' ? name : 'Δ GEX',
                  ]}
                  labelFormatter={(label) => `Strike $${label}`}
                />
                <ReferenceLine x={0} stroke="var(--color-border)" />
                {/* Grouped signed bars — a diff needs the direction of change
                    (right = grew, left = shrank), so unlike the strike-profile
                    panel each series keeps its sign here rather than pinning
                    calls right / puts left. Net mode keeps the sign-colored
                    single bar; Split adds call/put; Combined adds the purple
                    net delta. */}
                {effGexMode === 'net' && (
                  <Bar dataKey="deltaNet" name="Δ Net GEX" isAnimationActive={false} />
                )}
                {effGexMode !== 'net' && (
                  <>
                    <Bar
                      dataKey="deltaCall"
                      name="Δ Call GEX"
                      fill="var(--color-bull)"
                      isAnimationActive={false}
                    />
                    <Bar
                      dataKey="deltaPut"
                      name="Δ Put GEX"
                      fill="var(--color-bear)"
                      isAnimationActive={false}
                    />
                    {effGexMode === 'combined' && (
                      <Bar
                        dataKey="deltaNet"
                        name="Δ Net GEX"
                        fill={NET_BAR_COLOR}
                        isAnimationActive={false}
                      />
                    )}
                  </>
                )}
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
  strikeGex: Map<number, StrikeGex>;
  gexPeak: number;
  gexMode: GexMode;
  /** DTE-ranked shade per expiration (nearest boldest). */
  expOpacity: Map<string, number>;
  /** Whether the session carries more than one expiration — below that the
   *  ramp carries no information and bars render at full strength. */
  gradientActive: boolean;
  // Whether the payload carries call/put gamma. Drives whether the
  // Split/Combined cycle toggle is offered at all.
  canSplit: boolean;
  onCycleGexMode: () => void;
  yLo: number;
  yHi: number;
  gammaFlip: number | null;
  callWall: number | null;
  putWall: number | null;
  maxPain: number | null;
  pinStrike: number | null;
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
  gexMode,
  expOpacity,
  gradientActive,
  canSplit,
  onCycleGexMode,
  yLo,
  yHi,
  gammaFlip,
  callWall,
  putWall,
  maxPain,
  pinStrike,
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

  // ── Vertical zoom (price / strike axis) ──
  // Mirrors the GEX Strike Profile chart's strike-axis zoom so a viewer's
  // muscle memory transfers. yZoom multiplies the full padded half-span the
  // parent computed; anchoring on the candles' price center keeps the
  // tradeable zone framed as the band tightens.
  const svgRef = useRef<SVGSVGElement | null>(null);
  // useId keeps the clipPath unique if this chart ever mounts twice; strip
  // the ':' React embeds so the id stays valid inside an SVG url(#…) ref.
  const clipId = `replay-clip-${useId().replace(/[^a-zA-Z0-9-]/g, '')}`;
  const [yZoom, setYZoom] = useState<number>(Y_ZOOM_DEFAULT);
  // Opt-in: drop the ghosted future candles entirely so the tape reads as
  // an as-it-happened replay with no lookahead past the playhead. Default
  // off preserves the ghost-and-light-up behavior.
  const [hideFuture, setHideFuture] = useState(false);

  const priceCenter = useMemo(() => {
    let lo = Number.POSITIVE_INFINITY;
    let hi = Number.NEGATIVE_INFINITY;
    for (const c of usableCandles) {
      if (c.low != null && c.low < lo) lo = c.low;
      if (c.high != null && c.high > hi) hi = c.high;
    }
    if (Number.isFinite(lo) && Number.isFinite(hi) && hi > lo) return (lo + hi) / 2;
    return (yLo + yHi) / 2;
  }, [usableCandles, yLo, yHi]);

  // Effective visible price band after zoom. At yZoom = 1 it equals the
  // parent's full padded [yLo, yHi]; smaller narrows it around the price
  // center (strikes spread out), larger widens it (strikes compress in).
  const { effLo, effHi } = useMemo(() => {
    const fullHalf = (yHi - yLo) / 2;
    const half = Math.max(1e-9, fullHalf * yZoom);
    return { effLo: priceCenter - half, effHi: priceCenter + half };
  }, [yLo, yHi, yZoom, priceCenter]);

  // Mouse-wheel vertical zoom. Attached imperatively with { passive: false }
  // so preventDefault suppresses page scroll while the cursor is over the
  // chart — same pattern as the GEX Strike Profile chart.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (e: WheelEvent) => {
      if (e.deltaY === 0) return;
      e.preventDefault();
      const factor = e.deltaY > 0 ? Y_ZOOM_STEP : 1 / Y_ZOOM_STEP;
      setYZoom((v) => clampZoom(v * factor));
    };
    svg.addEventListener('wheel', onWheel, { passive: false });
    return () => svg.removeEventListener('wheel', onWheel);
  }, []);

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
      PLOT_TOP + (1 - (price - effLo) / Math.max(1e-9, effHi - effLo)) * PLOT_HEIGHT,
    [effLo, effHi, PLOT_TOP, PLOT_HEIGHT],
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
          isFuture: true,
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
          isFuture: false,
        };
      }
      return {
        bucket: b,
        open: b.fullOpen,
        high: b.fullHigh,
        low: b.fullLow,
        close: b.fullClose,
        opacity: FUTURE_CANDLE_OPACITY,
        isFuture: true,
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
    () => niceTicks(effLo, effHi, priceTickTarget),
    [effLo, effHi, priceTickTarget],
  );
  const priceStep = priceTicks.length >= 2 ? priceTicks[1] - priceTicks[0] : 1;

  // Strikes that land inside the visible band drive the bar thickness so
  // magnifying (fewer strikes on screen) fattens each rung instead of
  // leaving hairline bars adrift on a sparse axis.
  const visibleStrikeCount = useMemo(
    () => strikes.filter((s) => s >= effLo && s <= effHi).length,
    [strikes, effLo, effHi],
  );

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

  // ── Level markers with de-collided labels ──
  // Each level's line sits at its true price (yForPrice); its label sits just
  // above the line. When two levels are close in price (e.g. flip and max pain
  // near spot) their labels would overlap, so we stagger the label Ys apart
  // vertically — keeping them inside the plot and in price order — while the
  // lines stay put. Only levels whose line is on-screen get a label (the lines
  // are clipped to the plot box, so an off-screen level shouldn't show a label).
  const levelMarkers = (() => {
    const defs: Array<{ value: number | null; label: string; color: string; dash: string }> = [
      { value: callWall, label: 'Call Wall', color: 'var(--color-bear)', dash: '5 3' },
      { value: gammaFlip, label: 'Flip', color: 'var(--color-warning)', dash: '4 3' },
      { value: maxPain, label: 'Max Pain', color: 'var(--color-gold)', dash: '1 5' },
      { value: putWall, label: 'Put Wall', color: 'var(--color-bull)', dash: '5 3' },
      { value: pinStrike, label: 'Pin', color: 'var(--color-pin)', dash: '2 3' },
    ];
    const items = defs
      .flatMap((d) =>
        d.value != null && Number.isFinite(d.value)
          ? [{ label: d.label, color: d.color, dash: d.dash, value: d.value, lineY: yForPrice(d.value) }]
          : [],
      )
      // Only on-screen levels get a label — the lines are clipped to the plot box.
      .filter((d) => d.lineY >= PLOT_TOP - 1 && d.lineY <= PLOT_BOTTOM + 1)
      .sort((a, b) => a.lineY - b.lineY);
    const labelYs = staggerLabelYs(items.map((d) => d.lineY), {
      gap: 13,
      minY: PLOT_TOP + 9,
      maxY: PLOT_BOTTOM - 3,
    });
    return items.map((d, i) => ({ ...d, labelY: labelYs[i] }));
  })();

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-[10px] uppercase tracking-[0.22em] font-bold text-[var(--color-text-secondary)]">
          {symbol} price · dealer {gexMode === 'net' ? 'net ' : ''}GEX · strike profile
        </div>
        <div className="flex items-center gap-3">
          {currentBar && (
            <div className="font-mono text-[11px] text-[var(--color-text-secondary)]">
              O {currentBar.open?.toFixed(2)} · H {currentBar.high?.toFixed(2)} · L{' '}
              {currentBar.low?.toFixed(2)} · C{' '}
              <span className="text-[var(--color-text-primary)] font-bold">
                {currentBar.close?.toFixed(2)}
              </span>
            </div>
          )}
          {/* Gamma display mode cycle: Split → Net → Combined → Split. Shown
              only when the payload carries call/put gamma; otherwise the
              panel is Net-only and there's nothing to cycle. Mirrors the
              Strike Profile chart's toggle. */}
          {canSplit && (
            <button
              type="button"
              onClick={onCycleGexMode}
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

          {/* Hide-future-bars toggle — opt into an as-it-happened tape with
              no candles drawn ahead of the playhead. */}
          <button
            type="button"
            onClick={() => setHideFuture((v) => !v)}
            aria-pressed={hideFuture}
            title={
              hideFuture
                ? 'Show future bars (ghosted ahead of the playhead)'
                : 'Hide future bars (draw only up to the playhead)'
            }
            className="inline-flex items-center gap-1.5 rounded-md border border-[var(--color-border)] px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] transition-colors hover:bg-[var(--color-surface-subtle)]"
            style={{
              color: hideFuture ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
              background: hideFuture ? 'var(--color-surface-subtle)' : 'var(--color-surface)',
            }}
          >
            {hideFuture ? <EyeOff size={13} /> : <Eye size={13} />}
            Future
          </button>

          {/* Vertical strike-axis zoom — scroll to zoom, or use the buttons. */}
          <div
            className="inline-flex overflow-hidden rounded-md border border-[var(--color-border)]"
            role="group"
            aria-label="Zoom the strike axis vertically"
          >
            <button
              type="button"
              onClick={() => setYZoom((v) => clampZoom(v * Y_ZOOM_STEP))}
              disabled={yZoom >= Y_ZOOM_MAX - 1e-6}
              title="Zoom out (compress more strikes into view)"
              className="px-2 py-1.5 text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-surface-subtle)] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ZoomOut size={13} />
            </button>
            <button
              type="button"
              onClick={() => setYZoom((v) => clampZoom(v / Y_ZOOM_STEP))}
              disabled={yZoom <= Y_ZOOM_MIN + 1e-6}
              title="Zoom in (spread the strikes apart)"
              className="border-l border-[var(--color-border)] px-2 py-1.5 text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-surface-subtle)] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ZoomIn size={13} />
            </button>
            <button
              type="button"
              onClick={() => setYZoom(Y_ZOOM_DEFAULT)}
              disabled={Math.abs(yZoom - Y_ZOOM_DEFAULT) < 1e-6}
              title="Reset zoom to full strike range"
              className="border-l border-[var(--color-border)] px-2 py-1.5 text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-surface-subtle)] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <RotateCcw size={13} />
            </button>
          </div>
        </div>
      </div>
      <div className="mt-3 w-full overflow-x-auto">
        <svg
          ref={svgRef}
          role="img"
          aria-label={`${symbol} replay overlay: candles left, horizontal strike profile right, shared price axis`}
          width="100%"
          viewBox={`0 0 ${CW} ${CH}`}
          preserveAspectRatio="xMinYMin meet"
          className="block w-full"
          // Keep the chart at a legible size on narrow screens instead of
          // scaling the whole 1200-wide canvas down to phone width (which shrank
          // every candle, bar and axis label to a few pixels). Below ~880px the
          // SVG holds this min width and the wrapper's overflow-x-auto lets the
          // user pan horizontally; on desktop the container is wider than the
          // floor so width:100% still governs and nothing changes.
          style={{ aspectRatio: `${CW} / ${CH}`, minWidth: "880px" }}
        >
          {/* Clip price-dependent marks (candles, strike bars, flip line) to
              the plot box so magnified content never spills past the axes. */}
          <defs>
            <clipPath id={clipId}>
              <rect x={LEFT_X} y={PLOT_TOP} width={CW - LEFT_X} height={PLOT_HEIGHT} />
            </clipPath>
          </defs>
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

          {/* Level lines (call/put walls, gamma flip, max pain) are drawn
              LATER — after the candles and strike bars — so their lines and
              labels read on top instead of being obscured. See the
              "Level lines" block below the right panel. */}

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
            <g clipPath={`url(#${clipId})`}>
            {renderedBuckets.map((rb) => {
              if (
                rb.open == null ||
                rb.high == null ||
                rb.low == null ||
                rb.close == null
              ) {
                return null;
              }
              // Hide-future toggle: drop bars ahead of the playhead entirely.
              if (hideFuture && rb.isFuture) return null;
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
            })}
            </g>
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
          <g clipPath={`url(#${clipId})`}>
          {strikes.map((strike) => {
            const agg = strikeGex.get(strike);
            if (!agg) return null;
            const y = yForPrice(strike);
            const half = MID_W / 2;
            // Same bar thickness across all three modes — the Combined net
            // overlay is exactly as thick as the call/put split bars it sits
            // on, matching the Strike Profile chart.
            const barH = Math.max(
              2,
              Math.min(9, (PLOT_HEIGHT / Math.max(1, visibleStrikeCount)) * 0.6),
            );
            const netPositive = agg.net >= 0;
            const netW = (Math.abs(agg.net) / gexPeak) * half;

            // Net view: a single signed bar (bull right / bear left) — the
            // ladder the replay has always shown.
            if (gexMode === 'net') {
              if (agg.net === 0) return null;
              return (
                <rect
                  key={`gex-${strike}`}
                  x={netPositive ? MID_CENTER : MID_CENTER - Math.max(0, netW)}
                  y={y - barH / 2}
                  width={Math.max(0, netW)}
                  height={barH}
                  fill={netPositive ? 'var(--color-bull)' : 'var(--color-bear)'}
                  opacity={0.9}
                />
              );
            }

            // Split and Combined both draw the call/put split (calls push
            // right, puts push left). Combined adds the purple Net bar on top,
            // same thickness, pointing right for net-positive and left for
            // net-negative — |net| ≤ max(|call|,|put|) on the side it points,
            // so the split bar's tip still shows past the overlay.
            const callW = (Math.abs(agg.call) / gexPeak) * half;
            const putW = (Math.abs(agg.put) / gexPeak) * half;
            const isCombined = gexMode === 'combined';
            if (agg.call === 0 && agg.put === 0 && !(isCombined && agg.net !== 0)) {
              return null;
            }
            // Subdivide each side into its DTE-ranked expiration segments —
            // nearest expiration anchored at the zero line (boldest), fanning
            // out to the furthest at the bar's tip (faintest). The segments
            // partition the authoritative bar width, so they always add back
            // to the same bar; a strike with no split draws solid as before.
            const callSegs = gradientActive
              ? stackSegments(`callseg-${strike}`, agg.callSegs, 1, MID_CENTER, Math.max(0, callW), y, barH, 'var(--color-bull)', expOpacity)
              : null;
            const putSegs = gradientActive
              ? stackSegments(`putseg-${strike}`, agg.putSegs, -1, MID_CENTER, Math.max(0, putW), y, barH, 'var(--color-bear)', expOpacity)
              : null;
            return (
              <g key={`gex-${strike}`}>
                {callSegs ?? (agg.call !== 0 && (
                  <rect
                    x={MID_CENTER}
                    y={y - barH / 2}
                    width={Math.max(0, callW)}
                    height={barH}
                    fill="var(--color-bull)"
                    opacity={BAR_OPACITY}
                  />
                ))}
                {putSegs ?? (agg.put !== 0 && (
                  <rect
                    x={MID_CENTER - Math.max(0, putW)}
                    y={y - barH / 2}
                    width={Math.max(0, putW)}
                    height={barH}
                    fill="var(--color-bear)"
                    opacity={BAR_OPACITY}
                  />
                ))}
                {isCombined && agg.net !== 0 && (
                  <rect
                    x={netPositive ? MID_CENTER : MID_CENTER - Math.max(0, netW)}
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
            {gexMode === 'net'
              ? 'Dealer net GEX'
              : gexMode === 'split'
                ? 'Dealer GEX · call / put'
                : 'Dealer GEX · combined'}
          </text>

          {/* Color legend for the split/combined views — anchored to the
              right edge of the gamma panel so the purple Net overlay in
              particular reads unambiguously. Net view needs no legend (the
              bull/bear sign is self-explanatory). */}
          {gexMode !== 'net' && (
            <g>
              {[
                { label: 'Call', color: 'var(--color-bull)' },
                { label: 'Put', color: 'var(--color-bear)' },
                ...(gexMode === 'combined'
                  ? [{ label: 'Net', color: NET_BAR_COLOR }]
                  : []),
              ].map((item, i, arr) => {
                // Lay the entries out right-to-left from the panel's right
                // edge so the group never collides with the panel title.
                const slot = 46;
                const rightX = MID_X + MID_W;
                const x = rightX - (arr.length - i) * slot;
                return (
                  <g key={item.label}>
                    <rect x={x} y={PLOT_TOP - 15} width={9} height={9} fill={item.color} rx={1.5} />
                    <text
                      x={x + 12}
                      y={PLOT_TOP - 8}
                      fontSize={10}
                      fill="var(--color-text-secondary)"
                      fontWeight={700}
                    >
                      {item.label}
                    </text>
                  </g>
                );
              })}
            </g>
          )}

          {/* Expiry ramp key — only when the gradient is actually drawn. Sits
              under the panel title on the LEFT so it can't collide with the
              call/put/net swatches anchored to the right edge. */}
          {gexMode !== 'net' && gradientActive && (
            <g>
              <defs>
                <linearGradient id={`${clipId}-expramp`} x1="0" x2="1" y1="0" y2="0">
                  <stop offset="0%" stopColor="var(--color-text-secondary)" stopOpacity={1} />
                  <stop offset="100%" stopColor="var(--color-text-secondary)" stopOpacity={0.25} />
                </linearGradient>
              </defs>
              <text x={MID_X} y={PLOT_TOP - 20} fontSize={9} fill="var(--color-text-secondary)">
                near
              </text>
              <rect
                x={MID_X + 24}
                y={PLOT_TOP - 27}
                width={34}
                height={7}
                rx={1.5}
                fill={`url(#${clipId}-expramp)`}
              />
              <text x={MID_X + 62} y={PLOT_TOP - 20} fontSize={9} fill="var(--color-text-secondary)">
                far expiry
              </text>
            </g>
          )}

          {/* ── Level lines: call/put walls, gamma flip, max pain ──
              Drawn here — AFTER the candles and strike bars — so the lines
              and their labels paint on top instead of being obscured by the
              bars/candles. Each spans both panels as a single regime marker,
              clipped to the plot box. Labels are right-edge anchored so they
              stack into one column; call wall sits above spot, put wall below,
              flip and max pain near it. Colors match the rest of the app
              (call = bear/resistance, put = bull/support, flip = warning,
              max pain = gold, as on the Gamma Terminal chart). */}
          {levelMarkers.map((lvl) => {
            // A label nudged more than a couple px off its line gets a faint
            // vertical leader back to the line so the tie stays legible.
            const nudged = Math.abs(lvl.labelY - (lvl.lineY - 4)) > 2;
            return (
              <g key={lvl.label} clipPath={`url(#${clipId})`}>
                <line
                  x1={LEFT_X}
                  x2={MID_X + MID_W}
                  y1={lvl.lineY}
                  y2={lvl.lineY}
                  stroke={lvl.color}
                  strokeDasharray={lvl.dash}
                  opacity={0.85}
                />
                {nudged && (
                  <line
                    x1={MID_X + MID_W - 2}
                    x2={MID_X + MID_W - 2}
                    y1={Math.min(lvl.lineY, lvl.labelY - 3)}
                    y2={Math.max(lvl.lineY, lvl.labelY - 3)}
                    stroke={lvl.color}
                    strokeWidth={0.75}
                    opacity={0.4}
                  />
                )}
                <text
                  x={MID_X + MID_W - 4}
                  y={lvl.labelY}
                  textAnchor="end"
                  fontSize={10}
                  fontWeight={700}
                  fill={lvl.color}
                >
                  {lvl.label} {lvl.value.toFixed(2)}
                </text>
              </g>
            );
          })}

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
              // Label the playhead with the ET time of the minute you've
              // scrubbed to (e.g. "14:55") rather than "Now" — in a
              // historical replay the marker sits on a past moment, so the
              // actual clock time reads truer than any static word.
              label={cursorTimestamp ? formatTime(cursorTimestamp) : '—'}
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
  // Size the badge to the label so single-char pins ("A"/"B") stay compact
  // while a word like "Playhead" isn't clipped. Floor at 36 keeps the pin
  // badges the same width they were before this became variable.
  const badgeW = Math.max(36, label.length * 6.2 + 12);
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
        x={x - badgeW / 2}
        y={top - 18}
        width={badgeW}
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
