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

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Info, Sparkles } from "lucide-react";
import PageShell from "@/components/layout/PageShell";
import PairGammaHeatmap, { type HeatmapCell, type HeatmapColumnInput } from "@/components/PairGammaHeatmap";
import PairReplayScrubber from "@/components/PairReplayScrubber";
import PairCandleChart from "@/components/PairCandleChart";
import GexUnitToggle from "@/components/GexUnitToggle";
import BetaBadge from "@/components/BetaBadge";
import TooltipWrapper from "@/components/TooltipWrapper";
import ChartCaption from "@/components/ChartCaption";
import { type ChartTimeframe } from "@/components/ChartTimeframeSelect";
import { useApiData, useGEXSummary, useMarketQuote, useSessionCloses } from "@/hooks/useApiData";
import { usePairReplay, type PairReplayData, type ReplayFrame, type ReplayCandle } from "@/hooks/usePairReplay";
import { useGexUnit } from "@/core/GexUnitContext";
import { useTimeframe, type UnderlyingSymbol } from "@/core/TimeframeContext";
import { SYMBOLS } from "@/core/symbols";
import { getPrimaryPriceChangeSummary } from "@/core/priceChange";

const TIMEFRAME_OPTIONS: Array<{ value: ChartTimeframe; label: string }> = [
  { value: "1min", label: "1m" },
  { value: "5min", label: "5m" },
  { value: "15min", label: "15m" },
  { value: "1hr", label: "1h" },
  { value: "1day", label: "1D" },
];

const STRIKE_FILTER_OPTIONS: Array<{ value: boolean; label: string }> = [
  { value: true, label: "Active" },
  { value: false, label: "All" },
];

const INFO_TEXT =
  "Compare two symbols' dealer-gamma structure side by side. The left ladder follows your header symbol; " +
  "pick any of SPY / QQQ / SPX / NDX to compare on the right. Both stay centered on spot and strike-aligned, " +
  "with the Gamma Flip, Call/Put Walls and Max Pain marked. Enter Replay to scrub the most-recent session " +
  "minute by minute (spot in replay is the underlying close for that minute; the change is vs the session open, " +
  "while live shows the day change from the prior close). The Strikes toggle shows only strikes carrying " +
  "dealer gamma (Active) or every listed strike near spot (All) — Active keeps high-priced chains like NDX, " +
  "which list a fine grid but concentrate open interest on the round strikes, from reading as sparse. " +
  "Net GEX is a modeled estimate of dealer gamma by strike — decision-support context only, not investment advice.";

// Default "compare against" symbol for each header symbol — its like-pair, so a
// fresh visit opens on a meaningful comparison (SPY↔QQQ, SPX↔NDX).
const COMPARE_DEFAULT: Record<UnderlyingSymbol, UnderlyingSymbol> = {
  SPY: "QQQ",
  QQQ: "SPY",
  SPX: "NDX",
  NDX: "SPX",
};

// ── Live-poll cadences ───────────────────────────────────────────────────────
// Pair Comparison is the app's heaviest page: it runs TWO live columns, each
// polling the GEX heatmap and summary, so its per-viewer request rate is ~2× a
// single-symbol dashboard. The website's BFF proxies straight to the API
// (ZEROGEX_API_BASE_URL, default 127.0.0.1:8000), bypassing the nginx response
// cache / request coalescing that fronts direct API traffic — so every poll from
// every viewer lands on a uvicorn worker. That is why the site-wide overload
// surfaced as 503s here first, on the gamma heatmap.
//
// The heatmap and summary go through useApiData as independent per-URL fetch
// loops (and the two columns are different symbols), so their cadence directly
// sets how many requests this page emits. The heatmap only changes on the
// analytics cycle (~60s) and is cached ~5s server-side (ANALYTICS_CACHE_TTL_
// SECONDS), so polling it every second just re-fetched byte-identical data;
// aligning the poll with that cache cuts the heaviest request type ~5× per
// column with no visible change to the surface. The summary (flip / walls /
// max-pain, also 60s-cycle) is kept a touch faster so its spot_price — the
// ladder marker and the candles' horizontal spot line — stays live-ish.
//
// Quotes are deliberately NOT rate-limited here: useMarketQuote already shares
// one deduplicated subscription per symbol (min interval across subscribers) and
// drops to a heartbeat once the WebSocket is serving that symbol, so the live
// candle tip keeps its 1 Hz feel without adding per-column HTTP load.
//
// NOTE: useApiData halves the nominal interval (REFRESH_ACCELERATION_FACTOR) with
// a 1s floor, so 10_000 → ~5s and 5_000 → ~2.5s effective.
const HEATMAP_REFRESH_MS = 10_000; // ~5s effective — matches the server GEX cache
const SUMMARY_REFRESH_MS = 5_000; // ~2.5s effective — keeps the spot marker live-ish

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

// Compact timeframe segmented control for the candle charts — the zg-gc-seg
// idiom the Gamma Chart's toolbar uses.
function TimeframeSeg({ value, onChange }: { value: ChartTimeframe; onChange: (v: ChartTimeframe) => void }) {
  return (
    <div className="zg-gc-seg" role="tablist" aria-label="Candle timeframe">
      {TIMEFRAME_OPTIONS.map((t) => (
        <button
          key={t.value}
          type="button"
          className="zg-gc-seg-btn"
          data-active={t.value === value}
          onClick={() => onChange(t.value)}
          aria-pressed={t.value === value}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

// Strike-filter segmented control for the ladders. "Active" hides strikes with
// no dealer gamma so the fixed-height window fills with real levels — the fix
// for high-priced chains (NDX) that list a fine grid but only accrue OI on the
// round strikes; "All" restores every listed strike near spot.
function StrikeFilterSeg({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="zg-gc-seg" role="tablist" aria-label="Strike filter">
      {STRIKE_FILTER_OPTIONS.map((t) => (
        <button
          key={String(t.value)}
          type="button"
          className="zg-gc-seg-btn"
          data-active={t.value === value}
          onClick={() => onChange(t.value)}
          aria-pressed={t.value === value}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

// Build the live-mode input for one column from the polling hooks.
function useLiveColumn(symbol: UnderlyingSymbol, enabled: boolean): Omit<HeatmapColumnInput, "control"> {
  const { data: summary } = useGEXSummary(symbol, SUMMARY_REFRESH_MS, enabled);
  const { data: hm, loading, error } = useApiData<HeatmapBucket[]>(heatmapUrl(symbol), { refreshInterval: HEATMAP_REFRESH_MS, enabled });
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
  const [loop, setLoop] = useState(true);
  const [timeframe, setTimeframe] = useState<ChartTimeframe>("5min");
  // Ladder strike filter — default to active-only so NDX (and any high-priced
  // chain with a fine listed grid) fills the window with real levels instead of
  // listed-but-empty strikes. Users can switch to "All" to see every strike.
  const [activeOnly, setActiveOnly] = useState(true);

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

  // Refs so the interval reads the latest cursor/loop without re-subscribing on
  // every scrub (which would reset the timer). Updated in passive effects.
  const cursorRef = useRef(cursor);
  const loopRef = useRef(loop);
  useEffect(() => {
    cursorRef.current = cursor;
  }, [cursor]);
  useEffect(() => {
    loopRef.current = loop;
  }, [loop]);

  // Auto-advance loop — the page owns it so one playhead drives both columns.
  // All setState lives in the interval callback body (not the effect body and
  // not inside another updater), so it never triggers the cascading-render or
  // impure-updater patterns. At the end it wraps to the open when Loop is on,
  // otherwise it stops.
  useEffect(() => {
    if (mode !== "replay" || !isPlaying || timeline.length === 0) return;
    const id = setInterval(() => {
      const cur = cursorRef.current < 0 ? timeline.length - 1 : cursorRef.current;
      if (cur + 1 >= timeline.length) {
        if (loopRef.current) setCursor(0);
        else setIsPlaying(false);
      } else {
        setCursor(cur + 1);
      }
    }, Math.max(40, Math.round(1000 / speed)));
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
    // Pressing Play from the end (or while following the latest) replays from
    // the session open rather than sitting parked on the final frame. Two plain
    // sequential setStates (not a setState nested in another updater) so a
    // StrictMode double-invoke can't double-queue the cursor reset.
    if (!isPlaying && (cursor < 0 || cursor >= lastIdx)) setCursor(0);
    setIsPlaying((p) => !p);
  };
  const step = (delta: number) => {
    setIsPlaying(false);
    setCursor(Math.max(0, Math.min(lastIdx, effCursor + delta)));
  };
  const scrub = (i: number) => {
    setIsPlaying(false);
    setCursor(i);
  };

  // Keep the two columns distinct: picking the other column's current symbol
  // swaps them rather than showing a symbol compared against itself. Column 1's
  // dropdown drives the global header symbol, so its swap moves the header too.
  const changeSym1 = (s: UnderlyingSymbol) => {
    if (s === sym2) setSym2(sym1);
    setSymbol(s);
  };
  const changeSym2 = (s: UnderlyingSymbol) => {
    if (s === sym1) setSymbol(sym2);
    setSym2(s);
  };

  const cursorTs = timeline[effCursor] ?? null;

  // The React Compiler auto-memoizes these granularly (replayColumn only
  // re-scans when its inputs actually change), so we keep the code plain.
  const leftData = mode === "live" ? live1 : replayColumn(sym1, replay1, cursorTs);
  const rightData = mode === "live" ? live2 : replayColumn(sym2, replay2, cursorTs);

  const leftInput: HeatmapColumnInput = {
    ...leftData,
    control: <SymbolSelect value={sym1} onChange={changeSym1} ariaLabel="Column 1 symbol (follows the header)" />,
  };
  const rightInput: HeatmapColumnInput = {
    ...rightData,
    control: <SymbolSelect value={sym2} onChange={changeSym2} ariaLabel="Column 2 symbol to compare" />,
  };

  return (
    <PageShell width="wide">
      {/* Hero — compact: the descriptive subtext now lives in the info tooltip. */}
      <header className="mb-5">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles size={14} style={{ color: "var(--color-brand-primary)" }} />
          <span className="zg-eyebrow" style={{ color: "var(--color-brand-primary)" }}>
            Dealer gamma · side by side
          </span>
        </div>
        <div className="flex items-center gap-2.5">
          <h1 className="zg-h1" style={{ margin: 0 }}>Pair Comparison</h1>
          <BetaBadge size="md" />
          <TooltipWrapper text={INFO_TEXT} placement="bottom" />
        </div>
      </header>

      {/* Global controls: candle timeframe · ladder strike filter (left) · GEX unit (right) */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <span className="zg-eyebrow" style={{ fontSize: 10 }}>Candles</span>
        <TimeframeSeg value={timeframe} onChange={setTimeframe} />
        <span className="zg-eyebrow" style={{ fontSize: 10 }}>Strikes</span>
        <div className="inline-flex items-center gap-1.5">
          <StrikeFilterSeg value={activeOnly} onChange={setActiveOnly} />
          <TooltipWrapper text="Active hides strikes with no dealer gamma (net GEX 0), so the ladder fills with real levels — high-priced chains like NDX list a fine strike grid but only accrue open interest on the round 25-pt strikes. All shows every listed strike near spot.">
            <Info size={13} style={{ color: "var(--text-muted)" }} />
          </TooltipWrapper>
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <span className="zg-eyebrow" style={{ fontSize: 10 }}>GEX unit</span>
          <GexUnitToggle showHint={false} />
        </div>
      </div>

      {/* One rectangular instrument: narrow strike-aligned ladders on the left,
          the two candle charts stacked on the right to fill the space, and the
          replay transport spanning the bottom — one playhead drives all four. */}
      <div className="zg-feature-shell zg-gc-rise" style={{ overflow: "hidden" }}>
        <div className="flex flex-col lg:flex-row">
          {/* Left: the two gamma ladders (narrowed) */}
          <div className="w-full lg:w-[340px] lg:flex-none border-b lg:border-b-0 lg:border-r border-[var(--border-default)]">
            <PairGammaHeatmap left={leftInput} right={rightInput} gexUnit={gexUnit} activeOnly={activeOnly} />
          </div>

          {/* Right: stacked candles — top = header symbol, bottom = compare
              symbol — scrubbing in lockstep with the ladders during Replay. */}
          <div className="flex-1 min-w-0 flex flex-col">
            <div className="border-b border-[var(--border-default)]">
              <PairCandleChart
                symbol={sym1}
                timeframe={timeframe}
                embedded
                replay={{
                  active: mode === "replay",
                  candles: replay1.candles,
                  cursorTs,
                  loading: replay1.loading,
                  levels: { spot: leftData.spot, flip: leftData.gammaFlip, call: leftData.callWall, put: leftData.putWall, pain: leftData.maxPain },
                }}
              />
            </div>
            <PairCandleChart
              symbol={sym2}
              timeframe={timeframe}
              embedded
              replay={{
                active: mode === "replay",
                candles: replay2.candles,
                cursorTs,
                loading: replay2.loading,
                levels: { spot: rightData.spot, flip: rightData.gammaFlip, call: rightData.callWall, put: rightData.putWall, pain: rightData.maxPain },
              }}
            />
          </div>
        </div>

        {/* Replay transport — spans the full width; drives both ladders and both
            candle charts together. */}
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
          loop={loop}
          onLoopToggle={() => setLoop((l) => !l)}
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
        <ChartCaption variant="strip" right="Pair / Gamma" />
      </div>
    </PageShell>
  );
}
