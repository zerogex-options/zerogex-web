"use client";

/**
 * Pair Comparison — two premium, strike-aligned Net-GEX ladders side by side.
 *
 * Column 1 tracks the symbol selected in the app header (the global symbol
 * context); column 2 is free-select via its own dropdown, so you can compare
 * the dealer-gamma structure of any two of SPY / QQQ / SPX / NDX. Both stay
 * centered on the latest spot and update in realtime — or drop into Replay to
 * scrub the most-recent session and watch the gamma levels migrate minute by
 * minute, a single playhead driving both columns in lockstep.
 */

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Sparkles } from "lucide-react";
import PageShell from "@/components/layout/PageShell";
import PairGammaHeatmap, { type HeatmapCell, type HeatmapColumnInput } from "@/components/PairGammaHeatmap";
import PairReplayScrubber from "@/components/PairReplayScrubber";
import GexUnitToggle from "@/components/GexUnitToggle";
import BetaBadge from "@/components/BetaBadge";
import { useApiData, useGEXSummary, useMarketQuote, useSessionCloses } from "@/hooks/useApiData";
import { usePairReplay, type PairReplayData, type ReplayFrame, type ReplayCandle } from "@/hooks/usePairReplay";
import { useGexUnit } from "@/core/GexUnitContext";
import { useTimeframe, type UnderlyingSymbol } from "@/core/TimeframeContext";
import { SYMBOLS } from "@/core/symbols";
import { getPrimaryPriceChangeSummary } from "@/core/priceChange";

// Default "compare against" symbol for each header symbol — its like-pair, so a
// fresh visit opens on a meaningful comparison (SPY↔QQQ, SPX↔NDX).
const COMPARE_DEFAULT: Record<UnderlyingSymbol, UnderlyingSymbol> = {
  SPY: "QQQ",
  QQQ: "SPY",
  SPX: "NDX",
  NDX: "SPX",
};

interface HeatmapBucket {
  timestamp: string;
  heatmap?: HeatmapCell[];
}

// Freshest non-empty per-strike column (an empty after-hours tip mustn't blank it).
function latestHeatmap(buckets: HeatmapBucket[] | null | undefined): HeatmapCell[] {
  if (!Array.isArray(buckets)) return [];
  for (let i = buckets.length - 1; i >= 0; i -= 1) {
    const h = buckets[i]?.heatmap;
    if (Array.isArray(h) && h.length > 0) return h;
  }
  return [];
}

function heatmapUrl(symbol: string): string {
  const s = encodeURIComponent(symbol);
  return `/api/gex/heatmap?symbol=${s}&underlying=${s}&timeframe=5min&window_units=6`;
}

// Last replay frame at-or-before a timestamp (frames are chronological ascending).
function frameAtOrBefore(frames: ReplayFrame[], targetTs: string | null): ReplayFrame | null {
  if (!frames.length || !targetTs) return frames[frames.length - 1] ?? null;
  const t = Date.parse(targetTs);
  let best: ReplayFrame | null = null;
  for (const f of frames) {
    if (Date.parse(f.timestamp) <= t) best = f;
    else break;
  }
  return best ?? frames[0];
}

function closeAtOrBefore(candles: ReplayCandle[], targetTs: string | null): number | null {
  if (!candles.length || !targetTs) return null;
  const t = Date.parse(targetTs);
  let best: number | null = null;
  for (const c of candles) {
    if (Date.parse(c.timestamp) <= t && c.close != null && Number.isFinite(c.close)) best = c.close;
    else if (Date.parse(c.timestamp) > t) break;
  }
  return best;
}

function firstOpen(candles: ReplayCandle[]): number | null {
  for (const c of candles) {
    if (c.open != null && Number.isFinite(c.open)) return c.open;
  }
  return null;
}

function frameToCells(frame: ReplayFrame | null): HeatmapCell[] {
  if (!frame) return [];
  const out: HeatmapCell[] = [];
  for (const s of frame.strikes ?? []) {
    if (s.strike != null && s.net_gex != null && Number.isFinite(s.strike)) {
      out.push({ strike: s.strike, net_gex: s.net_gex });
    }
  }
  return out;
}

// A styled native dropdown — this is literally the "dropdown at the top of the
// column" the design calls for; column 1's is wired to the global header symbol
// so changing it here also moves the app header.
function SymbolSelect({
  value,
  onChange,
  ariaLabel,
}: {
  value: UnderlyingSymbol;
  onChange: (s: UnderlyingSymbol) => void;
  ariaLabel: string;
}) {
  return (
    <div className="relative inline-flex items-center">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as UnderlyingSymbol)}
        aria-label={ariaLabel}
        className="appearance-none font-mono font-bold"
        style={{
          fontSize: 14,
          letterSpacing: "0.04em",
          color: "var(--text-primary)",
          background: "var(--bg-card)",
          border: "1px solid var(--border-default)",
          borderRadius: "var(--radius-control)",
          padding: "3px 22px 3px 8px",
          cursor: "pointer",
        }}
      >
        {SYMBOLS.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
      <ChevronDown size={13} style={{ position: "absolute", right: 5, pointerEvents: "none", color: "var(--text-secondary)" }} />
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col">
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 20, fontWeight: 700, color: "var(--text-primary)", lineHeight: 1.1 }}>{value}</span>
      <span className="zg-eyebrow" style={{ fontSize: 10, marginTop: 2 }}>{label}</span>
    </div>
  );
}

// Build the live-mode input for one column from the polling hooks.
function useLiveColumn(symbol: UnderlyingSymbol, enabled: boolean): Omit<HeatmapColumnInput, "control"> {
  const { data: summary } = useGEXSummary(symbol, 1000, enabled);
  const { data: hm, loading, error } = useApiData<HeatmapBucket[]>(heatmapUrl(symbol), { refreshInterval: 1000, enabled });
  const { data: quote } = useMarketQuote(symbol, 1000, enabled);
  const { data: closes } = useSessionCloses(symbol, 60000, quote?.session ?? null, enabled);

  return useMemo(() => {
    const change = getPrimaryPriceChangeSummary({
      quoteClose: quote?.close ?? null,
      quoteSession: quote?.session ?? null,
      sessionCloses: closes ?? null,
      displaySource: quote?.display_source ?? null,
      futuresClose: quote?.futures_close ?? null,
      futuresReferenceClose: quote?.futures_reference_close ?? null,
    });
    return {
      symbol,
      cells: latestHeatmap(hm),
      spot: summary?.spot_price ?? null,
      gammaFlip: summary?.gamma_flip ?? null,
      callWall: summary?.call_wall ?? null,
      putWall: summary?.put_wall ?? null,
      maxPain: summary?.max_pain ?? null,
      changePercent: change.changePercent,
      isPositive: change.isPositive,
      loading,
      error,
    };
  }, [symbol, hm, summary, quote, closes, loading, error]);
}

// Build the replay-mode input for one column at the shared playhead timestamp.
function replayColumn(
  symbol: UnderlyingSymbol,
  replay: PairReplayData,
  cursorTs: string | null,
): Omit<HeatmapColumnInput, "control"> {
  const frame = frameAtOrBefore(replay.frames, cursorTs);
  const spot = closeAtOrBefore(replay.candles, frame?.timestamp ?? cursorTs);
  const open = firstOpen(replay.candles);
  const changePercent = spot != null && open != null && open !== 0 ? ((spot - open) / open) * 100 : null;
  return {
    symbol,
    cells: frameToCells(frame),
    spot,
    gammaFlip: frame?.gamma_flip ?? null,
    callWall: frame?.call_wall ?? null,
    putWall: frame?.put_wall ?? null,
    maxPain: frame?.max_pain ?? null,
    changePercent,
    isPositive: changePercent != null ? changePercent >= 0 : undefined,
    loading: replay.loading && !frame,
    error: replay.error,
  };
}

export default function PairComparisonClient() {
  const { symbol: headerSymbol, setSymbol } = useTimeframe();
  const { gexUnit } = useGexUnit();

  const sym1 = headerSymbol;
  const [sym2, setSym2] = useState<UnderlyingSymbol>(() => COMPARE_DEFAULT[headerSymbol] ?? "QQQ");

  const [mode, setMode] = useState<"live" | "replay">("live");
  // Sticky: once replay is armed the session buffers stay mounted so toggling
  // Live⇄Replay is instant instead of refetching each time.
  const [replayArmed, setReplayArmed] = useState(false);
  // -1 is the "follow the latest frame" sentinel — it resolves to the most
  // recent minute until the user scrubs, so entering Replay opens on "now".
  const [cursor, setCursor] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(4);

  const liveEnabled = mode === "live";
  const live1 = useLiveColumn(sym1, liveEnabled);
  const live2 = useLiveColumn(sym2, liveEnabled);
  const replay1 = usePairReplay(sym1, replayArmed, mode === "replay");
  const replay2 = usePairReplay(sym2, replayArmed, mode === "replay");

  // Master timeline — column 1's per-minute frames (fall back to column 2 if
  // column 1 has none). Both columns resolve their own frame at the shared ts.
  const timeline = useMemo(() => {
    const src = replay1.frames.length ? replay1.frames : replay2.frames;
    return src.map((f) => f.timestamp);
  }, [replay1.frames, replay2.frames]);

  const replayLoading = replay1.loading || replay2.loading;
  const replayError = replay1.error || replay2.error;
  const sessionDate = replay1.date ?? replay2.date;
  const isToday = replay1.isToday || replay2.isToday;

  const lastIdx = Math.max(0, timeline.length - 1);
  const effCursor = cursor < 0 ? lastIdx : Math.min(cursor, lastIdx);

  // Auto-advance loop — the page owns it so one playhead drives both columns.
  // setState lives in the interval callback (not the effect body), so it never
  // triggers the cascading-render pattern.
  useEffect(() => {
    if (mode !== "replay" || !isPlaying || timeline.length === 0) return;
    const id = setInterval(() => {
      setCursor((c) => {
        const cur = c < 0 ? timeline.length - 1 : c;
        return cur + 1 >= timeline.length ? 0 : cur + 1;
      });
    }, Math.max(120, Math.round(700 / speed)));
    return () => clearInterval(id);
  }, [mode, isPlaying, speed, timeline.length]);

  const enterReplay = () => {
    setReplayArmed(true);
    setCursor(-1);
    setMode("replay");
  };
  const exitReplay = () => {
    setMode("live");
    setIsPlaying(false);
  };
  const togglePlay = () => {
    setIsPlaying((p) => {
      const next = !p;
      // Pressing Play from the end (or while following the latest) replays from
      // the session open rather than sitting parked on the final frame.
      if (next) setCursor((c) => (c < 0 || c >= lastIdx ? 0 : c));
      return next;
    });
  };
  const step = (delta: number) => {
    setIsPlaying(false);
    setCursor(Math.max(0, Math.min(lastIdx, effCursor + delta)));
  };
  const scrub = (i: number) => {
    setIsPlaying(false);
    setCursor(i);
  };

  const cursorTs = timeline[effCursor] ?? null;

  const leftData = mode === "live" ? live1 : replayColumn(sym1, replay1, cursorTs);
  const rightData = mode === "live" ? live2 : replayColumn(sym2, replay2, cursorTs);

  const leftInput: HeatmapColumnInput = {
    ...leftData,
    control: <SymbolSelect value={sym1} onChange={setSymbol} ariaLabel="Column 1 symbol (follows the header)" />,
  };
  const rightInput: HeatmapColumnInput = {
    ...rightData,
    control: <SymbolSelect value={sym2} onChange={setSym2} ariaLabel="Column 2 symbol to compare" />,
  };

  return (
    <PageShell width="wide">
      {/* Hero */}
      <header className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles size={14} style={{ color: "var(--color-brand-primary)" }} />
          <span className="zg-eyebrow" style={{ color: "var(--color-brand-primary)" }}>
            Dealer gamma · side by side
          </span>
        </div>
        <div className="flex items-center gap-3 mb-3">
          <h1 className="zg-h1" style={{ margin: 0 }}>Pair Comparison</h1>
          <BetaBadge size="md" />
        </div>
        <p style={{ fontSize: 15, lineHeight: 1.65, color: "var(--text-secondary)", maxWidth: 760 }}>
          Read the dealer-gamma structure of two symbols against each other. The left column tracks the
          symbol in your header; pick anything to compare on the right. Both stay centered on spot and
          strike-aligned, with the Gamma Flip, Call/Put Walls and Max&nbsp;Pain marked — or drop into
          Replay to scrub the most-recent session and watch the levels migrate minute by minute.
        </p>
        <div className="flex flex-wrap items-center gap-x-8 gap-y-3 mt-5">
          <Stat value="SPY · QQQ · SPX · NDX" label="Underlyings" />
          <Stat value="Live + Replay" label="Two modes" />
          <Stat value="Centered on spot" label="Strike-aligned" />
        </div>
      </header>

      {/* The instrument */}
      <div className="zg-feature-shell zg-gc-rise" style={{ overflow: "hidden" }}>
        {/* Toolbar band */}
        <div
          className="flex flex-wrap items-center justify-between gap-3 p-3 sm:p-4"
          style={{ borderBottom: "1px solid var(--border-default)", background: "var(--bg-subtle)" }}
        >
          <span className="zg-eyebrow">Net GEX by strike · centered on spot</span>
          <div className="flex items-center gap-2 ml-auto">
            <span className="zg-eyebrow" style={{ fontSize: 10 }}>GEX unit</span>
            <GexUnitToggle showHint={false} />
          </div>
        </div>

        {/* Two strike-aligned ladders (each carries its own symbol dropdown header) */}
        <PairGammaHeatmap left={leftInput} right={rightInput} gexUnit={gexUnit} />

        {/* Replay transport */}
        <PairReplayScrubber
          mode={mode}
          onEnterReplay={enterReplay}
          onExitReplay={exitReplay}
          frameCount={timeline.length}
          cursor={effCursor}
          onScrub={scrub}
          isPlaying={isPlaying}
          onPlayToggle={togglePlay}
          onStep={step}
          speed={speed}
          onSpeedChange={setSpeed}
          cursorTime={cursorTs}
          startTime={timeline[0] ?? null}
          endTime={timeline[timeline.length - 1] ?? null}
          sessionDate={sessionDate}
          isToday={isToday}
          loading={replayLoading}
          error={replayError}
        />
      </div>

      <p className="mt-6" style={{ fontSize: 11.5, lineHeight: 1.6, color: "var(--text-muted)", maxWidth: 820 }}>
        Net GEX is a modeled estimate of dealer gamma by strike derived from the options chain; the two columns
        are aligned by strike offset from each symbol&apos;s spot-nearest strike, not by absolute price. Replay shows
        the most-recent session&apos;s per-minute frames; spot during replay is the underlying close for that minute.
        Decision-support context only — not a guarantee of price behavior, and not investment advice.
      </p>
    </PageShell>
  );
}
